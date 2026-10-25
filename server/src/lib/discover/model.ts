// « Découvrir » : événements publics et idées de sorties de Suisse romande (2026-10-23). Les données viennent de
// sources (DiscoverSource) : agendas ouverts (OpenAgenda), OpenStreetMap, flux iCal autorisés, saisie manuelle dans
// le panneau admin. Les sources « pending » (partenaires en attente d'accord) ne sont jamais synchronisées.

// Régions des sources (synchronisation, anciennes apps) ; Découvrir cherche par lieu et rayon depuis le 2026-10-25
export const REGIONS = ['ge', 'la', 'vs', 'fr', 'ne'] as const;
export type Region = typeof REGIONS[number];
export const isRegion = (v: unknown): v is Region => typeof v === 'string' && (REGIONS as readonly string[]).includes(v);

// Catégories d'événements (libellés côté client, dans les 4 langues)
export const CATEGORIES = ['soiree', 'concert', 'danse', 'bar', 'theatre', 'scene', 'festival', 'expo', 'atelier', 'animation', 'jeux', 'sport', 'famille'] as const;
export type Category = typeof CATEGORIES[number];
export const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);

// Types de lieux (idées de sorties)
export const PLACE_KINDS = [
  'escape', 'laser', 'bowling', 'trampoline', 'escalade', 'karting', 'minigolf', 'patinoire', 'piscine', 'arcade', 'parc', 'sport', 'animaux', 'musee',
  // depuis le 2026-10-24
  'defi', 'loisirs', 'bains', 'cave', 'bateau', 'equitation', 'golf', 'chateau', 'jardin', 'galerie', 'poterie', 'bibliotheque',
] as const;
export type PlaceKind = typeof PLACE_KINDS[number];
export const isPlaceKind = (v: unknown): v is PlaceKind => typeof v === 'string' && (PLACE_KINDS as readonly string[]).includes(v);
// Lieux adaptés aux familles par défaut
export const FAMILY_KINDS: PlaceKind[] = ['bowling', 'trampoline', 'escalade', 'minigolf', 'patinoire', 'piscine', 'arcade', 'parc', 'animaux', 'musee', 'laser',
  'loisirs', 'bateau', 'equitation', 'chateau', 'jardin', 'bibliotheque'];

export const EVENT_STATUSES = ['scheduled', 'full', 'cancelled', 'postponed'] as const;
export const STATES = ['published', 'pending', 'hidden'] as const;
export type State = typeof STATES[number];
export const isState = (v: unknown): v is State => typeof v === 'string' && (STATES as readonly string[]).includes(v);

// Événement normalisé, tel que renvoyé par un connecteur
export interface NormalizedEvent {
  externalId: string;
  title: string;
  place: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  category: Category;
  family: boolean;
  priceText: string | null;
  status: typeof EVENT_STATUSES[number];
  startAt: Date;
  endAt: Date | null;
  multiDay: boolean;
  dateLabel: string | null;
  url: string | null;
}

export interface NormalizedPlace {
  externalId: string;
  name: string;
  kind: PlaceKind;
  city: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website: string;
  family: boolean;
}

export const TITLE_MAX = 160;
export const TEXT_MAX = 120;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
export const cleanText = (v: unknown, max = TEXT_MAX): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? clip(s, max) : null;
};

// Lien http(s) seulement (jamais javascript:, mailto:…)
export function cleanUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// Saisie manuelle (panneau admin) : contrôle des champs, null si invalide
export function parseManualEvent(b: any): { error: string } | { data: Omit<NormalizedEvent, 'externalId'> & { region: Region } } {
  const title = cleanText(b?.title, TITLE_MAX);
  if (!title) return { error: 'Titre requis' };
  if (!isRegion(b?.region)) return { error: 'Région invalide' };
  if (!isCategory(b?.category)) return { error: 'Catégorie invalide' };
  const startAt = new Date(b?.startAt);
  if (isNaN(startAt.getTime())) return { error: 'Date de début invalide' };
  const endAt = b?.endAt ? new Date(b.endAt) : null;
  if (endAt && (isNaN(endAt.getTime()) || endAt < startAt)) return { error: 'Date de fin invalide' };
  const url = b?.url ? cleanUrl(b.url) : null;
  if (b?.url && !url) return { error: 'Lien invalide (il doit commencer par https://)' };
  const status = (EVENT_STATUSES as readonly string[]).includes(b?.status) ? b.status : 'scheduled';
  const multiDay = !!endAt && endAt.getTime() - startAt.getTime() > 26 * 3600e3;
  return {
    data: {
      region: b.region, title, place: cleanText(b?.place), city: cleanText(b?.city, 60), latitude: null, longitude: null,
      category: b.category, family: b?.family === true || b.category === 'famille', priceText: cleanText(b?.priceText, 80),
      status, startAt, endAt, multiDay, dateLabel: multiDay ? cleanText(b?.dateLabel, 60) : null, url,
    },
  };
}

export function parseManualPlace(b: any): { error: string } | { data: Omit<NormalizedPlace, 'externalId'> & { region: Region } } {
  const name = cleanText(b?.name, 100);
  if (!name) return { error: 'Nom requis' };
  if (!isRegion(b?.region)) return { error: 'Région invalide' };
  if (!isPlaceKind(b?.kind)) return { error: 'Type de lieu invalide' };
  const website = cleanUrl(b?.website);
  if (!website) return { error: 'Lien invalide (il doit commencer par https://)' };
  return { data: { region: b.region, name, kind: b.kind, city: cleanText(b?.city, 60), address: cleanText(b?.address, 120), website, family: b?.family === true || FAMILY_KINDS.includes(b.kind) } };
}

// « Poster un événement public » : demande pour être prévenu
export function parseProInterest(b: any): { error: string } | { data: { name: string; company: string | null; email: string; city: string | null; message: string | null } } {
  const name = cleanText(b?.name, 80);
  if (!name) return { error: 'Nom requis' };
  const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return { error: 'Adresse email invalide' };
  return { data: { name, company: cleanText(b?.company, 100), email, city: cleanText(b?.city, 60), message: cleanText(b?.message, 500) } };
}
