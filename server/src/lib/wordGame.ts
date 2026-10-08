import prisma from './prisma';
import { drawPairs, santaParticipants } from './secretSanta';
import { isCircleManager } from './circleRoles';
import { notifyUser } from './push';

// Le mot piège : fonction à activer dans un Plan (enabledFeatures « mot_piege »). Chaque joueur doit faire
// dire secrètement un mot à sa cible. Quand c'est fait, il le signale et la cible confirme. La cible peut
// aussi « démasquer » la personne qui essaie de la piéger. Deux modes :
// - points (défaut) : personne n'est éliminé ; un mot réussi ou un piégeur démasqué = 1 point, et une
//   nouvelle mission ; fin à l'heure choisie ou quand l'organisateur arrête ;
// - elimination : la cible piégée sort du jeu, le piégeur reprend sa cible avec un nouveau mot ; le dernier
//   en jeu gagne.
// Règle d'or : avant la fin, chacun ne voit que sa propre mission ; le classement, lui, est public.

export const WORD_FEATURE = 'mot_piege';
export const WORD_DISABLED_ERROR = 'Le mot piège n’est pas activé pour ce Plan';
export const WORD_MODES = ['points', 'elimination'] as const;
export type WordMode = typeof WORD_MODES[number];
export const WORD_LEVELS = ['facile', 'moyen', 'difficile'] as const;
export const WORD_MAX = 40;
export const CUSTOM_WORDS_MAX = 100;
// Après une accusation fausse : plus d'accusation pendant 30 minutes
export const ACCUSE_COOLDOWN_MS = 30 * 60 * 1000;

export const DEFAULT_WORDS: Record<typeof WORD_LEVELS[number], string[]> = {
  facile: [
    'vacances', 'chocolat', 'parapluie', 'anniversaire', 'piscine', 'montagne', 'fromage', 'voiture', 'soleil',
    'neige', 'cinéma', 'gâteau', 'jardin', 'vélo', 'pizza', 'café', 'train', 'chaussures', 'musique', 'week-end',
    'lunettes', 'valise', 'restaurant', 'bouteille', 'football', 'chanson', 'photo', 'forêt', 'glace', 'pluie',
    'dessert', 'miroir', 'plage', 'bureau', 'chien', 'téléphone', 'cuisine', 'lac', 'fenêtre', 'boulangerie',
  ],
  moyen: [
    'girafe', 'trampoline', 'moustache', 'crocodile', 'sous-marin', 'accordéon', 'pyjama', 'brocoli', 'licorne',
    'volcan', 'igloo', 'kangourou', 'saxophone', 'perroquet', 'tracteur', 'dinosaure', 'cactus', 'tornade',
    'astronaute', 'pirate', 'château', 'raclette', 'cornichon', 'hélicoptère', 'aquarium', 'boussole',
    'chewing-gum', 'escargot', 'pingouin', 'marmotte', 'papillon', 'toboggan', 'sorcière', 'extraterrestre',
    'pamplemousse', 'bretzel', 'coccinelle', 'karaoké', 'montgolfière', 'fondue',
  ],
  difficile: [
    'ornithorynque', 'Zanzibar', 'hippopotame', 'ventriloque', 'tyrannosaure', 'chrysanthème', 'Tombouctou',
    'scaphandre', 'abracadabra', 'Mississippi', 'philatélie', 'zeppelin', 'kilt', 'yodel', 'cachalot',
    'cornemuse', 'Toutânkhamon', 'xylophone', 'paparazzi', 'boomerang', 'Vladivostok', 'origami', 'mammouth',
    'tamanoir', 'Kamtchatka', 'pélican', 'harpe', 'tiramisu', 'gondole', 'Bollywood', 'sumo', 'macramé',
    'tatou', 'narval', 'yéti', 'fakir', 'cerf-volant', 'flamant rose', 'Cléopâtre', 'Atlantide',
  ],
};

export function wordGameEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(WORD_FEATURE);
}

export async function canManageWordGame(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

// Mots personnalisés : textes non vides, sans doublon (casse ignorée), longueur et nombre limités
export function parseCustomWords(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const w = x.trim();
    if (!w) continue;
    if (w.length > WORD_MAX) return null;
    if (!seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); out.push(w); }
  }
  return out.length > CUSTOM_WORDS_MAX ? null : out;
}

export function parseLevels(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((x): x is string => (WORD_LEVELS as readonly string[]).includes(x)))];
  return out;
}

