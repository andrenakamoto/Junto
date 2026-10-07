import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import {
  DEFAULT_OBJECTS, DEFAULT_PLACES, KILLER_DISABLED_ERROR, KillerState, alive, applyKill, buildMissions, canManageKiller,
  insertPlayer, killerEnabled, killerParticipants, loadPlayers, parseKillerList, repairChain, savePlayers, withdrawPlayer,
} from '../lib/killer';

// Killer (lib/killer.ts), monté dans le routeur des Plans (/api/plans). Règle d'or : avant la fin
// de la partie, une réponse ne contient que la mission de la personne qui demande ; qui a éliminé
// qui n'est révélé qu'à la fin (la victime, elle, apprend qui l'a eue au moment de confirmer).
const router = Router();

const person = { id: true, pseudo: true, firstName: true } as const;
type Person = { id: string; pseudo: string; firstName: string | null };
const label = (p?: Person | null) => (p ? p.firstName ?? `@${p.pseudo}` : 'Quelqu’un');

async function load(req: AuthRequest, res: any) {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !killerEnabled(plan)) { res.status(403).json({ error: KILLER_DISABLED_ERROR }); return null; }
  const game = await prisma.killerGame.upsert({
    where: { planId: plan.id },
    create: { planId: plan.id, objects: DEFAULT_OBJECTS, places: DEFAULT_PLACES },
    update: {},
  });
  return { plan, game };
}

async function requireManager(req: AuthRequest, res: any, plan: { creatorId: string; circleId: string }) {
  if (await canManageKiller(req.userId!, plan)) return true;
  res.status(403).json({ error: 'Réservé à l’organisateur' });
  return false;
}

const running = (g: { startedAt: Date | null; endedAt: Date | null }) => !!g.startedAt && !g.endedAt;

function notify(req: AuthRequest, plan: { id: string; title: string; circleId: string }, userId: string, preview: string, actorId?: string) {
  notifyUser(req.app.get('io'), userId, { type: 'killer', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview, ...(actorId ? { actorId } : {}) });
}

async function people(ids: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: person });
  return new Map(users.map(u => [u.id, u as Person]));
}

// GET /:id/killer
router.get('/:id/killer', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { plan, game } = ctx;
  const me = req.userId!;
  const manager = await canManageKiller(me, plan);
  let players = await loadPlayers(plan.id);
  // Filet de sécurité : une chaîne cassée (compte supprimé) est réparée à la lecture
  if (running(game)) {
    const fixed = repairChain(players, game.objects, game.places);
    if (fixed !== players) { await savePlayers(plan.id, players, fixed); players = fixed; }
  }
  const claims = await prisma.killerPlayer.findMany({ where: { planId: plan.id, claimedAt: { not: null } }, select: { userId: true, targetId: true } });
  const participants = await killerParticipants(plan.id);
  const byId = await people([...new Set([...players.map(p => p.userId), ...players.map(p => p.eliminatedById).filter((x): x is string => !!x), ...participants.map(p => p.id)])]);
  const mine = players.find(p => p.userId === me);
  const ended = !!game.endedAt;
  const claimOnMe = claims.find(c => c.targetId === me);
  const inGame = new Set(players.map(p => p.userId));
  res.json({
    started: !!game.startedAt,
    ended,
    canManage: manager,
    // Listes d'objets et de lieux : l'organisateur seulement (sinon on devine les missions)
    objects: manager ? game.objects : null,
    places: manager ? game.places : null,
    participants: participants.map(p => ({ id: p.id, pseudo: p.pseudo, firstName: p.firstName })),
    aliveCount: alive(players).length,
    playerCount: players.length,
    // Joueurs : en jeu ou non ; nombre d'éliminations et auteur seulement à la fin
    players: players
      .map(p => ({
        user: byId.get(p.userId) ?? { id: p.userId, pseudo: '?', firstName: null },
        alive: !p.eliminatedAt,
        eliminatedAt: p.eliminatedAt,
        kills: ended ? p.kills : undefined,
        eliminatedBy: ended ? (p.eliminatedById ? byId.get(p.eliminatedById) ?? null : null) : undefined,
      }))
      .sort((a, b) => (ended ? (b.kills ?? 0) - (a.kills ?? 0) || +(b.alive) - +(a.alive) : 0) || label(a.user).localeCompare(label(b.user), 'fr')),
    me: mine ? {
      alive: !mine.eliminatedAt,
      kills: mine.kills,
      mission: mine.targetId && !ended ? { target: byId.get(mine.targetId) ?? (await people([mine.targetId])).get(mine.targetId), object: mine.object, place: mine.place } : null,
      claimed: claims.some(c => c.userId === me),
      eliminatedBy: mine.eliminatedById ? byId.get(mine.eliminatedById) ?? null : null,
    } : null,
    // Quelqu'un dit m'avoir éliminé(e) : je le découvre pour confirmer ou contester
    pendingClaim: claimOnMe && mine && !mine.eliminatedAt ? { killer: byId.get(claimOnMe.userId) ?? null } : null,
    winner: game.winnerId ? byId.get(game.winnerId) ?? (await people([game.winnerId])).get(game.winnerId) ?? null : null,
    // Arrivés après le début (organisateur) : à ajouter à la partie
    newcomers: manager && running(game) ? participants.filter(p => !inGame.has(p.id)) : [],
  });
});

