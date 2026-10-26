import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { verifySessionToken } from '../middleware/auth';
import { isRegion, parseProInterest, cleanText } from '../lib/discover/model';
import { discoverCache } from '../lib/discover/sync';
import { boundingBox, distanceKm, nearestRegion, searchLocalities } from '../lib/discover/geo';
import { imageFile, isImageKey } from '../lib/discover/images';
import { dedupeEvents } from '../lib/discover/dedupe';
import { planSignup } from '../lib/discover/planPublish';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { escapeHtml } from '../lib/escapeHtml';

// « Découvrir » (lib/discover/) : lecture publique, sans compte. Aucune donnée sur la personne qui consulte.
const router = Router();
const ADMIN_EMAIL = process.env.REPORTS_EMAIL || 'info@evly.ch';

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de demandes, réessaie plus tard.' },
});

const CACHE_MS = 5 * 60 * 1000;

// Types de lieux connus des apps jusqu'à la 1.0.32 : elles affichent la clé brute (« discover.kinds.galerie ») pour les autres.
const LEGACY_KINDS = new Set(['escape', 'laser', 'bowling', 'trampoline', 'escalade', 'karting', 'minigolf', 'patinoire', 'piscine', 'arcade', 'parc', 'sport', 'animaux', 'musee']);
// Versions demandées par le client : sans `v` = apps ≤ 1.0.32 (anciens types de lieux seulement) ; `v=2` = apps 1.0.33 à
// 1.0.35 (tous les lieux, pas de crédit des partenaires sur les cartes) ; `v=3` = site et apps suivantes. Les clients sans
// crédit le reçoivent dans le texte du prix (vide pour ces sources).
const CREDITED = new Set(['geneversleep', 'partner', 'eventfrog']);
// Les clients connaissent les types `geneversleep` et `partner` pour le crédit : Eventfrog leur est présenté comme `partner`
const asPartner = (body: any) => ({ ...body, sources: body.sources.map((s: any) => s.type === 'eventfrog' ? { ...s, type: 'partner' } : s) });
const forClient = (body: any, v: unknown) => {
  if (v === '3') return asPartner(body);
  const credit = new Map<string, string>(body.sources.filter((s: any) => CREDITED.has(s.type)).map((s: any) => [s.id, s.attribution ?? s.name]));
  return asPartner({
    ...body,
    places: v === '2' ? body.places : body.places.filter((p: { kind: string }) => LEGACY_KINDS.has(p.kind)),
    events: body.events.map((e: any) => credit.has(e.sourceId) ? { ...e, priceText: e.priceText ? `${e.priceText} · ${credit.get(e.sourceId)}` : credit.get(e.sourceId) } : e),
  });
};

const RADII = [10, 25, 50];
// Position arrondie au centième (~1 km) : rien de plus précis n'est utile, et le cache reste partagé
function parsePoint(q: any): { lat: number; lon: number; radius: number } | null {
  const lat = Number(q.lat), lon = Number(q.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 45.6 || lat > 48 || lon < 5.8 || lon > 10.6) return null;
  const r = Number(q.radius);
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, radius: RADII.includes(r) ? r : 25 };
}

// GET /api/discover/img/<clé>.jpg — image d'un événement (copie chez nous, lib/discover/images.ts), public, en cache 1 an
router.get(/^\/img\/([0-9a-f-]{36})\.jpg$/, (req, res) => {
  const key = (req.params as any)[0] as string;
  if (!isImageKey(key)) { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('image/jpeg');
  res.sendFile(imageFile(key), err => { if (err && !res.headersSent) res.status(404).end(); });
});

// GET /api/discover/localities?q=nyo — « Ville ou village » de Découvrir (répertoire des localités de swisstopo, sur le serveur)
router.get('/localities', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(searchLocalities(q).map(l => ({ name: l.name, canton: l.canton, lat: l.lat, lon: l.lon })));
});

