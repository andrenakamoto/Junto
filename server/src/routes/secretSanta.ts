import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { encryptMessage, decryptMessage } from '../lib/messageCrypto';
import {
  BUDGET_MAX, SANTA_DISABLED_ERROR, SANTA_MESSAGE_MAX, WISH_MAX, addToSanta, canManageSanta, drawPairs, pairKey,
  santaEnabled, santaParticipants,
} from '../lib/secretSanta';

// Père Noël secret (lib/secretSanta.ts), monté dans le routeur des Plans (/api/plans) : même
// authentification et même diffusion temps réel (lib/realtime.ts, sans données dans l'événement).
// Règle d'or : une réponse ne contient jamais la paire de quelqu'un d'autre avant la révélation,
// ni l'identité du Père Noël de la personne qui demande.
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;

// Plan visible + fonction activée ; crée la ligne SecretSanta au premier accès
async function load(req: AuthRequest, res: any) {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, eventDate: true, endDate: true, enabledFeatures: true } });
  if (!plan || !santaEnabled(plan)) { res.status(403).json({ error: SANTA_DISABLED_ERROR }); return null; }
  const santa = await prisma.secretSanta.upsert({ where: { planId: plan.id }, create: { planId: plan.id }, update: {} });
  return { plan, santa, access };
}

async function requireManager(req: AuthRequest, res: any, plan: { creatorId: string; circleId: string }) {
  if (await canManageSanta(req.userId!, plan)) return true;
  res.status(403).json({ error: 'Réservé à l’organisateur' });
  return false;
}

// La révélation n'est possible qu'à partir du jour de l'échange (date du Plan)
const canRevealNow = (eventDate: Date | null) => !!eventDate && Date.now() >= eventDate.getTime();

// 'wish' : envies notées ; 'none' : « pas d'envie particulière » ; 'pending' : pas encore répondu
const wishStatus = (w?: { text: string; noWish: boolean }) => (w?.text.trim() ? 'wish' : w?.noWish ? 'none' : 'pending');

// GET /:id/santa — ce que la personne a le droit de voir
router.get('/:id/santa', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { plan, santa } = ctx;
  const me = req.userId!;
  const manager = await canManageSanta(me, plan);
  const [participants, wishes, pairs, exclusions] = await Promise.all([
    santaParticipants(plan.id),
    prisma.secretSantaWish.findMany({ where: { planId: plan.id }, select: { userId: true, text: true, noWish: true } }),
    prisma.secretSantaPair.findMany({ where: { planId: plan.id }, include: { giver: person, receiver: person } }),
    manager ? prisma.secretSantaExclusion.findMany({ where: { planId: plan.id } }) : Promise.resolve([]),
  ]);
  const myPair = pairs.find(p => p.giverId === me);
  const mySanta = pairs.find(p => p.receiverId === me);
  const thread = async (giverId: string, receiverId: string, iAmGiver: boolean) => (await prisma.secretSantaMessage.findMany({
    where: { planId: plan.id, giverId, receiverId }, orderBy: { createdAt: 'asc' },
  })).map(m => ({ id: m.id, mine: m.fromGiver === iAmGiver, content: decryptMessage(m.content), createdAt: m.createdAt }));
  const paired = new Set(pairs.map(p => p.giverId));
  const nameOf = (id: string) => participants.find(p => p.id === id);
  res.json({
    budget: santa.budget,
    drawn: !!santa.drawnAt,
    revealed: !!santa.revealedAt,
    canManage: manager,
    canReveal: !!santa.drawnAt && !santa.revealedAt && canRevealNow(plan.eventDate),
    eventDate: plan.eventDate,
    endDate: plan.endDate,
    // Liste d'envies : facultative, mais chacun répond (envies notées, ou « pas d'envie particulière »)
    participants: participants.map(p => ({ ...p, wishStatus: wishStatus(wishes.find(w => w.userId === p.id)) })),
    myWish: wishes.find(w => w.userId === me)?.text ?? '',
    myNoWish: wishes.find(w => w.userId === me)?.noWish ?? false,
    // Exclusions : visibles par l'organisateur seulement
    exclusions: exclusions.map(e => ({ id: e.id, a: nameOf(e.userAId) ?? { id: e.userAId }, b: nameOf(e.userBId) ?? { id: e.userBId } })),
    me: myPair ? {
      receiver: myPair.receiver,
      receiverWish: wishes.find(w => w.userId === myPair.receiverId)?.text ?? '',
      receiverWishStatus: wishStatus(wishes.find(w => w.userId === myPair.receiverId)),
      giftReady: myPair.giftReady,
      withReceiver: await thread(me, myPair.receiverId, true),
    } : null,
    // Conversation avec mon Père Noël : jamais son identité (avant la révélation)
    santa: mySanta ? { withSanta: await thread(mySanta.giverId, me, false) } : null,
    readyCount: pairs.filter(p => p.giftReady).length,
    pairCount: pairs.length,
    // Après le tirage, participants pas encore dans le tirage (arrivés après) : organisateur seulement
    unpaired: manager && santa.drawnAt ? participants.filter(p => !paired.has(p.id)) : [],
    reveal: santa.revealedAt ? pairs.map(p => ({ giver: p.giver, receiver: p.receiver })) : null,
  });
});

