import { norm } from './geo';

// Un même événement publié par deux sources (le spectacle du Musée d'art et d'histoire sur l'agenda de Genève et sur Eventfrog…)
// n'apparaît qu'une fois dans Découvrir (2026-10-26). Même titre, même jour, même endroit (moins de 1 km, ou même ville sans
// position) : on garde **l'annonce qui a une photo**, sinon la source la plus sûre (choix de l'utilisateur) ; quand l'un des deux
// est « sur plusieurs jours » et couvre la date de l'autre, le moins bien placé disparaît aussi.
export const SOURCE_RANK: Record<string, number> = { plan: 0, manual: 1, openagenda: 2, ical: 3, geneversleep: 4, partner: 5, eventfrog: 6 };

export interface DedupeEvent {
  id: string; title: string; sourceId: string; startAt: Date; endAt: Date | null; multiDay: boolean;
  city: string | null; latitude: number | null; longitude: number | null; imageKey?: string | null;
}

const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
const near = (a: DedupeEvent, b: DedupeEvent) => {
  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const dLat = (a.latitude - b.latitude) * 111, dLon = (a.longitude - b.longitude) * 111 * Math.cos(a.latitude * Math.PI / 180);
    return Math.hypot(dLat, dLon) < 1;
  }
  return !!a.city && !!b.city && norm(a.city) === norm(b.city);
};

// Même titre, ou l'un contenu dans l'autre (« Intelligences en mouvement » / « Spectacle son et lumière : « Intelligences en
// mouvement » »), à partir de 12 caractères
const sameTitle = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 12 && (a.includes(b) || b.includes(a)));

// L'annonce gardée retient les titres des annonces retirées (`aliases`) : la recherche « son et lumière » la retrouve
export function dedupeEvents<T extends DedupeEvent>(events: T[], typeOfSource: (sourceId: string) => string): (T & { aliases?: string[] })[] {
  const rank = (e: T) => (e.imageKey ? 0 : 10) + (SOURCE_RANK[typeOfSource(e.sourceId)] ?? 9);
  // Regroupés par endroit (position arrondie à ~2 km, sinon la ville) : on ne compare que des événements voisins
  const bucketOf = (e: T) => e.latitude != null && e.longitude != null
    ? `${Math.round(e.latitude * 50)},${Math.round(e.longitude * 50)}` : `ville:${norm(e.city ?? '')}`;
  const buckets = new Map<string, T[]>();
  for (const e of events) { const k = bucketOf(e); buckets.set(k, [...(buckets.get(k) ?? []), e]); }
  const titleOf = new Map(events.map(e => [e.id, norm(e.title)]));
  const drop = new Set<string>();
  const aliases = new Map<string, Set<string>>();
  for (const group of buckets.values()) {
    if (group.length < 2 || new Set(group.map(e => e.sourceId)).size < 2) continue;
    const sorted = [...group].sort((a, b) => rank(a) - rank(b));
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      if (drop.has(a.id)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (drop.has(b.id) || a.sourceId === b.sourceId || !near(a, b) || !sameTitle(titleOf.get(a.id)!, titleOf.get(b.id)!)) continue;
        const sameDay = dayOf(a.startAt) === dayOf(b.startAt);
        // L'un des deux, sur plusieurs jours, couvre la date de l'autre
        const covers = (x: T, y: T) => x.multiDay && y.startAt >= x.startAt && y.startAt <= (x.endAt ?? x.startAt);
        const covered = covers(a, b) || covers(b, a);
        if (sameDay || covered) {
          drop.add(b.id);
          if (b.title !== a.title) aliases.set(a.id, (aliases.get(a.id) ?? new Set()).add(b.title));
        }
      }
    }
  }
  if (!drop.size) return events;
  return events.filter(e => !drop.has(e.id)).map(e => aliases.has(e.id) ? { ...e, aliases: [...aliases.get(e.id)!] } : e);
}
