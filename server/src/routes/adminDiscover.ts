import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { isRegion, isState, parseManualEvent, parseManualPlace, cleanText, cleanUrl, isCategory } from '../lib/discover/model';
import { withCoords } from '../lib/discover/geo';
import { syncSource, discoverCache } from '../lib/discover/sync';
import { DEFAULT_SOURCE_KEYS } from '../lib/discover/defaults';
import { imageFile } from '../lib/discover/images';
import { promises as fsp } from 'fs';
import { openAgendaLicense, searchOpenAgendas } from '../lib/discover/openagenda';

// Panneau admin « Découvrir » : sources, file « À valider », saisie manuelle, lieux masqués, organisateurs intéressés
const router = Router();
router.use(requireAuth as any);
router.use(requireAdmin as any);

const SOURCE_STATUSES = ['active', 'pending', 'disabled'];

router.get('/sources', async (_req, res) => {
  const sources = await prisma.discoverSource.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  const counts = await prisma.discoverEvent.groupBy({ by: ['sourceId', 'state'], _count: true });
  const places = await prisma.discoverPlace.groupBy({ by: ['sourceId'], _count: true });
  res.json(sources.map(s => ({
    ...s,
    events: Object.fromEntries(counts.filter(c => c.sourceId === s.id).map(c => [c.state, c._count])),
    places: places.find(p => p.sourceId === s.id)?._count ?? 0,
    deletable: !DEFAULT_SOURCE_KEYS.has(s.key),
  })));
});

// PUT /sources/:id { status?, autoPublish?, name?, attribution?, region? }
router.put('/sources/:id', async (req: AuthRequest, res) => {
  const b = req.body ?? {};
  const data: any = {};
  if (b.status !== undefined) { if (!SOURCE_STATUSES.includes(b.status)) { res.status(400).json({ error: 'État invalide' }); return; } data.status = b.status; }
  if (typeof b.autoPublish === 'boolean') data.autoPublish = b.autoPublish;
  if (b.name !== undefined) { const n = cleanText(b.name, 80); if (!n) { res.status(400).json({ error: 'Nom requis' }); return; } data.name = n; }
  if (b.attribution !== undefined) data.attribution = cleanText(b.attribution, 120);
  if (b.region !== undefined) { if (b.region !== null && !isRegion(b.region)) { res.status(400).json({ error: 'Région invalide' }); return; } data.region = b.region; }
  const s = await prisma.discoverSource.update({ where: { id: req.params.id }, data }).catch(() => null);
  if (!s) { res.status(404).json({ error: 'Source introuvable' }); return; }
  // Source coupée : ses annonces disparaissent de Découvrir (gardées, réapparaissent si elle est réactivée)
  discoverCache.clear();
  res.json(s);
});

// POST /sources { type: 'openagenda', agendaUid, region } | { type: 'ical', url, region, category?, city? }
router.post('/sources', async (req, res) => {
  const b = req.body ?? {};
  if (!isRegion(b.region)) { res.status(400).json({ error: 'Région invalide' }); return; }
  if (b.type === 'openagenda') {
    const uid = Number(b.agendaUid);
    if (!Number.isInteger(uid) || uid <= 0) { res.status(400).json({ error: 'Agenda invalide' }); return; }
    const info = await openAgendaLicense(uid).catch(() => null);
    if (!info) { res.status(400).json({ error: 'Agenda introuvable' }); return; }
    const s = await prisma.discoverSource.create({
      data: {
        key: `openagenda-${uid}`, name: cleanText(b.name, 80) ?? `${info.publisher ?? 'Agenda'} (OpenAgenda)`, type: 'openagenda', region: b.region,
        config: { agendaUid: uid, defaultCategory: isCategory(b.category) ? b.category : 'animation' },
        license: info.license, licenseUrl: info.licenseUrl, attribution: info.publisher,
        // Activée seulement à la main, après vérification de la licence
        status: 'pending', autoPublish: false,
      },
    }).catch(() => null);
    if (!s) { res.status(409).json({ error: 'Cette source existe déjà' }); return; }
    res.json(s);
    return;
  }
  if (b.type === 'ical') {
    const url = cleanUrl(b.url);
    if (!url) { res.status(400).json({ error: 'Lien invalide (il doit commencer par https://)' }); return; }
    const s = await prisma.discoverSource.create({
      data: {
        key: `ical-${randomUUID().slice(0, 8)}`, name: cleanText(b.name, 80) ?? new URL(url).hostname, type: 'ical', region: b.region,
        config: { url, category: isCategory(b.category) ? b.category : 'animation', city: cleanText(b.city, 60) },
        attribution: cleanText(b.attribution, 120) ?? new URL(url).hostname.replace(/^www\./, ''), status: 'pending', autoPublish: false,
      },
    });
    res.json(s);
    return;
  }
  res.status(400).json({ error: 'Type de source inconnu' });
});

