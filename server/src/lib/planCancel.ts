import prisma from './prisma';
import { notifyUser } from './push';

// Un Plan à venir est supprimé à la main (créateur, vote, « Annuler cette fois ») ou avec son Cercle : les
// participants « Je suis in » et « Peut-être » sont prévenus (dans l'app et en push, jamais par email ; le mode
// silencieux ne coupe pas ce message). Rien pour la suppression automatique après la date de fin.
// À préparer AVANT la suppression (on lit les participants), puis à envoyer une fois le Plan supprimé.
export type CancelKind = 'deleted' | 'voted' | 'skipped' | 'circle';

export function cancelPreview(kind: CancelKind, actorPseudo?: string | null): string {
  if (kind === 'skipped') return '🚫 Annulé cette fois-ci : le Plan suivant est déjà prévu';
  if (kind === 'circle') return '🚫 Plan annulé : le Cercle a été supprimé';
  if (kind === 'deleted' && actorPseudo) return `🚫 Plan annulé par @${actorPseudo}`;
  return '🚫 Plan supprimé par le vote des participants';
}

export async function prepareCancelNotice(planIds: string[], kind: CancelKind, actorId?: string | null): Promise<(io: any) => void> {
  if (planIds.length === 0) return () => {};
  const now = new Date();
  const [plans, actor] = await Promise.all([
    prisma.plan.findMany({
      where: { id: { in: planIds }, endDate: { gt: now } },
      select: {
        id: true, title: true, circleId: true,
        members: { where: { rsvp: { in: ['in', 'maybe'] }, user: { isLight: false } }, select: { userId: true } },
      },
    }),
    actorId ? prisma.user.findUnique({ where: { id: actorId }, select: { pseudo: true } }) : null,
  ]);
  const preview = cancelPreview(kind, actor?.pseudo);
  return (io: any) => {
    for (const p of plans) {
      for (const m of p.members) {
        if (m.userId === actorId) continue;
        // Pas de planId : le Plan n'existe plus, la notification ouvre son Cercle
        notifyUser(io, m.userId, { type: 'plan_cancelled', planTitle: p.title, circleId: p.circleId, from: actor?.pseudo, actorId: actorId ?? undefined, preview });
      }
    }
  };
}
