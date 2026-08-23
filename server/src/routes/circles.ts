import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';

const router = Router();
router.use(requireAuth as any);

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const circleInclude = {
  members: { include: { user: { select: { id: true, pseudo: true } } } },
  creator: { select: { id: true, pseudo: true } },
  deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
  joinRequests: {
    include: {
      user: { select: { id: true, pseudo: true } },
      votes: { select: { userId: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

// List circles of current user
router.get('/', async (req: AuthRequest, res) => {
  const now = new Date();
  const circles = await prisma.circle.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      ...circleInclude,
      _count: { select: { plans: true } },
      plans: {
        where: { archived: false, endDate: { gt: now } },
        orderBy: { endDate: 'asc' },
        take: 1,
        select: { id: true, title: true, eventDate: true, endDate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(circles);
});

const CIRCLE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

// Create a circle
router.post('/', async (req: AuthRequest, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nom requis' });
    return;
  }
  let code = generateCode();
  while (await prisma.circle.findUnique({ where: { code } })) {
    code = generateCode();
  }
  const circle = await prisma.circle.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: CIRCLE_COLORS.includes(color) ? color : null,
      code,
      creatorId: req.userId!,
      members: { create: { userId: req.userId!, role: 'admin' } },
    },
    include: circleInclude,
  });
  res.json(circle);
});

// Changer la couleur du thème d'un Cercle (créateur uniquement)
router.put('/:id/color', async (req: AuthRequest, res) => {
  const { color } = req.body;
  if (color !== null && !CIRCLE_COLORS.includes(color)) {
    res.status(400).json({ error: 'Couleur invalide' });
    return;
  }
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (circle.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur' }); return; }
  const updated = await prisma.circle.update({
    where: { id: req.params.id },
    data: { color },
    include: circleInclude,
  });
  res.json(updated);
});

// Demander à rejoindre un cercle — nécessite l'approbation d'au moins la
// moitié des membres actuels (même principe que la suppression d'un Cercle/Plan)
router.post('/join', async (req: AuthRequest, res) => {
  const { name, code } = req.body;
  if (!name?.trim() || !code?.trim()) {
    res.status(400).json({ error: 'Nom et code requis' });
    return;
  }
  const circle = await prisma.circle.findFirst({
    where: { name: name.trim(), code: code.trim().toUpperCase() },
  });
  if (!circle) {
    res.status(404).json({ error: 'Cercle introuvable. Vérifie le nom et le code.' });
    return;
  }
  const existing = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: circle.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'Tu es déjà dans ce Cercle' });
    return;
  }
  const existingRequest = await prisma.circleJoinRequest.findUnique({
    where: { circleId_userId: { circleId: circle.id, userId: req.userId! } },
  });
  if (existingRequest) {
    res.json({ pending: true, circleName: circle.name });
    return;
  }

  const requester = await prisma.user.findUnique({ where: { id: req.userId! }, select: { pseudo: true } });
  await prisma.circleJoinRequest.create({ data: { circleId: circle.id, userId: req.userId! } });
  res.json({ pending: true, circleName: circle.name });

  // Notifier les membres actuels — temps réel + email
  try {
    const io = req.app.get('io');
    const members = await prisma.circleMember.findMany({
      where: { circleId: circle.id },
      select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true } } },
    });
    if (io) {
      for (const m of members) {
        io.to(`user:${m.userId}`).emit('notification', {
          type: 'join_request',
          circleId: circle.id,
          circleName: circle.name,
          from: requester?.pseudo,
        });
      }
    }
    const recipients = members.filter(m => m.user.email && m.user.emailVerified);
    await Promise.all(recipients.map(m => resend.emails.send({
      from: FROM_EMAIL,
      to: m.user.email!,
      subject: `${requester?.pseudo} veut rejoindre "${circle.name}"`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Salut ${m.user.pseudo} 👋</h2>
          <p><strong>${requester?.pseudo}</strong> a demandé à rejoindre le Cercle <strong>"${circle.name}"</strong>.</p>
          <p>La majorité des membres doit valider la demande pour qu'elle soit acceptée.</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Voir la demande
          </a>
        </div>`,
    }).then(r => { if (r.error) console.error('[join_request email]', m.user.email, r.error); })
      .catch(e => console.error('[join_request email]', m.user.email, e))));
  } catch (e) {
    console.error('[join_request notify]', e);
  }
});

// Voter pour accepter une demande — accepte le membre si le seuil est atteint
router.post('/:id/join-requests/:requestId/vote', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const request = await prisma.circleJoinRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.circleId !== circleId) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const existingVote = await prisma.circleJoinVote.findUnique({
    where: { requestId_userId: { requestId: request.id, userId } },
  });
  if (existingVote) {
    await prisma.circleJoinVote.delete({ where: { requestId_userId: { requestId: request.id, userId } } });
  } else {
    await prisma.circleJoinVote.create({ data: { requestId: request.id, userId } });
  }

  const [memberCount, voteCount] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.circleJoinVote.count({ where: { requestId: request.id } }),
  ]);
  const threshold = Math.ceil(memberCount / 2);

  if (voteCount >= threshold) {
    await prisma.$transaction([
      prisma.circleJoinRequest.delete({ where: { id: request.id } }),
      prisma.circleMember.create({ data: { userId: request.userId, circleId } }),
    ]);

    const updatedCircle = await prisma.circle.findUnique({ where: { id: circleId }, include: circleInclude });

    try {
      const io = req.app.get('io');
      if (io && updatedCircle) {
        io.to(`user:${request.userId}`).emit('notification', {
          type: 'join_accepted',
          circleId,
          circleName: updatedCircle.name,
        });
      }
      const approvedUser = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true, emailVerified: true, pseudo: true },
      });
      if (updatedCircle && approvedUser?.email && approvedUser.emailVerified) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: approvedUser.email,
          subject: `Tu as rejoint "${updatedCircle.name}" !`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2>Bienvenue dans "${updatedCircle.name}" ${approvedUser.pseudo} 🎉</h2>
              <p>Les membres du Cercle ont validé ta demande.</p>
              <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Ouvrir EvLY
              </a>
            </div>`,
        }).then(r => { if (r.error) console.error('[join_accepted email]', approvedUser.email, r.error); });
      }
    } catch (e) {
      console.error('[join_accepted notify]', e);
    }

    res.json({ accepted: true, circle: updatedCircle });
    return;
  }

  const updatedCircle = await prisma.circle.findUnique({ where: { id: circleId }, include: circleInclude });
  res.json({ accepted: false, circle: updatedCircle, votes: voteCount, threshold });
});

