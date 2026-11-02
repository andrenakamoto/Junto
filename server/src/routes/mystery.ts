import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { isCircleManager } from '../lib/circleRoles';
import { notifyUser } from '../lib/push';
import {
  defaultRevealAt, MYSTERY_DISABLED_ERROR, MYSTERY_FEATURE, MYSTERY_MAX_ACCOMPLICES, mysteryEnabled, mysteryView, parseClues, parseGuess,
  parseRealPlace, parseRealTitle, parseRevealAt, revealClue, revealMystery,
} from '../lib/mystery';

// Plan mystère (lib/mystery.ts), monté dans le routeur des Plans (/api/plans) : même authentification, même lecture seule après
// la fin du Plan, même diffusion temps réel (lib/realtime.ts, rechargement seulement).
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;

async function loadPlan(req: AuthRequest, res: any) {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, location: true, creatorId: true, circleId: true, eventDate: true, endDate: true, enabledFeatures: true } });
  if (!plan || !(await getPlanAccess(req.userId!, plan.id))?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!mysteryEnabled(plan)) { res.status(403).json({ error: MYSTERY_DISABLED_ERROR }); return null; }
  const manager = plan.creatorId === req.userId || await isCircleManager(req.userId!, plan.circleId);
  return { plan, manager };
}

async function view(planId: string, userId: string, manager: boolean) {
  const m = await prisma.planMystery.findUnique({ where: { planId } });
  if (!m) return { mystery: null, canManage: manager };
  const [clues, guesses] = await Promise.all([
    prisma.planMysteryClue.findMany({ where: { planId }, orderBy: [{ revealAt: 'asc' }, { position: 'asc' }] }),
    prisma.planMysteryGuess.findMany({ where: { planId }, include: { user: person }, orderBy: { createdAt: 'asc' } }),
  ]);
  return { mystery: mysteryView(m, clues, guesses, { userId, manager }), canManage: manager };
}

// GET /api/plans/:id/mystery
router.get('/:id/mystery', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  res.json(await view(ctx.plan.id, req.userId!, ctx.manager));
});

// PUT /api/plans/:id/mystery { realTitle, realLocation, revealAt?, clues?, accompliceIds? } — créer ou modifier le mystère
// (créateur du Plan ou gestionnaire du Cercle, avant le dévoilement). Le titre et le lieu actuels du Plan restent ce que
// voient les invités.
router.put('/:id/mystery', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  const { plan, manager } = ctx;
  if (!manager) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  const existing = await prisma.planMystery.findUnique({ where: { planId: plan.id } });
  if (existing?.revealedAt) { res.status(409).json({ error: 'Le mystère est déjà levé' }); return; }
  const realTitle = parseRealTitle(req.body?.realTitle);
  const realLocation = parseRealPlace(req.body?.realLocation);
  if (!realTitle || !realLocation) { res.status(400).json({ error: 'Indique le vrai titre et le vrai lieu' }); return; }
  const revealAt = req.body?.revealAt === undefined ? existing?.revealAt ?? defaultRevealAt(plan.eventDate, plan.endDate) : parseRevealAt(req.body.revealAt, plan.eventDate, plan.endDate);
  if (!revealAt) { res.status(400).json({ error: 'Le dévoilement doit avoir lieu avant le début du Plan' }); return; }
  const clues = req.body?.clues === undefined ? null : parseClues(req.body.clues, revealAt);
  if (req.body?.clues !== undefined && !clues) { res.status(400).json({ error: 'Indices invalides (8 au plus, avant le dévoilement)' }); return; }

  // Complices : participants du Plan avec un compte (pas l'organisation, déjà dans la confidence)
  let accompliceIds = existing?.accompliceIds ?? [];
  if (req.body?.accompliceIds !== undefined) {
    const ids = Array.isArray(req.body.accompliceIds) ? [...new Set(req.body.accompliceIds.filter((x: unknown): x is string => typeof x === 'string'))] : null;
    if (!ids || ids.length > MYSTERY_MAX_ACCOMPLICES) { res.status(400).json({ error: 'Complices invalides' }); return; }
    const members = await prisma.planMember.findMany({ where: { planId: plan.id, userId: { in: ids as string[] }, user: { isLight: false } }, select: { userId: true } });
    accompliceIds = members.map(m => m.userId).filter(id => id !== plan.creatorId);
  }

  await prisma.planMystery.upsert({
    where: { planId: plan.id },
    create: { planId: plan.id, realTitle, realLocation, revealAt, accompliceIds, publicTitle: plan.title, publicLocation: plan.location },
    update: { realTitle, realLocation, revealAt, accompliceIds },
  });
  if (clues) {
    // Les indices déjà dévoilés restent tels quels ; les autres sont remplacés par la nouvelle liste
    const revealedIds = new Set((await prisma.planMysteryClue.findMany({ where: { planId: plan.id, revealedAt: { not: null } }, select: { id: true } })).map(c => c.id));
    const pending = clues.filter(c => !c.id || !revealedIds.has(c.id));
    await prisma.$transaction([
      prisma.planMysteryClue.deleteMany({ where: { planId: plan.id, revealedAt: null } }),
      prisma.planMysteryClue.createMany({ data: pending.map((c, i) => ({ planId: plan.id, text: c.text, revealAt: c.revealAt, position: i })) }),
    ]);
  }
  // Nouveaux complices : prévenus qu'ils sont dans la confidence
  const added = accompliceIds.filter(id => !(existing?.accompliceIds ?? []).includes(id) && id !== req.userId);
  for (const userId of added) {
    notifyUser(req.app.get('io'), userId, { type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: MYSTERY_FEATURE,
      preview: `🤫 @${req.pseudo} te met dans la confidence : « ${plan.title} »`, from: req.pseudo, actorId: req.userId });
  }
  res.json(await view(plan.id, req.userId!, manager));
});

