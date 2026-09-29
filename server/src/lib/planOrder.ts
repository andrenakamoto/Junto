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