// Réserve de mots de la partie : niveaux choisis + mots personnalisés
export function wordPool(levels: string[], customWords: string[]): string[] {
  const words = [...customWords];
  for (const l of WORD_LEVELS) if (levels.includes(l)) words.push(...DEFAULT_WORDS[l]);
  return [...new Map(words.map(w => [w.toLowerCase(), w])).values()];
}

// Un mot pas encore tiré dans la partie ; quand tout a servi, on repart de la réserve complète
export function pickWord(pool: string[], used: Set<string>, rand: () => number = Math.random): string {
  const free = pool.filter(w => !used.has(w.toLowerCase()));
  const from = free.length ? free : pool;
  const w = from[Math.floor(rand() * from.length)];
  used.add(w.toLowerCase());
  return w;
}

export type WordState = {
  userId: string;
  targetId: string | null;
  word: string | null;
  points: number;
  eliminatedAt: Date | null;
  eliminatedById: string | null;
};

export const playing = (players: WordState[]) => players.filter(p => !p.eliminatedAt);
const pick = <T>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)];

// Missions de départ : une seule chaîne (chacun est la cible d'une seule personne), un mot chacun
export function startMissions(ids: string[], nextWord: () => string, rand: () => number = Math.random): WordState[] | null {
  const pairs = drawPairs(ids, new Set(), rand);
  if (!pairs) return null;
  return ids.map(userId => ({ userId, targetId: pairs.get(userId)!, word: nextWord(), points: 0, eliminatedAt: null, eliminatedById: null }));
}

// Nouvelle cible en mode points : un autre joueur, de préférence ni l'ancienne cible ni quelqu'un de déjà
// visé par beaucoup de monde
function newTarget(players: WordState[], userId: string, avoid: string | null, rand: () => number): string | null {
  const others = playing(players).filter(p => p.userId !== userId);
  if (!others.length) return null;
  const load = (id: string) => players.filter(p => !p.eliminatedAt && p.userId !== userId && p.targetId === id).length;
  const fresh = others.filter(p => p.userId !== avoid);
  const pool = fresh.length ? fresh : others;
  const min = Math.min(...pool.map(p => load(p.userId)));
  return pick(pool.filter(p => load(p.userId) === min), rand).userId;
}

// Mot réussi (confirmé par la cible). Points : +1 et nouvelle mission (autre cible, autre mot).
// Élimination : la cible sort, le piégeur reprend sa cible avec un nouveau mot ; gameOver s'il reste seul.
export function applySuccess(players: WordState[], mode: WordMode, hunterId: string, targetId: string, nextWord: () => string, rand: () => number = Math.random, now = new Date()): { players: WordState[]; gameOver: boolean } | null {
  const hunter = players.find(p => p.userId === hunterId);
  const target = players.find(p => p.userId === targetId);
  if (!hunter || !target || hunter.eliminatedAt || target.eliminatedAt || hunter.targetId !== targetId) return null;
  if (mode === 'points') {
    const next = players.map(p => (p.userId === hunterId ? { ...p, points: p.points + 1 } : p));
    const t = newTarget(next, hunterId, targetId, rand);
    return { players: next.map(p => (p.userId === hunterId ? { ...p, targetId: t, word: t ? nextWord() : null } : p)), gameOver: false };
  }
  const gameOver = target.targetId === hunterId;
  return {
    players: players.map(p => {
      if (p.userId === hunterId) return gameOver ? { ...p, points: p.points + 1, targetId: null, word: null } : { ...p, points: p.points + 1, targetId: target.targetId, word: nextWord() };
      if (p.userId === targetId) return { ...p, eliminatedAt: now, eliminatedById: hunterId, targetId: null, word: null };
      return p;
    }),
    gameOver,
  };
}

// « Démasquer » : la cible accuse quelqu'un. Juste si cette personne la vise ; l'accusateur gagne alors
// 1 point et le piégeur démasqué reçoit un nouveau mot (et une autre cible en mode points).
export function applyAccusation(players: WordState[], mode: WordMode, accuserId: string, suspectId: string, nextWord: () => string, rand: () => number = Math.random): { players: WordState[]; correct: boolean } | null {
  const accuser = players.find(p => p.userId === accuserId);
  const suspect = players.find(p => p.userId === suspectId);
  if (!accuser || !suspect || accuser.eliminatedAt || suspect.eliminatedAt || accuserId === suspectId) return null;
  if (suspect.targetId !== accuserId) return { players, correct: false };
  let next = players.map(p => (p.userId === accuserId ? { ...p, points: p.points + 1 } : p));
  const t = mode === 'points' ? newTarget(next, suspectId, accuserId, rand) : accuserId;
  next = next.map(p => (p.userId === suspectId ? { ...p, targetId: t, word: t ? nextWord() : null } : p));
  return { players: next, correct: true };
}