// DELETE /sources/:id — source ajoutée dans le panneau admin (agenda OpenAgenda, flux iCal) : supprimée avec ses annonces, ses lieux
// et leurs images. Les sources de base ne se suppriment pas (recréées au démarrage) : les désactiver.
router.delete('/sources/:id', async (req, res) => {
  const s = await prisma.discoverSource.findUnique({ where: { id: req.params.id } });
  if (!s) { res.status(404).json({ error: 'Source introuvable' }); return; }
  if (DEFAULT_SOURCE_KEYS.has(s.key)) { res.status(400).json({ error: 'Source de base : elle ne se supprime pas, mets-la sur « Désactivée »' }); return; }
  const images = await prisma.discoverEvent.findMany({ where: { sourceId: s.id, imageKey: { not: null } }, select: { imageKey: true } });
  await prisma.discoverSource.delete({ where: { id: s.id } }); // annonces et lieux en cascade
  for (const i of images) await fsp.rm(imageFile(i.imageKey!), { force: true });
  discoverCache.clear();
  res.json({ ok: true });
});

router.post('/sources/:id/sync', async (req, res) => {
  const s = await prisma.discoverSource.findUnique({ where: { id: req.params.id } });
  if (!s) { res.status(404).json({ error: 'Source introuvable' }); return; }
  // Eventfrog : plusieurs minutes (toute la Suisse, 30 requêtes par minute au plus) → lancée en arrière-plan, le résultat
  // s'affiche ensuite sur la carte de la source (dernière synchronisation ou erreur)
  if (s.type === 'eventfrog') { syncSource(s).catch(e => console.error('[discover eventfrog]', e)); res.json({ started: true }); return; }
  res.json(await syncSource(s));
});

router.get('/openagenda-search', async (req, res) => {
  const q = cleanText(req.query.q, 60);
  if (!q) { res.json([]); return; }
  res.json(await searchOpenAgendas(q).catch(() => []));
});

// GET /events?state=pending&region=ge&manual=1&upcoming=1&q=…
router.get('/events', async (req, res) => {
  const where: any = {};
  if (isState(req.query.state)) where.state = req.query.state;
  if (isRegion(req.query.region)) where.region = req.query.region;
  if (req.query.manual === '1') where.source = { type: 'manual' };
  // À venir ou en cours (onglet « Événements » : masquer / réafficher)
  if (req.query.upcoming === '1') where.OR = [{ endAt: { gte: new Date() } }, { endAt: null, startAt: { gte: new Date(Date.now() - 6 * 3600e3) } }];
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (q) where.AND = [{ OR: ['title', 'place', 'city'].map(f => ({ [f]: { contains: q, mode: 'insensitive' } })) }];
  const events = await prisma.discoverEvent.findMany({ where, orderBy: { startAt: 'asc' }, take: 300, include: { source: { select: { name: true, type: true } } } });
  res.json(events);
});

