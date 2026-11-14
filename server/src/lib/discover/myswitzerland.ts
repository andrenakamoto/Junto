import type { NormalizedPlace, PlaceKind } from './model';
import { cleanText, cleanUrl, FAMILY_KINDS } from './model';

// Suisse Tourisme (OpenData API de MySwitzerland.com, 2026-11-14) : attractions choisies par Suisse Tourisme et itinéraires de
// SuisseMobile (randonnées, vélo, raquettes…), dans toute la Suisse. Clé gratuite MYSWITZERLAND_API_KEY (/etc/evly/app.env,
// compte info@evly.ch sur developer.myswitzerland.io). Licence CC BY-SA 4.0 : source citée (« Suisse Tourisme –
// MySwitzerland.com ») et lien vers la page d'origine sur chaque lieu (le lien du lieu est sa page MySwitzerland). Pas d'images
// (droits propres à chaque photo). Seulement des idées de sorties : l'API n'a pas d'agenda d'événements.

const API = 'https://opendata.myswitzerland.io/v1';
const PER_PAGE = 50; // maximum de l'API
const MAX_PAGES = 120;

type Classes = Map<string, Set<string>>;
// classification: [{ name: 'sporttype', values: [{ name: 'toboggan' }] }] → Map('sporttype' → {'toboggan'})
export function classesOf(item: any): Classes {
  const out: Classes = new Map();
  for (const c of Array.isArray(item?.classification) ? item.classification : []) {
    if (typeof c?.name !== 'string') continue;
    const set = out.get(c.name) ?? new Set<string>();
    for (const v of Array.isArray(c.values) ? c.values : []) if (typeof v?.name === 'string') set.add(v.name);
    out.set(c.name, set);
  }
  return out;
}
const has = (c: Classes, name: string, ...values: string[]) => { const s = c.get(name); return !!s && (values.length === 0 ? s.size > 0 : values.some(v => s.has(v))); };

// Type d'idée d'une attraction, du plus précis au plus général (null = laissée de côté)
export function attractionKind(item: any): PlaceKind | null {
  const c = classesOf(item);
  if (has(c, 'sporttype', 'skiingorsnowboarding') || has(c, 'naturetype', 'snowpark')) return 'ski';
  if (has(c, 'sporttype', 'toboggan')) return 'luge';
  if (has(c, 'sporttype', 'skate')) return 'patinoire';
  if (has(c, 'wellnesstype', 'beach', 'riverbath')) return 'plage';
  if (has(c, 'wellnesstype', 'indoorswimmingpool')) return 'piscine';
  if (has(c, 'wellnesstype')) return 'bains';
  if (has(c, 'sporttype', 'bathingandswimming')) return 'plage';
  if (has(c, 'parktype', 'animalpark', 'zoo')) return 'animaux';
  if (has(c, 'naturetype', 'ropepark')) return 'accrobranche';
  if (has(c, 'naturetype', 'viaferrata')) return 'escalade';
  if (has(c, 'funandadventureforkids', 'playground')) return 'jeux_enfants';
  if (has(c, 'museumtype')) return 'musee';
  if (has(c, 'cultureandcongresscentretype', 'theater', 'concerthall', 'opera')) return 'theatre';
  if (has(c, 'achitekturtyp', 'castles', 'palace', 'fortress')) return 'chateau';
  if (has(c, 'transporttype', 'ship') || has(c, 'toursandsightseeingtype', 'cruises')) return 'bateau';
  if (has(c, 'transporttype', 'cablerailway', 'train') || has(c, 'toursandsightseeingtype', 'cablecarrides', 'trainrides', 'passroad')) return 'excursion';
  if (has(c, 'platformtype')) return 'vue';
  if (has(c, 'naturetype', 'garden')) return 'jardin';
  if (has(c, 'naturetype', 'canyons', 'waterfall', 'caves', 'glaciergarden', 'mines', 'icepavilion') || has(c, 'parktype', 'wildernesspark')) return 'nature';
  if (has(c, 'naturetype', 'parks', 'lakesidepromenades')) return 'parc_ville';
  if (has(c, 'naturetrailtype')) return 'randonnee';
  if (has(c, 'achitekturtyp') || has(c, 'buildingstype') || has(c, 'areatype', 'oldtown') || has(c, 'unesco')) return 'patrimoine';
  if (has(c, 'experiencetype', 'nature')) return 'nature';
  if (has(c, 'experiencetype', 'culture', 'urban', 'education')) return 'patrimoine';
  if (has(c, 'experiencetype', 'active', 'adventure')) return 'loisirs';
  return null;
}

