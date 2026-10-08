import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import {
  ACCUSE_COOLDOWN_MS, WORD_DISABLED_ERROR, WORD_MODES, WordMode, WordState, applyAccusation, applySuccess,
  canManageWordGame, insertWordPlayer, loadWordPlayers, parseCustomWords, parseLevels, playing, ranking,
  saveWordPlayers, startMissions, winnerOf, withdrawWordPlayer, wordDrawer, wordGameEnabled, wordParticipants,
} from '../lib/wordGame';

// Le mot piège (lib/wordGame.ts), monté dans le routeur des Plans (/api/plans). Règle d'or : avant la fin,
// une réponse ne contient que la mission de la personne qui demande ; le classement est public. La cible
// découvre qui la revendique (et le mot) au moment de confirmer.
const router = Router();

const personSelect = { id: true, pseudo: true, firstName: true } as const;
type Person = { id: string; pseudo: string; firstName: string | null };
const label = (p?: Person | null) => (p ? p.firstName ?? `@${p.pseudo}` : 'Quelqu’un');

async function load(req: AuthRequest, res: any) {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !wordGameEnabled(plan)) { res.status(403).json({ error: WORD_DISABLED_ERROR }); return null; }
  let game = await prisma.wordGame.upsert({ where: { planId: plan.id }, create: { planId: plan.id }, update: {} });
  // Fin à l'heure choisie (mode points) : constatée à la première lecture ou action après l'heure
  if (game.startedAt && !game.endedAt && game.endsAt && game.endsAt.getTime() <= Date.now()) {
    const players = await loadWordPlayers(plan.id);
    const claimed = await prisma.wordGame.updateMany({ where: { planId: plan.id, endedAt: null }, data: { endedAt: new Date(), winnerId: winnerOf(players, game.mode as WordMode) } });
    if (claimed.count) {
      await prisma.wordPlayer.updateMany({ where: { planId: plan.id }, data: { claimedAt: null } });
      await prisma.wordMission.updateMany({ where: { planId: plan.id, outcome: 'open' }, data: { closedAt: new Date() } });
      for (const p of players) notify(req, plan, p.userId, '⏱️ Fin du mot piège : découvre le classement et toutes les missions');
    }
    game = (await prisma.wordGame.findUnique({ where: { planId: plan.id } }))!;
  }
  return { plan, game, mode: game.mode as WordMode };
}

async function requireManager(req: AuthRequest, res: any, plan: { creatorId: string; circleId: string }) {
  if (await canManageWordGame(req.userId!, plan)) return true;
  res.status(403).json({ error: 'Réservé à l’organisateur' });
  return false;
}

const running = (g: { startedAt: Date | null; endedAt: Date | null }) => !!g.startedAt && !g.endedAt;

function notify(req: AuthRequest, plan: { id: string; title: string; circleId: string }, userId: string, preview: string, actorId?: string) {
  notifyUser(req.app.get('io'), userId, { type: 'words', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview, ...(actorId ? { actorId } : {}) });
}

async function people(ids: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: personSelect });
  return new Map(users.map(u => [u.id, u as Person]));
}