// PUT /events/:id { state } — publier, masquer
router.put('/events/:id/state', async (req, res) => {
  if (!isState(req.body?.state)) { res.status(400).json({ error: 'État invalide' }); return; }
  const e = await prisma.discoverEvent.update({ where: { id: req.params.id }, data: { state: req.body.state } }).catch(() => null);
  if (!e) { res.status(404).json({ error: 'Annonce introuvable' }); return; }
  discoverCache.clear();
  res.json(e);
});

async function manualSourceId() {
  const s = await prisma.discoverSource.findUnique({ where: { key: 'manual' }, select: { id: true } });
  return s!.id;
}

// Saisie manuelle d'un événement (Lausanne, Valais, associations…) : faits seulement, lien vers l'organisateur
router.post('/events', async (req: AuthRequest, res) => {
  const p = parseManualEvent(req.body);
  if ('error' in p) { res.status(400).json({ error: p.error }); return; }
  const e = await prisma.discoverEvent.create({ data: { ...withCoords(p.data, p.data.region), externalId: randomUUID(), sourceId: await manualSourceId(), state: 'published', createdById: req.userId } });
  discoverCache.clear();
  res.json(e);
});

router.put('/events/:id', async (req, res) => {
  const cur = await prisma.discoverEvent.findUnique({ where: { id: req.params.id }, include: { source: { select: { type: true } } } });
  if (!cur || cur.source.type !== 'manual') { res.status(404).json({ error: 'Annonce introuvable' }); return; }
  const p = parseManualEvent(req.body);
  if ('error' in p) { res.status(400).json({ error: p.error }); return; }
  const e = await prisma.discoverEvent.update({ where: { id: cur.id }, data: withCoords({ ...p.data, latitude: null, longitude: null }, p.data.region) });
  discoverCache.clear();
  res.json(e);
});

router.delete('/events/:id', async (req, res) => {
  const cur = await prisma.discoverEvent.findUnique({ where: { id: req.params.id }, include: { source: { select: { type: true } } } });
  if (!cur || cur.source.type !== 'manual') { res.status(404).json({ error: 'Annonce introuvable' }); return; }
  await prisma.discoverEvent.delete({ where: { id: cur.id } });
  discoverCache.clear();
  res.json({ ok: true });
});

// Lieux (idées de sorties)
router.get('/places', async (req, res) => {
  const where: any = {};
  if (isRegion(req.query.region)) where.region = req.query.region;
  if (isState(req.query.state)) where.state = req.query.state;
  res.json(await prisma.discoverPlace.findMany({ where, orderBy: [{ kind: 'asc' }, { name: 'asc' }], include: { source: { select: { name: true, type: true } } } }));
});

router.put('/places/:id/state', async (req, res) => {
  if (req.body?.state !== 'published' && req.body?.state !== 'hidden') { res.status(400).json({ error: 'État invalide' }); return; }
  const p = await prisma.discoverPlace.update({ where: { id: req.params.id }, data: { state: req.body.state } }).catch(() => null);
  if (!p) { res.status(404).json({ error: 'Lieu introuvable' }); return; }
  discoverCache.clear();
  res.json(p);
});

router.post('/places', async (req, res) => {
  const p = parseManualPlace(req.body);
  if ('error' in p) { res.status(400).json({ error: p.error }); return; }
  const place = await prisma.discoverPlace.create({ data: { ...withCoords(p.data, p.data.region), externalId: randomUUID(), sourceId: await manualSourceId() } });
  discoverCache.clear();
  res.json(place);
});

router.delete('/places/:id', async (req, res) => {
  const cur = await prisma.discoverPlace.findUnique({ where: { id: req.params.id }, include: { source: { select: { type: true } } } });
  if (!cur || cur.source.type !== 'manual') { res.status(404).json({ error: 'Lieu introuvable' }); return; }
  await prisma.discoverPlace.delete({ where: { id: cur.id } });
  discoverCache.clear();
  res.json({ ok: true });
});

router.get('/pro-interests', async (_req, res) => {
  res.json(await prisma.proInterest.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { pseudo: true } } } }));
});

export default router;
