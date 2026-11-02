import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { isCircleManager } from '../lib/circleRoles';
import { decryptMessage, encryptMessage } from '../lib/messageCrypto';
import {
  CAPSULE_DEPOSITS_PER_PERSON, CAPSULE_MAX_BYTES, CAPSULE_PHOTO_MAX_BYTES, CAPSULE_TEXT_MAX, CAPSULE_VOICE_MAX_BYTES, CAPSULE_VOICE_MAX_SECONDS,
  capsuleDir, capsuleExpiresAt, capsuleFile, capsuleStage, depositDeadline, notifyCreated, oneYearAfter, parseOpenAt, sealCapsule, removeCapsuleFiles, removeDepositFiles,
} from '../lib/capsule';

// Capsule temporelle (lib/capsule.ts), sur /api/capsules. Hors du routeur des Plans : on dépose encore des souvenirs pendant les
// 7 jours qui suivent la fin du Plan (le Plan est alors en lecture seule, puis supprimé), et la capsule vit sans lui jusqu'à
// son ouverture. Fonction à activer d'un Plan (`capsule`). Fichiers dans STORAGE_DIR/capsules/<id>/, servis avec un jeton
// à usage précis (comme les photos des Plans).
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CAPSULE_PHOTO_MAX_BYTES, files: 1 } });
const TOKEN_TTL = '12h';
const mintToken = (capsuleId: string, userId: string) => jwt.sign({ capsuleId, userId, purpose: 'capsule' }, process.env.JWT_SECRET!, { expiresIn: TOKEN_TTL });

// GET /api/capsules/files/:depositId?t=<jeton> — photo ou son d'un dépôt (sans session : balises <img> / <audio>)
router.get('/files/:depositId', async (req, res) => {
  let tok: { capsuleId?: string; userId?: string; purpose?: string };
  try { tok = jwt.verify(String(req.query.t ?? ''), process.env.JWT_SECRET!) as any; } catch { res.status(403).end(); return; }
  if (tok.purpose !== 'capsule' || !tok.capsuleId || !tok.userId) { res.status(403).end(); return; }
  const dep = await prisma.capsuleDeposit.findUnique({ where: { id: req.params.depositId }, include: { capsule: { select: { id: true, openAt: true, openedAt: true, depositUntil: true } } } });
  if (!dep || !dep.fileKey || dep.capsuleId !== tok.capsuleId) { res.status(404).end(); return; }
  // Avant l'ouverture, seule la personne qui l'a déposé voit son souvenir
  if (capsuleStage(dep.capsule) !== 'opened' && dep.userId !== tok.userId) { res.status(403).end(); return; }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(dep.kind === 'voice' ? 'audio/mpeg' : 'image/jpeg');
  res.sendFile(capsuleFile(dep.fileKey), err => { if (err && !res.headersSent) res.status(404).end(); });
});

router.use(requireAuth as any);

type Loaded = NonNullable<Awaited<ReturnType<typeof loadCapsule>>>;
async function loadCapsule(id: string) {
  return prisma.timeCapsule.findUnique({ where: { id }, include: { plan: { select: { id: true, creatorId: true, circleId: true, endDate: true } } } });
}

async function canManage(userId: string, c: { createdById: string | null; circleId: string; plan: { creatorId: string } | null }) {
  return c.createdById === userId || c.plan?.creatorId === userId || isCircleManager(userId, c.circleId);
}

// Qui voit la capsule : les personnes figées au scellage ; avant, aussi les participants actuels du Plan
async function canSee(userId: string, c: Loaded): Promise<boolean> {
  if (c.audienceIds.includes(userId)) return true;
  if (c.sealedAt || !c.planId) return false;
  const m = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId: c.planId } }, select: { rsvp: true } });
  return !!m && m.rsvp !== 'out';
}

