import { readFileSync } from 'fs';
import path from 'path';
import type { Region } from './model';

// Découvrir par lieu et rayon (2026-10-25). Localités suisses : répertoire officiel des localités de swisstopo (données
// ouvertes, « © swisstopo »), réduit à [nom, canton, latitude, longitude] dans assets/localities.json (une ligne par
// localité et par commune, coordonnées moyennes de leurs NPA). Sert à situer les événements et lieux qui n'ont qu'un nom
// de ville, et à la recherche de lieu de Découvrir. Aucun service extérieur n'est appelé.

export type Locality = { name: string; canton: string; lat: number; lon: number };

// Centres des régions (anciennes apps qui envoient `region`, sources sans coordonnées, rattachement d'une ville ambiguë)
export const REGION_CENTERS: Record<Region, { lat: number; lon: number; name: string }> = {
  ge: { lat: 46.2044, lon: 6.1432, name: 'Genève' },
  la: { lat: 46.5197, lon: 6.6323, name: 'Lausanne' },
  vs: { lat: 46.2331, lon: 7.3606, name: 'Sion' },
  fr: { lat: 46.8065, lon: 7.1620, name: 'Fribourg' },
  ne: { lat: 46.9900, lon: 6.9293, name: 'Neuchâtel' },
  ju: { lat: 47.3648, lon: 7.3305, name: 'Delémont' },
  be: { lat: 46.9488, lon: 7.4276, name: 'Bern' },
  so: { lat: 47.2057, lon: 7.5335, name: 'Solothurn' },
  bs: { lat: 47.5566, lon: 7.5907, name: 'Basel' },
  bl: { lat: 47.4810, lon: 7.7433, name: 'Liestal' },
  ag: { lat: 47.3937, lon: 8.0623, name: 'Aarau' },
  lu: { lat: 47.0504, lon: 8.3012, name: 'Luzern' },
  zg: { lat: 47.1574, lon: 8.5218, name: 'Zug' },
  sz: { lat: 47.0217, lon: 8.6822, name: 'Schwyz' },
  ur: { lat: 46.8874, lon: 8.6462, name: 'Altdorf' },
  ow: { lat: 46.8949, lon: 8.2284, name: 'Sarnen' },
  nw: { lat: 46.9627, lon: 8.3635, name: 'Stans' },
  zh: { lat: 47.3799, lon: 8.5313, name: 'Zürich' },
  sh: { lat: 47.7108, lon: 8.6278, name: 'Schaffhausen' },
  tg: { lat: 47.5503, lon: 8.9114, name: 'Frauenfeld' },
  sg: { lat: 47.4245, lon: 9.3724, name: 'St. Gallen' },
  ar: { lat: 47.3783, lon: 9.2528, name: 'Herisau' },
  ai: { lat: 47.3428, lon: 9.4151, name: 'Appenzell' },
  gl: { lat: 47.0396, lon: 9.0443, name: 'Glarus' },
  gr: { lat: 46.8398, lon: 9.5540, name: 'Chur' },
  ti: { lat: 46.2023, lon: 9.0150, name: 'Bellinzona' },
};

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

