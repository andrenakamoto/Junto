import { t, intlLocale } from '../i18n';

// « Découvrir » : événements publics et idées de sorties (serveur : lib/discover/, GET /api/discover)
// Régions = cantons des sources (publication d'un Plan, panneau admin) ; la page Découvrir cherche par lieu et rayon
export type DiscoverRegion = 'ge' | 'la' | 'vs' | 'fr' | 'ne';
export const REGIONS: DiscoverRegion[] = ['ge', 'la', 'vs', 'fr', 'ne'];

export interface DiscoverEvent {
  id: string; title: string; place: string | null; city: string | null; category: string; family: boolean;
  priceText: string | null; status: string; startAt: string; endAt: string | null; multiDay: boolean; dateLabel: string | null;
  url: string | null; sourceId: string;
  // Annonce publiée depuis un Plan : inscription par son lien d'invitation (/invitation?token=…)
  signupPath?: string;
  // Distance depuis le lieu choisi (km), absente si l'événement n'a pas de position
  distanceKm?: number | null;
}
export interface DiscoverPlace { id: string; name: string; kind: string; city: string | null; address?: string | null; website: string; family: boolean; sourceId: string; distanceKm?: number | null }
export interface DiscoverSourceInfo { id: string; name: string; type: string; attribution: string | null; license: string | null; licenseUrl: string | null }
export interface DiscoverData { region: DiscoverRegion; events: DiscoverEvent[]; places: DiscoverPlace[]; sources: DiscoverSourceInfo[] }

export const IDEAS = 'ideas';
// Catégories rangées en groupes (pas de défilement horizontal)
export const CATEGORY_GROUPS: [string, string[]][] = [
  ['sortir', ['soiree', 'concert', 'danse', 'bar']],
  ['spectacles', ['theatre', 'scene', 'festival']],
  ['culture', ['expo', 'atelier', 'animation']],
  ['activites', [IDEAS, 'jeux', 'sport', 'famille']],
];
// Idées de sorties : types de lieux rangés en groupes de tuiles (le premier qui contient le type l'emporte)
export const KIND_GROUPS: [string, string[]][] = [
  ['jeux', ['escape', 'laser', 'bowling', 'karting', 'defi', 'arcade', 'minigolf']],
  ['sport', ['piscine', 'escalade', 'patinoire', 'golf', 'equitation', 'bateau', 'sport']],
  ['detente', ['bains', 'cave']],
  ['famille', ['loisirs', 'parc', 'trampoline', 'animaux']],
  ['culture', ['musee', 'bibliotheque', 'chateau', 'jardin', 'galerie', 'poterie']],
];
export const KIND_ORDER = KIND_GROUPS.flatMap(([, kinds]) => kinds);
export const KIND_EMOJI: Record<string, string> = {
  escape: '🔐', laser: '🔫', bowling: '🎳', karting: '🏎️', defi: '🎯', arcade: '🕹️', minigolf: '⛳',
  piscine: '🏊', escalade: '🧗', patinoire: '⛸️', golf: '🏌️', equitation: '🐴', bateau: '🛶', sport: '🏅',
  bains: '♨️', cave: '🍷', loisirs: '🎢', parc: '🧸', trampoline: '🤸', animaux: '🦁',
  musee: '🏛️', bibliotheque: '📚', chateau: '🏰', jardin: '🌿', galerie: '🖼️', poterie: '🏺',
};

export const catLabel = (c: string) => t(`discover.cats.${c}` as any);
export const kindLabel = (k: string) => t(`discover.kinds.${k}` as any);
export const regionLabel = (r: string) => t(`discover.regions.${r}` as any);

// Recherche sans accents ni majuscules
export const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Nom du site où mène un lien (organisateur, agenda, billetterie…)
export function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

// Jour (heure suisse) d'une date, au format AAAA-MM-JJ
export const dayKey = (d: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));

