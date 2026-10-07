import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import {
  FOR_WHOM_MAX, IDEA_MAX, PAY_INFO_MAX, POT_CURRENCIES, POT_DISABLED_ERROR, REMINDER_GAP_MS, canManagePot,
  formatPotAmount, parseAmount, parseOptionalAmount, parseUrl, potEnabled, potTotals,
} from '../lib/giftPot';

// Cagnotte cadeau commune (lib/giftPot.ts), montée dans le routeur des Plans (/api/plans).
// Montants individuels : organisateur seulement. Participer : membre du Plan avec un compte, quelle
// que soit sa réponse (on peut participer au cadeau sans venir à la fête).
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;
const label = (p?: { pseudo: string; firstName: string | null } | null) => (p ? p.firstName ?? `@${p.pseudo}` : 'Quelqu’un');

async function load(req: AuthRequest, res: any) {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !potEnabled(plan)) { res.status(403).json({ error: POT_DISABLED_ERROR }); return null; }
  const pot = await prisma.giftPot.upsert({ where: { planId: plan.id }, create: { planId: plan.id }, update: {} });
  const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId: req.userId!, planId: plan.id } }, select: { rsvp: true } });
  return { plan, pot, member };
}

async function requireManager(req: AuthRequest, res: any, plan: { creatorId: string; circleId: string }) {
  if (await canManagePot(req.userId!, plan)) return true;
  res.status(403).json({ error: 'Réservé à l’organisateur' });
  return false;
}

function notify(req: AuthRequest, plan: { id: string; title: string; circleId: string }, userId: string, preview: string, actorId?: string) {
  notifyUser(req.app.get('io'), userId, { type: 'pot', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview, ...(actorId ? { actorId } : {}) });
}

// GET /:id/pot
router.get('/:id/pot', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { plan, pot } = ctx;
  const me = req.userId!;
  const manager = await canManagePot(me, plan);
  const [pledges, ideas, members] = await Promise.all([
    prisma.giftPledge.findMany({ where: { planId: plan.id }, include: { user: person }, orderBy: { createdAt: 'asc' } }),
    prisma.giftIdea.findMany({ where: { planId: plan.id }, include: { createdBy: person, votes: { select: { userId: true } } }, orderBy: { createdAt: 'asc' } }),
    manager ? prisma.planMember.findMany({ where: { planId: plan.id, user: { isLight: false } }, select: { rsvp: true, user: person } }) : Promise.resolve([]),
  ]);
  const mine = pledges.find(p => p.userId === me);
  const pledged = new Set(pledges.map(p => p.userId));
  res.json({
    canManage: manager,
    isMember: !!ctx.member,
    forWhom: pot.forWhom, target: pot.target, suggested: pot.suggested, currency: pot.currency, payInfo: pot.payInfo,
    closed: !!pot.closedAt,
    chosenIdeaId: pot.chosenIdeaId,
    ...potTotals(pledges),
    // Qui participe (sans montant) : visible de tous
    contributors: pledges.map(p => p.user),
    myPledge: mine ? { amount: mine.amount, declaredPaid: !!mine.declaredPaidAt, received: !!mine.receivedAt } : null,
    // Détail par personne : organisateur seulement
    pledges: manager ? pledges.map(p => ({ user: p.user, amount: p.amount, declaredPaid: !!p.declaredPaidAt, received: !!p.receivedAt })) : null,
    // Pas encore participé (hors organisateur, qui collecte)
    notYet: manager ? members.filter(m => !pledged.has(m.user.id) && m.rsvp !== 'out' && m.user.id !== plan.creatorId).map(m => m.user) : null,
    canRemind: manager && !pot.closedAt && (!pot.lastReminderAt || Date.now() - pot.lastReminderAt.getTime() > REMINDER_GAP_MS),
    ideas: ideas
      .map(i => ({ id: i.id, text: i.text, url: i.url, price: i.price, createdBy: i.createdBy, votes: i.votes.length, myVote: i.votes.some(v => v.userId === me), canDelete: manager || i.createdById === me }))
      .sort((a, b) => b.votes - a.votes),
  });
});

