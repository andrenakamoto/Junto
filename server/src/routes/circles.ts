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
interface NewPlanInput {
  title: string;
  description: string;
  eventDate?: string | null;
  endDate: string;
  location?: string | null;
  maxParticipants?: string | number | null;
}

// Crée un Plan dans un Cercle et notifie les membres (temps réel + email).
// Partagé entre POST /:id/plans et la conversion d'un CirclePoll en Plan.
async function createPlanInCircle(app: any, circleId: string, creatorId: string, input: NewPlanInput) {
  const { title, description, eventDate, endDate, location, maxParticipants } = input;
  if (!title?.trim() || !description?.trim()) return { error: 'Titre et description requis' as const };
  if (!endDate) return { error: 'Date de fin obligatoire' as const };
  const parsedEndDate = new Date(endDate);
  if (isNaN(parsedEndDate.getTime()) || parsedEndDate <= new Date()) {
    return { error: 'La date de fin doit être dans le futur' as const };
  }
  let parsedMaxParticipants: number | null = null;
  if (maxParticipants !== undefined && maxParticipants !== null && maxParticipants !== '') {
    parsedMaxParticipants = parseInt(String(maxParticipants), 10);
    if (isNaN(parsedMaxParticipants) || parsedMaxParticipants < 1) {
      return { error: 'Limite de participants invalide' as const };
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
      creatorId,
      circleId,
      members: { create: { userId: creatorId, rsvp: 'in' } },
    },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      _count: { select: { messages: true } },
    },
  });

  notifyNewPlan(app, circleId, plan).catch(e => console.error('[new_plan notify]', e));

  return { plan };
}

// Notifier les membres du cercle (sauf le créateur) — temps réel + email
async function notifyNewPlan(app: any, circleId: string, plan: any) {
  const io = app.get('io');
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: {
      name: true,
      members: { select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true } } } },
    },
  });
  if (!circle) return;
  const otherMembers = circle.members.filter(m => m.userId !== plan.creatorId);

  if (io) {
    for (const m of otherMembers) {
      io.to(`user:${m.userId}`).emit('notification', {
        type: 'new_plan',
        planId: plan.id,
        planTitle: plan.title,
        circleId,
        circleName: circle.name,
        from: plan.creator.pseudo,
      });
    }
  }

  const recipients = otherMembers.filter((m: any) => m.user.email && m.user.emailVerified);
  await Promise.all(recipients.map((m: any) => resend.emails.send({
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

router.post('/:id/plans', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const result = await createPlanInCircle(req.app, req.params.id, req.userId!, req.body);
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }
  res.json(result.plan);
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

// ─── Sondages de Cercle (caler une date avant de créer un Plan) ───────────
// Contrairement aux sondages d'un Plan (choix unique), le vote y est
// multiple : chaque membre coche toutes les options qui lui conviennent.

const circlePollInclude = {
  creator: { select: { id: true, pseudo: true } },
  options: {
    include: { votes: { include: { user: { select: { id: true, pseudo: true } } } } },
  },
};

async function assertCircleMember(userId: string, circleId: string): Promise<boolean> {
  const m = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } } });
  return !!m;
}

router.get('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertCircleMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const polls = await prisma.circlePoll.findMany({
    where: { circleId: req.params.id, resolvedAt: null },
    include: circlePollInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(polls);
});