// PUT /:id/killer { objects, places } — avant le début (organisateur)
router.put('/:id/killer', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.game.startedAt) { res.status(400).json({ error: 'La partie a commencé : les objets et les lieux ne changent plus' }); return; }
  const data: { objects?: string[]; places?: string[] } = {};
  if (req.body?.objects !== undefined) {
    const v = parseKillerList(req.body.objects);
    if (!v) { res.status(400).json({ error: 'Objets : de 1 à 30, 60 caractères maximum chacun' }); return; }
    data.objects = v;
  }
  if (req.body?.places !== undefined) {
    const v = parseKillerList(req.body.places);
    if (!v) { res.status(400).json({ error: 'Lieux : de 1 à 30, 60 caractères maximum chacun' }); return; }
    data.places = v;
  }
  await prisma.killerGame.update({ where: { planId: ctx.plan.id }, data });
  res.json({ ok: true });
});

// POST /:id/killer/start — distribue les missions (organisateur)
router.post('/:id/killer/start', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.game.startedAt) { res.status(409).json({ error: 'La partie a déjà commencé' }); return; }
  const participants = await killerParticipants(ctx.plan.id);
  if (participants.length < 3) { res.status(400).json({ error: 'Il faut au moins 3 joueurs (« Je suis in », avec un compte)' }); return; }
  const missions = buildMissions(participants.map(p => p.id), ctx.game.objects, ctx.game.places);
  if (!missions) { res.status(400).json({ error: 'Impossible de distribuer les missions' }); return; }
  const claimed = await prisma.killerGame.updateMany({ where: { planId: ctx.plan.id, startedAt: null }, data: { startedAt: new Date() } });
  if (claimed.count === 0) { res.status(409).json({ error: 'La partie a déjà commencé' }); return; }
  await prisma.killerPlayer.createMany({ data: missions.map(m => ({ planId: ctx.plan.id, userId: m.userId, targetId: m.targetId, object: m.object, place: m.place })) });
  res.json({ ok: true, count: missions.length });
  for (const p of participants) notify(req, ctx.plan, p.id, '🔪 La partie de Killer commence : découvre ta mission (et garde-la secrète !)');
});

// POST /:id/killer/claim — « J'ai eu ma cible » (le tueur)
router.post('/:id/killer/claim', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const me = await prisma.killerPlayer.findUnique({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } } });
  if (!me || me.eliminatedAt || !me.targetId) { res.status(400).json({ error: 'Tu n’as pas de mission en cours' }); return; }
  await prisma.killerPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } }, data: { claimedAt: new Date() } });
  res.json({ ok: true });
  const killer = (await people([req.userId!])).get(req.userId!);
  notify(req, ctx.plan, me.targetId, `🔪 ${label(killer)} dit t’avoir éliminé(e) : confirme ou conteste dans le Killer`, req.userId!);
});

// DELETE /:id/killer/claim — annuler sa revendication (le tueur)
router.delete('/:id/killer/claim', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  await prisma.killerPlayer.updateMany({ where: { planId: ctx.plan.id, userId: req.userId! }, data: { claimedAt: null } });
  res.json({ ok: true });
});

