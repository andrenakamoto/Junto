import type { NormalizedPlace, PlaceKind } from './model';
import { cleanText, cleanUrl, FAMILY_KINDS, OUTDOOR_KINDS } from './model';

// Connecteur OpenStreetMap (idées de sorties) : service Overpass, données sous licence ODbL (mention « © les
// contributeurs d'OpenStreetMap » affichée). Seulement les lieux qui ont un nom, et seulement dans la zone : un canton
// (ISO3166-2, ex. CH-GE) ou un département, éventuellement réduit à un rayon autour d'une ville.
// Depuis le 2026-11-14 : un lieu sans site web est gardé s'il a un téléphone, des horaires ou une fiche Wikidata, et les
// idées de plein air (OUTDOOR_KINDS) avec un nom seulement ; le lien mène alors à sa fiche sur openstreetmap.org.

export interface OsmConfig { area: string; around?: [number, number, number] }

const SELECTORS: [string, PlaceKind][] = [
  ['nwr["leisure"="escape_game"]', 'escape'],
  ['nwr["sport"="laser_tag"]', 'laser'],
  ['nwr["leisure"="bowling_alley"]', 'bowling'],
  ['nwr["leisure"="trampoline_park"]', 'trampoline'],
  ['nwr["sport"="climbing"]["leisure"~"sports_centre|sports_hall"]', 'escalade'],
  ['nwr["sport"="karting"]', 'karting'],
  ['nwr["leisure"="miniature_golf"]', 'minigolf'],
  ['nwr["leisure"="ice_rink"]', 'patinoire'],
  ['nwr["leisure"="water_park"]', 'piscine'],
  ['nwr["leisure"="sports_centre"]["sport"="swimming"]', 'piscine'],
  ['nwr["leisure"="amusement_arcade"]', 'arcade'],
  ['nwr["leisure"="indoor_play"]', 'parc'],
  ['nwr["tourism"~"^(zoo|aquarium)$"]', 'animaux'],
  ['nwr["tourism"="museum"]', 'musee'],
  // Ajoutés le 2026-10-24
  ['nwr["sport"~"^(paintball|axe_throwing)$"]', 'defi'],
  ['nwr["tourism"="theme_park"]', 'loisirs'],
  ['nwr["amenity"="public_bath"]', 'bains'],
  ['nwr["leisure"~"^(sauna|spa)$"]', 'bains'],
  ['nwr["craft"="winery"]', 'cave'],
  ['nwr["amenity"="boat_rental"]', 'bateau'],
  ['nwr["leisure"="horse_riding"]', 'equitation'],
  ['nwr["leisure"="golf_course"]', 'golf'],
  ['nwr["historic"="castle"]["tourism"~"^(attraction|museum)$"]', 'chateau'],
  ['nwr["leisure"="garden"]["garden:type"="botanical"]', 'jardin'],
  ['nwr["tourism"="gallery"]', 'galerie'],
  ['nwr["craft"="pottery"]', 'poterie'],
  ['nwr["amenity"="library"]', 'bibliotheque'],
  // Ajoutés le 2026-11-14
  ['nwr["amenity"="cinema"]', 'cinema'],
  ['nwr["amenity"="theatre"]', 'theatre'],
  ['nwr["leisure"~"^(firepit|picnic_site)$"]["name"]', 'grillade'],
  ['nwr["amenity"="bbq"]["name"]', 'grillade'],
  ['nwr["natural"="beach"]["name"]', 'plage'],
  ['nwr["leisure"~"^(beach_resort|bathing_place)$"]["name"]', 'plage'],
  ['nwr["tourism"="viewpoint"]["name"]["wikidata"]', 'vue'],
  ['nwr["leisure"="park"]["name"]["wikidata"]', 'parc_ville'],
  ['nwr["leisure"="playground"]["name"]', 'jeux_enfants'],
  ['nwr["sport"="climbing_adventure"]', 'accrobranche'],
  ['nwr["attraction"="summer_toboggan"]', 'luge'],
  ['way["piste:type"="sled"]["name"]', 'luge'],
  ['nwr["landuse"="winter_sports"]["name"]', 'ski'],
  ['nwr["amenity"~"^(bar|pub|biergarten)$"]', 'bar'],
  ['nwr["amenity"="nightclub"]', 'discotheque'],
];

