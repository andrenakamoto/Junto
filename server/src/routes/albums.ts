import { Router, Request } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import archiver from 'archiver';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest, verifySessionToken } from '../middleware/auth';
import { isSessionCurrent } from '../lib/sessions';
import { getPlanAccess } from '../lib/planAccess';
import { isCircleManager } from '../lib/circleRoles';
import { notifyUser } from '../lib/push';
import { diskTooFull } from '../lib/capsule';
import {
  ALBUM_MAX_PER_DEVICE, ALBUM_MAX_PHOTOS, ALBUM_PHOTO_SIZE, ALBUM_THUMB_SIZE, ALBUM_UPLOAD_MAX_BYTES, albumDir, albumFile, expiresFor,
  isAlbumToken, newAlbumToken, parseAuthorName, parseDeviceId, planAudience, removeAlbumDir, removeAlbumPhotoFiles,
} from '../lib/albums';

// Album souvenir (lib/albums.ts), sur /api/albums. Partie publique (/public/:token, /files/:token/…) sans compte : on y entre par
// le lien ou le QR code ; partie connectée pour l'organisation (créer depuis le Plan, nouveau lien, supprimer). Hors du routeur des
// Plans : l'album vit 7 jours après la soirée, alors que le Plan est effacé 24 h après sa fin.
const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ALBUM_UPLOAD_MAX_BYTES, files: 1 } });
const uploadOne = (req: any, res: any, next: any) => upload.single('photo')(req, res, (err: any) => {
  if (err?.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'Photo trop lourde' }); return; }
  if (err) { next(err); return; }
  next();
});
// Envois sans compte : au plus 120 photos par 30 minutes et par connexion (une soirée entière d'un téléphone passe largement)
const uploadLimiter = rateLimit({ windowMs: 30 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de photos envoyées en peu de temps : réessaie dans quelques minutes' } });

// Personne connectée, si la requête porte une session valable (sinon null : l'album reste ouvert sans compte)
async function optionalUser(req: Request): Promise<string | null> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  const p = verifySessionToken(token);
  if (!p || p.light) return null;
  return (await isSessionCurrent(p.userId, p.sv)) ? p.userId : null;
}

// Prénom (sinon pseudo) d'une personne connectée : utilisé à la place du prénom demandé aux personnes sans compte
async function accountName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, pseudo: true } });
  return u ? (u.firstName?.trim() || u.pseudo).slice(0, 30) : null;
}

type Album = NonNullable<Awaited<ReturnType<typeof byToken>>>;
const byToken = (token: unknown) => (isAlbumToken(token) ? prisma.photoAlbum.findUnique({ where: { token }, include: { plan: { select: { id: true, creatorId: true } } } }) : Promise.resolve(null));

async function canManage(userId: string | null, a: { createdById: string | null; circleId: string; plan: { creatorId: string } | null }) {
  if (!userId) return false;
  return a.createdById === userId || a.plan?.creatorId === userId || isCircleManager(userId, a.circleId);
}

