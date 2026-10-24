import { t, intlLocale } from '../i18n';

// « Découvrir » : événements publics et idées de sorties (serveur : lib/discover/, GET /api/discover)
export type DiscoverRegion = 'ge' | 'la' | 'vs';
export const REGIONS: DiscoverRegion[] = ['ge', 'la', 'vs'];

export interface DiscoverEvent {
  id: string; title: string; place: string | null; city: string | null; category: string; family: boolean;
  priceText: string | null; status: string; startAt: string; endAt: string | null; multiDay: boolean; dateLabel: string | null;
  url: string | null; sourceId: string;
  // Annonce publiée depuis un Plan : inscription par son lien d'invitation (/invitation?token=…)
  signupPath?: string;
}
export interface DiscoverPlace { id: string; name: string; kind: string; city: string | null; address?: string | null; website: string; family: boolean; sourceId: string }
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
  try { const r = localStorage.getItem(REGION_KEY); if (r === 'ge' || r === 'la' || r === 'vs') return r; } catch { /* stockage indisponible */ }
  return 'ge';
}
export function saveRegion(r: DiscoverRegion) {
  try { localStorage.setItem(REGION_KEY, r); } catch { /* stockage indisponible */ }
}
