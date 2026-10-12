import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { notifyPlanActivity } from '../lib/planNotifications';
import { ARRIVE_EARLY_MS, NOTE_MAX, fetchConnections, fetchLastConnection, linesText, parseStop, sanitizeLegs, sharedLegs, searchStops, type Connection } from '../lib/transit';

// « En transports publics » (rubrique Trajets, lib/transit.ts), monté dans le routeur des Plans. Chaque participant
// choisit SES arrêts de départ et d'arrivée (TransitChoice) ; le départ peut être mémorisé (TransitHome) si la personne
// le veut. Ces deux tables ne sont lues que pour la personne elle-même : les autres ne voient son trajet que si elle le
// propose (« On voyage ensemble » : TransitGroup + membres).
// Réservé aux participants qui n'ont pas répondu « Je passe », et à un Plan où les Trajets ne sont pas masqués.
const router = Router();

const person = { select: { id: true, pseudo: true, firstName: true } } as const;

type Fail = { status: number; error: string; plan?: undefined; member?: undefined };
const fail = (status: number, error: string): Fail => ({ status, error });

async function participant(userId: string, planId: string) {
  const access = await getPlanAccess(userId, planId);
  if (!access?.canView) return fail(404, 'Plan introuvable');
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, eventDate: true, endDate: true, location: true, disabledFeatures: true, circleId: true } });
  if (!plan) return fail(404, 'Plan introuvable');
  if (plan.disabledFeatures.includes('trajets')) return fail(403, 'Les trajets ne sont pas activés pour ce Plan');
  const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId } } });
  if (!member || member.rsvp === 'out') return fail(403, 'Réservé aux participants du Plan');
  return { plan, member, status: 200, error: undefined as string | undefined };
}

const groupInclude = { creator: person, members: { orderBy: { createdAt: 'asc' as const }, select: { userId: true, user: person } } };

// État de la rubrique pour la personne : ses arrêts, son départ habituel, les voyages partagés
router.get('/:id/transit', async (req: AuthRequest, res) => {
  const p = await participant(req.userId!, req.params.id);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  const [home, choice, groups] = await Promise.all([
    prisma.transitHome.findUnique({ where: { userId: req.userId! } }),
    prisma.transitChoice.findUnique({ where: { planId_userId: { planId: p.plan.id, userId: req.userId! } } }),
    prisma.transitGroup.findMany({ where: { planId: p.plan.id, departureAt: { gt: new Date(Date.now() - 3 * 3600 * 1000) } }, orderBy: { departureAt: 'asc' }, include: groupInclude }),
  ]);
  res.json({
    from: choice?.fromId ? { id: choice.fromId, name: choice.fromName } : null,
    to: choice?.toId ? { id: choice.toId, name: choice.toName } : null,
    home: home ? { id: home.stopId, name: home.stopName } : null,
    location: p.plan.location,
    eventDate: p.plan.eventDate,
    groups,
  });
});

// Recherche d'arrêts (liste de suggestions pendant la frappe)
router.get('/:id/transit/stops', async (req: AuthRequest, res) => {
  const p = await participant(req.userId!, req.params.id);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  try {
    res.json(await searchStops(String(req.query.q ?? '')));
  } catch {
    res.status(502).json({ error: 'Les horaires sont momentanément indisponibles' });
  }
});

// Mes arrêts pour ce Plan ; `remember` mémorise le départ comme départ habituel (ou l'oublie)
router.put('/:id/transit/me', async (req: AuthRequest, res) => {
  const p = await participant(req.userId!, req.params.id);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  const from = parseStop(req.body?.from);
  const to = parseStop(req.body?.to);
  if (from === undefined && req.body?.from !== undefined) { res.status(400).json({ error: 'Arrêt invalide' }); return; }
  if (to === undefined && req.body?.to !== undefined) { res.status(400).json({ error: 'Arrêt invalide' }); return; }
  const data: Record<string, string | null> = {};
  if (from !== undefined) Object.assign(data, { fromId: from?.id ?? null, fromName: from?.name ?? null });
  if (to !== undefined) Object.assign(data, { toId: to?.id ?? null, toName: to?.name ?? null });
  const userId = req.userId!;
  await prisma.transitChoice.upsert({ where: { planId_userId: { planId: p.plan.id, userId } }, create: { planId: p.plan.id, userId, ...data }, update: data });
  if (req.body?.remember === true && from) {
    await prisma.transitHome.upsert({ where: { userId }, create: { userId, stopId: from.id, stopName: from.name }, update: { stopId: from.id, stopName: from.name } });
  } else if (req.body?.remember === false) {
    await prisma.transitHome.deleteMany({ where: { userId } });
  }
  res.json({ ok: true });
});