router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertCircleMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { question, options } = req.body;
  if (!question?.trim() || !Array.isArray(options)) {
    res.status(400).json({ error: 'Question et options requises' });
    return;
  }
  const validOptions = (options as { label?: string; eventDate?: string }[])
    .filter(o => o?.label?.trim());
  if (validOptions.length < 2) {
    res.status(400).json({ error: 'Au moins 2 options valides requises' });
    return;
  }
  const poll = await prisma.circlePoll.create({
    data: {
      question: question.trim(),
      circleId: req.params.id,
      creatorId: req.userId!,
      options: {
        create: validOptions.map(o => ({
          label: o.label!.trim(),
          eventDate: o.eventDate ? new Date(o.eventDate) : null,
        })),
      },
    },
    include: circlePollInclude,
  });
  res.json(poll);

  // Notifier les autres membres du cercle — temps réel + email
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
            type: 'new_circle_poll',
            circleId: req.params.id,
            circleName: circle.name,
            from: poll.creator.pseudo,
            planTitle: poll.question,
          });
        }
      }

      const recipients = otherMembers.filter(m => m.user.email && m.user.emailVerified);
      await Promise.all(recipients.map(m => resend.emails.send({
        from: FROM_EMAIL,
        to: m.user.email!,
        subject: `Sondage de dates dans "${circle.name}" — ${poll.question}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${m.user.pseudo} 👋</h2>
            <p><strong>${poll.creator.pseudo}</strong> propose plusieurs dates dans le Cercle <strong>"${circle.name}"</strong> :</p>
            <p style="font-size:16px;font-weight:600;margin:16px 0">${poll.question}</p>
            <p>Indique les dates qui te conviennent pour aider à trouver le meilleur créneau.</p>
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le sondage
            </a>
          </div>`,
      }).then(r => { if (r.error) console.error('[circle_poll email]', m.user.email, r.error); })
        .catch(e => console.error('[circle_poll email]', m.user.email, e))));
    }
  } catch (e) {
    console.error('[circle_poll notify]', e);
  }
});

router.delete('/polls/:pollId', async (req: AuthRequest, res) => {
  const poll = await prisma.circlePoll.findUnique({ where: { id: req.params.pollId } });
  if (!poll) { res.status(404).json({ error: 'Sondage introuvable' }); return; }
  if (poll.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur du sondage' }); return; }
  await prisma.circlePoll.delete({ where: { id: req.params.pollId } });
  res.json({ ok: true });
});

// Vote (bascule), plusieurs options possibles à la fois
router.post('/polls/options/:optionId/vote', async (req: AuthRequest, res) => {
  const option = await prisma.circlePollOption.findUnique({
    where: { id: req.params.optionId },
    include: { poll: true },
  });
  if (!option) { res.status(404).json({ error: 'Option introuvable' }); return; }
  if (option.poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage est clos' }); return; }
  if (!(await assertCircleMember(req.userId!, option.poll.circleId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const existing = await prisma.circlePollVote.findUnique({
    where: { optionId_userId: { optionId: req.params.optionId, userId: req.userId! } },
  });
  if (existing) {
    await prisma.circlePollVote.delete({ where: { optionId_userId: { optionId: req.params.optionId, userId: req.userId! } } });
  } else {
    await prisma.circlePollVote.create({ data: { optionId: req.params.optionId, userId: req.userId! } });
  }

  const updatedPoll = await prisma.circlePoll.findUnique({ where: { id: option.pollId }, include: circlePollInclude });
  res.json(updatedPoll);
});

// Convertit l'option gagnante d'un sondage en Plan (créateur du sondage uniquement)
router.post('/polls/:pollId/convert', async (req: AuthRequest, res) => {
  const poll = await prisma.circlePoll.findUnique({ where: { id: req.params.pollId }, include: { options: true } });
  if (!poll) { res.status(404).json({ error: 'Sondage introuvable' }); return; }
  if (poll.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur du sondage' }); return; }
  if (poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage a déjà été converti' }); return; }

  const { optionId, title, description, endDate, location, maxParticipants } = req.body;
  const option = poll.options.find(o => o.id === optionId);
  if (!option) { res.status(400).json({ error: 'Option invalide' }); return; }

  const result = await createPlanInCircle(req.app, poll.circleId, req.userId!, {
    title, description, endDate, location, maxParticipants,
    eventDate: option.eventDate?.toISOString() ?? null,
  });
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }

  await prisma.circlePoll.update({
    where: { id: poll.id },
    data: { resolvedAt: new Date(), createdPlanId: result.plan.id },
  });

  res.json(result.plan);
});

export default router;
