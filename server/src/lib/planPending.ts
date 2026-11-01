import prisma from './prisma';
import { planCircleIds } from './planAccess';

// Rubrique Membres d'un Plan : les membres de ses Cercles qui n'ont pas encore répondu (« Pas encore répondu ») et la
// relance de l'organisation. Jamais les personnes à qui le Plan est caché (« Cacher à… », « Réservé à… », retirées),
// ni celles déjà sur la liste d'attente, ni les réponses sans compte.

export const NUDGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function pendingMembers(plan: { id: string; circleId: string }) {
  const circleIds = await planCircleIds(plan);
  const users = await prisma.user.findMany({
    where: {
      isLight: false,
      memberships: { some: { circleId: { in: circleIds } } },
      planMemberships: { none: { planId: plan.id } },
      planExclusions: { none: { planId: plan.id } },
      waitlists: { none: { planId: plan.id } },
    },
    select: { id: true, pseudo: true, firstName: true },
  });
  return users.sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr'));
}

// Prochaine relance possible (null = tout de suite)
export function nextNudgeAt(lastNudgeAt: Date | null, now = new Date()): Date | null {
  if (!lastNudgeAt) return null;
  const next = new Date(lastNudgeAt.getTime() + NUDGE_INTERVAL_MS);
  return next > now ? next : null;
}
