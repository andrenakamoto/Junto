import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';

// userId -> nombre de connexions actives (plusieurs onglets/appareils)
const onlineCounts = new Map<string, number>();

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Non authentifié'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; pseudo: string };
      socket.data.userId = payload.userId;
      socket.data.pseudo = payload.pseudo;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    socket.join(`user:${socket.data.userId}`);

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

    socket.on('disconnect', () => {
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

    socket.on('send-message', async ({ planId, content, parentId }: { planId: string; content: string; parentId?: string }) => {
      if (!content?.trim()) return;
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId } },
      });
      if (!member) return;

      let validParentId: string | undefined;
      if (parentId) {
        const parent = await prisma.message.findFirst({ where: { id: parentId, planId } });
        if (parent) validParentId = parentId;
      }

      const message = await prisma.message.create({
        data: { content: content.trim(), authorId: socket.data.userId, planId, parentId: validParentId },
        include: {
          author: { select: { id: true, pseudo: true } },
          reactions: { include: { user: { select: { id: true, pseudo: true } } } },
          _count: { select: { replies: true } },
        },
      });
      io.to(`plan:${planId}`).emit('message', message);

      const planData = await prisma.plan.findUnique({
        where: { id: planId },
        select: {
          title: true, circleId: true,
          members: { select: { userId: true, user: { select: { pseudo: true, email: true, emailVerified: true } } } },
        },
      });
      if (!planData) return;

      const sockets = await io.in(`plan:${planId}`).fetchSockets();
      const activeUserIds = new Set(sockets.map(s => s.data.userId));

      // Mentions @pseudo → notification ciblée, même hors room active
      const mentioned = new Set<string>();
      const trimmed = content.trim();
      for (const m of planData.members) {
        if (m.userId === socket.data.userId) continue;
        const re = new RegExp(`@${m.user.pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(trimmed)) mentioned.add(m.userId);
      }
      for (const userId of mentioned) {
        io.to(`user:${userId}`).emit('notification', {
          type: 'mention',
          planId,
          planTitle: planData.title,
          circleId: planData.circleId,
          from: socket.data.pseudo,
          preview: trimmed.slice(0, 60),
        });
      }

      // Email aux membres mentionnés hors ligne (pas de connexion active du tout)
      const offlineMentioned = planData.members.filter(
        m => mentioned.has(m.userId) && (onlineCounts.get(m.userId) ?? 0) === 0 && m.user.email && m.user.emailVerified,
      );
      await Promise.all(offlineMentioned.map(m => resend.emails.send({
        from: FROM_EMAIL,
        to: m.user.email!,
        subject: `${socket.data.pseudo} t'a mentionné dans "${planData.title}"`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${m.user.pseudo} 👋</h2>
            <p><strong>${socket.data.pseudo}</strong> t'a mentionné dans le Plan <strong>"${planData.title}"</strong> :</p>
            <p style="font-size:15px;color:#475569;margin:16px 0;padding:12px 16px;background:#f8fafc;border-radius:8px">${trimmed.slice(0, 200)}</p>
            <a href="${APP_URL}/dashboard?planId=${planId}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le message
            </a>
          </div>`,
      }).then(r => { if (r.error) console.error('[mention email]', m.user.email, r.error); })
        .catch(e => console.error('[mention email]', m.user.email, e))));

      // Notifier les autres membres du plan qui ne sont pas dans la room (et pas déjà notifiés pour la mention)
      for (const m of planData.members) {
        if (m.userId !== socket.data.userId && !activeUserIds.has(m.userId) && !mentioned.has(m.userId)) {
          io.to(`user:${m.userId}`).emit('notification', {
            type: 'new_message',
            planId,
            planTitle: planData.title,
            circleId: planData.circleId,
            from: socket.data.pseudo,
            preview: trimmed.slice(0, 60),
          });
        }
      }
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
