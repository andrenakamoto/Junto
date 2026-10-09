import prisma from './prisma';
import { notifyUser } from './push';

// Match de groupe : chacun fait défiler les propositions (oui / non). Une proposition qui reçoit oui de
// tous les joueurs est un « match ». Joueurs = participants du Plan qui occupent une place (« Je suis in »
// ou « Peut-être ») et ont un compte. Personne ne voit les réponses des autres avant d'avoir fini ses
// propres cartes ; tout le monde voit les matchs (chacun y a déjà répondu oui).

export const MATCH_QUESTION_MAX = 150;
export const MATCH_LABEL_MAX = 80;
export const MATCH_NOTE_MAX = 200;
export const MATCH_URL_MAX = 500;
export const MATCH_OPTIONS_MAX = 15;

export type Swipe = { optionId: string; userId: string; like: boolean };

// Ordre des cartes propre à chaque personne (mélangé, mais stable d'un affichage à l'autre)
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function deckOrder<T extends { id: string }>(options: T[], userId: string): T[] {
  return [...options].sort((a, b) => hash(userId + a.id) - hash(userId + b.id));
}

// Cartes que la personne n'a pas encore jouées, dans son ordre
export function remainingFor<T extends { id: string }>(options: T[], swipes: Swipe[], userId: string): T[] {
  const done = new Set(swipes.filter(s => s.userId === userId).map(s => s.optionId));
  return deckOrder(options.filter(o => !done.has(o.id)), userId);
}

// Oui de tous les joueurs (au moins deux joueurs pour parler de match)
export function isUnanimous(optionId: string, playerIds: string[], swipes: Swipe[]): boolean {
  if (playerIds.length < 2) return false;
  const yes = new Set(swipes.filter(s => s.optionId === optionId && s.like).map(s => s.userId));
  return playerIds.every(id => yes.has(id));
}

// Nombre de joueurs qui ont fini toutes leurs cartes
export function finishedCount(optionIds: string[], playerIds: string[], swipes: Swipe[]): number {
  return playerIds.filter(id => optionIds.every(o => swipes.some(s => s.userId === id && s.optionId === o))).length;
}

// Classement : plus de « oui », puis moins de « non »
export function rankOptions<T extends { id: string }>(options: T[], swipes: Swipe[]): (T & { yes: number; no: number })[] {
  return options
    .map(o => ({ ...o, yes: swipes.filter(s => s.optionId === o.id && s.like).length, no: swipes.filter(s => s.optionId === o.id && !s.like).length }))
    .sort((a, b) => b.yes - a.yes || a.no - b.no);
}

export function parseMatchText(v: unknown, max: number, required = true): string | null | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return required ? undefined : null;
  return s.length > max ? undefined : s;
}

export function parseMatchUrl(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > MATCH_URL_MAX || !/^https?:\/\/\S+$/i.test(s)) return undefined;
  return s;
}

// Joueurs d'un Plan : place occupée (« in » / « peut-être ») et compte (pas les réponses sans compte)
export async function matchPlayers(planId: string) {
  return prisma.planMember.findMany({
    where: { planId, rsvp: { not: 'out' }, user: { isLight: false } },
    select: { userId: true, user: { select: { id: true, pseudo: true, firstName: true } } },
  });
}

// Rappel la veille de l'échéance à ceux qui n'ont pas fini (toutes les heures avec les autres tâches)
export async function sendMatchReminders(io: any) {
  try {
    const now = Date.now();
    const due = await prisma.matchPoll.findMany({
      where: { closedAt: null, reminderSentAt: null, deadline: { gt: new Date(now), lte: new Date(now + 24 * 3600 * 1000) } },
      include: { plan: { select: { id: true, title: true, circleId: true } }, options: { select: { id: true } } },
    });
    for (const m of due) {
      const claimed = await prisma.matchPoll.updateMany({ where: { id: m.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
      if (!claimed.count) continue;
      const players = await matchPlayers(m.planId);
      const swipes = await prisma.matchSwipe.findMany({ where: { matchId: m.id }, select: { optionId: true, userId: true, like: true } });
      const optionIds = m.options.map(o => o.id);
      for (const p of players) {
        if (optionIds.every(o => swipes.some(s => s.userId === p.userId && s.optionId === o))) continue;
        notifyUser(io, p.userId, { type: 'match', planId: m.plan.id, planTitle: m.plan.title, circleId: m.plan.circleId, preview: `💘 Il ne manque plus que toi pour le match « ${m.question} »` });
      }
    }
  } catch (e) {
    console.error('[match reminders]', e);
  }
}