// Un joueur quitte la partie (départ, « Je passe », retiré par l'organisateur). Points : ceux qui le
// visaient reçoivent une autre mission. Élimination : celui qui le visait reprend sa cible.
// gameOver : il ne reste qu'un joueur (élimination) ou moins de deux (points).
export function withdrawWordPlayer(players: WordState[], mode: WordMode, userId: string, nextWord: () => string, rand: () => number = Math.random, now = new Date()): { players: WordState[]; gameOver: boolean; changed: string[] } | null {
  const leaving = players.find(p => p.userId === userId);
  if (!leaving || leaving.eliminatedAt) return null;
  let next = players.map(p => (p.userId === userId ? { ...p, eliminatedAt: now, eliminatedById: null, targetId: null, word: null } : p));
  const gameOver = playing(next).length < 2;
  const hunters = next.filter(p => !p.eliminatedAt && p.targetId === userId).map(p => p.userId);
  for (const h of hunters) {
    const t = gameOver ? null
      : mode === 'points' ? newTarget(next, h, userId, rand)
      : leaving.targetId === h ? null : leaving.targetId;
    next = next.map(p => (p.userId === h ? { ...p, targetId: t, word: t ? nextWord() : null } : p));
  }
  return { players: next, gameOver, changed: hunters };
}

// Arrivée en cours de partie : en élimination, insertion dans la chaîne (A → nouveau → B) ; en points,
// une cible peu visée, et le nouveau devient la cible de celui qui a le moins de « chasseurs »
export function insertWordPlayer(players: WordState[], mode: WordMode, userId: string, nextWord: () => string, rand: () => number = Math.random): { players: WordState[]; changed: string[] } | null {
  if (players.some(p => p.userId === userId)) return null;
  const candidates = playing(players).filter(p => p.targetId);
  if (!candidates.length) return null;
  const hunter = pick(candidates, rand);
  const newcomer: WordState = { userId, targetId: hunter.targetId, word: nextWord(), points: 0, eliminatedAt: null, eliminatedById: null };
  return {
    players: [...players.map(p => (p.userId === hunter.userId ? { ...p, targetId: userId, word: nextWord() } : p)), newcomer],
    changed: [hunter.userId],
  };
}

// Classement : points, puis encore en jeu
export function ranking<T extends { points: number; eliminatedAt: Date | null }>(players: T[]): T[] {
  return [...players].sort((a, b) => b.points - a.points || +!!a.eliminatedAt - +!!b.eliminatedAt);
}

// Vainqueur : élimination → le dernier en jeu ; points → le meilleur score s'il est seul en tête
export function winnerOf(players: WordState[], mode: WordMode): string | null {
  if (mode === 'elimination') {
    const left = playing(players);
    return left.length === 1 ? left[0].userId : null;
  }
  const r = ranking(players);
  return r.length && r[0].points > 0 && (r.length === 1 || r[0].points > r[1].points) ? r[0].userId : null;
}

// Joueurs possibles : « Je suis in » avec un compte (comme le Killer)
export const wordParticipants = santaParticipants;

// ---------- Base ----------

export async function loadWordPlayers(planId: string): Promise<WordState[]> {
  return prisma.wordPlayer.findMany({
    where: { planId },
    select: { userId: true, targetId: true, word: true, points: true, eliminatedAt: true, eliminatedById: true },
  });
}

