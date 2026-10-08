import { Server, Socket } from 'socket.io';
import { escapeHtml } from '../lib/escapeHtml';
import { verifySessionToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { resend, FROM_EMAIL, APP_URL, notificationFooter } from '../lib/mailer';
import { decryptMessage, encryptMessage, withPlainContent } from '../lib/messageCrypto';
import { checkMessageEdit, cleanContent } from '../lib/messageEdit';
import { countMessageSent, touchUser } from '../lib/activity';
import { touchPlanSection } from '../lib/planActivity';
import { notifyUser } from '../lib/push';
import { messageInclude } from '../lib/messageInclude';
import { destroyFiles } from '../lib/cloudinary';
import { wantsEmail } from '../lib/notificationPrefs';

// userId -> nombre de connexions actives (plusieurs onglets/appareils)
const onlineCounts = new Map<string, number>();

// Dernier rafraîchissement des listes du Cercle provoqué par un message (voir send-message)
const chatListRefresh = new Map<string, number>();

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Non authentifié'));
    // Jeton de connexion uniquement (pas un jeton de photo, de téléchargement ni d'invité)
    const payload = verifySessionToken(token);
    if (!payload) return next(new Error('Token invalide'));
    if (payload.light) return next(new Error('Non authentifié')); // réponse sans compte : pas de temps réel
    socket.data.userId = payload.userId;
    socket.data.pseudo = payload.pseudo;
    touchUser(payload.userId);
    next();
  });

  io.on('connection', (socket: Socket) => {
    socket.join(`user:${socket.data.userId}`);

    // Pas d'`await` ici avant d'enregistrer les écouteurs ci-dessous : un événement émis
    // par le client juste après la connexion (ex. `join-plan`) serait sinon perdu.
    const presenceReady = (async () => {
      const memberships = await prisma.circleMember.findMany({
        where: { userId: socket.data.userId },
        select: { circleId: true },
      });
      const circleIds = memberships.map(m => m.circleId);
      socket.data.circleIds = circleIds;
      for (const circleId of circleIds) socket.join(`circle:${circleId}`);

      const wasOffline = !onlineCounts.get(socket.data.userId);
      onlineCounts.set(socket.data.userId, (onlineCounts.get(socket.data.userId) ?? 0) + 1);
      if (wasOffline) {
        for (const circleId of circleIds) {
          io.to(`circle:${circleId}`).emit('presence', { userId: socket.data.userId, online: true });
        }
      }

      if (circleIds.length > 0) {
        const circleMembers = await prisma.circleMember.findMany({
          where: { circleId: { in: circleIds } },
          select: { userId: true },
        });
        const onlineUserIds = [...new Set(circleMembers.map(m => m.userId))].filter(id => (onlineCounts.get(id) ?? 0) > 0);
        socket.emit('presence-snapshot', onlineUserIds);
      }
      return circleIds;
    })();
    presenceReady.catch(e => console.error('[socket presence setup]', e));

    socket.on('disconnect', async () => {
      const circleIds = await presenceReady.catch(() => null);
      if (!circleIds) return;
      const count = (onlineCounts.get(socket.data.userId) ?? 1) - 1;
      if (count <= 0) {
        onlineCounts.delete(socket.data.userId);
        for (const circleId of circleIds) {
          io.to(`circle:${circleId}`).emit('presence', { userId: socket.data.userId, online: false });
        }
      } else {
        onlineCounts.set(socket.data.userId, count);
      }
    });

    socket.on('join-plan', async (planId: string) => {
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId } },
      });
      if (member) socket.join(`plan:${planId}`);
    });

    socket.on('leave-plan', (planId: string) => {
      socket.leave(`plan:${planId}`);
    });

    socket.on('send-message', async ({ planId, content, parentId, attachmentId }: { planId: string; content: string; parentId?: string; attachmentId?: string }) => {
      const text = typeof content === 'string' ? content.trim().slice(0, 2000) : '';
      if (!text && !attachmentId) return;
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId } },
        include: { plan: { select: { disabledFeatures: true } } },
      });
      if (!member || member.plan.disabledFeatures.includes('chat')) return;

      // Photo ou message vocal envoyé depuis le chat : déjà importé dans le Plan par son auteur
      // (POST /attachments/plans/:planId?via=chat), pas encore rattaché à un message
      let validAttachmentId: string | undefined;
      let isVoice = false;
      if (attachmentId) {
        const att = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { message: { select: { id: true } } } });
        if (!att || att.planId !== planId || att.uploadedBy !== socket.data.pseudo || !(att.mimeType.startsWith('image/') || (att.mimeType.startsWith('audio/') && att.resourceType === 'video')) || att.message) return;
        validAttachmentId = att.id;
        isVoice = att.mimeType.startsWith('audio/');
      }

      let validParentId: string | undefined;
      if (parentId) {
        const parent = await prisma.message.findFirst({ where: { id: parentId, planId } });
        if (parent) validParentId = parentId;
      }

      const message = await prisma.message.create({
        data: { content: encryptMessage(text), authorId: socket.data.userId, planId, parentId: validParentId, attachmentId: validAttachmentId },
        include: messageInclude,
      });
      io.to(`plan:${planId}`).emit('message', withPlainContent(message));
      countMessageSent();
      touchPlanSection(planId, 'chat', socket.data.userId);

      const planData = await prisma.plan.findUnique({
        where: { id: planId },
        select: {
          title: true, circleId: true,
          members: { select: { userId: true, user: { select: { pseudo: true, email: true, emailVerified: true, notificationChannel: true } } } },
        },
      });
      if (!planData) return;

      // Ordre des listes (dernière activité d'abord) : le Cercle recharge ses listes, au plus une
      // fois par minute et par Plan pendant une conversation
      const lastRefresh = chatListRefresh.get(planId) ?? 0;
      if (Date.now() - lastRefresh > 60_000) {
        chatListRefresh.set(planId, Date.now());
        io.to(`circle:${planData.circleId}`).emit('circle-updated', { circleId: planData.circleId });
      }

      const sockets = await io.in(`plan:${planId}`).fetchSockets();
      const activeUserIds = new Set(sockets.map(s => s.data.userId));

      // Mentions @pseudo → notification ciblée, même hors room active
      const mentioned = new Set<string>();
      const trimmed = text || (isVoice ? '🎤 Message vocal' : '📷 Photo');
      for (const m of planData.members) {
        if (m.userId === socket.data.userId) continue;
        const re = new RegExp(`@${m.user.pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(trimmed)) mentioned.add(m.userId);
      }
      for (const userId of mentioned) {
        notifyUser(io, userId, {
          type: 'mention',
          planId,
          planTitle: planData.title,
          circleId: planData.circleId,
          from: socket.data.pseudo, actorId: socket.data.userId,
          preview: trimmed.slice(0, 60),
        });
      }

      // Email aux membres mentionnés hors ligne (pas de connexion active du tout)
      const offlineMentioned = planData.members.filter(
        m => mentioned.has(m.userId) && (onlineCounts.get(m.userId) ?? 0) === 0 && m.user.email && m.user.emailVerified && wantsEmail(m.user.notificationChannel),
      );
      await Promise.all(offlineMentioned.map(m => resend.emails.send({
        from: FROM_EMAIL,
        to: m.user.email!,
        subject: `${socket.data.pseudo} t'a mentionné dans "${planData.title}"`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${escapeHtml(m.user.pseudo)} 👋</h2>
            <p><strong>${escapeHtml(socket.data.pseudo)}</strong> t'a mentionné dans le Plan <strong>"${escapeHtml(planData.title)}"</strong>.</p>
            <a href="${APP_URL}/dashboard?planId=${planId}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le message
            </a>
          ${notificationFooter('simple')}
          </div>`,
      }).then(r => { if (r.error) console.error('[mention email]', m.user.email, r.error); })
        .catch(e => console.error('[mention email]', m.user.email, e))));

      // Notifier les autres membres du plan qui ne sont pas dans la room (et pas déjà notifiés pour la mention)
      for (const m of planData.members) {
        if (m.userId !== socket.data.userId && !activeUserIds.has(m.userId) && !mentioned.has(m.userId)) {
          notifyUser(io, m.userId, {
            type: 'new_message',
            planId,
            planTitle: planData.title,
            circleId: planData.circleId,
            from: socket.data.pseudo, actorId: socket.data.userId,
            preview: trimmed.slice(0, 60),
          });
        }
      }
    });

    // Modifier / supprimer son message dans les 15 minutes (lib/messageEdit.ts)
    async function editableMessage(messageId: unknown) {
      if (typeof messageId !== 'string') return null;
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { plan: { select: { disabledFeatures: true, title: true, circleId: true } } },
      });
      if (!message || message.plan.disabledFeatures.includes('chat')) return null;
      return checkMessageEdit(message, socket.data.userId) ? null : message;
    }

    socket.on('edit-message', async ({ messageId, content }: { messageId: string; content: string }) => {
      const text = cleanContent(content);
      const message = text && await editableMessage(messageId);
      if (!message || !text) return;
      const before = decryptMessage(message.content);
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { content: encryptMessage(text), editedAt: new Date() },
        include: messageInclude,
      });
      io.to(`plan:${message.planId}`).emit('message-updated', withPlainContent(updated));

      // Seule une mention ajoutée par la modification notifie (dans l'app, sans email)
      const members = await prisma.planMember.findMany({
        where: { planId: message.planId, userId: { not: socket.data.userId } },
        select: { userId: true, user: { select: { pseudo: true } } },
      });
      const mentions = (t: string, pseudo: string) => new RegExp(`@${pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t);
      for (const m of members) {
        if (mentions(text, m.user.pseudo) && !mentions(before, m.user.pseudo)) {
          notifyUser(io, m.userId, {
            type: 'mention', planId: message.planId, planTitle: message.plan.title, circleId: message.plan.circleId,
            from: socket.data.pseudo, actorId: socket.data.userId, preview: text.slice(0, 60),
          });
        }
      }
    });

    socket.on('delete-message', async ({ messageId }: { messageId: string }) => {
      const message = await editableMessage(messageId);
      if (!message) return;
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { content: '', deletedAt: new Date(), attachmentId: null },
        include: messageInclude,
      });
      // Photo envoyée avec ce message : supprimée aussi (Cloudinary + onglet Infos)
      if (message.attachmentId) {
        const att = await prisma.attachment.findUnique({ where: { id: message.attachmentId } });
        if (att) {
          await destroyFiles([att]).catch(e => console.error('[chat photo delete]', e));
          await prisma.attachment.delete({ where: { id: att.id } }).catch(() => {});
          io.to(`plan:${message.planId}`).emit('plan-updated', { planId: message.planId });
        }
      }
      io.to(`plan:${message.planId}`).emit('message-updated', withPlainContent(updated));
    });

    socket.on('toggle-reaction', async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!emoji || emoji.length > 8) return;
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) return;
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId: message.planId } },
      });
      if (!member) return;

      const existing = await prisma.messageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId: socket.data.userId, emoji } },
      });
      if (existing) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.messageReaction.create({ data: { messageId, emoji, userId: socket.data.userId } });
      }

      const reactions = await prisma.messageReaction.findMany({
        where: { messageId },
        include: { user: { select: { id: true, pseudo: true } } },
      });
      io.to(`plan:${message.planId}`).emit('reactions-updated', { messageId, reactions });
    });
  });
}