// PUT /:id/santa — budget et exclusions (organisateur ; exclusions seulement avant le tirage)
router.put('/:id/santa', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const { budget, exclusions } = req.body ?? {};
  const data: { budget?: string | null } = {};
  if (budget !== undefined) {
    const b = typeof budget === 'string' ? budget.trim() : '';
    if (b.length > BUDGET_MAX) { res.status(400).json({ error: `Budget : ${BUDGET_MAX} caractères maximum` }); return; }
    data.budget = b || null;
  }
  if (exclusions !== undefined) {
    if (ctx.santa.drawnAt) { res.status(400).json({ error: 'Le tirage est déjà fait : les exclusions ne peuvent plus changer' }); return; }
    if (!Array.isArray(exclusions) || exclusions.length > 100) { res.status(400).json({ error: 'Exclusions invalides' }); return; }
    const ids = new Set((await santaParticipants(ctx.plan.id)).map(p => p.id));
    const clean = new Map<string, [string, string]>();
    for (const e of exclusions) {
      if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || typeof e[1] !== 'string' || e[0] === e[1]) continue;
      if (!ids.has(e[0]) || !ids.has(e[1])) continue;
      const [a, b] = e[0] < e[1] ? [e[0], e[1]] : [e[1], e[0]];
      clean.set(pairKey(a, b), [a, b]);
    }
    await prisma.$transaction([
      prisma.secretSantaExclusion.deleteMany({ where: { planId: ctx.plan.id } }),
      prisma.secretSantaExclusion.createMany({ data: [...clean.values()].map(([userAId, userBId]) => ({ planId: ctx.plan.id, userAId, userBId })) }),
    ]);
  }
  if (Object.keys(data).length) await prisma.secretSanta.update({ where: { planId: ctx.plan.id }, data });
  res.json({ ok: true });
});

// PUT /:id/santa/wish { text } ou { noWish: true } — ma liste d'envies (participant)
router.put('/:id/santa/wish', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (ctx.santa.revealedAt) { res.status(400).json({ error: 'Le Père Noël secret est terminé' }); return; }
  const noWish = req.body?.noWish === true;
  const text = noWish ? '' : typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text.length > WISH_MAX) { res.status(400).json({ error: `Liste d’envies : ${WISH_MAX} caractères maximum` }); return; }
  const isParticipant = (await santaParticipants(ctx.plan.id)).some(p => p.id === req.userId);
  if (!isParticipant) { res.status(403).json({ error: 'Réponds « Je suis in » pour participer' }); return; }
  await prisma.secretSantaWish.upsert({
    where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } },
    create: { planId: ctx.plan.id, userId: req.userId!, text, noWish }, update: { text, noWish },
  });
  res.json({ ok: true });
});

// POST /:id/santa/draw — le tirage (organisateur), une seule fois
router.post('/:id/santa/draw', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.santa.drawnAt) { res.status(409).json({ error: 'Le tirage est déjà fait' }); return; }
  const participants = await santaParticipants(ctx.plan.id);
  if (participants.length < 3) { res.status(400).json({ error: 'Il faut au moins 3 participants (« Je suis in », avec un compte)' }); return; }
  const exclusions = await prisma.secretSantaExclusion.findMany({ where: { planId: ctx.plan.id } });
  const pairs = drawPairs(participants.map(p => p.id), new Set(exclusions.map(e => pairKey(e.userAId, e.userBId))));
  if (!pairs) { res.status(400).json({ error: 'Tirage impossible avec ces exclusions : retire-en une' }); return; }
  // Réservation atomique : deux clics simultanés ne font pas deux tirages
  const claimed = await prisma.secretSanta.updateMany({ where: { planId: ctx.plan.id, drawnAt: null }, data: { drawnAt: new Date() } });
  if (claimed.count === 0) { res.status(409).json({ error: 'Le tirage est déjà fait' }); return; }
  await prisma.secretSantaPair.createMany({ data: [...pairs.entries()].map(([giverId, receiverId]) => ({ planId: ctx.plan.id, giverId, receiverId })) });
  res.json({ ok: true, count: pairs.size });
  const io = req.app.get('io');
  for (const p of participants) {
    notifyUser(io, p.id, { type: 'santa_draw', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, preview: '🎅 Le tirage est fait : découvre à qui tu offres un cadeau !' });
  }
});

