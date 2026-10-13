import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { canSeeMembers } from '../lib/memberPrivacy';
import { getPlanAccess } from '../lib/planAccess';
import { computeByCurrency } from '../lib/expenses';
import { bringSummary, moneySummary, pendingMatches, personName, rideOffers, rideSummary, unansweredPolls } from '../lib/planSummary';

// GET /plans/:id/summary — « En bref » (lib/planSummary.ts), monté dans le routeur des Plans. Réservé aux
// participants « Je suis in » et « Peut-être ». Ne renvoie que ce qui concerne la personne, rubrique par
// rubrique, en respectant les fonctions masquées ou non activées du Plan.
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;

router.get('/:id/summary', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const access = await getPlanAccess(userId, req.params.id);
  if (!access?.canView || !access.isPlanMember) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const planId = req.params.id;
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, title: true, eventDate: true, endDate: true, location: true, importantInfo: true, disabledFeatures: true, enabledFeatures: true, creatorId: true, circleId: true, membersVisibility: true, maxParticipants: true },
  });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const members = await prisma.planMember.findMany({ where: { planId }, select: { userId: true, rsvp: true, user: person } });
  const me = members.find(m => m.userId === userId);
  if (!me || me.rsvp === 'out') { res.status(403).json({ error: 'Le résumé est réservé aux participants' }); return; }
  const on = (f: string) => !plan.disabledFeatures.includes(f);
  const optional = (f: string) => plan.enabledFeatures.includes(f);
  const nameOf = (id: string) => personName(members.find(m => m.userId === id)?.user);

  const [waitlist, rides, requests, items, expenses, reimbursements, polls, matches, pot, shifts, photos] = await Promise.all([
    prisma.planWaitlist.count({ where: { planId } }),
    on('trajets') ? prisma.ride.findMany({ where: { planId }, include: { driver: person, passengers: { select: { userId: true } } } }) : [],
    on('trajets') ? prisma.rideRequest.findMany({ where: { planId }, select: { userId: true, fromLocation: true } }) : [],
    on('depenses') ? prisma.bringItem.findMany({ where: { planId }, select: { label: true, quantity: true, claimedBy: true } }) : [],
    on('depenses') ? prisma.expense.findMany({ where: { planId }, select: { amount: true, currency: true, paidById: true, splitWith: { select: { userId: true } } } }) : [],
    on('depenses') ? prisma.reimbursement.findMany({ where: { planId }, select: { amount: true, currency: true, fromUserId: true, toUserId: true } }) : [],
    on('votes') ? prisma.poll.findMany({ where: { planId }, select: { options: { select: { votes: { select: { userId: true } } } } } }) : [],
    on('votes') ? prisma.matchPoll.findMany({ where: { planId }, select: { closedAt: true, deadline: true, options: { select: { id: true, swipes: { where: { userId }, select: { optionId: true, userId: true } } } } } }) : [],
    optional('cagnotte') ? prisma.giftPot.findUnique({ where: { planId }, select: { forWhom: true, currency: true, closedAt: true, pledges: { where: { userId }, select: { amount: true, declaredPaidAt: true, receivedAt: true } } } }) : null,
    optional('benevoles') ? prisma.volunteerShift.findMany({ where: { planId, signups: { some: { userId } } }, select: { title: true, startsAt: true, endsAt: true }, orderBy: { startsAt: 'asc' } }) : [],
    // Comme le ZIP des photos : images du Plan, sans les photos des matchs ni du quiz
    prisma.attachment.count({ where: { planId, mimeType: { startsWith: 'image/' }, matchOption: null, NOT: [{ name: { startsWith: 'match-' } }, { name: { startsWith: 'quiz-' } }] } }),
  ]);

  const counts = { in: 0, maybe: 0, out: 0 };
  for (const m of members) counts[m.rsvp === 'maybe' ? 'maybe' : m.rsvp === 'out' ? 'out' : 'in']++;
  const pledge = pot?.pledges[0];
  const money = moneySummary(computeByCurrency(members.map(m => m.userId), expenses, reimbursements), userId, nameOf);

  res.json({
    plan: {
      id: plan.id, title: plan.title, eventDate: plan.eventDate, endDate: plan.endDate, location: plan.location,
      importantInfo: plan.importantInfo?.split('\n').map(l => l.trim()).find(Boolean) ?? null,
    },
    myRsvp: me.rsvp,
    // Liste des participants réservée (Mode annonce) : pas de nombre, sauf les places d'un Plan limité
    counts: (await canSeeMembers(plan, userId)) ? { ...counts, waitlist } : null,
    places: plan.maxParticipants != null ? { taken: counts.in + counts.maybe, max: plan.maxParticipants } : null,
    ride: rideSummary(rides, requests, userId),
    rideOffers: rideOffers(rides),
    bring: bringSummary(items, me.user.pseudo),
    money,
    pot: pot && !pot.closedAt
      ? { forWhom: pot.forWhom, currency: pot.currency, amount: pledge?.amount ?? null, status: !pledge ? 'none' : pledge.receivedAt ? 'received' : pledge.declaredPaidAt ? 'paid' : 'pledged' }
      : null,
    shifts: shifts.map(s => ({ title: s.title, startsAt: s.startsAt, endsAt: s.endsAt })),
    todo: {
      polls: unansweredPolls(polls, userId),
      matches: pendingMatches(matches.map(m => ({ ...m, swipes: m.options.flatMap(o => o.swipes) })), userId),
    },
    photos,
  });
});

export default router;
