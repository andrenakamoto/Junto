// Ordre d'affichage commun des Plans et des Cercles : le plus proche d'abord.
// Un Plan daté est classé par sa date de début (un Plan déjà commencé mais pas
// terminé reste donc en tête) ; les Plans sans date viennent après, par date de fin.
// Même règle côté client : client/src/lib/order.ts.

type DatedPlan = { eventDate: Date | string | null; endDate: Date | string };

const time = (d: Date | string) => new Date(d).getTime();

export function comparePlans(a: DatedPlan, b: DatedPlan): number {
  if (a.eventDate && b.eventDate) return time(a.eventDate) - time(b.eventDate) || time(a.endDate) - time(b.endDate);
  if (a.eventDate) return -1;
  if (b.eventDate) return 1;
  return time(a.endDate) - time(b.endDate);
}

// Cercles triés selon leur prochain Plan (plans[0]) ; sans Plan à venir : à la fin,
// dans l'ordre reçu (tri stable)
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
// « Tous mes plans » garde l'ordre par date (comparePlans). Miroir client : client/src/lib/order.ts.
type Active = { lastActivityAt?: Date | string | null };
const activity = (x: Active) => (x.lastActivityAt ? time(x.lastActivityAt) : 0);

// Activité d'un Plan : sa création, ou la dernière activité d'une de ses rubriques (PlanActivity)
export function planLastActivity(plan: { createdAt: Date | string; activities?: { at: Date | string }[] }): Date {
  return new Date(Math.max(time(plan.createdAt), ...(plan.activities ?? []).map(a => time(a.at))));
}

// Plus récente activité d'abord ; à égalité, le plus proche dans le temps
export function compareByActivity<T extends Active & DatedPlan>(a: T, b: T): number {
  return activity(b) - activity(a) || comparePlans(a, b);
}

// Cercles : plus récente activité d'abord ; à égalité, l'ordre reçu (tri stable)
export function sortCirclesByActivity<C extends Active>(circles: C[]): C[] {
  return [...circles].sort((a, b) => activity(b) - activity(a));
}