// POST /:id/santa/add — intégrer les participants arrivés après le tirage (organisateur)
router.post('/:id/santa/add', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!ctx.santa.drawnAt || ctx.santa.revealedAt) { res.status(400).json({ error: 'Pas de tirage en cours' }); return; }
  const pairs = await prisma.secretSantaPair.findMany({ where: { planId: ctx.plan.id }, select: { giverId: true } });
  const paired = new Set(pairs.map(p => p.giverId));
  const newcomers = (await santaParticipants(ctx.plan.id)).filter(p => !paired.has(p.id));
  const { added, failed } = await addToSanta(ctx.plan.id, newcomers.map(p => p.id));
  res.json({ added: added.length, failed: failed.length });
  const io = req.app.get('io');
  for (const id of added) notifyUser(io, id, { type: 'santa_draw', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, preview: '🎅 Tu fais partie du Père Noël secret : découvre à qui tu offres un cadeau !' });
});

// PUT /:id/santa/ready { ready } — mon cadeau est prêt
router.put('/:id/santa/ready', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { count } = await prisma.secretSantaPair.updateMany({ where: { planId: ctx.plan.id, giverId: req.userId! }, data: { giftReady: req.body?.ready === true } });
  if (!count) { res.status(404).json({ error: 'Tu ne fais pas partie du tirage' }); return; }
  res.json({ ok: true });
});

// POST /:id/santa/messages { to: 'receiver' | 'santa', content } — messagerie anonyme
router.post('/:id/santa/messages', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (ctx.santa.revealedAt) { res.status(400).json({ error: 'Le Père Noël secret est terminé' }); return; }
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > SANTA_MESSAGE_MAX) { res.status(400).json({ error: 'Message vide ou trop long' }); return; }
  const me = req.userId!;
  const pair = req.body?.to === 'receiver'
    ? await prisma.secretSantaPair.findUnique({ where: { planId_giverId: { planId: ctx.plan.id, giverId: me } } })
    : await prisma.secretSantaPair.findUnique({ where: { planId_receiverId: { planId: ctx.plan.id, receiverId: me } } });
  if (!pair) { res.status(404).json({ error: 'Conversation introuvable' }); return; }
  const fromGiver = pair.giverId === me;
  await prisma.secretSantaMessage.create({ data: { planId: ctx.plan.id, giverId: pair.giverId, receiverId: pair.receiverId, fromGiver, content: encryptMessage(content) } });
  res.json({ ok: true });
  const io = req.app.get('io');
  if (fromGiver) {
    // Anonyme : ni « from », ni actorId (l'auteur ne doit pas transparaître, même via les filtres)
    notifyUser(io, pair.receiverId, { type: 'santa_message', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, preview: '🎅 Ton Père Noël secret t’a écrit' });
  } else {
    const meUser = await prisma.user.findUnique({ where: { id: me }, select: { pseudo: true, firstName: true } });
    notifyUser(io, pair.giverId, { type: 'santa_message', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, actorId: me, from: meUser?.pseudo, preview: `🎁 ${meUser?.firstName ?? '@' + meUser?.pseudo} t’a répondu` });
  }
});

// POST /:id/santa/reveal — tout révéler (organisateur), à partir du jour de l'échange
router.post('/:id/santa/reveal', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!ctx.santa.drawnAt || ctx.santa.revealedAt) { res.status(400).json({ error: 'Rien à révéler' }); return; }
  if (!canRevealNow(ctx.plan.eventDate)) { res.status(400).json({ error: 'La révélation est possible à partir du jour de l’échange' }); return; }
  await prisma.secretSanta.update({ where: { planId: ctx.plan.id }, data: { revealedAt: new Date() } });
  res.json({ ok: true });
  const io = req.app.get('io');
  for (const p of await santaParticipants(ctx.plan.id)) {
    notifyUser(io, p.id, { type: 'santa_reveal', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, preview: '🎅 Découvre qui était le Père Noël secret de chacun !' });
  }
});

// POST /:id/santa/reset — refaire le tirage avant la révélation (organisateur) : paires et messages effacés
router.post('/:id/santa/reset', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.santa.revealedAt) { res.status(400).json({ error: 'Le Père Noël secret est terminé' }); return; }
  await prisma.$transaction([
    prisma.secretSantaPair.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.secretSantaMessage.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.secretSanta.update({ where: { planId: ctx.plan.id }, data: { drawnAt: null, weekReminderSentAt: null } }),
  ]);
  res.json({ ok: true });
});

export default router;