// GET /api/albums/files/:token/:file — photo (<clé>.jpg) ou miniature (<clé>-s.jpg), sans session (balises <img>)
router.get('/files/:token/:file', async (req, res) => {
  const m = /^([0-9a-f-]{36})(-s)?\.jpg$/.exec(req.params.file);
  const a = m ? await byToken(req.params.token) : null;
  if (!m || !a) { res.status(404).end(); return; }
  const photo = await prisma.albumPhoto.findUnique({ where: { key: m[1] }, select: { albumId: true } });
  if (!photo || photo.albumId !== a.id) { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('image/jpeg');
  if (req.query.dl) res.setHeader('Content-Disposition', `attachment; filename="evly-${m[1].slice(0, 8)}.jpg"`);
  res.sendFile(albumFile(a.id, m[1], !!m[2]), err => { if (err && !res.headersSent) res.status(404).end(); });
});

// GET /api/albums/public/:token — l'album (en-tête x-album-device : l'appareil, pour « mes photos » et « mes cœurs »)
router.get('/public/:token', async (req, res) => {
  const a = await byToken(req.params.token);
  if (!a || a.expiresAt <= new Date()) { res.status(404).json({ error: 'Album introuvable' }); return; }
  const device = parseDeviceId(req.headers['x-album-device']);
  const me = await optionalUser(req);
  const manager = await canManage(me, a);
  // Personne connectée qui voit le Plan : bouton « Retour au Plan » ; son prénom remplace la question du prénom
  const [access, myName] = await Promise.all([me && a.planId ? getPlanAccess(me, a.planId) : null, accountName(me)]);
  const photos = await prisma.albumPhoto.findMany({
    where: { albumId: a.id, ...(manager ? {} : { hidden: false }) }, orderBy: { createdAt: 'desc' },
    include: { likes: { select: { deviceId: true } } },
  });
  res.json({
    id: a.id, title: a.title, token: a.token, eventEnd: a.eventEnd, expiresAt: a.expiresAt, planId: a.planId, canManage: manager,
    photoCount: photos.filter(p => !p.hidden).length,
    contributorCount: new Set(photos.filter(p => !p.hidden).map(p => p.deviceId)).size,
    myCount: device ? photos.filter(p => p.deviceId === device).length : 0, maxPerDevice: ALBUM_MAX_PER_DEVICE,
    full: photos.length >= ALBUM_MAX_PHOTOS,
    canOpenPlan: !!access?.canView, me: myName ? { name: myName } : null,
    photos: photos.map(p => ({
      id: p.id, key: p.key, width: p.width, height: p.height, author: p.authorName, createdAt: p.createdAt, hidden: p.hidden,
      likes: p.likes.length, liked: !!device && p.likes.some(l => l.deviceId === device), mine: !!device && p.deviceId === device,
    })),
  });
});

// POST /api/albums/public/:token/photos — ajouter une photo (multipart : photo, name ; en-tête x-album-device)
router.post('/public/:token/photos', uploadLimiter, uploadOne, async (req, res) => {
  const a = await byToken(req.params.token);
  if (!a || a.expiresAt <= new Date()) { res.status(404).json({ error: 'Album introuvable' }); return; }
  const device = parseDeviceId(req.headers['x-album-device']);
  const userId = await optionalUser(req);
  // Compte connecté : son prénom (pas celui du formulaire) ; sans compte : le prénom indiqué
  const name = (await accountName(userId)) ?? parseAuthorName(req.body?.name);
  if (!device) { res.status(400).json({ error: 'Appareil inconnu : recharge la page' }); return; }
  if (!name) { res.status(400).json({ error: 'Indique ton prénom' }); return; }
  const f = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
  if (!f || !f.mimetype.startsWith('image/')) { res.status(400).json({ error: 'Seules les photos sont acceptées' }); return; }
  const [total, mine] = await Promise.all([prisma.albumPhoto.count({ where: { albumId: a.id } }), prisma.albumPhoto.count({ where: { albumId: a.id, deviceId: device } })]);
  if (total >= ALBUM_MAX_PHOTOS) { res.status(400).json({ error: 'L’album est plein' }); return; }
  if (mine >= ALBUM_MAX_PER_DEVICE) { res.status(400).json({ error: `${ALBUM_MAX_PER_DEVICE} photos par personne au maximum` }); return; }
  if (await diskTooFull()) { res.status(507).json({ error: 'L’album est momentanément plein, réessaie plus tard' }); return; }
  let big: { data: Buffer; info: { width: number; height: number } }, small: Buffer;
  try {
    // Photo refaite par le serveur : redressée, 2048 px au plus, JPEG, sans métadonnées (position GPS comprise)
    const base = sharp(f.buffer, { limitInputPixels: 60_000_000 }).rotate();
    big = await base.clone().resize({ width: ALBUM_PHOTO_SIZE, height: ALBUM_PHOTO_SIZE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    small = await base.clone().resize({ width: ALBUM_THUMB_SIZE, height: ALBUM_THUMB_SIZE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  } catch (e) {
    console.error('[album photo]', (e as Error).message);
    res.status(400).json({ error: 'Cette photo n’a pas pu être lue' }); return;
  }
  const key = crypto.randomUUID();
  await fs.mkdir(albumDir(a.id), { recursive: true });
  await fs.writeFile(albumFile(a.id, key), big.data, { mode: 0o640 });
  await fs.writeFile(albumFile(a.id, key, true), small, { mode: 0o640 });
  const p = await prisma.albumPhoto.create({
    data: { albumId: a.id, key, width: big.info.width, height: big.info.height, size: big.data.length, authorName: name, authorId: userId, deviceId: device },
  });
  res.json({ id: p.id, key: p.key, width: p.width, height: p.height });
});

// DELETE /api/albums/public/:token/photos/:id — retirer sa photo (même appareil) ou, pour l'organisation, n'importe laquelle
router.delete('/public/:token/photos/:id', async (req, res) => {
  const a = await byToken(req.params.token);
  const p = a ? await prisma.albumPhoto.findUnique({ where: { id: req.params.id } }) : null;
  if (!a || !p || p.albumId !== a.id) { res.status(404).json({ error: 'Photo introuvable' }); return; }
  const device = parseDeviceId(req.headers['x-album-device']);
  if (!(device && device === p.deviceId) && !(await canManage(await optionalUser(req), a))) { res.status(403).json({ error: 'Seule la personne qui a ajouté la photo peut la retirer' }); return; }
  await removeAlbumPhotoFiles(a.id, p.key);
  await prisma.albumPhoto.delete({ where: { id: p.id } });
  res.json({ ok: true });
});

// PUT /api/albums/public/:token/photos/:id/hidden {hidden} — masquer / réafficher (organisation)
router.put('/public/:token/photos/:id/hidden', async (req, res) => {
  const a = await byToken(req.params.token);
  const p = a ? await prisma.albumPhoto.findUnique({ where: { id: req.params.id }, select: { id: true, albumId: true } }) : null;
  if (!a || !p || p.albumId !== a.id) { res.status(404).json({ error: 'Photo introuvable' }); return; }
  if (!(await canManage(await optionalUser(req), a))) { res.status(403).json({ error: 'Réservé à l’organisation' }); return; }
  await prisma.albumPhoto.update({ where: { id: p.id }, data: { hidden: req.body?.hidden === true } });
  res.json({ ok: true });
});

// POST /api/albums/public/:token/photos/:id/like — cœur (bascule, un par appareil)
router.post('/public/:token/photos/:id/like', async (req, res) => {
  const a = await byToken(req.params.token);
  const p = a ? await prisma.albumPhoto.findUnique({ where: { id: req.params.id }, select: { id: true, albumId: true } }) : null;
  const device = parseDeviceId(req.headers['x-album-device']);
  if (!a || !p || p.albumId !== a.id || !device) { res.status(404).json({ error: 'Photo introuvable' }); return; }
  const where = { photoId_deviceId: { photoId: p.id, deviceId: device } };
  const had = await prisma.albumPhotoLike.findUnique({ where });
  if (had) await prisma.albumPhotoLike.delete({ where }); else await prisma.albumPhotoLike.create({ data: { photoId: p.id, deviceId: device } }).catch(() => {});
  res.json({ liked: !had, likes: await prisma.albumPhotoLike.count({ where: { photoId: p.id } }) });
});

// GET /api/albums/public/:token/zip — toutes les photos visibles en ZIP
router.get('/public/:token/zip', async (req, res) => {
  const a = await byToken(req.params.token);
  if (!a || a.expiresAt <= new Date()) { res.status(404).json({ error: 'Album introuvable' }); return; }
  const photos = await prisma.albumPhoto.findMany({ where: { albumId: a.id, hidden: false }, orderBy: { createdAt: 'asc' } });
  if (!photos.length) { res.status(404).json({ error: 'Aucune photo dans l’album' }); return; }
  const zipName = `${a.title.replace(/[/\\:*?"<>|]/g, '_')} - album.zip`;
  const encoded = encodeURIComponent(zipName).replace(/'/g, '%27');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  const archive = archiver('zip', { store: true });
  archive.on('error', err => { console.error('[album zip]', err); res.destroy(err); });
  archive.pipe(res);
  photos.forEach((p, i) => archive.file(albumFile(a.id, p.key), { name: `${String(i + 1).padStart(3, '0')} - ${p.authorName.replace(/[/\\:*?"<>|]/g, '_')}.jpg` }));
  await archive.finalize();
});

// ---------------------------------------------------------------- organisation (connectée)
router.use(requireAuth as any);

const shapeOwn = (a: Album | { id: string; token: string; expiresAt: Date; title: string }, count: number) => ({ id: a.id, token: a.token, expiresAt: a.expiresAt, title: a.title, photoCount: count });

// GET /api/albums/plan/:planId — l'album du Plan (carte de l'onglet Infos)
router.get('/plan/:planId', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.planId);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = access.plan;
  const manager = plan.creatorId === req.userId || await isCircleManager(req.userId!, plan.circleId);
  const a = await prisma.photoAlbum.findUnique({ where: { planId: plan.id } });
  const count = a ? await prisma.albumPhoto.count({ where: { albumId: a.id, hidden: false } }) : 0;
  res.json({ album: a ? shapeOwn(a, count) : null, canCreate: manager && !a, canManage: manager });
});

// POST /api/albums/plan/:planId — ouvrir l'album (créateur du Plan, organisateurs du Cercle)
router.post('/plan/:planId', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.planId);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = await prisma.plan.findUnique({ where: { id: access.plan.id }, select: { id: true, title: true, circleId: true, creatorId: true, endDate: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!(plan.creatorId === req.userId || await isCircleManager(req.userId!, plan.circleId))) { res.status(403).json({ error: 'Réservé au créateur du Plan et aux organisateurs du Cercle' }); return; }
  if (await prisma.photoAlbum.findUnique({ where: { planId: plan.id }, select: { id: true } })) { res.status(409).json({ error: 'Ce Plan a déjà un album' }); return; }
  const audienceIds = await planAudience(plan.id);
  const a = await prisma.photoAlbum.create({
    data: { planId: plan.id, circleId: plan.circleId, title: plan.title, token: newAlbumToken(), createdById: req.userId!, eventEnd: plan.endDate, expiresAt: expiresFor(plan.endDate), audienceIds },
  });
  res.json({ album: shapeOwn(a, 0) });
  // Les participants sont prévenus (app + push), comme une activité du Plan (rubrique Infos)
  const io = req.app.get('io');
  for (const userId of audienceIds) if (userId !== req.userId) {
    notifyUser(io, userId, { type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: 'infos', preview: `📸 @${req.pseudo} a ouvert l’album souvenir : ajoute tes photos`, from: req.pseudo, actorId: req.userId });
  }
});

async function ownAlbum(req: AuthRequest, res: any) {
  const a = await prisma.photoAlbum.findUnique({ where: { id: req.params.id }, include: { plan: { select: { id: true, creatorId: true } } } });
  if (!a) { res.status(404).json({ error: 'Album introuvable' }); return null; }
  if (!(await canManage(req.userId!, a))) { res.status(403).json({ error: 'Réservé à l’organisation' }); return null; }
  return a;
}

// POST /api/albums/:id/token — nouveau lien (l'ancien lien et l'ancien QR code ne marchent plus)
router.post('/:id/token', async (req: AuthRequest, res) => {
  const a = await ownAlbum(req, res);
  if (!a) return;
  const b = await prisma.photoAlbum.update({ where: { id: a.id }, data: { token: newAlbumToken() } });
  res.json({ album: shapeOwn(b, await prisma.albumPhoto.count({ where: { albumId: b.id, hidden: false } })) });
});

// DELETE /api/albums/:id — supprimer l'album et toutes ses photos
router.delete('/:id', async (req: AuthRequest, res) => {
  const a = await ownAlbum(req, res);
  if (!a) return;
  await removeAlbumDir(a.id);
  await prisma.photoAlbum.delete({ where: { id: a.id } });
  res.json({ ok: true });
});

export default router;
