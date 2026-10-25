import type { Category, NormalizedEvent } from './model';
import { cleanText, cleanUrl, TITLE_MAX } from './model';

// Connecteur GeNEVERsleep (partenaire, accord du 2026-10-25) : flux JSON réservé à EvLY, spécification v1
// (`version`, `events[]` avec `id` stable, `name`, `venue`, `city`, `city_group` « Genève » | « Lausanne », `start` ISO avec
// décalage, `end`, `url`, `categories`, `cancelled`). Un flux couvre deux villes : une source par région, filtrée par
// `cityGroup` ; depuis le 2026-10-25, une seule source sans `cityGroup` reprend tout le flux (toutes les villes), chaque
// événement rangé dans la région de sa ville (`regionFromPlace` de sync.ts). Seules les informations de base sont partagées ; le crédit « Source : GeNEVERsleep » avec un lien vers la page
// de l'événement est obligatoire (`url`, et la mention affichée sur chaque carte de Découvrir).

export interface GeneverSleepConfig { url: string; cityGroup?: string }

// Styles musicaux qui font d'une soirée un concert ; tout le reste (electronic, house, techno, latin…) = soirée
const CONCERT_STYLES = ['live music', 'concert', 'punk', 'jazz', 'classical', 'pop/chanson', 'rock', 'metal', 'folk', 'blues', 'chanson'];

export function categoryOf(categories: unknown): Category {
  const list = Array.isArray(categories) ? categories.map(c => String(c).toLowerCase()) : [];
  return list.some(c => CONCERT_STYLES.includes(c)) ? 'concert' : 'soiree';
}

// Un événement du flux → un événement EvLY. Sans heure de début, il est laissé de côté (une heure inventée serait fausse).
export function normalizeGeneverSleepEvent(e: any, cityGroup: string | undefined, from: Date, to: Date): NormalizedEvent | null {
  if (!e || (cityGroup && e.city_group !== cityGroup)) return null;
  const externalId = typeof e.id === 'string' ? e.id.slice(0, 120) : null;
  const title = cleanText(e.name, TITLE_MAX);
  const startAt = typeof e.start === 'string' ? new Date(e.start) : null;
  if (!externalId || !title || !startAt || isNaN(startAt.getTime())) return null;
  if (startAt > to || startAt.getTime() < from.getTime() - 6 * 3600e3) return null;
  const endAt = typeof e.end === 'string' && !isNaN(new Date(e.end).getTime()) ? new Date(e.end) : null;
  return {
    externalId, title,
    place: cleanText(e.venue),
    city: cleanText(e.city, 60),
    latitude: null, longitude: null,
    category: categoryOf(e.categories),
    family: false,
    priceText: null,
    status: e.cancelled === true ? 'cancelled' : 'scheduled',
    startAt, endAt, multiDay: false, dateLabel: null,
    url: cleanUrl(e.url) ?? 'https://geneversleep.ch/',
  };
}

export async function fetchGeneverSleep(cfg: GeneverSleepConfig, from: Date, to: Date): Promise<NormalizedEvent[]> {
  const res = await fetch(cfg.url, { headers: { Accept: 'application/json', 'User-Agent': 'EvLY/1.0 (info@evly.ch)' } });
  if (!res.ok) throw new Error(`GeNEVERsleep ${res.status}`);
  const data: any = await res.json();
  if (data?.version !== 1 || !Array.isArray(data.events)) throw new Error('GeNEVERsleep : format inattendu');
  return data.events.map((e: any) => normalizeGeneverSleepEvent(e, cfg.cityGroup, from, to)).filter((e: NormalizedEvent | null): e is NormalizedEvent => !!e);
}
