import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { cloudinary } from '../lib/cloudinary';
import { FEATURE_DISABLED_ERROR, IMPORTANT_INFO_MAX } from '../lib/settings';
import {
  MATCH_LABEL_MAX, MATCH_NOTE_MAX, MATCH_OPTIONS_MAX, MATCH_QUESTION_MAX, Swipe, finishedCount, isUnanimous,
  matchPlayers, parseMatchText, parseMatchUrl, rankOptions, remainingFor,
} from '../lib/matchPoll';

// Match de groupe (lib/matchPoll.ts), monté dans le routeur des Plans (/api/plans), dans l'onglet Votes.
// Règle : avant d'avoir fini ses cartes, on ne voit pas les réponses des autres ; les matchs (oui de tous)
// sont visibles de tous.
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;
const label = (p?: { pseudo: string; firstName: string | null } | null) => (p ? p.firstName ?? `@${p.pseudo}` : 'Quelqu’un');

type PlanLite = { id: string; title: string; circleId: string; creatorId: string; disabledFeatures: string[] };

async function loadPlan(req: AuthRequest, res: any, planId: string | undefined): Promise<PlanLite | null> {
  if (!planId) { res.status(404).json({ error: 'Introuvable' }); return null; }
  const access = await getPlanAccess(req.userId!, planId);
  if (!access?.canView || !access.isPlanMember) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true, creatorId: true, disabledFeatures: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  return plan;
}

const writable = (plan: PlanLite, res: any) => {
  if (plan.disabledFeatures.includes('votes')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return false; }
  return true;
};

function notify(req: AuthRequest, plan: PlanLite, userId: string, preview: string, actorId?: string) {
  notifyUser(req.app.get('io'), userId, { type: 'match', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview, ...(actorId ? { actorId } : {}) });
}

// Photo d'une proposition : envoyée par la personne dans ce Plan (POST /attachments/plans/:id?via=match),
// image, pas encore utilisée
async function validPhoto(planId: string, attachmentId: unknown, pseudo: string): Promise<string | null | undefined> {
  if (!attachmentId) return null;
  const att = await prisma.attachment.findUnique({ where: { id: String(attachmentId) }, include: { matchOption: { select: { id: true } }, message: { select: { id: true } } } });
  if (!att || att.planId !== planId || att.uploadedBy.toLowerCase() !== pseudo.toLowerCase() || !att.mimeType.startsWith('image/') || att.matchOption || att.message) return undefined;
  return att.id;
}

async function parseOption(planId: string, body: any, pseudo: string) {
  const text = parseMatchText(body?.label, MATCH_LABEL_MAX);
  if (!text) return { error: `Proposition : de 1 à ${MATCH_LABEL_MAX} caractères` };
  const note = parseMatchText(body?.note, MATCH_NOTE_MAX, false);
  if (note === undefined) return { error: `Précision : ${MATCH_NOTE_MAX} caractères maximum` };
  const url = parseMatchUrl(body?.url);
  if (url === undefined) return { error: 'Lien invalide (il doit commencer par https://)' };
  const attachmentId = await validPhoto(planId, body?.attachmentId, pseudo);
  if (attachmentId === undefined) return { error: 'Photo invalide' };
  return { label: text, note, url, attachmentId };
}

async function destroyPhotos(attachmentIds: string[]) {
  if (!attachmentIds.length) return;
  const atts = await prisma.attachment.findMany({ where: { id: { in: attachmentIds } } });
  for (const a of atts) await cloudinary.uploader.destroy(a.publicId, { resource_type: a.resourceType as any }).catch(e => console.error('[match photo]', e));
  await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
}

