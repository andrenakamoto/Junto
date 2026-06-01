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

// Get plan detail (full)
router.get('/:id', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      polls: { include: { options: { include: { votes: true } } }, orderBy: { createdAt: 'asc' } },
      items: { orderBy: { id: 'asc' } },
    },
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
  res.json(plan);
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
  res.json(updatedPlan);
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
router.get('/:id/messages', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const messages = await prisma.message.findMany({
    where: { planId: req.params.id },
    include: { author: { select: { id: true, pseudo: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(messages);
});

// Create poll
router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { question, options } = req.body;
  if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: 'Question et au moins 2 options requises' });
    return;
  }
  const poll = await prisma.poll.create({
    data: {
      question: question.trim(),
      planId: req.params.id,
      options: { create: (options as string[]).map((text) => ({ text: text.trim() })) },
    },
    include: { options: { include: { votes: true } } },
  });
  res.json(poll);
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
  res.json(updatedPoll);
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
  res.json({ deleted: false, plan: full });
});

export default router;