export function placeKind(t: Record<string, string>): PlaceKind | null {
  if (t.amenity === 'cinema') return 'cinema';
  if (t.amenity === 'nightclub') return 'discotheque';
  if (t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'biergarten') return 'bar';
  if (t.amenity === 'theatre') return 'theatre';
  if (t.sport === 'climbing_adventure') return 'accrobranche';
  if (t.attraction === 'summer_toboggan' || t['piste:type'] === 'sled') return 'luge';
  if (t.landuse === 'winter_sports') return 'ski';
  if (t.leisure === 'escape_game') return 'escape';
  if (t.sport === 'laser_tag') return 'laser';
  if (t.leisure === 'bowling_alley') return 'bowling';
  if (t.leisure === 'trampoline_park') return 'trampoline';
  if ((t.sport ?? '').includes('climbing')) return 'escalade';
  if (t.sport === 'karting') return 'karting';
  if (t.leisure === 'miniature_golf') return 'minigolf';
  if (t.leisure === 'ice_rink') return 'patinoire';
  if (t.leisure === 'water_park' || (t.leisure === 'sports_centre' && t.sport === 'swimming')) return 'piscine';
  if (t.leisure === 'amusement_arcade') return 'arcade';
  if (t.leisure === 'indoor_play') return 'parc';
  if (t.tourism === 'zoo' || t.tourism === 'aquarium') return 'animaux';
  if (t.historic === 'castle' && (t.tourism === 'attraction' || t.tourism === 'museum')) return 'chateau';
  if (t.tourism === 'museum') return 'musee';
  if (t.sport === 'paintball' || t.sport === 'axe_throwing') return 'defi';
  if (t.tourism === 'theme_park') return 'loisirs';
  if (t.amenity === 'public_bath' || t.leisure === 'sauna' || t.leisure === 'spa') return 'bains';
  if (t.craft === 'winery') return 'cave';
  if (t.amenity === 'boat_rental') return 'bateau';
  if (t.leisure === 'horse_riding') return 'equitation';
  if (t.leisure === 'golf_course') return 'golf';
  if (t.leisure === 'garden' && t['garden:type'] === 'botanical') return 'jardin';
  if (t.tourism === 'gallery') return 'galerie';
  if (t.craft === 'pottery') return 'poterie';
  if (t.amenity === 'library') return 'bibliotheque';
  if (t.leisure === 'firepit' || t.leisure === 'picnic_site' || t.amenity === 'bbq') return 'grillade';
  if (t.natural === 'beach' || t.leisure === 'beach_resort' || t.leisure === 'bathing_place') return 'plage';
  if (t.tourism === 'viewpoint') return 'vue';
  if (t.leisure === 'park') return 'parc_ville';
  if (t.leisure === 'playground') return 'jeux_enfants';
  return null;
}

const NOT_A_PLAYGROUND = /kindergarten|kita|cr[eè]che|[ée]cole|schule|scuola|asilo|tobog|rutsch|balan[cç]oire|schaukel|mur de grimpe|kletterwand|sandkasten|bac [àa] sable/i;