// POST /:id/killer/answer { confirm } — la cible confirme (éliminée) ou conteste
router.post('/:id/killer/answer', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const me = req.userId!;
  const claim = await prisma.killerPlayer.findFirst({ where: { planId: ctx.plan.id, targetId: me, claimedAt: { not: null }, eliminatedAt: null } });
  if (!claim) { res.status(404).json({ error: 'Personne ne dit t’avoir éliminé(e)' }); return; }
  const names = await people([me, claim.userId]);
  if (req.body?.confirm !== true) {
    await prisma.killerPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: claim.userId } }, data: { claimedAt: null } });
    res.json({ ok: true });
    notify(req, ctx.plan, claim.userId, `🙅 ${label(names.get(me))} conteste : ta mission continue`, me);
    return;
  }
  const before = await loadPlayers(ctx.plan.id);
  const result = applyKill(before, claim.userId, me);
  if (!result) { res.status(409).json({ error: 'Cette élimination ne correspond plus à une mission en cours' }); return; }
  await savePlayers(ctx.plan.id, before, result.players, result.gameOver ? { endedAt: new Date(), winnerId: claim.userId } : {});
  await prisma.killerPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: claim.userId } }, data: { claimedAt: null } });
  res.json({ ok: true, gameOver: result.gameOver });
  const living = alive(result.players);
  if (result.gameOver) {
    for (const p of result.players) notify(req, ctx.plan, p.userId, `🏆 ${label(names.get(claim.userId))} remporte le Killer ! Découvre qui a éliminé qui`);
    return;
  }
  notify(req, ctx.plan, claim.userId, '🎯 Élimination confirmée ! Découvre ta nouvelle mission', me);
  for (const p of living) {
    if (p.userId !== claim.userId) notify(req, ctx.plan, p.userId, `💀 ${label(names.get(me))} est éliminé(e) : il reste ${living.length} joueurs`);
  }
});

// POST /:id/killer/remove { userId } — retirer un joueur (organisateur) : la chaîne se referme
router.post('/:id/killer/remove', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const userId = String(req.body?.userId ?? '');
  const before = await loadPlayers(ctx.plan.id);
  const result = withdrawPlayer(before, userId);
  if (!result) { res.status(404).json({ error: 'Ce joueur n’est plus en jeu' }); return; }
  const living = alive(result.players);
  await savePlayers(ctx.plan.id, before, result.players, result.gameOver ? { endedAt: new Date(), winnerId: living.length === 1 ? living[0].userId : null } : {});
  res.json({ ok: true });
  notify(req, ctx.plan, userId, '🔪 L’organisateur t’a retiré(e) de la partie de Killer');
  if (result.gameOver) {
    const names = await people(living.map(p => p.userId));
    for (const p of result.players) notify(req, ctx.plan, p.userId, living.length === 1 ? `🏆 ${label(names.get(living[0].userId))} remporte le Killer !` : '🔪 La partie de Killer est terminée');
  } else if (result.heirId) notify(req, ctx.plan, result.heirId, '🎯 Ta cible a quitté la partie : découvre ta nouvelle mission');
});

// POST /:id/killer/add — faire entrer les arrivés après le début (organisateur)
router.post('/:id/killer/add', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const before = await loadPlayers(ctx.plan.id);
  const inGame = new Set(before.map(p => p.userId));
  const newcomers = (await killerParticipants(ctx.plan.id)).filter(p => !inGame.has(p.id));
  let players: KillerState[] = before;
  const hunters = new Set<string>(); const added: string[] = [];
  for (const n of newcomers) {
    const r = insertPlayer(players, n.id, ctx.game.objects, ctx.game.places);
    if (!r) continue;
    players = r.players; hunters.add(r.hunterId); added.push(n.id);
  }
  if (added.length) await savePlayers(ctx.plan.id, before, players);
  res.json({ added: added.length });
  for (const id of added) notify(req, ctx.plan, id, '🔪 Tu entres dans la partie de Killer : découvre ta mission');
  for (const id of hunters) if (!added.includes(id)) notify(req, ctx.plan, id, '🎯 Un nouveau joueur arrive : ta cible a changé');
});

// POST /:id/killer/end — terminer la partie maintenant (organisateur) : tout est révélé
router.post('/:id/killer/end', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const living = alive(await loadPlayers(ctx.plan.id));
  await prisma.killerGame.update({ where: { planId: ctx.plan.id }, data: { endedAt: new Date(), winnerId: living.length === 1 ? living[0].userId : null } });
  await prisma.killerPlayer.updateMany({ where: { planId: ctx.plan.id }, data: { claimedAt: null } });
  res.json({ ok: true });
  for (const p of await loadPlayers(ctx.plan.id)) notify(req, ctx.plan, p.userId, '🔪 La partie de Killer est terminée : découvre le palmarès');
});

// POST /:id/killer/reset — tout recommencer (organisateur)
router.post('/:id/killer/reset', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  await prisma.$transaction([
    prisma.killerPlayer.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.killerGame.update({ where: { planId: ctx.plan.id }, data: { startedAt: null, endedAt: null, winnerId: null } }),
  ]);
  res.json({ ok: true });
});

export default router;