// GET /:id/words
router.get('/:id/words', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { plan, game, mode } = ctx;
  const me = req.userId!;
  const manager = await canManageWordGame(me, plan);
  const [players, rows, participants] = await Promise.all([
    loadWordPlayers(plan.id),
    prisma.wordPlayer.findMany({ where: { planId: plan.id }, select: { userId: true, targetId: true, word: true, claimedAt: true, accuseBlockedUntil: true } }),
    wordParticipants(plan.id),
  ]);
  const ended = !!game.endedAt;
  const missions = ended ? await prisma.wordMission.findMany({ where: { planId: plan.id }, orderBy: { createdAt: 'asc' } }) : [];
  const byId = await people([...players.map(p => p.userId), ...participants.map(p => p.id), ...missions.flatMap(m => [m.hunterId, m.targetId]), ...(game.winnerId ? [game.winnerId] : [])]);
  const mine = players.find(p => p.userId === me);
  const myRow = rows.find(r => r.userId === me);
  const claimOnMe = rows.find(r => r.targetId === me && r.claimedAt);
  const inGame = new Set(players.map(p => p.userId));
  const words = wordDrawer(game);
  res.json({
    started: !!game.startedAt,
    ended,
    mode,
    endsAt: game.endsAt,
    canManage: manager,
    // Réglages : l'organisateur seulement (les mots perso ne doivent pas fuiter)
    levels: manager ? game.levels : null,
    customWords: manager ? game.customWords : null,
    poolSize: manager ? words.poolSize : null,
    participants: participants.map(p => ({ id: p.id, pseudo: p.pseudo, firstName: p.firstName })),
    // Classement en direct (public) ; qui a piégé qui seulement à la fin
    ranking: ranking(players).map(p => ({
      user: byId.get(p.userId) ?? { id: p.userId, pseudo: '?', firstName: null },
      points: p.points,
      alive: !p.eliminatedAt,
      eliminatedBy: ended ? (p.eliminatedById ? byId.get(p.eliminatedById) ?? null : null) : undefined,
    })),
    playingCount: playing(players).length,
    me: mine ? {
      alive: !mine.eliminatedAt,
      points: mine.points,
      mission: mine.targetId && mine.word && !ended ? { target: byId.get(mine.targetId) ?? null, word: mine.word } : null,
      claimed: !!myRow?.claimedAt,
      accuseBlockedUntil: myRow?.accuseBlockedUntil && myRow.accuseBlockedUntil.getTime() > Date.now() ? myRow.accuseBlockedUntil : null,
      eliminatedBy: mine.eliminatedById ? byId.get(mine.eliminatedById) ?? null : null,
    } : null,
    // Quelqu'un dit que j'ai prononcé mon mot : je découvre qui, et le mot, pour confirmer
    pendingClaim: claimOnMe && mine && !mine.eliminatedAt && !ended ? { hunter: byId.get(claimOnMe.userId) ?? null, word: claimOnMe.word } : null,
    winner: game.winnerId ? byId.get(game.winnerId) ?? null : null,
    newcomers: manager && running(game) ? participants.filter(p => !inGame.has(p.id)) : [],
    // Fin : toutes les missions de la partie
    missions: ended ? missions.map(m => ({ hunter: byId.get(m.hunterId) ?? null, target: byId.get(m.targetId) ?? null, word: m.word, outcome: m.outcome })) : null,
  });
});

// PUT /:id/words { mode, levels, customWords, endsAt } — réglages (organisateur). Mode, niveaux et mots
// avant le début ; l'heure de fin reste modifiable pendant la partie.
router.put('/:id/words', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  const before = !ctx.game.startedAt;
  if (b.mode !== undefined || b.levels !== undefined || b.customWords !== undefined) {
    if (!before) { res.status(400).json({ error: 'La partie a commencé : le mode et les mots ne changent plus' }); return; }
    if (b.mode !== undefined) {
      if (!(WORD_MODES as readonly string[]).includes(b.mode)) { res.status(400).json({ error: 'Mode inconnu' }); return; }
      data.mode = b.mode;
    }
    if (b.levels !== undefined) {
      const v = parseLevels(b.levels);
      if (!v) { res.status(400).json({ error: 'Niveaux invalides' }); return; }
      data.levels = v;
    }
    if (b.customWords !== undefined) {
      const v = parseCustomWords(b.customWords);
      if (!v) { res.status(400).json({ error: 'Mots : 100 au maximum, 40 caractères chacun' }); return; }
      data.customWords = v;
    }
  }
  if (b.endsAt !== undefined) {
    if (b.endsAt === null || b.endsAt === '') data.endsAt = null;
    else {
      const d = new Date(b.endsAt);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) { res.status(400).json({ error: 'L’heure de fin doit être à venir' }); return; }
      data.endsAt = d;
    }
  }
  const next = { levels: (data.levels as string[]) ?? ctx.game.levels, customWords: (data.customWords as string[]) ?? ctx.game.customWords };
  if (!next.levels.length && !next.customWords.length) { res.status(400).json({ error: 'Garde au moins un niveau de mots ou ajoute tes propres mots' }); return; }
  await prisma.wordGame.update({ where: { planId: ctx.plan.id }, data });
  res.json({ ok: true });
});

