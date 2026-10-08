// Ordre d'affichage des Plans et des Cercles : le plus proche d'abord.
// Miroir de server/src/lib/planOrder.ts — garder les deux identiques.

type DatedPlan = { eventDate?: string | null; endDate: string };

const time = (d: string) => new Date(d).getTime();

export function comparePlans(a: DatedPlan, b: DatedPlan): number {
  if (a.eventDate && b.eventDate) return time(a.eventDate) - time(b.eventDate) || time(a.endDate) - time(b.endDate);
  if (a.eventDate) return -1;
  if (b.eventDate) return 1;
  return time(a.endDate) - time(b.endDate);
}

export function sortPlans<P extends DatedPlan>(plans: P[]): P[] {
  return [...plans].sort(comparePlans);
}

// Selon le prochain Plan de chaque Cercle ; les Cercles sans Plan à venir restent à la fin
export function sortCircles<C extends { plans?: DatedPlan[] }>(circles: C[]): C[] {
  return [...circles].sort((a, b) => {
    const pa = a.plans?.[0], pb = b.plans?.[0];
    if (pa && pb) return comparePlans(pa, pb);
    if (pa) return -1;
    if (pb) return 1;
    return 0;
  });
}

// Ordre « dernière activité » (Cercles et Plans d'un Cercle) : le plus récemment modifié d'abord.
// « Tous mes plans » garde l'ordre par date. Miroir de server/src/lib/planOrder.ts.
// Sans date d'activité (Cercle ou Plan tout juste créé, avant le rechargement) : en tête.
type Active = { lastActivityAt?: string | null };
const activity = (x: Active) => (x.lastActivityAt ? time(x.lastActivityAt) : Date.now() + 1);

export function sortPlansByActivity<P extends DatedPlan & Active>(plans: P[]): P[] {
  return [...plans].sort((a, b) => activity(b) - activity(a) || comparePlans(a, b));
}

export function sortCirclesByActivity<C extends Active>(circles: C[]): C[] {
  return [...circles].sort((a, b) => activity(b) - activity(a));
}
