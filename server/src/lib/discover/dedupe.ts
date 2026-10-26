import { norm } from './geo';

// Un même événement publié par deux sources (le spectacle du Musée d'art et d'histoire sur l'agenda de Genève et sur Eventfrog…)
// n'apparaît qu'une fois dans Découvrir (2026-10-26). Même titre, même jour, même endroit (moins de 1 km, ou même ville sans
// position) : on garde la source la plus sûre ; une date couverte par le même événement « sur plusieurs jours » d'une autre
// source disparaît aussi.
export const SOURCE_RANK: Record<string, number> = { plan: 0, manual: 1, openagenda: 2, ical: 3, geneversleep: 4, partner: 5, eventfrog: 6 };

export interface DedupeEvent {
  id: string; title: string; sourceId: string; startAt: Date; endAt: Date | null; multiDay: boolean;
  city: string | null; latitude: number | null; longitude: number | null;
}

const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
const near = (a: DedupeEvent, b: DedupeEvent) => {
  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const dLat = (a.latitude - b.latitude) * 111, dLon = (a.longitude - b.longitude) * 111 * Math.cos(a.latitude * Math.PI / 180);
    return Math.hypot(dLat, dLon) < 1;
  }
  return !!a.city && !!b.city && norm(a.city) === norm(b.city);
};

export function dedupeEvents<T extends DedupeEvent>(events: T[], typeOfSource: (sourceId: string) => string): T[] {
  const rank = (e: T) => SOURCE_RANK[typeOfSource(e.sourceId)] ?? 9;
  const byTitle = new Map<string, T[]>();
  for (const e of events) { const k = norm(e.title); byTitle.set(k, [...(byTitle.get(k) ?? []), e]); }
  const drop = new Set<string>();
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => rank(a) - rank(b));
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      if (drop.has(a.id)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (drop.has(b.id) || a.sourceId === b.sourceId || !near(a, b)) continue;
        const sameDay = dayOf(a.startAt) === dayOf(b.startAt);
        // b (moins sûr) tombe pendant l'événement a sur plusieurs jours
        const covered = a.multiDay && b.startAt >= a.startAt && b.startAt <= (a.endAt ?? a.startAt);
        if (sameDay || covered) drop.add(b.id);
      }
    }
  }
  return drop.size ? events.filter(e => !drop.has(e.id)) : events;
}