async function view(userId: string, c: Loaded) {
  const stage = capsuleStage(c);
  const deposits = await prisma.capsuleDeposit.findMany({ where: { capsuleId: c.id }, include: { user: person }, orderBy: { createdAt: 'asc' } });
  const shape = (d: (typeof deposits)[number]) => ({
    id: d.id, kind: d.kind, text: d.text ? decryptMessage(d.text) : null, hasFile: !!d.fileKey, seconds: d.seconds, createdAt: d.createdAt,
    author: d.user, mine: d.userId === userId,
  });
  return {
    id: c.id, title: c.title, circleId: c.circleId, planId: c.planId, openAt: c.openAt, depositUntil: c.depositUntil, stage,
    expiresAt: capsuleExpiresAt(c),
    depositCount: deposits.length,
    contributorCount: new Set(deposits.map(d => d.userId)).size,
    canManage: await canManage(userId, c),
    canDeposit: stage === 'open_for_deposits',
    // Avant l'ouverture : seulement ses propres dépôts ; après : tous
    deposits: (stage === 'opened' ? deposits : deposits.filter(d => d.userId === userId)).map(shape),
    mediaToken: mintToken(c.id, userId),
  };
}

// GET /api/capsules/plan/:planId — la capsule du Plan (rubrique « Capsule »)
router.get('/plan/:planId', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const access = await getPlanAccess(me, req.params.planId);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.planId }, select: { id: true, creatorId: true, circleId: true, eventDate: true, endDate: true, enabledFeatures: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const c = await prisma.timeCapsule.findUnique({ where: { planId: plan.id }, include: { plan: { select: { id: true, creatorId: true, circleId: true, endDate: true } } } });
  const manager = plan.creatorId === me || await isCircleManager(me, plan.circleId);
  if (!c) {
    const depositUntil = depositDeadline(plan.endDate);
    res.json({ capsule: null, canCreate: manager && plan.enabledFeatures.includes('capsule'), depositUntil, oneYear: oneYearAfter(plan.eventDate ?? plan.endDate, depositUntil) });
    return;
  }
  if (!(await canSee(me, c))) { res.json({ capsule: null, canCreate: false, notInvited: true }); return; }
  res.json({ capsule: await view(me, c), canCreate: false });
});

// POST /api/capsules/plan/:planId { openAt } — créer la capsule (créateur du Plan ou gestionnaire du Cercle)
router.post('/plan/:planId', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const access = await getPlanAccess(me, req.params.planId);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.planId }, select: { id: true, title: true, creatorId: true, circleId: true, endDate: true, enabledFeatures: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!plan.enabledFeatures.includes('capsule')) { res.status(403).json({ error: 'La capsule temporelle n’est pas activée pour ce Plan' }); return; }
  if (plan.creatorId !== me && !(await isCircleManager(me, plan.circleId))) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  const depositUntil = depositDeadline(plan.endDate);
  const openAt = parseOpenAt(req.body?.openAt, depositUntil);
  if (!openAt) { res.status(400).json({ error: 'Date d’ouverture invalide (après la fin des dépôts, dans l’année au plus)' }); return; }
  if (await prisma.timeCapsule.findUnique({ where: { planId: plan.id }, select: { id: true } })) { res.status(409).json({ error: 'Ce Plan a déjà une capsule' }); return; }
  const members = await prisma.planMember.findMany({ where: { planId: plan.id, rsvp: { not: 'out' }, user: { isLight: false } }, select: { userId: true } });
  const c = await prisma.timeCapsule.create({
    data: { circleId: plan.circleId, planId: plan.id, title: plan.title, openAt, depositUntil, createdById: me, audienceIds: [...new Set([me, ...members.map(m => m.userId)])] },
  });
  notifyCreated(req.app.get('io'), c, me);
  res.json({ id: c.id });
});

// PUT /api/capsules/:id { openAt } — changer la date d'ouverture (avant le scellage)
router.put('/:id', async (req: AuthRequest, res) => {
  const c = await loadCapsule(req.params.id);
  if (!c || !(await canSee(req.userId!, c))) { res.status(404).json({ error: 'Capsule introuvable' }); return; }
  if (!(await canManage(req.userId!, c))) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  if (capsuleStage(c) !== 'open_for_deposits') { res.status(409).json({ error: 'La capsule est déjà scellée' }); return; }
  const openAt = parseOpenAt(req.body?.openAt, c.depositUntil);
  if (!openAt) { res.status(400).json({ error: 'Date d’ouverture invalide (après la fin des dépôts, dans l’année au plus)' }); return; }
  await prisma.timeCapsule.update({ where: { id: c.id }, data: { openAt } });
  res.json({ ok: true });
});