// Enregistre l'état et tient l'historique des missions : toute mission changée ferme l'ancienne (outcome
// donné par l'appelant pour ce joueur, sinon « cancelled ») et ouvre la nouvelle
export async function saveWordPlayers(planId: string, before: WordState[], after: WordState[], opts: { outcomes?: Map<string, string>; usedWords?: string[]; end?: { winnerId: string | null } } = {}) {
  const prev = new Map(before.map(p => [p.userId, p]));
  const ops: any[] = [];
  const now = new Date();
  for (const p of after) {
    const old = prev.get(p.userId);
    const data = { targetId: p.targetId, word: p.word, points: p.points, eliminatedAt: p.eliminatedAt, eliminatedById: p.eliminatedById };
    const missionChanged = !old || old.targetId !== p.targetId || old.word !== p.word;
    if (!old) ops.push(prisma.wordPlayer.create({ data: { planId, userId: p.userId, ...data } }));
    else if (missionChanged || old.points !== p.points || +(old.eliminatedAt ?? 0) !== +(p.eliminatedAt ?? 0)) {
      ops.push(prisma.wordPlayer.update({ where: { planId_userId: { planId, userId: p.userId } }, data: { ...data, ...(missionChanged ? { claimedAt: null } : {}) } }));
    }
    if (missionChanged) {
      if (old?.targetId && old.word) {
        ops.push(prisma.wordMission.updateMany({ where: { planId, hunterId: p.userId, outcome: 'open' }, data: { outcome: opts.outcomes?.get(p.userId) ?? 'cancelled', closedAt: now } }));
      }
      if (p.targetId && p.word) ops.push(prisma.wordMission.create({ data: { planId, hunterId: p.userId, targetId: p.targetId, word: p.word } }));
    }
  }
  if (opts.usedWords) ops.push(prisma.wordGame.update({ where: { planId }, data: { usedWords: opts.usedWords } }));
  if (opts.end) {
    ops.push(prisma.wordGame.update({ where: { planId }, data: { endedAt: now, winnerId: opts.end.winnerId } }));
    ops.push(prisma.wordPlayer.updateMany({ where: { planId }, data: { claimedAt: null } }));
  }
  await prisma.$transaction(ops);
}

// Générateur de mots d'une partie (réserve + mots déjà tirés), à enregistrer ensuite (usedWords)
export function wordDrawer(game: { levels: string[]; customWords: string[]; usedWords: string[] }, rand: () => number = Math.random) {
  const pool = wordPool(game.levels, game.customWords);
  const used = new Set(game.usedWords.map(w => w.toLowerCase()));
  const drawn = [...game.usedWords];
  return {
    next: () => { const w = pickWord(pool, used, rand); drawn.push(w); return w; },
    used: () => drawn,
    poolSize: pool.length,
  };
}

// Désistement (« Je passe », exclusion, départ du Cercle) pendant une partie
export async function removeFromWordGame(planId: string, userId: string) {
  const game = await prisma.wordGame.findUnique({ where: { planId } });
  if (!game?.startedAt || game.endedAt) return;
  const before = await loadWordPlayers(planId);
  const words = wordDrawer(game);
  const result = withdrawWordPlayer(before, game.mode as WordMode, userId, words.next);
  if (!result) return;
  await saveWordPlayers(planId, before, result.players, {
    usedWords: words.used(),
    ...(result.gameOver ? { end: { winnerId: winnerOf(result.players, game.mode as WordMode) } } : {}),
  });
}

export async function removeFromWordGameInCircle(circleId: string, userId: string) {
  const rows = await prisma.wordPlayer.findMany({ where: { userId, eliminatedAt: null, game: { plan: { circleId } } }, select: { planId: true } });
  for (const r of rows) await removeFromWordGame(r.planId, userId);
}

// Fin à l'heure choisie (mode points) : vérifiée chaque minute par le serveur (index.ts, comme les autres
// tâches régulières), pour prévenir les joueurs à l'heure. La lecture de l'onglet la constate aussi.
export async function endDueWordGames(io: any) {
  try {
    const due = await prisma.wordGame.findMany({
      where: { startedAt: { not: null }, endedAt: null, endsAt: { lte: new Date() } },
      include: { plan: { select: { id: true, title: true, circleId: true } } },
    });
    for (const g of due) {
      const players = await loadWordPlayers(g.planId);
      const claimed = await prisma.wordGame.updateMany({ where: { planId: g.planId, endedAt: null }, data: { endedAt: new Date(), winnerId: winnerOf(players, g.mode as WordMode) } });
      if (!claimed.count) continue;
      await prisma.wordPlayer.updateMany({ where: { planId: g.planId }, data: { claimedAt: null } });
      await prisma.wordMission.updateMany({ where: { planId: g.planId, outcome: 'open' }, data: { closedAt: new Date() } });
      io.to(`plan:${g.planId}`).emit('plan-updated', { planId: g.planId });
      for (const p of players) {
        notifyUser(io, p.userId, { type: 'words', planId: g.plan.id, planTitle: g.plan.title, circleId: g.plan.circleId, preview: '⏱️ Fin du mot piège : découvre le classement et toutes les missions' });
      }
    }
  } catch (e) {
    console.error('[word game end]', e);
  }
}