// Pastilles « Quand » : aujourd'hui, demain, puis les 5 jours suivants, et « Plus tard »
export function dayChips(now = new Date()): { key: string; label: string }[] {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 864e5);
    const label = i === 0 ? t('discover.today') : i === 1 ? t('discover.tomorrow')
      : new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', timeZone: 'Europe/Zurich' }).format(d);
    out.push({ key: dayKey(d), label });
  }
  return out;
}

export const timeLabel = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(new Date(iso));
export const dayTitle = (key: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(key + 'T12:00:00Z'));
export const shortDate = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', timeZone: 'Europe/Zurich' }).format(new Date(iso));

const REGION_KEY = 'evly_discover_region';
export function savedRegion(): DiscoverRegion {
  try { const r = localStorage.getItem(REGION_KEY); if (r && (REGIONS as string[]).includes(r)) return r as DiscoverRegion; } catch { /* stockage indisponible */ }
  return 'ge';
}

// Lieu et rayon de Découvrir (2026-10-25). « Autour de moi » : la position est redemandée à chaque ouverture, jamais
// gardée sur l'appareil ; une ville choisie est mémorisée avec ses coordonnées (`evly_discover_place`).
export const RADII = [10, 25, 50] as const;
export type Radius = typeof RADII[number];
export interface Spot { name: string; lat: number; lon: number }
export interface SpotChoice { spot: Spot | null; here: boolean; radius: Radius }
// Raccourcis (Suisse romande)
export const BIG_CITIES: Spot[] = [
  { name: 'Genève', lat: 46.2044, lon: 6.1432 }, { name: 'Nyon', lat: 46.3833, lon: 6.2398 },
  { name: 'Lausanne', lat: 46.5197, lon: 6.6323 }, { name: 'Morges', lat: 46.5113, lon: 6.4985 },
  { name: 'Vevey', lat: 46.4628, lon: 6.8419 }, { name: 'Montreux', lat: 46.4312, lon: 6.9107 },
  { name: 'Yverdon-les-Bains', lat: 46.7785, lon: 6.6411 }, { name: 'Fribourg', lat: 46.8065, lon: 7.1620 },
  { name: 'Neuchâtel', lat: 46.9900, lon: 6.9293 }, { name: 'Sion', lat: 46.2331, lon: 7.3606 },
  { name: 'Martigny', lat: 46.1028, lon: 7.0726 }, { name: 'Monthey', lat: 46.2550, lon: 6.9540 },
];
const REGION_CITY: Record<DiscoverRegion, string> = { ge: 'Genève', la: 'Lausanne', vs: 'Sion', fr: 'Fribourg', ne: 'Neuchâtel' };
const PLACE_KEY = 'evly_discover_place';
const RECENT_KEY = 'evly_discover_recent';
const isSpot = (x: any): x is Spot => x && typeof x.name === 'string' && Number.isFinite(x.lat) && Number.isFinite(x.lon);

export function savedSpot(): SpotChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null');
    const radius = (RADII as readonly number[]).includes(raw?.radius) ? raw.radius as Radius : 25;
    if (raw?.here) return { spot: null, here: true, radius };
    if (isSpot(raw?.spot)) return { spot: raw.spot, here: false, radius };
  } catch { /* stockage indisponible */ }
  // Avant le 2026-10-25 : la région choisie devient sa ville principale
  const city = BIG_CITIES.find(c => c.name === REGION_CITY[savedRegion()])!;
  return { spot: city, here: false, radius: 25 };
}
export function saveSpot(c: SpotChoice) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(c.here ? { here: true, radius: c.radius } : { spot: c.spot, radius: c.radius }));
    if (!c.here && c.spot) {
      const list = [c.spot, ...recentSpots().filter(s => s.name !== c.spot!.name)].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    }
  } catch { /* stockage indisponible */ }
}
export function recentSpots(): Spot[] {
  try { const l = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(l) ? l.filter(isSpot) : []; } catch { return []; }
}
export const kmLabel = (d: number | null | undefined) => d == null ? null : d < 1 ? '< 1 km' : `${Math.round(d)} km`;
export function saveRegion(r: DiscoverRegion) {
  try { localStorage.setItem(REGION_KEY, r); } catch { /* stockage indisponible */ }
}