// PUT /:id/pot — réglages (organisateur)
router.put('/:id/pot', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.forWhom !== undefined) {
    const v = typeof b.forWhom === 'string' ? b.forWhom.trim() : '';
    if (v.length > FOR_WHOM_MAX) { res.status(400).json({ error: `Pour qui : ${FOR_WHOM_MAX} caractères maximum` }); return; }
    data.forWhom = v || null;
  }
  for (const k of ['target', 'suggested'] as const) {
    if (b[k] !== undefined) {
      const v = parseOptionalAmount(b[k]);
      if (v === undefined) { res.status(400).json({ error: 'Montant invalide' }); return; }
      data[k] = v;
    }
  }
  if (b.currency !== undefined) {
    if (!(POT_CURRENCIES as readonly string[]).includes(b.currency)) { res.status(400).json({ error: 'Devise inconnue' }); return; }
    data.currency = b.currency;
  }
  if (b.payInfo !== undefined) {
    const v = typeof b.payInfo === 'string' ? b.payInfo.trim() : '';
    if (v.length > PAY_INFO_MAX) { res.status(400).json({ error: `Comment payer : ${PAY_INFO_MAX} caractères maximum` }); return; }
    data.payInfo = v || null;
  }
  if (b.chosenIdeaId !== undefined) {
    if (b.chosenIdeaId && !(await prisma.giftIdea.findFirst({ where: { id: String(b.chosenIdeaId), planId: ctx.plan.id } }))) { res.status(404).json({ error: 'Idée introuvable' }); return; }
    data.chosenIdeaId = b.chosenIdeaId || null;
  }
  await prisma.giftPot.update({ where: { planId: ctx.plan.id }, data });
  res.json({ ok: true });
});

// PUT /:id/pot/pledge { amount } — ma participation
router.put('/:id/pot/pledge', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!ctx.member) { res.status(403).json({ error: 'Rejoins le Plan pour participer' }); return; }
  if (ctx.pot.closedAt) { res.status(400).json({ error: 'La cagnotte est close' }); return; }
  const amount = parseAmount(req.body?.amount);
  if (amount === null) { res.status(400).json({ error: 'Montant invalide' }); return; }
  const existing = await prisma.giftPledge.findUnique({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } } });
  if (existing?.receivedAt && existing.amount !== amount) { res.status(400).json({ error: 'Ta participation a déjà été reçue : demande à l’organisateur pour la changer' }); return; }
  await prisma.giftPledge.upsert({
    where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } },
    create: { planId: ctx.plan.id, userId: req.userId!, amount }, update: { amount },
  });
  res.json({ ok: true });
  if (!existing && ctx.plan.creatorId !== req.userId) {
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { pseudo: true, firstName: true } });
    notify(req, ctx.plan, ctx.plan.creatorId, `🎁 ${label(me)} participe à la cagnotte (${formatPotAmount(amount, ctx.pot.currency)})`, req.userId!);
  }
});

// DELETE /:id/pot/pledge — retirer ma participation (tant qu'elle n'est pas reçue)
router.delete('/:id/pot/pledge', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const existing = await prisma.giftPledge.findUnique({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } } });
  if (!existing) { res.json({ ok: true }); return; }
  if (existing.receivedAt) { res.status(400).json({ error: 'Ta participation a déjà été reçue : demande à l’organisateur' }); return; }
  await prisma.giftPledge.delete({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } } });
  res.json({ ok: true });
});

// PUT /:id/pot/pledge/paid { paid } — « J'ai payé »
router.put('/:id/pot/pledge/paid', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const paid = req.body?.paid === true;
  const { count } = await prisma.giftPledge.updateMany({ where: { planId: ctx.plan.id, userId: req.userId! }, data: { declaredPaidAt: paid ? new Date() : null } });
  if (!count) { res.status(404).json({ error: 'Indique d’abord ta participation' }); return; }
  res.json({ ok: true });
  if (paid && ctx.plan.creatorId !== req.userId) {
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { pseudo: true, firstName: true } });
    notify(req, ctx.plan, ctx.plan.creatorId, `💸 ${label(me)} dit avoir payé sa part de la cagnotte`, req.userId!);
  }
});

// PUT /:id/pot/pledges/:userId { received, amount? } — l'organisateur confirme la réception
router.put('/:id/pot/pledges/:userId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const data: { receivedAt?: Date | null; amount?: number } = {};
  if (req.body?.received !== undefined) data.receivedAt = req.body.received === true ? new Date() : null;
  if (req.body?.amount !== undefined) {
    const a = parseAmount(req.body.amount);
    if (a === null) { res.status(400).json({ error: 'Montant invalide' }); return; }
    data.amount = a;
  }
  const { count } = await prisma.giftPledge.updateMany({ where: { planId: ctx.plan.id, userId: req.params.userId }, data });
  if (!count) { res.status(404).json({ error: 'Participation introuvable' }); return; }
  res.json({ ok: true });
  if (data.receivedAt && req.params.userId !== req.userId) notify(req, ctx.plan, req.params.userId, '✅ Ta participation à la cagnotte est bien reçue, merci !', req.userId!);
});

