import prisma from './prisma';
import { drawPairs, santaParticipants } from './secretSanta';
import { isCircleManager } from './circleRoles';

// Killer : fonction à activer dans un Plan (enabledFeatures « killer »). Chaque joueur reçoit en
// secret une mission : éliminer sa cible en lui faisant tenir un objet dans un lieu. Les missions
// forment une seule chaîne. La cible confirme son élimination ; le tueur hérite alors de sa mission.
// Le dernier en jeu gagne. Règle d'or : avant la fin, personne ne voit la mission d'un autre.

export const KILLER_FEATURE = 'killer';
export const KILLER_DISABLED_ERROR = 'Le Killer n’est pas activé pour ce Plan';
export const KILLER_ITEM_MAX = 60;
export const KILLER_LIST_MAX = 30;

export const DEFAULT_OBJECTS = [
  'une cuillère', 'un verre', 'une serviette', 'un bouchon', 'un stylo', 'une clé',
  'une pièce de monnaie', 'une carte à jouer', 'un citron', 'un élastique', 'une chaussette', 'un ticket',
];
export const DEFAULT_PLACES = [
  'dans la cuisine', 'à table', 'près d’une fenêtre', 'dans un couloir', 'dehors', 'devant un miroir',
  'près de la porte d’entrée', 'assis(e) sur un canapé', 'près du bar', 'dans l’escalier',
];

export function killerEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(KILLER_FEATURE);
}

export async function canManageKiller(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

// Liste d'objets ou de lieux : textes non vides, sans doublon, longueur et nombre limités
export function parseKillerList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const items = [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean))];
  if (!items.length || items.length > KILLER_LIST_MAX || items.some(x => x.length > KILLER_ITEM_MAX)) return null;
  return items;
}

export type KillerState = {
  userId: string;
  targetId: string | null;
  object: string | null;
  place: string | null;
  kills: number;
  eliminatedAt: Date | null;
  eliminatedById: string | null;
};

const pick = <T>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)];

// Missions de départ : une seule chaîne (A → B → C → … → A), objet et lieu au hasard
export function buildMissions(ids: string[], objects: string[], places: string[], rand: () => number = Math.random): KillerState[] | null {
  const pairs = drawPairs(ids, new Set(), rand);
  if (!pairs) return null;
  return ids.map(userId => ({
    userId, targetId: pairs.get(userId)!, object: pick(objects, rand), place: pick(places, rand),
    kills: 0, eliminatedAt: null, eliminatedById: null,
  }));
}

export const alive = (players: KillerState[]) => players.filter(p => !p.eliminatedAt);

// Élimination confirmée : la victime sort, le tueur reprend sa mission (cible, objet, lieu).
// gameOver : il ne reste que le tueur.
export function applyKill(players: KillerState[], killerId: string, victimId: string, now = new Date()): { players: KillerState[]; gameOver: boolean } | null {
  const killer = players.find(p => p.userId === killerId);
  const victim = players.find(p => p.userId === victimId);
  if (!killer || !victim || killer.eliminatedAt || victim.eliminatedAt || killer.targetId !== victimId) return null;
  const gameOver = victim.targetId === killerId;
  const next = players.map(p => {
    if (p.userId === killerId) {
      return gameOver
        ? { ...p, kills: p.kills + 1, targetId: null, object: null, place: null }
        : { ...p, kills: p.kills + 1, targetId: victim.targetId, object: victim.object, place: victim.place };
    }
    if (p.userId === victimId) return { ...p, eliminatedAt: now, eliminatedById: killerId, targetId: null, object: null, place: null };
    return p;
  });
  return { players: next, gameOver };
}

// Un joueur quitte la partie sans être tué (départ, « Je passe », retiré par l'organisateur) :
// celui qui le visait reprend sa mission. gameOver : il ne reste qu'un joueur.
export function withdrawPlayer(players: KillerState[], userId: string, now = new Date()): { players: KillerState[]; gameOver: boolean; heirId: string | null } | null {
  const leaving = players.find(p => p.userId === userId);
  if (!leaving || leaving.eliminatedAt) return null;
  const hunter = players.find(p => !p.eliminatedAt && p.targetId === userId && p.userId !== userId);
  const remaining = alive(players).length - 1;
  const gameOver = remaining <= 1;
  const next = players.map(p => {
    if (p.userId === userId) return { ...p, eliminatedAt: now, eliminatedById: null, targetId: null, object: null, place: null };
    if (hunter && p.userId === hunter.userId) {
      return gameOver || leaving.targetId === hunter.userId
        ? { ...p, targetId: null, object: null, place: null }
        : { ...p, targetId: leaving.targetId, object: leaving.object, place: leaving.place };
    }
    return p;
  });
  return { players: next, gameOver, heirId: hunter && !gameOver ? hunter.userId : null };
}