// Get circle details
router.get('/:id', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id }, include: circleInclude });
  res.json(circle);
});

// List plans for a circle
router.get('/:id/plans', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const plans = await prisma.plan.findMany({
    where: { circleId: req.params.id, archived: false, endDate: { gt: new Date() } },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
  });
  res.json(plans);
});

// Create a plan in a circle
router.post('/:id/plans', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { title, description, eventDate, endDate, location, maxParticipants } = req.body;
  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'Titre et description requis' });
    return;
  }
  if (!endDate) {
    res.status(400).json({ error: 'Date de fin obligatoire' });
    return;
  }
  const parsedEndDate = new Date(endDate);
  if (isNaN(parsedEndDate.getTime()) || parsedEndDate <= new Date()) {
    res.status(400).json({ error: 'La date de fin doit être dans le futur' });
    return;
  }
  let parsedMaxParticipants: number | null = null;
  if (maxParticipants !== undefined && maxParticipants !== null && maxParticipants !== '') {
    parsedMaxParticipants = parseInt(maxParticipants, 10);
    if (isNaN(parsedMaxParticipants) || parsedMaxParticipants < 1) {
      res.status(400).json({ error: 'Limite de participants invalide' });
      return;
    }
  }
  const plan = await prisma.plan.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      eventDate: eventDate ? new Date(eventDate) : null,
      endDate: parsedEndDate,
      location: location?.trim() || null,
      maxParticipants: parsedMaxParticipants,
      creatorId: req.userId!,
      circleId: req.params.id,
      members: { create: { userId: req.userId!, rsvp: 'in' } },
    },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      _count: { select: { messages: true } },
    },
  });
  res.json(plan);

  // Notifier les membres du cercle (sauf le créateur) — temps réel + email
  try {
    const io = req.app.get('io');
    const circle = await prisma.circle.findUnique({
      where: { id: req.params.id },
      select: {
        name: true,
        members: { select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true } } } },
      },
    });
    if (circle) {
      const otherMembers = circle.members.filter(m => m.userId !== req.userId);

      if (io) {
        for (const m of otherMembers) {
          io.to(`user:${m.userId}`).emit('notification', {
            type: 'new_plan',
            planId: plan.id,
            planTitle: plan.title,
            circleId: req.params.id,
            circleName: circle.name,
            from: plan.creator.pseudo,
          });
        }
      }

      const recipients = otherMembers.filter(m => m.user.email && m.user.emailVerified);
      await Promise.all(recipients.map(m => resend.emails.send({
        from: FROM_EMAIL,
        to: m.user.email!,
        subject: `Nouveau Plan dans "${circle.name}" — ${plan.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${m.user.pseudo} 👋</h2>
            <p><strong>${plan.creator.pseudo}</strong> a créé un nouveau Plan dans le Cercle <strong>"${circle.name}"</strong> :</p>
            <p style="font-size:16px;font-weight:600;margin:16px 0">${plan.title}</p>
            <a href="${APP_URL}/dashboard?planId=${plan.id}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le Plan
            </a>
          </div>`,
      }).then(r => { if (r.error) console.error('[new_plan email]', m.user.email, r.error); })
        .catch(e => console.error('[new_plan email]', m.user.email, e))));
    }
  } catch (e) {
    console.error('[new_plan notify]', e);
  }
});