// Correspondances : aller (arrivée 10 min avant le début du Plan) et dernier retour de la nuit
router.get('/:id/transit/connections', async (req: AuthRequest, res) => {
  const p = await participant(req.userId!, req.params.id);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  const choice = await prisma.transitChoice.findUnique({ where: { planId_userId: { planId: p.plan.id, userId: req.userId! } } });
  if (!choice?.fromId || !choice.toId) { res.json({ go: [], last: null }); return; }
  const from = { id: choice.fromId, name: choice.fromName ?? '' }, to = { id: choice.toId, name: choice.toName ?? '' };
  if (!p.plan.eventDate) { res.json({ go: [], last: null, noDate: true }); return; }
  try {
    const arriveBy = new Date(p.plan.eventDate.getTime() - ARRIVE_EARLY_MS);
    // Plan déjà commencé : les prochains départs plutôt qu'une arrivée dans le passé
    const started = arriveBy.getTime() < Date.now();
    const [go, last] = await Promise.all([
      fetchConnections(from, to, started ? new Date() : arriveBy, !started, 4),
      fetchLastConnection(to, from, p.plan.eventDate).catch(() => null),
    ]);
    // En arrivée visée, l'API renvoie les correspondances qui arrivent autour de l'heure : on garde les 3 dernières à l'heure
    const onTime = started ? go.slice(0, 3) : go.filter(c => new Date(c.arrivalAt).getTime() <= arriveBy.getTime() + 60_000).slice(-3);
    res.json({ go: onTime.length ? onTime : go.slice(0, 3), last });
  } catch {
    res.status(502).json({ error: 'Les horaires sont momentanément indisponibles' });
  }
});

// « Je propose ce trajet » : copie figée de la correspondance choisie
router.post('/:id/transit/groups', async (req: AuthRequest, res) => {
  const p = await participant(req.userId!, req.params.id);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  const c = req.body?.connection as Connection | undefined;
  const dep = c?.departureAt ? new Date(c.departureAt) : null;
  const arr = c?.arrivalAt ? new Date(c.arrivalAt) : null;
  if (!c || !Array.isArray(c.legs) || !dep || !arr || isNaN(dep.getTime()) || isNaN(arr.getTime())) { res.status(400).json({ error: 'Trajet invalide' }); return; }
  if (dep.getTime() < Date.now() - 5 * 60 * 1000) { res.status(400).json({ error: 'Ce départ est déjà passé' }); return; }
  const firstRide = c.legs.find(l => l && l.kind !== 'walk');
  const lines = linesText(c.legs);
  if (!firstRide || !lines) { res.status(400).json({ error: 'Trajet invalide' }); return; }
  const note = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, NOTE_MAX) : null;
  const userId = req.userId!;
  const group = await prisma.$transaction(async tx => {
    // Un seul voyage partagé par personne et par Plan : proposer un trajet quitte l'éventuel précédent
    await tx.transitGroupMember.deleteMany({ where: { planId: p.plan.id, userId } });
    return tx.transitGroup.create({
      data: {
        planId: p.plan.id, creatorId: userId,
        fromName: String(firstRide.from ?? '').slice(0, 120), toName: String(c.legs[c.legs.length - 1]?.to ?? '').slice(0, 120),
        departureAt: new Date(firstRide.departureAt ?? c.departureAt), arrivalAt: arr, lines,
        platform: typeof firstRide.platform === 'string' ? firstRide.platform.slice(0, 20) : null, note,
        legs: sharedLegs(sanitizeLegs(c.legs)),
        members: { create: { userId, planId: p.plan.id } },
      },
      include: groupInclude,
    });
  });
  await cleanupEmptyGroups(p.plan.id);
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, pseudo: true } });
  if (me) notifyPlanActivity(req.app.get('io'), p.plan.id, me, 'transit_proposed').catch(() => {});
  res.status(201).json(group);
});

// Rejoindre / quitter un voyage partagé
router.post('/transit-groups/:groupId/join', async (req: AuthRequest, res) => {
  const group = await prisma.transitGroup.findUnique({ where: { id: req.params.groupId }, select: { id: true, planId: true, creatorId: true, lines: true } });
  if (!group) { res.status(404).json({ error: 'Trajet introuvable' }); return; }
  const p = await participant(req.userId!, group.planId);
  if (!p.plan || !p.member) { res.status(p.status).json({ error: p.error }); return; }
  const userId = req.userId!;
  await prisma.$transaction([
    prisma.transitGroupMember.deleteMany({ where: { planId: group.planId, userId } }),
    prisma.transitGroupMember.create({ data: { groupId: group.id, userId, planId: group.planId } }),
  ]);
  await cleanupEmptyGroups(group.planId);
  if (group.creatorId !== userId) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { pseudo: true } });
    notifyUser(req.app.get('io'), group.creatorId, { type: 'transit', planId: group.planId, planTitle: p.plan.title, circleId: p.plan.circleId, actorId: userId, from: me?.pseudo, preview: `@${me?.pseudo} voyage avec toi (${group.lines})` });
  }
  res.json({ ok: true });
});

router.delete('/transit-groups/:groupId/join', async (req: AuthRequest, res) => {
  const group = await prisma.transitGroup.findUnique({ where: { id: req.params.groupId }, select: { id: true, planId: true } });
  if (!group) { res.status(404).json({ error: 'Trajet introuvable' }); return; }
  await prisma.transitGroupMember.deleteMany({ where: { groupId: group.id, userId: req.userId! } });
  await cleanupEmptyGroups(group.planId);
  res.json({ ok: true });
});

// Un voyage partagé sans plus personne disparaît
async function cleanupEmptyGroups(planId: string) {
  await prisma.transitGroup.deleteMany({ where: { planId, members: { none: {} } } });
}

export default router;