// DELETE /api/plans/:id/mystery — renoncer au mystère avant le dévoilement (le titre et le lieu publics restent)
router.delete('/:id/mystery', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  if (!ctx.manager) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  const m = await prisma.planMystery.findUnique({ where: { planId: ctx.plan.id }, select: { revealedAt: true } });
  if (m?.revealedAt) { res.status(409).json({ error: 'Le mystère est déjà levé' }); return; }
  await prisma.$transaction([
    prisma.planMysteryClue.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.planMysteryGuess.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.planMystery.deleteMany({ where: { planId: ctx.plan.id } }),
  ]);
  res.json({ ok: true });
});

// POST /api/plans/:id/mystery/reveal — tout dévoiler maintenant (organisation)
router.post('/:id/mystery/reveal', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  if (!ctx.manager) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  if (!(await revealMystery(req.app.get('io'), ctx.plan.id))) { res.status(409).json({ error: 'Le mystère est déjà levé' }); return; }
  res.json(await view(ctx.plan.id, req.userId!, ctx.manager));
});

// POST /api/plans/:id/mystery/clues/:clueId/reveal — dévoiler un indice plus tôt (organisation)
router.post('/:id/mystery/clues/:clueId/reveal', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  if (!ctx.manager) { res.status(403).json({ error: 'Réservé au créateur du Plan' }); return; }
  const clue = await prisma.planMysteryClue.findFirst({ where: { id: req.params.clueId, planId: ctx.plan.id }, select: { id: true } });
  if (!clue) { res.status(404).json({ error: 'Indice introuvable' }); return; }
  await revealClue(req.app.get('io'), clue.id);
  res.json(await view(ctx.plan.id, req.userId!, ctx.manager));
});

// PUT /api/plans/:id/mystery/guess { text } — mon pari (participants hors confidence, avant le dévoilement) ; DELETE le retire
router.put('/:id/mystery/guess', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  const m = await prisma.planMystery.findUnique({ where: { planId: ctx.plan.id } });
  if (!m) { res.status(404).json({ error: 'Pas de mystère pour ce Plan' }); return; }
  if (m.revealedAt) { res.status(409).json({ error: 'Le mystère est déjà levé' }); return; }
  if (ctx.manager || m.accompliceIds.includes(req.userId!)) { res.status(403).json({ error: 'Tu es dans la confidence : pas de pari' }); return; }
  const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId: req.userId!, planId: ctx.plan.id } }, select: { rsvp: true } });
  if (!member) { res.status(403).json({ error: 'Rejoins le Plan pour parier' }); return; }
  const text = parseGuess(req.body?.text);
  if (!text) { res.status(400).json({ error: 'Écris ton pari (150 caractères au plus)' }); return; }
  await prisma.planMysteryGuess.upsert({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } }, create: { planId: ctx.plan.id, userId: req.userId!, text }, update: { text } });
  res.json(await view(ctx.plan.id, req.userId!, ctx.manager));
});

router.delete('/:id/mystery/guess', async (req: AuthRequest, res) => {
  const ctx = await loadPlan(req, res); if (!ctx) return;
  const m = await prisma.planMystery.findUnique({ where: { planId: ctx.plan.id }, select: { revealedAt: true } });
  if (m?.revealedAt) { res.status(409).json({ error: 'Le mystère est déjà levé' }); return; }
  await prisma.planMysteryGuess.deleteMany({ where: { planId: ctx.plan.id, userId: req.userId! } });
  res.json(await view(ctx.plan.id, req.userId!, ctx.manager));
});

export default router;