export function normalizeOsmElement(e: any): NormalizedPlace | null {
  const t = e?.tags ?? {};
  // « Kindergarten Gampel;Kindergarten » : plusieurs valeurs séparées par « ; », la première suffit
  const name = cleanText(typeof t.name === 'string' ? t.name.split(';')[0] : t.name, 100);
  const kind = placeKind(t);
  if (!name || !kind) return null;
  // Places de jeux : le nom décrit souvent un jeu ou une école, pas un lieu où aller
  if (kind === 'jeux_enfants' && (name.length < 4 || NOT_A_PLAYGROUND.test(name))) return null;
  // Sans site web : lieu gardé s'il est vérifiable autrement (téléphone, horaires, Wikidata) ou si c'est une idée de plein
  // air ; le lien mène à sa fiche OpenStreetMap (adresse, horaires, téléphone)
  let website = cleanUrl(t.website ?? t['contact:website'] ?? t.url);
  if (!website) {
    const known = t.phone || t['contact:phone'] || t.opening_hours || t.wikidata;
    if (!known && !OUTDOOR_KINDS.includes(kind)) return null;
    if (!['node', 'way', 'relation'].includes(e.type) || !Number.isFinite(Number(e.id))) return null;
    website = `https://www.openstreetmap.org/${e.type}/${e.id}`;
  }
  // Position : le nœud lui-même, ou le centre d'un bâtiment / d'une zone (`out tags center`)
  const lat = Number(e.lat ?? e.center?.lat), lon = Number(e.lon ?? e.center?.lon);
  const pos = Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : { latitude: null, longitude: null };
  return { externalId: `${e.type}/${e.id}`, name, kind, city: cleanText(t['addr:city'], 60), address: osmAddress(t), ...pos, website, family: FAMILY_KINDS.includes(kind) };
}

// « Rue du Rhône 12, 1204 Genève » à partir des champs addr:* (null sans rue ni place)
export function osmAddress(t: Record<string, string>): string | null {
  const road = t['addr:street'] ?? t['addr:place'];
  if (!road) return null; // un numéro seul (« 30 ») ne dit rien
  const street = [road, t['addr:housenumber']].filter(Boolean).join(' ');
  const town = [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ');
  return cleanText([street, town].filter(Boolean).join(', '), 120);
}

// Serveurs Overpass publics : le principal répond souvent 502 / 504 quand il est chargé ; on réessaie, puis on passe au suivant
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function overpass(query: string): Promise<any> {
  let last = '';
  for (let attempt = 0; attempt < OVERPASS.length * 2; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EvLY/1.0 (info@evly.ch)' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(320_000),
      });
      if (res.ok) {
        const data: any = await res.json();
        // Requête interrompue côté Overpass (temps ou mémoire) : réponse 200 avec une remarque et sans résultat fiable
        if (typeof data?.remark === 'string' && /runtime error|timed out|out of memory/i.test(data.remark)) last = `Overpass : ${data.remark.slice(0, 80)}`;
        else return data;
      } else {
        last = `Overpass ${res.status}`;
        if (![429, 502, 503, 504].includes(res.status)) break;
      }
    } catch (e) {
      last = `Overpass : ${(e as Error).message.slice(0, 80)}`;
    }
    await pause(15_000 * (attempt + 1));
  }
  throw new Error(last || 'Overpass indisponible');
}

export async function fetchOsmPlaces(cfg: OsmConfig): Promise<NormalizedPlace[]> {
  const filter = cfg.around ? `(area.a)(around:${cfg.around[2]},${cfg.around[0]},${cfg.around[1]})` : '(area.a)';
  const query = `[out:json][timeout:300];area["ISO3166-2"="${cfg.area}"]->.a;(${SELECTORS.map(([s]) => s + filter + ';').join('')});out tags center;`;
  const data = await overpass(query);
  const seen = new Set<string>();
  const out: NormalizedPlace[] = [];
  for (const e of data.elements ?? []) {
    const p = normalizeOsmElement(e);
    if (!p) continue;
    // Même lieu en point et en bâtiment : même nom à moins d'un kilomètre (des « Place de jeux » de villages différents restent)
    const key = `${p.name.toLowerCase()}|${p.latitude == null ? p.city ?? '' : `${p.latitude.toFixed(2)},${p.longitude?.toFixed(2)}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
