import prisma from './prisma';
import { isCircleManager } from './circleRoles';
import { notifyUser } from './push';

// Père Noël secret : fonction à activer dans un Plan (enabledFeatures « pere_noel »). La date du
// Plan est le jour de l'échange des cadeaux ; la révélation n'est possible qu'à partir de cette date.
// Le tirage (lancé par l'organisateur) relie les participants « Je suis in » qui ont un compte.
// Chacun ne voit que sa propre paire ; la messagerie est anonyme du côté du Père Noël.

export const SANTA_FEATURE = 'pere_noel';
export const WISH_MAX = 1000;
export const BUDGET_MAX = 40;
export const SANTA_MESSAGE_MAX = 1000;
export const SANTA_DISABLED_ERROR = 'Le Père Noël secret n’est pas activé pour ce Plan';

export function santaEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(SANTA_FEATURE);
}

// Dates d'un Plan avec Père Noël secret : la date (jour de l'échange) est obligatoire et la fin du
// Plan vient après, pour que la révélation tombe entre l'échange et la suppression du Plan
export function santaDateError(enabledFeatures: string[], eventDate: Date | null | undefined, endDate: Date): string | null {
  if (!enabledFeatures.includes(SANTA_FEATURE)) return null;
  if (!eventDate || isNaN(eventDate.getTime())) return 'Le Père Noël secret a besoin d’une date : celle de l’échange des cadeaux';
  if (endDate <= eventDate) return 'La fin du Plan doit venir après l’échange des cadeaux';
  return null;
}

