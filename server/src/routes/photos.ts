import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { isCircleManager } from '../lib/circleRoles';
import { avatarsSeenBy, canSeePhotoOf, deletePhoto, isPhotoKey, photoFile, PHOTO_MAX_BYTES, savePhoto } from '../lib/photos';
import { notifyAdmins, REPORT_REASON_MAX } from '../lib/moderation';

// Photos de profil et de Cercle — voir lib/photos.ts
const router = Router();

// GET /api/photos/<clé>.jpg | <clé>-s.jpg — public (clé impossible à deviner), en cache longue durée
router.get(/^\/([0-9a-f-]{36})(-s)?\.jpg$/, (req, res) => {
  const key = (req.params as any)[0] as string;
  if (!isPhotoKey(key)) { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('image/jpeg');
  res.sendFile(photoFile(key, !!(req.params as any)[1]), err => { if (err && !res.headersSent) res.status(404).end(); });
});

router.use(requireAuth as any);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_MAX_BYTES } });
// 30 envois par heure et par compte (recadrages successifs compris)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req: any) => req.userId ?? 'anonyme',
  message: { error: 'Trop de photos envoyées, réessaie plus tard.' },
});

async function readPhoto(req: AuthRequest, res: any, kind: 'avatar' | 'circle'): Promise<string | null> {
  if (!req.file || !/^image\//.test(req.file.mimetype)) { res.status(400).json({ error: 'Image manquante' }); return null; }
  try {
    return await savePhoto(req.file.buffer, kind);
  } catch {
    res.status(400).json({ error: 'Image illisible' });
    return null;
  }
}

// GET /api/photos/people — { pseudo: clé } des personnes qu'on côtoie et qui ont une photo
router.get('/people', async (req: AuthRequest, res) => {
  res.json(await avatarsSeenBy(req.userId!));
});

// PUT /api/photos/me (fichier « file ») — photo de profil
router.put('/me', uploadLimiter, upload.single('file'), async (req: AuthRequest, res) => {
  const key = await readPhoto(req, res, 'avatar');
  if (!key) return;
  const before = await prisma.user.findUnique({ where: { id: req.userId! }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: req.userId! }, data: { avatarKey: key } });
  await deletePhoto(before?.avatarKey);
  res.json({ avatarKey: key });
});

// DELETE /api/photos/me — retour aux initiales
router.delete('/me', async (req: AuthRequest, res) => {
  const before = await prisma.user.findUnique({ where: { id: req.userId! }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: req.userId! }, data: { avatarKey: null } });
  await deletePhoto(before?.avatarKey);
  res.json({ avatarKey: null });
});

async function setCirclePhoto(req: AuthRequest, res: any, key: string | null) {
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id }, select: { id: true, photoKey: true } });
  if (!circle) { await deletePhoto(key); res.status(404).json({ error: 'Cercle introuvable' }); return; }
  await prisma.circle.update({ where: { id: circle.id }, data: { photoKey: key } });
  await prisma.circleChangeLog.create({
    data: { circleId: circle.id, field: 'photo', oldValue: circle.photoKey ? 'photo' : null, newValue: key ? 'photo' : null, changedById: req.userId! },
  });
  await deletePhoto(circle.photoKey);
  req.app.get('io')?.to(`circle:${circle.id}`).emit('circle-updated', { circleId: circle.id });
  res.json({ photoKey: key });
}

// PUT /api/photos/circles/:id (fichier « file ») — photo du Cercle : créateur et organisateurs
router.put('/circles/:id', uploadLimiter, upload.single('file'), async (req: AuthRequest, res) => {
  if (!(await isCircleManager(req.userId!, req.params.id))) { res.status(403).json({ error: 'Réservé au créateur et aux organisateurs du Cercle' }); return; }
  const key = await readPhoto(req, res, 'circle');
  if (!key) return;
  await setCirclePhoto(req, res, key);
});

// DELETE /api/photos/circles/:id
router.delete('/circles/:id', async (req: AuthRequest, res) => {
  if (!(await isCircleManager(req.userId!, req.params.id))) { res.status(403).json({ error: 'Réservé au créateur et aux organisateurs du Cercle' }); return; }
  await setCirclePhoto(req, res, null);
});

// POST /api/photos/reports { kind: 'user' | 'circle', targetId, reason? } — signaler une photo
router.post('/reports', async (req: AuthRequest, res) => {
  const { kind, targetId } = req.body ?? {};
  if ((kind !== 'user' && kind !== 'circle') || typeof targetId !== 'string') { res.status(400).json({ error: 'Signalement invalide' }); return; }
  const photoKey = await canSeePhotoOf(kind, targetId, req.userId!);
  if (!photoKey) { res.status(404).json({ error: 'Photo introuvable' }); return; }
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim().slice(0, REPORT_REASON_MAX) : null;
  await prisma.photoReport.upsert({
    where: { reporterId_kind_targetId_photoKey: { reporterId: req.userId!, kind, targetId, photoKey } },
    create: { kind, targetId, photoKey, reason, reporterId: req.userId! },
    update: { reason, resolvedAt: null, resolution: null },
  });
  notifyAdmins('photo').catch(e => console.error('[photo report email]', e));
  res.json({ ok: true });
});

export default router;
