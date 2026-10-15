// Fin d'un Plan (serveur : lib/planLifecycle.ts) : à sa date de fin il passe « Terminé », reste visible 24 h en lecture
// seule, puis il est supprimé. Seul le créateur (ou qui peut modifier les dates) peut encore repousser la fin.
export const PLAN_GRACE_MS = 24 * 3600 * 1000;
export const isPlanEnded = (p: { endDate: string }, now = Date.now()) => new Date(p.endDate).getTime() <= now;
export const planDeletionAt = (p: { endDate: string }) => new Date(new Date(p.endDate).getTime() + PLAN_GRACE_MS);

// Listes : les Plans terminés à la fin, dans l'ordre déjà choisi
export function endedLast<P extends { endDate: string }>(plans: P[]): P[] {
  const now = Date.now();
  return [...plans.filter(p => !isPlanEnded(p, now)), ...plans.filter(p => isPlanEnded(p, now))];
}
