import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth as any);

async function assertPlanMember(userId: string, planId: string): Promise<boolean> {
  const m = await prisma.planMember.findUnique({
    where: { userId_planId: { userId, planId } },
  });
  return !!m;
}

const planInclude = {
  creator: { select: { id: true, pseudo: true } },
  members: { include: { user: { select: { id: true, pseudo: true } } } },
  deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
  polls: { include: { options: { include: { votes: true } } }, orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { id: 'asc' as const } },
  changeLogs: { orderBy: { changedAt: 'asc' as const } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
};

function sameMinute(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000);
}

// Un sondage anonyme masque l'identité des votants (sauf la sienne propre)
function anonymizePoll(poll: any, userId: string) {
  if (!poll?.anonymous) return poll;
  return {
    ...poll,
    options: poll.options.map((o: any) => ({
      ...o,
      votes: o.votes.map((v: any, i: number) => (v.userId === userId ? v : { ...v, userId: `anon-${i}` })),
    })),
  };
}

function anonymizePlanPolls(plan: any, userId: string) {
  if (!plan?.polls) return plan;
  return { ...plan, polls: plan.polls.map((p: any) => anonymizePoll(p, userId)) };
}

// Get all plans from all circles the user is a member of
router.get('/', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const plans = await prisma.plan.findMany({
      where: {
        archived: false,
        endDate: { gt: now },
        circle: { members: { some: { userId: req.userId } } },
      },
      include: {
        creator: { select: { id: true, pseudo: true } },
        members: { include: { user: { select: { id: true, pseudo: true } } } },
        deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
        circle: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
    });
    res.json(plans);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get plan detail (full)
router.get('/:id', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: planInclude,
  });
  if (!plan) {
    res.status(404).json({ error: 'Plan introuvable' });
    return;
  }
  const circleMember = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
  });
  if (!circleMember) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  res.json(anonymizePlanPolls(plan, req.userId!));
});

// Update plan (creator only)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
    if (plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur' }); return; }

    const { title, description, eventDate, endDate, maxParticipants } = req.body;
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Titre et description requis' }); return;
    }
    if (!endDate) {
      res.status(400).json({ error: 'Date de fin requise' }); return;
    }

    const newEventDate = eventDate ? new Date(eventDate) : null;
    const newEndDate = new Date(endDate);
    if (isNaN(newEndDate.getTime())) {
      res.status(400).json({ error: 'Date de fin invalide' }); return;
    }
    let newMaxParticipants: number | null = null;
    if (maxParticipants !== undefined && maxParticipants !== null && maxParticipants !== '') {
      newMaxParticipants = parseInt(maxParticipants, 10);
      if (isNaN(newMaxParticipants) || newMaxParticipants < 1) {
        res.status(400).json({ error: 'Limite de participants invalide' }); return;
      }
      const currentCount = await prisma.planMember.count({ where: { planId: req.params.id } });
      if (newMaxParticipants < currentCount) {
        res.status(400).json({ error: `Il y a déjà ${currentCount} membre(s), la limite doit être au moins ${currentCount}` }); return;
      }
    }

    const logs: { planId: string; field: string; oldValue: string | null; newValue: string | null }[] = [];
    const planId = req.params.id;

    if (title.trim() !== plan.title)
      logs.push({ planId, field: 'title', oldValue: plan.title, newValue: title.trim() });
    if (description.trim() !== plan.description)
      logs.push({ planId, field: 'description', oldValue: plan.description, newValue: description.trim() });
    if (!sameMinute(plan.eventDate, newEventDate))
      logs.push({ planId, field: 'eventDate', oldValue: plan.eventDate?.toISOString() ?? null, newValue: newEventDate?.toISOString() ?? null });
    if (!sameMinute(plan.endDate, newEndDate))
      logs.push({ planId, field: 'endDate', oldValue: plan.endDate.toISOString(), newValue: newEndDate.toISOString() });

    await prisma.plan.update({
      where: { id: planId },
      data: { title: title.trim(), description: description.trim(), eventDate: newEventDate, endDate: newEndDate, maxParticipants: newMaxParticipants },
    });

    if (logs.length > 0) {
      await prisma.planChangeLog.createMany({ data: logs });
    }

    const updated = await prisma.plan.findUnique({ where: { id: planId }, include: planInclude });
    res.json(anonymizePlanPolls(updated, req.userId!));
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Join a plan
router.post('/:id/join', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) {
    res.status(404).json({ error: 'Plan introuvable' });
    return;
  }
  const circleMember = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
  });
  if (!circleMember) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const existing = await prisma.planMember.findUnique({
    where: { userId_planId: { userId: req.userId!, planId: req.params.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'Tu es déjà dans ce Plan' });
    return;
  }
  if (plan.maxParticipants !== null) {
    const currentCount = await prisma.planMember.count({ where: { planId: req.params.id } });
    if (currentCount >= plan.maxParticipants) {
      res.status(409).json({ error: 'Ce Plan est complet' });
      return;
    }
  }
  await prisma.planMember.create({ data: { userId: req.userId!, planId: req.params.id, rsvp: 'in' } });
  const updatedPlan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      polls: { include: { options: { include: { votes: true } } } },
      items: true,
    },
  });
  res.json(anonymizePlanPolls(updatedPlan, req.userId!));
});

