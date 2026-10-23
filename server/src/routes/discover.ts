import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { verifySessionToken } from '../middleware/auth';
import { isRegion, parseProInterest, cleanText } from '../lib/discover/model';
import { discoverCache } from '../lib/discover/sync';
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

// GET /api/discover?region=ge&days=7 — événements à venir, idées de sorties et sources (licences à afficher)
router.get('/', async (req, res) => {
  const region = isRegion(req.query.region) ? req.query.region : 'ge';
  const days = Math.min(31, Math.max(1, Number(req.query.days) || 7));
  const key = `${region}|${days}`;
  const hit = discoverCache.get(key);
  // Pas de copie dans le navigateur : la mémoire du serveur (vidée à chaque synchronisation) suffit
  res.set('Cache-Control', 'no-cache');
  if (hit && Date.now() - hit.at < CACHE_MS) { res.json(hit.body); return; }
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 3600e3);
  const [events, places, sources] = await Promise.all([
    prisma.discoverEvent.findMany({
      where: { region, state: 'published', startAt: { lte: until }, OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: new Date(now.getTime() - 3 * 3600e3) } }] },
      orderBy: { startAt: 'asc' },
      take: 1500,
      select: { id: true, title: true, place: true, city: true, category: true, family: true, priceText: true, status: true, startAt: true, endAt: true, multiDay: true, dateLabel: true, url: true, sourceId: true },
    }),
    prisma.discoverPlace.findMany({
      where: { region, state: 'published' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kind: true, city: true, website: true, family: true, sourceId: true },
    }),
    prisma.discoverSource.findMany({ where: { status: 'active' }, select: { id: true, name: true, type: true, attribution: true, license: true, licenseUrl: true, lastSyncAt: true } }),
  ]);
  const used = new Set([...events.map(e => e.sourceId), ...places.map(p => p.sourceId)]);
  const body = {
    region, from: now, until,
    events, places,
    sources: sources.filter(s => used.has(s.id)),
  };
  discoverCache.set(key, { at: Date.now(), body });
  res.json(body);
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