// POST /api/capsules/:id/seal — sceller tout de suite, sans attendre la fin des dépôts (créateur du Plan ou gestionnaire)
router.post('/:id/seal', async (req: AuthRequest, res) => {
  const c = await loadCapsule(req.params.id);
  if (!c || !(await canSee(req.userId!, c))) { res.status(404).json({ error: 'Capsule introuvable' }); return; }
  if (!(await canManage(req.userId!, c))) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  if (capsuleStage(c) !== 'open_for_deposits') { res.status(409).json({ error: 'La capsule est déjà scellée' }); return; }
  await sealCapsule(req.app.get('io'), c.id);
  res.json({ ok: true });
});

// DELETE /api/capsules/:id — supprimer la capsule et ses souvenirs (avant le scellage)
router.delete('/:id', async (req: AuthRequest, res) => {
  const c = await loadCapsule(req.params.id);
  if (!c || !(await canSee(req.userId!, c))) { res.status(404).json({ error: 'Capsule introuvable' }); return; }
  if (!(await canManage(req.userId!, c))) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  if (capsuleStage(c) !== 'open_for_deposits') { res.status(409).json({ error: 'La capsule est déjà scellée' }); return; }
  await removeCapsuleFiles([c.id]);
  await prisma.timeCapsule.delete({ where: { id: c.id } });
  res.json({ ok: true });
});

// GET /api/capsules/circle/:circleId — capsules du Cercle que je verrai (colonne du Cercle)
// GET /api/capsules/mine — toutes mes capsules, quel que soit le Cercle (« Tous mes plans ») : elles restent accessibles à un
// invité extérieur au Cercle ou à une personne qui l'a quitté
router.get('/mine', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const myPlans = await prisma.planMember.findMany({ where: { userId: me, rsvp: { not: 'out' } }, select: { planId: true } });
  const list = await prisma.timeCapsule.findMany({
    where: { OR: [{ audienceIds: { has: me } }, { sealedAt: null, planId: { in: myPlans.map(p => p.planId) } }] },
    include: { _count: { select: { deposits: true } } }, orderBy: { openAt: 'asc' },
  });
  res.json(list.map(c => ({ id: c.id, title: c.title, openAt: c.openAt, depositUntil: c.depositUntil, stage: capsuleStage(c), depositCount: c._count.deposits, planId: c.planId, expiresAt: capsuleExpiresAt(c) })));
});

router.get('/circle/:circleId', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const list = await prisma.timeCapsule.findMany({ where: { circleId: req.params.circleId }, include: { plan: { select: { id: true, creatorId: true, circleId: true, endDate: true } }, _count: { select: { deposits: true } } }, orderBy: { openAt: 'asc' } });
  const out = [];
  for (const c of list) {
    if (!(await canSee(me, c))) continue;
    out.push({ id: c.id, title: c.title, openAt: c.openAt, depositUntil: c.depositUntil, stage: capsuleStage(c), depositCount: c._count.deposits, planId: c.planId, expiresAt: capsuleExpiresAt(c) });
  }
  res.json(out);
});

// GET /api/capsules/:id
router.get('/:id', async (req: AuthRequest, res) => {
  const c = await loadCapsule(req.params.id);
  if (!c || !(await canSee(req.userId!, c))) { res.status(404).json({ error: 'Capsule introuvable' }); return; }
  res.json(await view(req.userId!, c));
});

// Message vocal → MP3 (lisible sur iPhone comme sur Android)
async function toMp3(buf: Buffer): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `evly-capsule-${crypto.randomUUID()}`);
  await fs.writeFile(tmp, buf);
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      execFile('ffmpeg', ['-v', 'error', '-i', tmp, '-t', String(CAPSULE_VOICE_MAX_SECONDS), '-vn', '-codec:a', 'libmp3lame', '-q:a', '5', '-f', 'mp3', 'pipe:1'],
        { encoding: 'buffer', maxBuffer: 30 * 1024 * 1024, timeout: 60_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout as Buffer)));
    });
  } finally { await fs.rm(tmp, { force: true }); }
}

