import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

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

  io.on('connection', (socket: Socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('join-plan', async (planId: string) => {
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId } },
      });
      if (member) socket.join(`plan:${planId}`);
    });

    socket.on('leave-plan', (planId: string) => {
      socket.leave(`plan:${planId}`);
    });

    socket.on('send-message', async ({ planId, content }: { planId: string; content: string }) => {
      if (!content?.trim()) return;
      const member = await prisma.planMember.findUnique({
        where: { userId_planId: { userId: socket.data.userId, planId } },
      });
      if (!member) return;
      const message = await prisma.message.create({
        data: { content: content.trim(), authorId: socket.data.userId, planId },
        include: { author: { select: { id: true, pseudo: true } } },
      });
      io.to(`plan:${planId}`).emit('message', message);

      // Notifier les membres du plan qui ne sont pas dans la room
      const planData = await prisma.plan.findUnique({
        where: { id: planId },
        select: { title: true, members: { select: { userId: true } } },
      });
      if (planData) {
        const sockets = await io.in(`plan:${planId}`).fetchSockets();
        const activeUserIds = new Set(sockets.map(s => s.data.userId));
        for (const m of planData.members) {
          if (m.userId !== socket.data.userId && !activeUserIds.has(m.userId)) {
            io.to(`user:${m.userId}`).emit('notification', {
              type: 'new_message',
              planId,
              planTitle: planData.title,
              from: socket.data.pseudo,
              preview: content.trim().slice(0, 60),
            });
          }
        }
      }
    });
  });
}