// Un oui qui complète l'unanimité : « C'est un match ! » à tous les joueurs (une seule fois)
async function checkMatches(req: AuthRequest, plan: PlanLite, matchId: string) {
  const match = await prisma.matchPoll.findUnique({ where: { id: matchId }, include: { options: true } });
  if (!match || match.closedAt) return;
  const players = await matchPlayers(plan.id);
  const ids = players.map(p => p.userId);
  const swipes = await prisma.matchSwipe.findMany({ where: { matchId }, select: { optionId: true, userId: true, like: true } });
  for (const o of match.options) {
    if (o.matchedAt || !isUnanimous(o.id, ids, swipes)) continue;
    const claimed = await prisma.matchOption.updateMany({ where: { id: o.id, matchedAt: null }, data: { matchedAt: new Date() } });
    if (!claimed.count) continue;
    for (const id of ids) notify(req, plan, id, `❤️ C’est un match : ${o.label} !`);
  }
}

// GET /:id/matches — les matchs du Plan, vus par la personne
router.get('/:id/matches', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan) return;
  const me = req.userId!;
  const [matches, players] = await Promise.all([
    prisma.matchPoll.findMany({
      where: { planId: plan.id }, orderBy: { createdAt: 'asc' },
      include: { createdBy: person, options: { include: { createdBy: person }, orderBy: { createdAt: 'asc' } } },
    }),
    matchPlayers(plan.id),
  ]);
  const swipes = await prisma.matchSwipe.findMany({ where: { matchId: { in: matches.map(m => m.id) } }, select: { optionId: true, userId: true, like: true, matchId: true } });
  const playerIds = players.map(p => p.userId);
  const nameOf = new Map(players.map(p => [p.userId, label(p.user)]));
  const isPlayer = playerIds.includes(me);
  res.json(matches.map(m => {
    const mSwipes: Swipe[] = swipes.filter(s => s.matchId === m.id);
    const remaining = remainingFor(m.options, mSwipes, me);
    const done = m.options.length > 0 && remaining.length === 0;
    const closed = !!m.closedAt;
    const deadlinePassed = !!m.deadline && m.deadline.getTime() <= Date.now();
    const optionIds = m.options.map(o => o.id);
    const finished = finishedCount(optionIds, playerIds, mSwipes);
    // Résultats visibles quand j'ai fini (ou que le match est clos / l'échéance passée, ou que je ne joue pas)
    const showResults = done || closed || deadlinePassed || !isPlayer;
    const ranked = rankOptions(m.options, mSwipes);
    return {
      id: m.id,
      question: m.question,
      anonymous: m.anonymous,
      deadline: m.deadline,
      closed,
      chosenOptionId: m.chosenOptionId,
      createdBy: m.createdBy,
      canDelete: m.createdById === me || plan.creatorId === me,
      canChoose: plan.creatorId === me && !closed,
      isPlayer,
      playerCount: playerIds.length,
      finishedCount: finished,
      allFinished: playerIds.length > 0 && finished === playerIds.length,
      // Mes cartes à jouer, dans mon ordre
      deck: closed || !isPlayer ? [] : remaining.map(o => ({ id: o.id, label: o.label, note: o.note, url: o.url, attachmentId: o.attachmentId, createdBy: o.createdBy })),
      myLikes: mSwipes.filter(s => s.userId === me && s.like).map(s => s.optionId),
      // Les matchs (oui de tous) : visibles de tous
      matchedIds: m.options.filter(o => o.matchedAt).map(o => o.id),
      results: showResults ? ranked.map(o => ({
        id: o.id, label: o.label, note: o.note, url: o.url, attachmentId: o.attachmentId, createdBy: o.createdBy,
        yes: o.yes, no: o.no,
        canDelete: o.createdById === me || plan.creatorId === me,
        likers: m.anonymous ? undefined : mSwipes.filter(s => s.optionId === o.id && s.like).map(s => nameOf.get(s.userId) ?? '?'),
      })) : null,
      optionCount: m.options.length,
    };
  }));
});

