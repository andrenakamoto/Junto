import { t } from '../i18n';
import { AvailabilityEntry, AvailabilitySlot } from '../types';

// « Je suis dispo » (miroir de server/src/lib/availability.ts) : étiquettes d'activité, titre et heure proposés
// pour « Lancer un Plan »
export const AVAILABILITY_TAGS = [
  { key: 'apero', emoji: '🍻' },
  { key: 'manger', emoji: '🍕' },
  { key: 'cine', emoji: '🎬' },
  { key: 'sport', emoji: '⚽' },
  { key: 'jeux', emoji: '🎲' },
  { key: 'balade', emoji: '🚶' },
] as const;
export const AVAILABILITY_TAGS_MAX = 3;
export const AVAILABILITY_NOTE_MAX = 60;

export const tagEmoji = (key: string) => AVAILABILITY_TAGS.find(x => x.key === key)?.emoji ?? '';
export const tagLabel = (key: string) => t(`circle.dispo.tags.${key}` as any);
// Seuil appliqué : le plus petit « Plan proposé dès » des personnes dispo (chacune prend sinon celui du Cercle)
export function readyThreshold(entries: AvailabilityEntry[], circleThreshold: number): number {
  return entries.length ? Math.min(...entries.map(e => e.minPeople ?? circleThreshold)) : circleThreshold;
}
export const slotLabel = (slot: AvailabilitySlot) => t(slot === 'now' ? 'circle.dispo.slotNow' : 'circle.dispo.slotTonight');

const pad = (n: number) => n.toString().padStart(2, '0');
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Dans 30 minutes, arrondi au quart d'heure suivant
function soon(now: Date): Date {
  const d = new Date(now.getTime() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return d;
}

// Plan proposé d'après les dispos : créneau le plus demandé (« maintenant » l'emporte à égalité), activité la plus
// choisie, début dans 30 min (« maintenant ») ou à 19 h ce soir (dans 30 min s'il est déjà plus tard)
export function suggestedPlan(entries: AvailabilityEntry[], now: Date = new Date()): { title: string; start: string } {
  const nowCount = entries.filter(e => e.slot === 'now').length;
  const slot: AvailabilitySlot = nowCount * 2 >= entries.length && nowCount > 0 ? 'now' : 'tonight';
  const counts = new Map<string, number>();
  for (const e of entries) for (const tag of e.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const what = top ? t(`circle.dispo.planWhat.${top}` as any) : t('circle.dispo.defaultWhat');
  const emoji = top ? ` ${tagEmoji(top)}` : '';
  const title = t(slot === 'now' ? 'circle.dispo.planNow' : 'circle.dispo.planTonight', { what }) + emoji;

  let start = soon(now);
  if (slot === 'tonight') {
    const seven = new Date(now); seven.setHours(19, 0, 0, 0);
    if (now.getTime() < seven.getTime() - 30 * 60 * 1000) start = seven;
  }
  return { title, start: toLocal(start) };
}
