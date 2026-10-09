import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { FEATURE_DISABLED_ERROR } from '../lib/settings';
import { WHEEL_LEAD_MS, WHEEL_QUESTION_MAX, WHEEL_SPIN_MS, pickWinner, wheelCandidates, wheelParticipants } from '../lib/wheel';

// « Qui s'y colle ? » (lib/wheel.ts), monté dans le routeur des Plans (/api/plans), dans l'onglet Votes.
// Tout participant du Plan crée une roue, retire des personnes et la lance. Au lancement, le serveur tire le
// résultat et émet « wheel-spin » dans la room du Plan : les téléphones qui regardent le Plan rechargent et
// animent la roue jusqu'à l'heure d'arrivée commune ; les autres reçoivent le résultat en notification.
const router = Router();

type PlanLite = { id: string; title: string; circleId: string; creatorId: string; disabledFeatures: string[] };
const nameOf = (u?: { pseudo: string; firstName: string | null } | null) => (u ? u.firstName ?? u.pseudo : '?');

async function loadPlan(req: AuthRequest, res: any, planId: string | undefined, write = false): Promise<PlanLite | null> {
  if (!planId) { res.status(404).json({ error: 'Introuvable' }); return null; }
  const access = await getPlanAccess(req.userId!, planId);
  if (!access?.canView || !access.isPlanMember) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true, creatorId: true, disabledFeatures: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (write && plan.disabledFeatures.includes('votes')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return null; }
  return plan;
}

function parseExcluded(v: unknown, participantIds: string[]): string[] | null {
  if (v === undefined) return null;
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && participantIds.includes(x)))];
}

// GET /:id/wheels
router.get('/:id/wheels', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan) return;
  const [wheels, participants] = await Promise.all([
    prisma.wheel.findMany({ where: { planId: plan.id }, orderBy: { createdAt: 'asc' }, include: { spins: { orderBy: { createdAt: 'asc' } } } }),
    wheelParticipants(plan.id),
  ]);
  const ids = new Set<string>(participants.map(p => p.id));
  const extra = wheels.flatMap(w => w.spins.flatMap(s => [s.winnerId, ...s.candidateIds, ...s.excludedIds, ...s.skippedIds])).filter(id => !ids.has(id));
  const others = extra.length ? await prisma.user.findMany({ where: { id: { in: [...new Set(extra)] } }, select: { id: true, pseudo: true, firstName: true } }) : [];
  const byId = new Map<string, { pseudo: string; firstName: string | null }>([...participants, ...others].map(u => [u.id, u]));
  const person = (id: string) => ({ id, name: nameOf(byId.get(id)) });
  const participantIds = participants.map(p => p.id);
  res.json({
    serverNow: Date.now(),
    wheels: wheels.map(w => {
      const previous = w.spins.map(s => s.winnerId);
      const now = wheelCandidates(participantIds, w.excludedUserIds, previous, w.noRepeat);
      return {
        id: w.id,
        question: w.question,
        noRepeat: w.noRepeat,
        canDelete: w.createdById === req.userId || plan.creatorId === req.userId,
        participants: participants.map(p => ({ id: p.id, name: nameOf(p), excluded: w.excludedUserIds.includes(p.id), alreadyDrawn: w.noRepeat && previous.includes(p.id) })),
        // Sur la roue au prochain lancement
        candidates: now.candidates.map(person),
        spins: w.spins.map(s => ({
          id: s.id,
          winner: person(s.winnerId),
          candidates: s.candidateIds.map(person),
          // Retirées volontairement : affichées avec le résultat
          excluded: s.excludedIds.map(person),
          skipped: s.skippedIds.map(person),
          spunBy: s.spunById ? person(s.spunById) : null,
          startAt: s.startAt.getTime(),
          durationMs: s.durationMs,
        })),
      };
    }),
  });
});

// POST /:id/wheels { question, excludedUserIds?, noRepeat? }
router.post('/:id/wheels', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id, true); if (!plan) return;
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > WHEEL_QUESTION_MAX) { res.status(400).json({ error: `Question : de 1 à ${WHEEL_QUESTION_MAX} caractères` }); return; }
  const participantIds = (await wheelParticipants(plan.id)).map(p => p.id);
  const wheel = await prisma.wheel.create({
    data: { planId: plan.id, question, createdById: req.userId!, noRepeat: req.body?.noRepeat === true, excludedUserIds: parseExcluded(req.body?.excludedUserIds, participantIds) ?? [] },
  });
  res.json({ id: wheel.id });
});