// POST /api/capsules/:id/deposits (multipart : kind = text | photo | voice, text, file, seconds)
router.post('/:id/deposits', upload.single('file'), async (req: AuthRequest, res) => {
  const me = req.userId!;
  const c = await loadCapsule(req.params.id);
  if (!c || !(await canSee(me, c))) { res.status(404).json({ error: 'Capsule introuvable' }); return; }
  if (capsuleStage(c) !== 'open_for_deposits') { res.status(409).json({ error: 'La capsule est scellée : plus de dépôts' }); return; }
  const kind = String(req.body?.kind ?? '');
  if (!['text', 'photo', 'voice'].includes(kind)) { res.status(400).json({ error: 'Type de souvenir invalide' }); return; }
  const mine = await prisma.capsuleDeposit.count({ where: { capsuleId: c.id, userId: me } });
  if (mine >= CAPSULE_DEPOSITS_PER_PERSON) { res.status(400).json({ error: `${CAPSULE_DEPOSITS_PER_PERSON} souvenirs par personne au maximum` }); return; }
  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (rawText.length > CAPSULE_TEXT_MAX) { res.status(400).json({ error: `${CAPSULE_TEXT_MAX} caractères au maximum` }); return; }
  if (kind === 'text' && !rawText) { res.status(400).json({ error: 'Écris un petit mot' }); return; }
  let file: Buffer | null = null;
  if (kind !== 'text') {
    const f = (req as any).file as { buffer: Buffer; mimetype: string; size: number } | undefined;
    if (!f) { res.status(400).json({ error: 'Fichier manquant' }); return; }
    try {
      if (kind === 'photo') {
        if (!f.mimetype.startsWith('image/')) { res.status(400).json({ error: 'Photo invalide' }); return; }
        // Image refaite : 1600 px au plus, JPEG, sans métadonnées (position GPS comprise)
        file = await sharp(f.buffer, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      } else {
        if (!f.mimetype.startsWith('audio/') || f.size > CAPSULE_VOICE_MAX_BYTES) { res.status(400).json({ error: 'Message vocal invalide (2 minutes au plus)' }); return; }
        file = await toMp3(f.buffer);
      }
    } catch (e) {
      console.error('[capsule dépôt]', (e as Error).message);
      res.status(400).json({ error: kind === 'photo' ? 'Photo invalide' : 'Message vocal invalide (2 minutes au plus)' });
      return;
    }
  }
  const used = await prisma.capsuleDeposit.aggregate({ where: { capsuleId: c.id }, _sum: { size: true } });
  if ((used._sum.size ?? 0) + (file?.length ?? 0) > CAPSULE_MAX_BYTES) { res.status(400).json({ error: 'La capsule est pleine' }); return; }
  let fileKey: string | null = null;
  if (file) {
    fileKey = `${path.basename(capsuleDir(c.id))}/${crypto.randomUUID()}${kind === 'voice' ? '.mp3' : '.jpg'}`;
    await fs.mkdir(path.dirname(capsuleFile(fileKey)), { recursive: true });
    await fs.writeFile(capsuleFile(fileKey), file, { mode: 0o640 });
  }
  const seconds = kind === 'voice' ? Math.max(1, Math.min(CAPSULE_VOICE_MAX_SECONDS, Math.round(Number(req.body?.seconds) || 0))) : null;
  const d = await prisma.capsuleDeposit.create({
    data: { capsuleId: c.id, userId: me, kind, text: rawText ? encryptMessage(rawText) : null, fileKey, size: file?.length ?? 0, seconds },
  });
  if (!c.audienceIds.includes(me)) await prisma.timeCapsule.update({ where: { id: c.id }, data: { audienceIds: { push: me } } });
  res.json({ id: d.id });
});

// DELETE /api/capsules/deposits/:depositId — retirer son souvenir (avant le scellage)
router.delete('/deposits/:depositId', async (req: AuthRequest, res) => {
  const d = await prisma.capsuleDeposit.findUnique({ where: { id: req.params.depositId }, include: { capsule: true } });
  if (!d || d.userId !== req.userId) { res.status(404).json({ error: 'Souvenir introuvable' }); return; }
  if (capsuleStage(d.capsule) !== 'open_for_deposits') { res.status(409).json({ error: 'La capsule est scellée : plus de dépôts' }); return; }
  await removeDepositFiles([d.fileKey]);
  await prisma.capsuleDeposit.delete({ where: { id: d.id } });
  res.json({ ok: true });
});

export default router;
