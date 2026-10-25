import type { NormalizedPlace, PlaceKind } from './model';
import { cleanText, cleanUrl, FAMILY_KINDS } from './model';

// Connecteur OpenStreetMap (idées de sorties) : service Overpass, données sous licence ODbL (mention « © les
// contributeurs d'OpenStreetMap » affichée). Seulement les lieux qui ont un nom et un site web, et seulement en
// Suisse : la zone est un canton (ISO3166-2, ex. CH-GE), éventuellement réduite à un rayon autour d'une ville.

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
];

export function placeKind(t: Record<string, string>): PlaceKind | null {
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
  return null;
}

export function normalizeOsmElement(e: any): NormalizedPlace | null {
  const t = e?.tags ?? {};
  const name = cleanText(t.name, 100);
  const website = cleanUrl(t.website ?? t['contact:website']);
  const kind = placeKind(t);
  if (!name || !website || !kind) return null;
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

export async function fetchOsmPlaces(cfg: OsmConfig): Promise<NormalizedPlace[]> {
  const filter = cfg.around ? `(area.a)(around:${cfg.around[2]},${cfg.around[0]},${cfg.around[1]})` : '(area.a)';
  const query = `[out:json][timeout:120];area["ISO3166-2"="${cfg.area}"]->.a;(${SELECTORS.map(([s]) => s + filter + ';').join('')});out tags center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EvLY/1.0 (info@evly.ch)' },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data: any = await res.json();
  const seen = new Set<string>();
  const out: NormalizedPlace[] = [];
  for (const e of data.elements ?? []) {
    const p = normalizeOsmElement(e);
    if (!p || seen.has(p.name.toLowerCase())) continue;
    seen.add(p.name.toLowerCase());
    out.push(p);
  }
  return out;
}