// POST /:id/matches { question, options: [{ label, note?, url?, attachmentId? }], anonymous?, deadline? }
router.post('/:id/matches', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan || !writable(plan, res)) return;
  const question = parseMatchText(req.body?.question, MATCH_QUESTION_MAX);
  if (!question) { res.status(400).json({ error: `Question : de 1 à ${MATCH_QUESTION_MAX} caractères` }); return; }
  const raw = Array.isArray(req.body?.options) ? req.body.options : [];
  if (raw.length < 2 || raw.length > MATCH_OPTIONS_MAX) { res.status(400).json({ error: `De 2 à ${MATCH_OPTIONS_MAX} propositions` }); return; }
  const options = [];
  for (const o of raw) {
    const parsed = await parseOption(plan.id, o, req.pseudo!);
    if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
    options.push(parsed);
  }
  let deadline: Date | null = null;
  if (req.body?.deadline) {
    deadline = new Date(req.body.deadline);
    if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) { res.status(400).json({ error: 'L’échéance doit être à venir' }); return; }
  }
  const match = await prisma.matchPoll.create({
    data: {
      planId: plan.id, question, anonymous: req.body?.anonymous === true, deadline, createdById: req.userId!,
      options: { create: options.map(o => ({ ...o, createdById: req.userId! })) },
    },
  });
  res.json({ id: match.id });
  for (const p of await matchPlayers(plan.id)) {
    if (p.userId !== req.userId) notify(req, plan, p.userId, `❤️ Nouveau match : ${question} À toi de jouer !`, req.userId!);
  }
});

// POST /matches/:matchId/options { label, note?, url?, attachmentId? } — ajouter une proposition (tout participant)
router.post('/matches/:matchId/options', async (req: AuthRequest, res) => {
  const match = await prisma.matchPoll.findUnique({ where: { id: req.params.matchId }, include: { _count: { select: { options: true } } } });
  const plan = await loadPlan(req, res, match?.planId); if (!plan || !match || !writable(plan, res)) return;
  if (match.closedAt) { res.status(400).json({ error: 'Ce match est terminé' }); return; }
  if (match._count.options >= MATCH_OPTIONS_MAX) { res.status(400).json({ error: `${MATCH_OPTIONS_MAX} propositions au maximum` }); return; }
  const parsed = await parseOption(plan.id, req.body, req.pseudo!);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const option = await prisma.matchOption.create({ data: { matchId: match.id, ...parsed, createdById: req.userId! } });
  res.json({ id: option.id });
});

