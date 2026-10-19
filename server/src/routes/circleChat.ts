import { Router } from 'express';
import { isAllowedReaction } from '../lib/reactions';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { isCircleManager } from '../lib/circleRoles';
import { encryptMessage } from '../lib/messageCrypto';
import { checkMessageEdit, cleanContent } from '../lib/messageEdit';
import { countMessageSent } from '../lib/activity';
import { notifyUser } from '../lib/push';
import { deletePhoto, isPhotoKey, PHOTO_MAX_BYTES, savePhoto } from '../lib/photos';
import { CIRCLE_CHAT_MAX, canWriteChat, chatSince, circleMessageInclude, mentionedIn, plainCircleMessage } from '../lib/circleChat';

// Discussion d'un Cercle — voir lib/circleChat.ts. Réservée aux membres du Cercle.
const router = Router();
router.use(requireAuth as any);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_MAX_BYTES } });
const photoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req: any) => req.userId ?? 'anonyme',
  message: { error: 'Trop de photos envoyées, réessaie plus tard.' },
});
// Réactions possibles : lib/reactions.ts (communes à tous les chats)

// Membre du Cercle, mode du chat et droit d'écrire
async function context(userId: string, circleId: string) {
  const [circle, member] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, select: { id: true, name: true, chatMode: true } }),
    prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } } }),
  ]);
  if (!circle || !member) return null;
  const manager = await isCircleManager(userId, circleId);
  return { circle, manager, canWrite: canWriteChat(circle.chatMode, manager) };
}

const emitUpdated = (req: AuthRequest, circleId: string, message: unknown) =>
  req.app.get('io')?.to(`circle:${circleId}`).emit('circle-message-updated', { circleId, message });