// POST /:id/words/start — distribue les missions (organisateur)
router.post('/:id/words/start', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (ctx.game.startedAt) { res.status(409).json({ error: 'La partie a déjà commencé' }); return; }
  const participants = await wordParticipants(ctx.plan.id);
  if (participants.length < 3) { res.status(400).json({ error: 'Il faut au moins 3 joueurs (« Je suis in », avec un compte)' }); return; }
  const words = wordDrawer({ ...ctx.game, usedWords: [] });
  if (words.poolSize < 3) { res.status(400).json({ error: 'Il faut au moins 3 mots' }); return; }
  const missions = startMissions(participants.map(p => p.id), words.next);
  if (!missions) { res.status(400).json({ error: 'Impossible de distribuer les missions' }); return; }
  const claimed = await prisma.wordGame.updateMany({ where: { planId: ctx.plan.id, startedAt: null }, data: { startedAt: new Date(), usedWords: words.used() } });
  if (claimed.count === 0) { res.status(409).json({ error: 'La partie a déjà commencé' }); return; }
  await prisma.$transaction([
    prisma.wordPlayer.createMany({ data: missions.map(m => ({ planId: ctx.plan.id, userId: m.userId, targetId: m.targetId, word: m.word })) }),
    prisma.wordMission.createMany({ data: missions.map(m => ({ planId: ctx.plan.id, hunterId: m.userId, targetId: m.targetId!, word: m.word! })) }),
  ]);
  res.json({ ok: true, count: missions.length });
  for (const p of participants) notify(req, ctx.plan, p.id, '🤫 Le mot piège commence : découvre ta mission (et garde-la secrète !)');
});

// POST /:id/words/claim — « Il / elle l'a dit ! » (le piégeur)
router.post('/:id/words/claim', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const me = await prisma.wordPlayer.findUnique({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } } });
  if (!me || me.eliminatedAt || !me.targetId) { res.status(400).json({ error: 'Tu n’as pas de mission en cours' }); return; }
  await prisma.wordPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: req.userId! } }, data: { claimedAt: new Date() } });
  res.json({ ok: true });
  const hunter = (await people([req.userId!])).get(req.userId!);
  notify(req, ctx.plan, me.targetId, `🤫 ${label(hunter)} dit que tu as prononcé ton mot piège : confirme ou conteste`, req.userId!);
});

// DELETE /:id/words/claim — annuler sa revendication
router.delete('/:id/words/claim', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  await prisma.wordPlayer.updateMany({ where: { planId: ctx.plan.id, userId: req.userId! }, data: { claimedAt: null } });
  res.json({ ok: true });
});

// POST /:id/words/answer { confirm } — la cible confirme (le mot est compté) ou conteste
router.post('/:id/words/answer', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const me = req.userId!;
  const claim = await prisma.wordPlayer.findFirst({ where: { planId: ctx.plan.id, targetId: me, claimedAt: { not: null }, eliminatedAt: null } });
  if (!claim) { res.status(404).json({ error: 'Personne ne dit t’avoir piégé(e)' }); return; }
  const names = await people([me, claim.userId]);
  if (req.body?.confirm !== true) {
    await prisma.wordPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: claim.userId } }, data: { claimedAt: null } });
    res.json({ ok: true });
    notify(req, ctx.plan, claim.userId, `🙅 ${label(names.get(me))} conteste : ta mission continue`, me);
    return;
  }
  const before = await loadWordPlayers(ctx.plan.id);
  const words = wordDrawer(ctx.game);
  const result = applySuccess(before, ctx.mode, claim.userId, me, words.next);
  if (!result) { res.status(409).json({ error: 'Ce mot ne correspond plus à une mission en cours' }); return; }
  await saveWordPlayers(ctx.plan.id, before, result.players, {
    outcomes: new Map([[claim.userId, 'success']]),
    usedWords: words.used(),
    ...(result.gameOver ? { end: { winnerId: winnerOf(result.players, ctx.mode) } } : {}),
  });
  res.json({ ok: true, gameOver: result.gameOver });
  if (result.gameOver) {
    for (const p of result.players) notify(req, ctx.plan, p.userId, `🏆 ${label(names.get(claim.userId))} remporte le mot piège ! Découvre toutes les missions`);
    return;
  }
  notify(req, ctx.plan, claim.userId, '🎯 Mot validé ! +1 point, découvre ta nouvelle mission', me);
  if (ctx.mode === 'elimination') {
    for (const p of playing(result.players)) if (p.userId !== claim.userId) notify(req, ctx.plan, p.userId, `💬 ${label(names.get(me))} s’est fait piéger : il reste ${playing(result.players).length} joueurs`);
  }
});