// DELETE /matches/options/:optionId — retirer une proposition (son auteur ou le créateur du Plan)
router.delete('/matches/options/:optionId', async (req: AuthRequest, res) => {
  const option = await prisma.matchOption.findUnique({ where: { id: req.params.optionId }, include: { match: true } });
  const plan = await loadPlan(req, res, option?.match.planId); if (!plan || !option) return;
  if (option.createdById !== req.userId && plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé à son auteur et au créateur du Plan' }); return; }
  await prisma.matchOption.delete({ where: { id: option.id } });
  if (option.attachmentId) await destroyPhotos([option.attachmentId]);
  if (option.match.chosenOptionId === option.id) await prisma.matchPoll.update({ where: { id: option.matchId }, data: { chosenOptionId: null } });
  res.json({ ok: true });
});

// POST /matches/options/:optionId/swipe { like } — oui / non (le dernier « oui » peut faire un match)
router.post('/matches/options/:optionId/swipe', async (req: AuthRequest, res) => {
  const option = await prisma.matchOption.findUnique({ where: { id: req.params.optionId }, include: { match: true } });
  const plan = await loadPlan(req, res, option?.match.planId); if (!plan || !option || !writable(plan, res)) return;
  if (option.match.closedAt) { res.status(400).json({ error: 'Ce match est terminé' }); return; }
  if (!(await matchPlayers(plan.id)).some(p => p.userId === req.userId)) { res.status(403).json({ error: 'Réponds « Je suis in » ou « Peut-être » pour jouer' }); return; }
  const like = req.body?.like === true;
  await prisma.matchSwipe.upsert({
    where: { optionId_userId: { optionId: option.id, userId: req.userId! } },
    create: { optionId: option.id, userId: req.userId!, matchId: option.matchId, like }, update: { like },
  });
  res.json({ ok: true });
  if (like) await checkMatches(req, plan, option.matchId);
});

// DELETE /matches/options/:optionId/swipe — annuler sa dernière réponse (la carte revient)
router.delete('/matches/options/:optionId/swipe', async (req: AuthRequest, res) => {
  const option = await prisma.matchOption.findUnique({ where: { id: req.params.optionId }, include: { match: true } });
  const plan = await loadPlan(req, res, option?.match.planId); if (!plan || !option) return;
  if (option.matchedAt) { res.status(400).json({ error: 'C’est déjà un match !' }); return; }
  await prisma.matchSwipe.deleteMany({ where: { optionId: option.id, userId: req.userId! } });
  res.json({ ok: true });
});

// POST /matches/:matchId/choose { optionId, setLocation?, addToInfo? } — créateur du Plan : c'est décidé.
// Met à jour le lieu et / ou les informations importantes (historique), prévient les participants.
router.post('/matches/:matchId/choose', async (req: AuthRequest, res) => {
  const match = await prisma.matchPoll.findUnique({ where: { id: req.params.matchId }, include: { options: true } });
  const plan = await loadPlan(req, res, match?.planId); if (!plan || !match || !writable(plan, res)) return;
  if (plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  const option = match.options.find(o => o.id === req.body?.optionId);
  if (!option) { res.status(404).json({ error: 'Proposition introuvable' }); return; }
  const full = await prisma.plan.findUnique({ where: { id: plan.id }, select: { location: true, importantInfo: true } });
  const ops: any[] = [prisma.matchPoll.update({ where: { id: match.id }, data: { chosenOptionId: option.id, closedAt: new Date() } })];
  if (req.body?.setLocation === true && full?.location !== option.label) {
    ops.push(prisma.plan.update({ where: { id: plan.id }, data: { location: option.label } }));
    ops.push(prisma.planChangeLog.create({ data: { planId: plan.id, field: 'location', oldValue: full?.location ?? null, newValue: option.label, changedById: req.userId! } }));
  }
  if (req.body?.addToInfo === true) {
    const line = `✅ ${match.question} → ${option.label}`;
    const next = [full?.importantInfo, line].filter(Boolean).join('\n');
    if (next.length > IMPORTANT_INFO_MAX) { res.status(400).json({ error: 'Les informations importantes sont déjà trop longues pour y ajouter le choix' }); return; }
    ops.push(prisma.plan.update({ where: { id: plan.id }, data: { importantInfo: next } }));
    ops.push(prisma.planChangeLog.create({ data: { planId: plan.id, field: 'importantInfo', oldValue: full?.importantInfo ?? null, newValue: next, changedById: req.userId! } }));
  }
  await prisma.$transaction(ops);
  res.json({ ok: true });
  for (const p of await matchPlayers(plan.id)) {
    if (p.userId !== req.userId) notify(req, plan, p.userId, `✅ C’est décidé : ${option.label}`, req.userId!);
  }
});

// DELETE /matches/:matchId — supprimer un match (son créateur ou le créateur du Plan), photos comprises
router.delete('/matches/:matchId', async (req: AuthRequest, res) => {
  const match = await prisma.matchPoll.findUnique({ where: { id: req.params.matchId }, include: { options: { select: { attachmentId: true } } } });
  const plan = await loadPlan(req, res, match?.planId); if (!plan || !match) return;
  if (match.createdById !== req.userId && plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé à son créateur et au créateur du Plan' }); return; }
  await prisma.matchPoll.delete({ where: { id: match.id } });
  await destroyPhotos(match.options.map(o => o.attachmentId).filter((x): x is string => !!x));
  res.json({ ok: true });
});

export default router;