// GET /api/circle-chat/:circleId — messages des 7 derniers jours
router.get('/:circleId', async (req: AuthRequest, res) => {
  const ctx = await context(req.userId!, req.params.circleId);
  if (!ctx) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (ctx.circle.chatMode === 'off') { res.json({ mode: 'off', canWrite: false, canModerate: ctx.manager, messages: [] }); return; }
  const messages = await prisma.circleMessage.findMany({
    where: { circleId: ctx.circle.id, createdAt: { gt: chatSince() } },
    include: circleMessageInclude,
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  res.json({ mode: ctx.circle.chatMode, canWrite: ctx.canWrite, canModerate: ctx.manager, messages: messages.map(plainCircleMessage) });
});

// POST /api/circle-chat/:circleId/seen — tout est lu
router.post('/:circleId/seen', async (req: AuthRequest, res) => {
  await prisma.circleMember.updateMany({ where: { userId: req.userId!, circleId: req.params.circleId }, data: { chatSeenAt: new Date() } });
  res.json({ ok: true });
});

// POST /api/circle-chat/:circleId/photo (fichier « file ») — photo à joindre au message suivant
router.post('/:circleId/photo', photoLimiter, upload.single('file'), async (req: AuthRequest, res) => {
  const ctx = await context(req.userId!, req.params.circleId);
  if (!ctx) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (!ctx.canWrite) { res.status(403).json({ error: 'Seuls le créateur et les organisateurs écrivent dans cette discussion' }); return; }
  if (!req.file || !/^image\//.test(req.file.mimetype)) { res.status(400).json({ error: 'Image manquante' }); return; }
  try {
    res.json({ imageKey: await savePhoto(req.file.buffer, 'chat') });
  } catch {
    res.status(400).json({ error: 'Image illisible' });
  }
});

// POST /api/circle-chat/:circleId/messages { content?, imageKey? }
router.post('/:circleId/messages', async (req: AuthRequest, res) => {
  const ctx = await context(req.userId!, req.params.circleId);
  if (!ctx) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (ctx.circle.chatMode === 'off') { res.status(403).json({ error: 'La discussion de ce Cercle est désactivée' }); return; }
  if (!ctx.canWrite) { res.status(403).json({ error: 'Seuls le créateur et les organisateurs écrivent dans cette discussion' }); return; }
  const text = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const imageKey = isPhotoKey(req.body?.imageKey) ? req.body.imageKey : null;
  if ((!text && !imageKey) || text.length > CIRCLE_CHAT_MAX) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  // Une photo ne sert qu'une fois
  if (imageKey && await prisma.circleMessage.findFirst({ where: { imageKey } })) { res.status(409).json({ error: 'Photo déjà envoyée' }); return; }

  const message = plainCircleMessage(await prisma.circleMessage.create({
    data: { circleId: ctx.circle.id, authorId: req.userId!, content: encryptMessage(text), imageKey },
    include: circleMessageInclude,
  }));
  await prisma.circleMember.updateMany({ where: { userId: req.userId!, circleId: ctx.circle.id }, data: { chatSeenAt: new Date() } });
  countMessageSent();
  res.json(message);

  try {
    const io = req.app.get('io');
    io?.to(`circle:${ctx.circle.id}`).emit('circle-message', { circleId: ctx.circle.id, message });
    // Mentions : notification (même en mode silencieux) ; les autres messages : seulement pour qui l'a demandé
    const members = await prisma.circleMember.findMany({
      where: { circleId: ctx.circle.id, userId: { not: req.userId! } },
      select: { userId: true, user: { select: { pseudo: true, circleChatPush: true } } },
    });
    const mentioned = new Set(mentionedIn(text, members.map(m => ({ userId: m.userId, pseudo: m.user.pseudo })), req.userId!));
    const preview = text ? text.slice(0, 80) : '📷 Photo';
    for (const m of members) {
      const base = { circleId: ctx.circle.id, circleName: ctx.circle.name, from: req.pseudo, actorId: req.userId!, preview };
      if (mentioned.has(m.userId)) notifyUser(io, m.userId, { type: 'circle_mention', ...base });
      else if (m.user.circleChatPush) notifyUser(io, m.userId, { type: 'circle_message', ...base });
    }
  } catch (e) {
    console.error('[circle chat notify]', e);
  }
});

// Modifier (auteur, 15 minutes) ; supprimer (auteur 15 minutes, ou créateur / organisateurs du Cercle à tout moment)
router.put('/messages/:messageId', async (req: AuthRequest, res) => {
  const message = await prisma.circleMessage.findUnique({ where: { id: req.params.messageId } });
  const ctx = message && await context(req.userId!, message.circleId);
  if (!message || !ctx) { res.status(404).json({ error: 'Message introuvable' }); return; }
  const refused = checkMessageEdit(message, req.userId!);
  if (refused) { res.status(403).json({ error: refused }); return; }
  const text = cleanContent(req.body?.content, CIRCLE_CHAT_MAX);
  if (!text) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  const updated = plainCircleMessage(await prisma.circleMessage.update({
    where: { id: message.id }, data: { content: encryptMessage(text), editedAt: new Date() }, include: circleMessageInclude,
  }));
  res.json(updated);
  emitUpdated(req, message.circleId, updated);
});

router.delete('/messages/:messageId', async (req: AuthRequest, res) => {
  const message = await prisma.circleMessage.findUnique({ where: { id: req.params.messageId } });
  const ctx = message && await context(req.userId!, message.circleId);
  if (!message || !ctx) { res.status(404).json({ error: 'Message introuvable' }); return; }
  if (!ctx.manager) {
    const refused = checkMessageEdit(message, req.userId!);
    if (refused) { res.status(403).json({ error: refused }); return; }
  }
  await deletePhoto(message.imageKey).catch(() => {});
  const updated = plainCircleMessage(await prisma.circleMessage.update({
    where: { id: message.id }, data: { content: '', imageKey: null, deletedAt: new Date() }, include: circleMessageInclude,
  }));
  res.json(updated);
  emitUpdated(req, message.circleId, updated);
});

// POST /api/circle-chat/messages/:messageId/reactions { emoji } — ajoute ou retire
router.post('/messages/:messageId/reactions', async (req: AuthRequest, res) => {
  const emoji = req.body?.emoji;
  if (!isAllowedReaction(emoji)) { res.status(400).json({ error: 'Réaction invalide' }); return; }
  const message = await prisma.circleMessage.findUnique({ where: { id: req.params.messageId } });
  const ctx = message && await context(req.userId!, message.circleId);
  if (!message || !ctx || message.deletedAt) { res.status(404).json({ error: 'Message introuvable' }); return; }
  const key = { messageId_userId_emoji: { messageId: message.id, userId: req.userId!, emoji } };
  if (await prisma.circleMessageReaction.findUnique({ where: key })) await prisma.circleMessageReaction.delete({ where: key });
  else await prisma.circleMessageReaction.create({ data: { messageId: message.id, userId: req.userId!, emoji } });
  const updated = plainCircleMessage(await prisma.circleMessage.findUniqueOrThrow({ where: { id: message.id }, include: circleMessageInclude }));
  res.json(updated);
  emitUpdated(req, message.circleId, updated);
});

export default router;