// Type d'idée d'un itinéraire (SuisseMobile)
export function tourKind(item: any): PlaceKind | null {
  const c = classesOf(item);
  if (has(c, 'routestypes', 'sledging')) return 'luge';
  if (has(c, 'routestypes', 'crosscountryskiing')) return 'ski_fond';
  if (has(c, 'routestypes', 'snowshoe', 'winterhiking')) return 'raquettes';
  if (has(c, 'routestypes', 'bicycle', 'mountainbike')) return 'velo';
  if (has(c, 'routestypes', 'canoe')) return 'bateau';
  if (has(c, 'routestypes', 'hike')) return 'randonnee';
  return null;
}

const geoOf = (item: any) => {
  const lat = Number(item?.geo?.latitude), lon = Number(item?.geo?.longitude);
  // Suisse seulement (quelques itinéraires sortent du pays ; le Liechtenstein est aussi dans les données)
  const liechtenstein = lat > 47.04 && lat < 47.28 && lon > 9.47 && lon < 9.64;
  return Number.isFinite(lat) && Number.isFinite(lon) && lat > 45.7 && lat < 47.9 && lon > 5.8 && lon < 10.6 && !liechtenstein ? { latitude: lat, longitude: lon } : null;
};

export function normalizeAttraction(item: any): NormalizedPlace | null {
  const name = cleanText(item?.name, 100);
  const website = cleanUrl(item?.url);
  const kind = attractionKind(item);
  const pos = geoOf(item);
  if (!name || !website || !kind || !pos || typeof item?.identifier !== 'string') return null;
  const a = Array.isArray(item.address) ? item.address[0] : null;
  const city = cleanText(a?.addressLocality, 60);
  return { externalId: `a:${item.identifier}`, name, kind, city, address: null, ...pos, website, family: FAMILY_KINDS.includes(kind) || has(classesOf(item), 'suitablefortype', 'family', 'children') };
}

// « Randonnée du lac Noir (12 km) » : la distance aide à choisir ; ville = point de départ
export function normalizeTour(item: any): NormalizedPlace | null {
  const base = cleanText(item?.name, 90);
  const website = cleanUrl(item?.url);
  const kind = tourKind(item);
  const pos = geoOf(item);
  if (!base || !website || !kind || !pos || typeof item?.identifier !== 'string') return null;
  const km = Number(item?.specs?.distance);
  const name = Number.isFinite(km) && km > 0 && !base.includes('km') ? `${base} (${Math.round(km)} km)` : base;
  const start = Array.isArray(item.itinerary) ? item.itinerary[0]?.name : null;
  return { externalId: `t:${item.identifier}`, name, kind, city: cleanText(start, 60), address: null, ...pos, website, family: kind !== 'velo' && has(classesOf(item), 'requirementconditions', 'easy') };
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAll(path: 'attractions' | 'tours', key: string): Promise<any[]> {
  const out: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API}/${path}/?lang=fr&expand=true&striphtml=true&hitsPerPage=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`MySwitzerland ${path} : ${res.status}`);
    const data: any = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    out.push(...items);
    const total = Number(data?.meta?.page?.totalPages);
    if (!items.length || (Number.isFinite(total) && page + 1 >= total)) break;
    await pause(500);
  }
  return out;
}

export async function fetchMySwitzerland(): Promise<NormalizedPlace[]> {
  const key = process.env.MYSWITZERLAND_API_KEY;
  if (!key) throw new Error('MYSWITZERLAND_API_KEY manquante');
  const [attractions, tours] = [await fetchAll('attractions', key), await fetchAll('tours', key)];
  const seen = new Set<string>();
  const out: NormalizedPlace[] = [];
  for (const p of [...attractions.map(normalizeAttraction), ...tours.map(normalizeTour)]) {
    if (!p || seen.has(p.externalId)) continue;
    seen.add(p.externalId);
    out.push(p);
  }
  return out;
}