let cache: { list: Locality[]; byName: Map<string, Locality[]> } | null = null;
function data() {
  if (cache) return cache;
  const file = path.join(__dirname, '..', '..', '..', 'assets', 'localities.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as [string, string, number, number][];
  const list = raw.map(([name, canton, lat, lon]) => ({ name, canton, lat, lon }));
  const byName = new Map<string, Locality[]>();
  for (const l of list) byName.set(norm(l.name), [...(byName.get(norm(l.name)) ?? []), l]);
  cache = { list, byName };
  return cache;
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Coordonnées d'une ville d'après son nom ; plusieurs localités du même nom (Carouge GE / VD) : la plus proche du centre
// de la région de la source
export function locateCity(city: string | null | undefined, near?: { lat: number; lon: number }): { lat: number; lon: number } | null {
  if (!city) return null;
  const key = norm(city.replace(/\s*\((GE|VD|VS|FR|NE|JU|BE)\)\s*$/i, '').replace(/^\d{4}\s+/, ''));
  const found = data().byName.get(key);
  if (!found?.length) return null;
  const best = near ? [...found].sort((a, b) => distanceKm(a, near) - distanceKm(b, near))[0] : found[0];
  return { lat: best.lat, lon: best.lon };
}

// Recherche d'une localité (champ « Ville ou village » de Découvrir) : début de nom d'abord, puis contenu
export function searchLocalities(q: string, limit = 8): Locality[] {
  const n = norm(q);
  if (n.length < 2) return [];
  const { list } = data();
  const starts = list.filter(l => norm(l.name).startsWith(n));
  const contains = n.length >= 3 ? list.filter(l => !norm(l.name).startsWith(n) && norm(l.name).includes(n)) : [];
  return [...starts.sort((a, b) => a.name.length - b.name.length), ...contains].slice(0, limit);
}

// Région la plus proche d'un point (éléments sans position, recherche autour d'un point)
export function nearestRegion(p: { lat: number; lon: number }): Region {
  return (Object.keys(REGION_CENTERS) as Region[]).sort((a, b) => distanceKm(p, REGION_CENTERS[a]) - distanceKm(p, REGION_CENTERS[b]))[0];
}

// Rectangle englobant un cercle (filtre rapide en base avant le calcul exact de la distance)
export function boundingBox(c: { lat: number; lon: number }, km: number) {
  const dLat = km / 111.32, dLon = km / (111.32 * Math.cos(c.lat * Math.PI / 180));
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLon: c.lon - dLon, maxLon: c.lon + dLon };
}

// Coordonnées manquantes : d'après la ville (événements de GeNEVERsleep, saisie manuelle, lieux sans position)
// Sans ville reconnue : un nom de localité cité dans le lieu ou l'adresse (« Salle communale, Nyon », « … 1260 Nyon »)
export function locateInText(text: string | null | undefined, near?: { lat: number; lon: number }): { lat: number; lon: number } | null {
  if (!text) return null;
  const words = ` ${norm(text)} `;
  let best: string | null = null;
  for (const key of data().byName.keys()) {
    if (key.length >= 3 && (!best || key.length > best.length) && words.includes(` ${key} `)) best = key;
  }
  return best ? locateCity(best, near) : null;
}

export function withCoords<T extends { city?: string | null; place?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null }>(d: T, region: Region): T {
  if (d.latitude != null && d.longitude != null) return d;
  const near = REGION_CENTERS[region];
  // Un nom trouvé dans le texte n'est retenu que près de la région (« Bar du Port » ≠ une localité nommée Port à 150 km)
  const inText = (s: string | null | undefined) => { const p = locateInText(s, near); return p && distanceKm(p, near) <= 80 ? p : null; };
  const pos = locateCity(d.city, near) ?? inText(d.address) ?? inText(d.place);
  return pos ? { ...d, latitude: pos.lat, longitude: pos.lon } : d;
}

// Rattrapage des positions manquantes (au démarrage : lignes enregistrées avant le 2026-10-25, saisies, annonces)
export async function fillMissingCoords(prisma: any) {
  const events = await prisma.discoverEvent.findMany({ where: { latitude: null }, select: { id: true, region: true, city: true, place: true } });
  for (const e of events) {
    const d = withCoords(e, e.region as Region);
    if (d.latitude != null) await prisma.discoverEvent.update({ where: { id: e.id }, data: { latitude: d.latitude, longitude: d.longitude } });
  }
  const places = await prisma.discoverPlace.findMany({ where: { latitude: null }, select: { id: true, region: true, city: true, address: true } });
  for (const p of places) {
    const d = withCoords(p, p.region as Region);
    if (d.latitude != null) await prisma.discoverPlace.update({ where: { id: p.id }, data: { latitude: d.latitude, longitude: d.longitude } });
  }
}