// PUT /wheels/:wheelId { excludedUserIds?, noRepeat? } — retirer / remettre des personnes (tout participant)
router.put('/wheels/:wheelId', async (req: AuthRequest, res) => {
  const wheel = await prisma.wheel.findUnique({ where: { id: req.params.wheelId } });
  const plan = await loadPlan(req, res, wheel?.planId, true); if (!plan || !wheel) return;
  const participantIds = (await wheelParticipants(plan.id)).map(p => p.id);
  const data: { excludedUserIds?: string[]; noRepeat?: boolean } = {};
  const excluded = parseExcluded(req.body?.excludedUserIds, participantIds);
  if (excluded) data.excludedUserIds = excluded;
  if (typeof req.body?.noRepeat === 'boolean') data.noRepeat = req.body.noRepeat;
  await prisma.wheel.update({ where: { id: wheel.id }, data });
  res.json({ ok: true });
});

// POST /wheels/:wheelId/spin — lancer la roue (tout participant)
router.post('/wheels/:wheelId/spin', async (req: AuthRequest, res) => {
  const wheel = await prisma.wheel.findUnique({ where: { id: req.params.wheelId }, include: { spins: { orderBy: { createdAt: 'desc' } } } });
  const plan = await loadPlan(req, res, wheel?.planId, true); if (!plan || !wheel) return;
  const last = wheel.spins[0];
  if (last && last.startAt.getTime() + last.durationMs > Date.now()) { res.status(409).json({ error: 'La roue tourne déjà !' }); return; }
  const participants = await wheelParticipants(plan.id);
  const { candidates, excluded, skipped } = wheelCandidates(participants.map(p => p.id), wheel.excludedUserIds, wheel.spins.map(s => s.winnerId), wheel.noRepeat);
  if (candidates.length < 1) { res.status(400).json({ error: wheel.noRepeat ? 'Tout le monde est déjà tombé : décoche « Pas deux fois la même personne » ou remets des personnes sur la roue' : 'Il n’y a personne sur la roue' }); return; }
  const winnerId = pickWinner(candidates)!;
  const startAt = new Date(Date.now() + WHEEL_LEAD_MS);
  const spin = await prisma.wheelSpin.create({
    data: { wheelId: wheel.id, winnerId, candidateIds: candidates, excludedIds: excluded, skippedIds: skipped, spunById: req.userId!, startAt, durationMs: WHEEL_SPIN_MS },
  });
  res.json({ id: spin.id, startAt: startAt.getTime(), serverNow: Date.now() });

  // Les téléphones qui regardent le Plan animent la roue (sans données : ils rechargent eux-mêmes)
  const io = req.app.get('io');
  io?.to(`plan:${plan.id}`).emit('wheel-spin', { planId: plan.id, wheelId: wheel.id, spinId: spin.id });
  // À l'arrêt de la roue : le résultat à ceux qui ne regardent pas le Plan
  const winner = participants.find(p => p.id === winnerId);
  setTimeout(async () => {
    try {
      const watching = new Set<string>();
      if (io) for (const s of await io.in(`plan:${plan.id}`).fetchSockets()) watching.add(s.data.userId);
      for (const p of participants) {
        if (p.isLight || watching.has(p.id)) continue;
        notifyUser(io, p.id, { type: 'wheel', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview: `🎡 ${wheel.question} La roue a choisi : ${nameOf(winner)} !` });
      }
    } catch (e) { console.error('[wheel notify]', e); }
  }, WHEEL_LEAD_MS + WHEEL_SPIN_MS);
});

// DELETE /wheels/:wheelId — son créateur ou le créateur du Plan
router.delete('/wheels/:wheelId', async (req: AuthRequest, res) => {
  const wheel = await prisma.wheel.findUnique({ where: { id: req.params.wheelId } });
  const plan = await loadPlan(req, res, wheel?.planId); if (!plan || !wheel) return;
  if (wheel.createdById !== req.userId && plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé à son créateur et au créateur du Plan' }); return; }
  await prisma.wheel.delete({ where: { id: wheel.id } });
  res.json({ ok: true });
});

export default router;