// Toggle delete vote — deletes circle if threshold reached
router.post('/:id/vote-delete', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const existing = await prisma.circleDeleteVote.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });

  if (existing) {
    await prisma.circleDeleteVote.delete({ where: { userId_circleId: { userId, circleId } } });
  } else {
    await prisma.circleDeleteVote.create({ data: { userId, circleId } });
  }

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: circleInclude,
  });
  if (!circle) { res.json({ deleted: true }); return; }

  const threshold = Math.ceil(circle.members.length / 2);
  const voteCount = circle.deleteVotes.length;

  if (voteCount >= threshold) {
    await prisma.circle.delete({ where: { id: circleId } });
    res.json({ deleted: true });
    return;
  }

  res.json({ deleted: false, circle, votes: voteCount, threshold });
});

// Quitter un Cercle de son plein gré. Si le créateur part et qu'il reste
// d'autres membres, le rôle de créateur passe au membre le plus ancien.
// Si le créateur part et qu'il était seul, le Cercle est supprimé.
router.post('/:id/leave', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const circle = await prisma.circle.findUnique({ where: { id: circleId } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }

  if (circle.creatorId === userId) {
    const nextMember = await prisma.circleMember.findFirst({
      where: { circleId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
    });

    if (!nextMember) {
      await prisma.circle.delete({ where: { id: circleId } });
      res.json({ left: true, circleDeleted: true });
      return;
    }

    await prisma.$transaction([
      prisma.circle.update({ where: { id: circleId }, data: { creatorId: nextMember.userId } }),
      prisma.circleMember.update({
        where: { userId_circleId: { userId: nextMember.userId, circleId } },
        data: { role: 'admin' },
      }),
      prisma.circleDeleteVote.deleteMany({ where: { userId, circleId } }),
      prisma.planMember.deleteMany({ where: { userId, plan: { circleId } } }),
      prisma.circleMember.delete({ where: { userId_circleId: { userId, circleId } } }),
    ]);
    res.json({ left: true, circleDeleted: false });
    return;
  }

  await prisma.$transaction([
    prisma.circleDeleteVote.deleteMany({ where: { userId, circleId } }),
    prisma.planMember.deleteMany({ where: { userId, plan: { circleId } } }),
    prisma.circleMember.delete({ where: { userId_circleId: { userId, circleId } } }),
  ]);
  res.json({ left: true, circleDeleted: false });
});

export default router;