// Update RSVP
router.put('/:id/rsvp', async (req: AuthRequest, res) => {
  const { rsvp } = req.body;
  if (!['in', 'maybe', 'out'].includes(rsvp)) {
    res.status(400).json({ error: 'RSVP invalide' });
    return;
  }
  try {
    const member = await prisma.planMember.update({
      where: { userId_planId: { userId: req.userId!, planId: req.params.id } },
      data: { rsvp },
    });
    res.json(member);
  } catch {
    res.status(404).json({ error: 'Tu n\'es pas membre de ce Plan' });
  }
});

// Get messages
const messageInclude = {
  author: { select: { id: true, pseudo: true } },
  reactions: { include: { user: { select: { id: true, pseudo: true } } } },
  _count: { select: { replies: true } },
};

router.get('/:id/messages', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const messages = await prisma.message.findMany({
    where: { planId: req.params.id, parentId: null },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(messages);
});

// Fil de réponses d'un message
router.get('/messages/:messageId/replies', async (req: AuthRequest, res) => {
  const parent = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!parent) { res.status(404).json({ error: 'Message introuvable' }); return; }
  if (!(await assertPlanMember(req.userId!, parent.planId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const replies = await prisma.message.findMany({
    where: { parentId: req.params.messageId },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
  });
  res.json(replies);
});

// Create poll
router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { question, options, anonymous } = req.body;
  if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: 'Question et au moins 2 options requises' });
    return;
  }
  const poll = await prisma.poll.create({
    data: {
      question: question.trim(),
      anonymous: !!anonymous,
      planId: req.params.id,
      options: { create: (options as string[]).map((text) => ({ text: text.trim() })) },
    },
    include: { options: { include: { votes: true } } },
  });
  res.json(anonymizePoll(poll, req.userId!));
});

// Vote on a poll option
router.post('/polls/:optionId/vote', async (req: AuthRequest, res) => {
  const option = await prisma.pollOption.findUnique({
    where: { id: req.params.optionId },
    include: { poll: true },
  });
  if (!option) {
    res.status(404).json({ error: 'Option introuvable' });
    return;
  }
  // Remove user's existing votes on this poll
  const siblings = await prisma.pollOption.findMany({ where: { pollId: option.pollId } });
  await prisma.pollVote.deleteMany({
    where: { userId: req.userId!, pollOptionId: { in: siblings.map((s) => s.id) } },
  });
  await prisma.pollVote.create({ data: { userId: req.userId!, pollOptionId: req.params.optionId } });
  const updatedPoll = await prisma.poll.findUnique({
    where: { id: option.pollId },
    include: { options: { include: { votes: true } } },
  });
  res.json(anonymizePoll(updatedPoll, req.userId!));
});

// Add bring item
router.post('/:id/items', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { label } = req.body;
  if (!label?.trim()) {
    res.status(400).json({ error: 'Label requis' });
    return;
  }
  const item = await prisma.bringItem.create({ data: { label: label.trim(), planId: req.params.id } });
  res.json(item);
});

// Claim / unclaim a bring item
router.put('/items/:itemId/claim', async (req: AuthRequest, res) => {
  const item = await prisma.bringItem.findUnique({ where: { id: req.params.itemId } });
  if (!item) {
    res.status(404).json({ error: 'Item introuvable' });
    return;
  }
  const updated = await prisma.bringItem.update({
    where: { id: req.params.itemId },
    data: { claimedBy: item.claimedBy === req.pseudo ? null : req.pseudo },
  });
  res.json(updated);
});

// Toggle vote de suppression — supprime le plan si le seuil est atteint
router.post('/:id/vote-delete', async (req: AuthRequest, res) => {
  const planId = req.params.id;
  const userId = req.userId!;

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { members: true, deleteVotes: true },
  });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

  const isMember = plan.members.some(m => m.userId === userId);
  if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const existingVote = plan.deleteVotes.find(v => v.userId === userId);

  if (existingVote) {
    await prisma.planDeleteVote.delete({ where: { userId_planId: { userId, planId } } });
  } else {
    await prisma.planDeleteVote.create({ data: { userId, planId } });
  }

  const updated = await prisma.plan.findUnique({
    where: { id: planId },
    include: { members: true, deleteVotes: true },
  });

  const voteCount = updated!.deleteVotes.length;
  const threshold = Math.ceil(updated!.members.length / 2);

  if (voteCount >= threshold) {
    await prisma.plan.delete({ where: { id: planId } });
    res.json({ deleted: true });
    return;
  }

  const full = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      polls: { include: { options: { include: { votes: true } } } },
      items: true,
    },
  });
  res.json({ deleted: false, plan: anonymizePlanPolls(full, userId) });
});

// Export iCal (.ics) d'un Plan
function icsEscape(s: string): string {
  return s.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
}
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

router.get('/:id/ical', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const start = plan.eventDate ?? plan.endDate;
  const end = plan.eventDate ? new Date(plan.eventDate.getTime() + 2 * 60 * 60 * 1000) : plan.endDate;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Estelle//Plan//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${plan.id}@estelle.fan`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(plan.title)}`,
    `DESCRIPTION:${icsEscape(plan.description)}`,
    ...(plan.location ? [`LOCATION:${icsEscape(plan.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${plan.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
  res.send(ics);
});

export default router;