export async function canManageSanta(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

// Clé d'exclusion indépendante de l'ordre
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Tirage : de préférence un seul grand cercle (pas d'échange à deux, A→B et B→A), en respectant
// les exclusions ; sinon toute attribution sans soi-même. null si impossible.
export function drawPairs(ids: string[], excluded: Set<string>, rand: () => number = Math.random): Map<string, string> | null {
  if (ids.length < 3) return null;
  const ok = (g: string, r: string) => g !== r && !excluded.has(pairKey(g, r));
  for (let attempt = 0; attempt < 4000; attempt++) {
    const order = shuffle(ids, rand);
    if (order.every((g, i) => ok(g, order[(i + 1) % order.length]))) {
      return new Map(order.map((g, i) => [g, order[(i + 1) % order.length]]));
    }
  }
  for (let attempt = 0; attempt < 4000; attempt++) {
    const receivers = shuffle(ids, rand);
    if (ids.every((g, i) => ok(g, receivers[i]))) return new Map(ids.map((g, i) => [g, receivers[i]]));
  }
  return null;
}

// Une personne quitte le tirage : son Père Noël offre désormais à la personne qu'elle devait gâter.
// Renvoie les modifications à appliquer (sans toucher aux autres paires).
export function withoutParticipant(pairs: Map<string, string>, userId: string): Map<string, string> {
  const next = new Map(pairs);
  const receiver = next.get(userId);
  const giver = [...next.entries()].find(([, r]) => r === userId)?.[0];
  next.delete(userId);
  if (giver !== undefined && receiver !== undefined) {
    if (giver === receiver) next.delete(giver); // il ne restait que deux personnes
    else next.set(giver, receiver);
  }
  return next;
}

// Une personne arrive après le tirage : elle s'insère dans une paire existante A→B (A→nouveau→B),
// en respectant les exclusions si possible. null si aucune place ne convient.
export function withParticipant(pairs: Map<string, string>, userId: string, excluded: Set<string>, rand: () => number = Math.random): Map<string, string> | null {
  if (pairs.has(userId)) return pairs;
  const entries = shuffle([...pairs.entries()], rand);
  const ok = (g: string, r: string) => g !== r && !excluded.has(pairKey(g, r));
  const spot = entries.find(([a, b]) => ok(a, userId) && ok(userId, b));
  if (!spot) return null;
  const next = new Map(pairs);
  next.set(spot[0], userId);
  next.set(userId, spot[1]);
  return next;
}

// Participants : « Je suis in » et un vrai compte (pas les réponses sans compte)
export async function santaParticipants(planId: string) {
  const members = await prisma.planMember.findMany({
    where: { planId, rsvp: 'in', user: { isLight: false } },
    select: { user: { select: { id: true, pseudo: true, firstName: true } } },
  });
  return members.map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr'));
}

async function applyPairs(planId: string, next: Map<string, string>) {
  const current = await prisma.secretSantaPair.findMany({ where: { planId } });
  const ready = new Map(current.filter(p => next.get(p.giverId) === p.receiverId).map(p => [p.giverId, p.giftReady]));
  await prisma.$transaction([
    prisma.secretSantaPair.deleteMany({ where: { planId } }),
    prisma.secretSantaPair.createMany({ data: [...next.entries()].map(([giverId, receiverId]) => ({ planId, giverId, receiverId, giftReady: ready.get(giverId) ?? false })) }),
  ]);
}

// Désistement après le tirage (« Je passe », exclusion, départ) : la chaîne se referme sans refaire
// le tirage ; les messages de ses deux conversations disparaissent.
export async function removeFromSanta(planId: string, userId: string) {
  const santa = await prisma.secretSanta.findUnique({ where: { planId }, include: { pairs: true } });
  if (!santa?.drawnAt || santa.revealedAt || !santa.pairs.some(p => p.giverId === userId || p.receiverId === userId)) return;
  const pairs = new Map(santa.pairs.map(p => [p.giverId, p.receiverId]));
  await applyPairs(planId, withoutParticipant(pairs, userId));
  await prisma.secretSantaMessage.deleteMany({ where: { planId, OR: [{ giverId: userId }, { receiverId: userId }] } });
}

export async function removeFromSantaInCircle(circleId: string, userId: string) {
  const plans = await prisma.secretSantaPair.findMany({ where: { santa: { plan: { circleId } }, OR: [{ giverId: userId }, { receiverId: userId }] }, select: { planId: true } });
  for (const planId of new Set(plans.map(p => p.planId))) await removeFromSanta(planId, userId);
}

export async function addToSanta(planId: string, userIds: string[]): Promise<{ added: string[]; failed: string[] }> {
  const santa = await prisma.secretSanta.findUnique({ where: { planId }, include: { pairs: true, exclusions: true } });
  if (!santa?.drawnAt) return { added: [], failed: userIds };
  const excluded = new Set(santa.exclusions.map(e => pairKey(e.userAId, e.userBId)));
  let pairs = new Map(santa.pairs.map(p => [p.giverId, p.receiverId]));
  const added: string[] = [], failed: string[] = [];
  for (const id of userIds) {
    const next = withParticipant(pairs, id, excluded);
    if (next) { pairs = next; added.push(id); } else failed.push(id);
  }
  if (added.length) await applyPairs(planId, pairs);
  return { added, failed };
}

// Rappel une semaine avant l'échange, à ceux dont le cadeau n'est pas encore prêt
export async function sendSantaReminders(io: any) {
  try {
    const now = Date.now();
    const due = await prisma.secretSanta.findMany({
      where: { drawnAt: { not: null }, revealedAt: null, weekReminderSentAt: null, plan: { eventDate: { gte: new Date(now + 6 * 864e5), lte: new Date(now + 7 * 864e5) } } },
      include: { plan: { select: { id: true, title: true, circleId: true } }, pairs: { where: { giftReady: false }, include: { receiver: { select: { pseudo: true, firstName: true } } } } },
    });
    for (const s of due) {
      await prisma.secretSanta.update({ where: { planId: s.planId }, data: { weekReminderSentAt: new Date() } });
      for (const p of s.pairs) {
        notifyUser(io, p.giverId, {
          type: 'santa_reminder', planId: s.plan.id, planTitle: s.plan.title, circleId: s.plan.circleId,
          preview: `🎅 Plus qu’une semaine pour le cadeau de ${p.receiver.firstName ?? '@' + p.receiver.pseudo}`,
        });
      }
    }
  } catch (e) {
    console.error('[santa reminders]', e);
  }
}
