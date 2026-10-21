// « Dispo » : une personne se déclare libre (maintenant ou ce soir) dans un ou plusieurs de ses Cercles, avec des
// étiquettes d'activité. Les autres membres sont prévenus (User.availabilityPush) ; dès Circle.availabilityThreshold
// personnes dispo, l'app propose de lancer un Plan. Rien n'est gardé après l'expiration (job horaire).

export const AVAILABILITY_SLOTS = ['now', 'tonight'] as const;
export type AvailabilitySlot = typeof AVAILABILITY_SLOTS[number];
export const AVAILABILITY_TAGS = ['apero', 'manger', 'cine', 'sport', 'jeux', 'balade'] as const;
export const AVAILABILITY_NOTE_MAX = 60;
export const AVAILABILITY_TAGS_MAX = 3;
export const THRESHOLD_MIN = 2;
export const THRESHOLD_MAX = 10;
export const THRESHOLD_DEFAULT = 3;

const NOW_MS = 3 * 60 * 60 * 1000; // « Maintenant » : 3 heures
const TONIGHT_END_HOUR = 4;        // « Ce soir » : jusqu'à 4 h du matin, heure suisse
const TZ = 'Europe/Zurich';

// Décalage de l'heure suisse (en ms) à un instant donné
function zurichOffset(at: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map(x => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

// Instant correspondant à une heure « murale » suisse (année, mois 1-12, jour, heure)
function zurichWall(y: number, m: number, d: number, h: number): Date {
  const guess = Date.UTC(y, m - 1, d, h);
  let t = guess - zurichOffset(new Date(guess));
  t = guess - zurichOffset(new Date(t)); // second passage : changements d'heure
  return new Date(t);
}

function zurichDate(at: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(at).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour };
}

// Fin d'une dispo : « maintenant » = 3 h ; « ce soir » = le prochain 4 h du matin (le jour même si l'on se déclare
// entre minuit et 4 h, sinon le lendemain)
export function availabilityExpiry(slot: AvailabilitySlot, now: Date = new Date()): Date {
  if (slot === 'now') return new Date(now.getTime() + NOW_MS);
  const z = zurichDate(now);
  if (z.h < TONIGHT_END_HOUR) return zurichWall(z.y, z.m, z.d, TONIGHT_END_HOUR);
  const next = new Date(Date.UTC(z.y, z.m - 1, z.d + 1));
  return zurichWall(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), TONIGHT_END_HOUR);
}

// Lecture d'une déclaration : créneau connu, étiquettes connues (3 au plus, sans doublon), petit mot facultatif
export function parseAvailability(body: unknown): { slot: AvailabilitySlot; tags: string[]; note: string | null } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!(AVAILABILITY_SLOTS as readonly unknown[]).includes(b.slot)) return null;
  const rawTags = Array.isArray(b.tags) ? b.tags : [];
  const tags = [...new Set(rawTags.filter((x): x is string => typeof x === 'string' && (AVAILABILITY_TAGS as readonly string[]).includes(x)))]
    .slice(0, AVAILABILITY_TAGS_MAX);
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return null;
  const note = typeof b.note === 'string' ? b.note.trim() : '';
  if (note.length > AVAILABILITY_NOTE_MAX) return null;
  return { slot: b.slot as AvailabilitySlot, tags, note: note || null };
}

export function parseThreshold(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= THRESHOLD_MIN && v <= THRESHOLD_MAX ? v : undefined;
}

// Faut-il prévenir les autres membres ? Oui pour une nouvelle dispo ou un changement de créneau, pas pour une
// simple retouche (étiquettes, petit mot) d'une dispo encore valable
export function shouldNotify(previous: { slot: string; expiresAt: Date } | null, slot: string, now: Date = new Date()): boolean {
  return !previous || previous.expiresAt <= now || previous.slot !== slot;
}
