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
  ['nwr["leisure"="amusement_arcade"]', 'arcade'],
  ['nwr["leisure"="indoor_play"]', 'parc'],
  ['nwr["tourism"~"^(zoo|aquarium)$"]', 'animaux'],
  ['nwr["tourism"="museum"]', 'musee'],
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
  if (t.leisure === 'water_park') return 'piscine';
  if (t.leisure === 'amusement_arcade') return 'arcade';
  if (t.leisure === 'indoor_play') return 'parc';
  if (t.tourism === 'zoo' || t.tourism === 'aquarium') return 'animaux';
  if (t.tourism === 'museum') return 'musee';
  return null;
}

export function normalizeOsmElement(e: any): NormalizedPlace | null {
  const t = e?.tags ?? {};
  const name = cleanText(t.name, 100);
  const website = cleanUrl(t.website ?? t['contact:website']);
  const kind = placeKind(t);
  if (!name || !website || !kind) return null;
  return { externalId: `${e.type}/${e.id}`, name, kind, city: cleanText(t['addr:city'], 60), website, family: FAMILY_KINDS.includes(kind) };
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