// POST /:id/words/accuse { suspectId } — « Démasquer » : accuser la personne qui essaie de me piéger
router.post('/:id/words/accuse', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const me = req.userId!;
  const row = await prisma.wordPlayer.findUnique({ where: { planId_userId: { planId: ctx.plan.id, userId: me } } });
  if (!row || row.eliminatedAt) { res.status(400).json({ error: 'Tu n’es pas en jeu' }); return; }
  if (row.accuseBlockedUntil && row.accuseBlockedUntil.getTime() > Date.now()) { res.status(429).json({ error: 'Après une accusation fausse, attends un peu avant d’accuser à nouveau' }); return; }
  const before = await loadWordPlayers(ctx.plan.id);
  const words = wordDrawer(ctx.game);
  const result = applyAccusation(before, ctx.mode, me, String(req.body?.suspectId ?? ''), words.next);
  if (!result) { res.status(400).json({ error: 'Choisis un joueur encore en jeu' }); return; }
  if (!result.correct) {
    const until = new Date(Date.now() + ACCUSE_COOLDOWN_MS);
    await prisma.wordPlayer.update({ where: { planId_userId: { planId: ctx.plan.id, userId: me } }, data: { accuseBlockedUntil: until } });
    res.json({ correct: false, blockedUntil: until });
    return;
  }
  const suspectId = String(req.body.suspectId);
  await saveWordPlayers(ctx.plan.id, before, result.players, { outcomes: new Map([[suspectId, 'unmasked']]), usedWords: words.used() });
  res.json({ correct: true });
  const names = await people([me]);
  notify(req, ctx.plan, suspectId, `🕵️ ${label(names.get(me))} t’a démasqué(e) ! Découvre ta nouvelle mission`, me);
});

// POST /:id/words/remove { userId } — retirer un joueur (organisateur)
router.post('/:id/words/remove', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const userId = String(req.body?.userId ?? '');
  const before = await loadWordPlayers(ctx.plan.id);
  const words = wordDrawer(ctx.game);
  const result = withdrawWordPlayer(before, ctx.mode, userId, words.next);
  if (!result) { res.status(404).json({ error: 'Ce joueur n’est plus en jeu' }); return; }
  await saveWordPlayers(ctx.plan.id, before, result.players, { usedWords: words.used(), ...(result.gameOver ? { end: { winnerId: winnerOf(result.players, ctx.mode) } } : {}) });
  res.json({ ok: true });
  notify(req, ctx.plan, userId, '🤫 L’organisateur t’a retiré(e) du mot piège');
  if (result.gameOver) for (const p of result.players) notify(req, ctx.plan, p.userId, '🤫 Le mot piège est terminé : découvre le classement');
  else for (const id of result.changed) notify(req, ctx.plan, id, '🎯 Ta cible a quitté la partie : découvre ta nouvelle mission');
});

// POST /:id/words/add — faire entrer les arrivés après le début (organisateur)
router.post('/:id/words/add', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const before = await loadWordPlayers(ctx.plan.id);
  const inGame = new Set(before.map(p => p.userId));
  const newcomers = (await wordParticipants(ctx.plan.id)).filter(p => !inGame.has(p.id));
  const words = wordDrawer(ctx.game);
  let players: WordState[] = before;
  const added: string[] = []; const changed = new Set<string>();
  for (const n of newcomers) {
    const r = insertWordPlayer(players, ctx.mode, n.id, words.next);
    if (!r) continue;
    players = r.players; added.push(n.id); r.changed.forEach(id => changed.add(id));
  }
  if (added.length) await saveWordPlayers(ctx.plan.id, before, players, { usedWords: words.used() });
  res.json({ added: added.length });
  for (const id of added) notify(req, ctx.plan, id, '🤫 Tu entres dans le mot piège : découvre ta mission');
  for (const id of changed) if (!added.includes(id)) notify(req, ctx.plan, id, '🎯 Un nouveau joueur arrive : ta mission a changé');
});

// POST /:id/words/end — terminer maintenant (organisateur) : classement et missions révélés
router.post('/:id/words/end', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  if (!running(ctx.game)) { res.status(400).json({ error: 'Pas de partie en cours' }); return; }
  const players = await loadWordPlayers(ctx.plan.id);
  await prisma.$transaction([
    prisma.wordGame.update({ where: { planId: ctx.plan.id }, data: { endedAt: new Date(), winnerId: winnerOf(players, ctx.mode) } }),
    prisma.wordPlayer.updateMany({ where: { planId: ctx.plan.id }, data: { claimedAt: null } }),
    prisma.wordMission.updateMany({ where: { planId: ctx.plan.id, outcome: 'open' }, data: { closedAt: new Date() } }),
  ]);
  res.json({ ok: true });
  for (const p of players) notify(req, ctx.plan, p.userId, '🤫 Le mot piège est terminé : découvre le classement et toutes les missions');
});

// POST /:id/words/reset — tout recommencer (organisateur) ; les réglages sont gardés
router.post('/:id/words/reset', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  await prisma.$transaction([
    prisma.wordPlayer.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.wordMission.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.wordGame.update({ where: { planId: ctx.plan.id }, data: { startedAt: null, endedAt: null, winnerId: null, usedWords: [], endsAt: null } }),
  ]);
  res.json({ ok: true });
});

export default router;
