import prisma from './prisma';

// Mode silencieux : une personne coupe les notifications d'un Plan ou de tout un Cercle.
// Coupé : notification dans l'app (bulle), push et email. Les points orange « nouveau » restent
// (lib/planActivity.ts ne dépend pas de ce réglage). Sans durée : actif jusqu'à ce qu'on le retire.

// Toujours envoyées : une mention s'adresse à la personne ; une invitation ou une admission
// concernent un Cercle dont elle n'est pas (encore) membre ; le reste n'est lié à aucun Plan.
// Le rappel de la veille est traité à part (gardé pour ceux qui ont répondu « Je suis in »).
// Le rappel de poste de bénévole passe même en silence : la personne s'est engagée (comme le rappel de la
// veille pour les « Je suis in »). L'ouverture d'un vote d'assemblée aussi : on vote dans la salle, maintenant.
export const MUTE_EXEMPT_TYPES = new Set(['mention', 'circle_invite', 'join_accepted', 'suggestion_update', 'shift_reminder', 'waitlist', 'assembly_vote']);

export type MuteScope = { planId?: string | null; circleId?: string | null };

async function resolveCircle(scope: MuteScope): Promise<string | null> {
  if (scope.circleId) return scope.circleId;
  if (!scope.planId) return null;
  const plan = await prisma.plan.findUnique({ where: { id: scope.planId }, select: { circleId: true } });
  return plan?.circleId ?? null;
}

// Parmi `userIds`, ceux qui ont mis ce Plan (ou son Cercle) en silence
export async function mutedAmong(scope: MuteScope, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0 || (!scope.planId && !scope.circleId)) return new Set();
  const circleId = await resolveCircle(scope);
  const or: { planId?: string; circleId?: string }[] = [];
  if (scope.planId) or.push({ planId: scope.planId });
  if (circleId) or.push({ circleId });
  const rows = await prisma.notificationMute.findMany({ where: { userId: { in: userIds }, OR: or }, select: { userId: true } });
  return new Set(rows.map(r => r.userId));
}

export async function isMuted(userId: string, scope: MuteScope): Promise<boolean> {
  return (await mutedAmong(scope, [userId])).has(userId);
}

// Filtre les destinataires d'un email de notification (garde ceux qui ne sont pas en silence)
export async function withoutMuted<T>(scope: MuteScope, items: T[], idOf: (t: T) => string): Promise<T[]> {
  const muted = await mutedAmong(scope, items.map(idOf));
  return items.filter(t => !muted.has(idOf(t)));
}