// GET /api/discover?lat=46.38&lon=6.24&radius=25&days=14 — événements à venir, idées de sorties et sources (licences à
// afficher) autour d'un point, avec la distance de chacun. Anciennes apps : ?region=ge (inchangé). La position n'est ni
// enregistrée ni journalisée.
router.get('/', async (req, res) => {
  const point = parsePoint(req.query);
  const region = point ? nearestRegion(point) : isRegion(req.query.region) ? req.query.region : 'ge';
  const days = Math.min(31, Math.max(1, Number(req.query.days) || 7));
  const key = point ? `${point.lat},${point.lon},${point.radius}|${days}` : `${region}|${days}`;
  if (discoverCache.size > 300) discoverCache.clear();
  const hit = discoverCache.get(key);
  // Pas de copie dans le navigateur : la mémoire du serveur (vidée à chaque synchronisation) suffit
  res.set('Cache-Control', 'no-cache');
  if (hit && Date.now() - hit.at < CACHE_MS) { res.json(forClient(hit.body, req.query.v)); return; }
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 3600e3);
  // Autour d'un point : tout ce qui est dans le rayon, plus les éléments sans position de la région la plus proche
  const box = point && boundingBox(point, point.radius);
  const near = box
    ? { OR: [{ latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLon, lte: box.maxLon } }, { latitude: null, region }] }
    : { region };
  const [allEvents, allPlaces, sources] = await Promise.all([
    prisma.discoverEvent.findMany({
      where: { AND: [near, { OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: new Date(now.getTime() - 3 * 3600e3) } }] }], state: 'published', startAt: { lte: until } },
      orderBy: { startAt: 'asc' },
      take: 3000,
      select: { id: true, title: true, place: true, city: true, category: true, family: true, priceText: true, status: true, startAt: true, endAt: true, multiDay: true, dateLabel: true, url: true, sourceId: true, planId: true, latitude: true, longitude: true, imageKey: true, imageCredit: true },
    }),
    prisma.discoverPlace.findMany({
      where: { ...near, state: 'published' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kind: true, city: true, address: true, website: true, family: true, sourceId: true, latitude: true, longitude: true },
    }),
    prisma.discoverSource.findMany({ where: { status: 'active' }, select: { id: true, name: true, type: true, attribution: true, license: true, licenseUrl: true, lastSyncAt: true } }),
  ]);
  // Annonces publiées depuis un Plan : inscription par son lien d'invitation, « complet » calculé en direct
  // Distance exacte (le rectangle déborde du cercle) ; sans position : pas de distance affichée
  const place = <T extends { latitude: number | null; longitude: number | null }>({ latitude, longitude, ...x }: T) => {
    const d = point && latitude != null && longitude != null ? distanceKm(point, { lat: latitude, lon: longitude }) : null;
    return { ...x, distanceKm: d == null ? null : Math.round(d * 10) / 10 };
  };
  const inRadius = (x: { distanceKm: number | null }) => !point || x.distanceKm == null || x.distanceKm <= point.radius;
  const typeOf = new Map(sources.map(s => [s.id, s.type]));
  const events = dedupeEvents(allEvents.filter(e => !point || e.latitude == null || e.longitude == null || distanceKm(point, { lat: e.latitude, lon: e.longitude }) <= point.radius), id => typeOf.get(id) ?? '')
    .map(place);
  const places = allPlaces.map(place).filter(inRadius);
  const withSignup = await Promise.all(events.map(async ({ planId, ...e }) => {
    if (!planId) return e;
    const s = await planSignup(planId);
    return s ? { ...e, signupPath: s.signupPath, status: s.full ? 'full' : e.status } : e;
  }));
  const used = new Set([...events.map(e => e.sourceId), ...places.map(p => p.sourceId)]);
  const body = {
    region, from: now, until, point,
    events: withSignup, places,
    sources: sources.filter(s => used.has(s.id)),
  };
  discoverCache.set(key, { at: Date.now(), body });
  res.json(forClient(body, req.query.v));
});

// POST /api/discover/report { eventId | placeId, message } — « Signaler une erreur » : email à l'équipe
router.post('/report', formLimiter, async (req, res) => {
  const { eventId, placeId } = req.body ?? {};
  const message = cleanText(req.body?.message, 500);
  const item = typeof eventId === 'string'
    ? await prisma.discoverEvent.findUnique({ where: { id: eventId }, select: { title: true, startAt: true, place: true, url: true } })
    : typeof placeId === 'string'
      ? await prisma.discoverPlace.findUnique({ where: { id: placeId }, select: { name: true, website: true, city: true } })
      : null;
  if (!item) { res.status(404).json({ error: 'Annonce introuvable' }); return; }
  const title = 'title' in item ? item.title : item.name;
  const r = await resend.emails.send({
    from: FROM_EMAIL, to: ADMIN_EMAIL,
    subject: `Découvrir : erreur signalée (${title.slice(0, 60)})`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Erreur signalée dans Découvrir</h2>
      <p><b>${escapeHtml(title)}</b></p>
      ${message ? `<p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px">${escapeHtml(message)}</p>` : '<p>(sans message)</p>'}
      <a href="${APP_URL}/admin" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Ouvrir le panneau admin</a>
    </div>`,
  });
  if (r.error) console.error('[discover report]', r.error);
  res.json({ ok: true });
});

function optionalUserId(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const p = verifySessionToken(h.slice(7));
  return p && !p.light ? p.userId : null;
}

// POST /api/discover/pro-interest — « Poster un événement public » (prochainement) : être prévenu
router.post('/pro-interest', formLimiter, async (req, res) => {
  const parsed = parseProInterest(req.body);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const userId = optionalUserId(req);
  await prisma.proInterest.create({ data: { ...parsed.data, userId } });
  const d = parsed.data;
  const r = await resend.emails.send({
    from: FROM_EMAIL, to: ADMIN_EMAIL,
    subject: `Découvrir : un organisateur veut publier (${d.company ?? d.name})`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Demande « Poster un événement public »</h2>
      <p>${escapeHtml(d.name)}${d.company ? ` · ${escapeHtml(d.company)}` : ''}${d.city ? ` · ${escapeHtml(d.city)}` : ''}<br>${escapeHtml(d.email)}</p>
      ${d.message ? `<p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px">${escapeHtml(d.message)}</p>` : ''}
    </div>`,
  });
  if (r.error) console.error('[pro interest email]', r.error);
  res.json({ ok: true });
});

export default router;