// POST /:id/pot/ideas { text, url?, price? } — proposer une idée de cadeau
router.post('/:id/pot/ideas', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!ctx.member) { res.status(403).json({ error: 'Rejoins le Plan pour proposer une idée' }); return; }
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > IDEA_MAX) { res.status(400).json({ error: `Idée : de 1 à ${IDEA_MAX} caractères` }); return; }
  const url = parseUrl(req.body?.url);
  if (url === undefined) { res.status(400).json({ error: 'Lien invalide (il doit commencer par https://)' }); return; }
  const price = parseOptionalAmount(req.body?.price);
  if (price === undefined) { res.status(400).json({ error: 'Prix invalide' }); return; }
  if (await prisma.giftIdea.count({ where: { planId: ctx.plan.id } }) >= 30) { res.status(400).json({ error: '30 idées au maximum' }); return; }
  const idea = await prisma.giftIdea.create({ data: { planId: ctx.plan.id, text, url, price, createdById: req.userId! } });
  await prisma.giftIdeaVote.create({ data: { ideaId: idea.id, userId: req.userId! } });
  res.json({ ok: true });
});

// DELETE /:id/pot/ideas/:ideaId — par son auteur ou l'organisateur
router.delete('/:id/pot/ideas/:ideaId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const idea = await prisma.giftIdea.findFirst({ where: { id: req.params.ideaId, planId: ctx.plan.id } });
  if (!idea) { res.status(404).json({ error: 'Idée introuvable' }); return; }
  if (idea.createdById !== req.userId && !(await canManagePot(req.userId!, ctx.plan))) { res.status(403).json({ error: 'Réservé à son auteur et à l’organisateur' }); return; }
  await prisma.giftIdea.delete({ where: { id: idea.id } });
  if (ctx.pot.chosenIdeaId === idea.id) await prisma.giftPot.update({ where: { planId: ctx.plan.id }, data: { chosenIdeaId: null } });
  res.json({ ok: true });
});

// POST /:id/pot/ideas/:ideaId/vote — voter / retirer son vote (plusieurs idées possibles)
router.post('/:id/pot/ideas/:ideaId/vote', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!ctx.member) { res.status(403).json({ error: 'Rejoins le Plan pour voter' }); return; }
  const idea = await prisma.giftIdea.findFirst({ where: { id: req.params.ideaId, planId: ctx.plan.id } });
  if (!idea) { res.status(404).json({ error: 'Idée introuvable' }); return; }
  const key = { ideaId_userId: { ideaId: idea.id, userId: req.userId! } };
  if (await prisma.giftIdeaVote.findUnique({ where: key })) await prisma.giftIdeaVote.delete({ where: key });
  else await prisma.giftIdeaVote.create({ data: { ideaId: idea.id, userId: req.userId! } });
  res.json({ ok: true });
});

// POST /:id/pot/remind — relancer (organisateur) : ceux qui n'ont pas participé, et ceux qui n'ont
// pas encore payé ; une fois toutes les 12 heures au plus
router.post('/:id/pot/remind', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.pot.closedAt) { res.status(400).json({ error: 'La cagnotte est close' }); return; }
  const claimed = await prisma.giftPot.updateMany({
    where: { planId: ctx.plan.id, OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(Date.now() - REMINDER_GAP_MS) } }] },
    data: { lastReminderAt: new Date() },
  });
  if (!claimed.count) { res.status(429).json({ error: 'Une relance a déjà été envoyée il y a moins de 12 heures' }); return; }
  const [members, pledges] = await Promise.all([
    prisma.planMember.findMany({ where: { planId: ctx.plan.id, rsvp: { not: 'out' }, user: { isLight: false } }, select: { userId: true } }),
    prisma.giftPledge.findMany({ where: { planId: ctx.plan.id } }),
  ]);
  const pledged = new Set(pledges.map(p => p.userId));
  const forWhom = ctx.pot.forWhom ? ` pour ${ctx.pot.forWhom}` : '';
  let sent = 0;
  for (const m of members) {
    if (m.userId === req.userId || m.userId === ctx.plan.creatorId || pledged.has(m.userId)) continue;
    notify(req, ctx.plan, m.userId, `🎁 Tu participes à la cagnotte${forWhom} ?`, req.userId!); sent++;
  }
  for (const p of pledges) {
    if (p.userId === req.userId || p.declaredPaidAt || p.receivedAt) continue;
    notify(req, ctx.plan, p.userId, `💸 Petit rappel : ta part de la cagnotte${forWhom} (${formatPotAmount(p.amount, ctx.pot.currency)})`, req.userId!); sent++;
  }
  res.json({ ok: true, sent });
});

// POST /:id/pot/close { closed } — clore / rouvrir la cagnotte (organisateur)
router.post('/:id/pot/close', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const closed = req.body?.closed !== false;
  await prisma.giftPot.update({ where: { planId: ctx.plan.id }, data: { closedAt: closed ? new Date() : null } });
  res.json({ ok: true });
  if (closed) {
    const pledges = await prisma.giftPledge.findMany({ where: { planId: ctx.plan.id } });
    const { total } = potTotals(pledges);
    for (const p of pledges) if (p.userId !== req.userId) notify(req, ctx.plan, p.userId, `🎉 Cagnotte close : ${formatPotAmount(total, ctx.pot.currency)} réunis, merci !`);
  }
});

export default router;