// Nouveau joueur après le début : il s'insère dans la chaîne (A → nouveau → B) ; A garde son objet
// et son lieu, le nouveau en reçoit d'autres au hasard.
export function insertPlayer(players: KillerState[], userId: string, objects: string[], places: string[], rand: () => number = Math.random): { players: KillerState[]; hunterId: string } | null {
  if (players.some(p => p.userId === userId)) return null;
  const candidates = alive(players).filter(p => p.targetId);
  if (!candidates.length) return null;
  const hunter = pick(candidates, rand);
  const newcomer: KillerState = {
    userId, targetId: hunter.targetId, object: pick(objects, rand), place: pick(places, rand),
    kills: 0, eliminatedAt: null, eliminatedById: null,
  };
  return {
    players: [...players.map(p => (p.userId === hunter.userId ? { ...p, targetId: userId } : p)), newcomer],
    hunterId: hunter.userId,
  };
}

// Filet de sécurité (compte supprimé en cours de partie…) : tout joueur en vie dont la cible n'est
// plus en jeu reçoit une personne en vie que personne ne vise.
export function repairChain(players: KillerState[], objects: string[], places: string[], rand: () => number = Math.random): KillerState[] {
  const living = alive(players);
  if (living.length < 2) return players;
  const livingIds = new Set(living.map(p => p.userId));
  const broken = living.filter(p => !p.targetId || !livingIds.has(p.targetId) || p.targetId === p.userId);
  if (!broken.length) return players;
  const targeted = new Set(living.filter(p => !broken.includes(p)).map(p => p.targetId));
  const free = living.filter(p => !targeted.has(p.userId)).map(p => p.userId);
  const fixes = new Map<string, string>();
  for (const b of broken) {
    const i = free.findIndex(id => id !== b.userId);
    if (i < 0) continue;
    fixes.set(b.userId, free[i]);
    free.splice(i, 1);
  }
  return players.map(p => (fixes.has(p.userId)
    ? { ...p, targetId: fixes.get(p.userId)!, object: p.object ?? pick(objects, rand), place: p.place ?? pick(places, rand) }
    : p));
}

// Joueurs possibles : « Je suis in » avec un compte (comme le Père Noël secret)
export const killerParticipants = santaParticipants;

// Lecture / écriture des joueurs d'une partie
export async function loadPlayers(planId: string): Promise<KillerState[]> {
  return prisma.killerPlayer.findMany({
    where: { planId },
    select: { userId: true, targetId: true, object: true, place: true, kills: true, eliminatedAt: true, eliminatedById: true },
  });
}

export async function savePlayers(planId: string, before: KillerState[], after: KillerState[], extra: { endedAt?: Date; winnerId?: string | null } = {}) {
  const prev = new Map(before.map(p => [p.userId, p]));
  const ops = [];
  for (const p of after) {
    const old = prev.get(p.userId);
    const data = { targetId: p.targetId, object: p.object, place: p.place, kills: p.kills, eliminatedAt: p.eliminatedAt, eliminatedById: p.eliminatedById };
    if (!old) ops.push(prisma.killerPlayer.create({ data: { planId, userId: p.userId, ...data } }));
    else if (JSON.stringify({ ...old, eliminatedAt: old.eliminatedAt?.getTime() ?? null }) !== JSON.stringify({ ...p, eliminatedAt: p.eliminatedAt?.getTime() ?? null })) {
      // Toute mission modifiée annule une revendication en attente qui la concernait
      ops.push(prisma.killerPlayer.update({ where: { planId_userId: { planId, userId: p.userId } }, data: { ...data, ...(old.targetId !== p.targetId ? { claimedAt: null } : {}) } }));
    }
  }
  if (extra.endedAt) ops.push(prisma.killerGame.update({ where: { planId }, data: { endedAt: extra.endedAt, winnerId: extra.winnerId ?? null } }));
  await prisma.$transaction(ops);
}

// Désistement (« Je passe », exclusion, départ du Cercle) pendant une partie : la chaîne se referme
export async function removeFromKiller(planId: string, userId: string) {
  const game = await prisma.killerGame.findUnique({ where: { planId } });
  if (!game?.startedAt || game.endedAt) return;
  const before = await loadPlayers(planId);
  const result = withdrawPlayer(before, userId);
  if (!result) return;
  const last = alive(result.players);
  await savePlayers(planId, before, result.players, result.gameOver ? { endedAt: new Date(), winnerId: last.length === 1 ? last[0].userId : null } : {});
}

export async function removeFromKillerInCircle(circleId: string, userId: string) {
  const rows = await prisma.killerPlayer.findMany({ where: { userId, eliminatedAt: null, game: { plan: { circleId } } }, select: { planId: true } });
  for (const r of rows) await removeFromKiller(r.planId, userId);
}
