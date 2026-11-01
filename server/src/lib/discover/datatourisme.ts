import type { Category, NormalizedEvent, Region } from './model';
import { cleanText, cleanUrl, TITLE_MAX } from './model';

// Connecteur DATAtourisme (France, 2026-11-01) : plateforme nationale des données touristiques, Licence Ouverte 2.0 d'Etalab.
// API https://api.datatourisme.fr/v1 (clé `DATATOURISME_API_KEY`, en-tête X-API-Key ; 1 000 requêtes / heure), « fêtes et
// manifestations » des départements choisis (d'abord l'Ain et la Haute-Savoie, la France voisine de Genève). La licence demande
// de citer l'auteur de chaque donnée (`hasBeenCreatedBy`, souvent l'office de tourisme) et la date de sa dernière mise à jour :
// `credit` de chaque événement, affiché sur sa carte.

export interface DatatourismeConfig { departments: string[] }

const API = 'https://api.datatourisme.fr/v1/entertainmentAndEvent';
const FIELDS = 'uuid,label,type,takesPlaceAt,isLocatedAt,hasBeenCreatedBy,lastUpdate,hasContact';
// Département → région d'EvLY (codes des sources, comme les cantons)
export const DEPARTMENT_REGION: Record<string, Region> = { '01': 'f01', '74': 'f74' };

// Types DATAtourisme → catégories d'EvLY (le premier type reconnu, dans cet ordre)
const TYPE_CATEGORY: [string, Category][] = [
  ['Concert', 'concert'], ['MusicEvent', 'concert'], ['DanceEvent', 'danse'], ['TheaterEvent', 'theatre'],
  ['ShowEvent', 'scene'], ['CircusEvent', 'scene'], ['ScreeningEvent', 'scene'], ['Festival', 'festival'],
  ['TraditionalCelebration', 'festival'], ['Carnival', 'festival'], ['Parade', 'festival'], ['Exhibition', 'expo'],
  ['ExhibitionEvent', 'expo'], ['VisualArtsEvent', 'expo'], ['WorkshopEvent', 'atelier'], ['TrainingWorkshop', 'atelier'],
  ['Game', 'jeux'], ['SportsCompetition', 'sport'], ['SportsEvent', 'sport'], ['ChildrensEvent', 'famille'],
  ['Market', 'animation'], ['SaleEvent', 'animation'], ['FairOrShow', 'animation'], ['LocalAnimation', 'animation'],
];
export function categoryOfTypes(types: string[]): Category {
  return TYPE_CATEGORY.find(([t]) => types.includes(t))?.[1] ?? 'animation';
}

const fr = (v: any): string | null => (v && typeof v === 'object' ? v['@fr'] ?? Object.values(v)[0] ?? null : typeof v === 'string' ? v : null) as string | null;
const first = <T>(v: T[] | T | undefined): T | undefined => (Array.isArray(v) ? v[0] : v);

// Heure « murale » française (même fuseau que la Suisse) → instant
function parisWall(day: string, time: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const t = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], t ? +t[1] : 0, t ? +t[2] : 0);
  const offset = (at: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(at)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 60000) * 60000;
  };
  let at = guess - offset(guess);
  at = guess - offset(at);
  return new Date(at);
}
const dmy = (iso: string | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : null; };

// Crédit exigé par la licence : auteur de la donnée et date de sa dernière mise à jour
export function creditOf(o: any): string {
  const author = cleanText(o?.hasBeenCreatedBy?.legalName, 90);
  const date = dmy(o?.lastUpdate);
  return [author ? `${author} · DATAtourisme` : 'DATAtourisme', date ? `mise à jour ${date}` : null].filter(Boolean).join(', ');
}

// Un objet DATAtourisme → une ligne par date dans la période (12 au plus) ; une période de trois jours ou plus (exposition,
// festival) → une seule ligne « sur plusieurs jours »
export function normalizeDatatourismeEvent(o: any, from: Date, to: Date): (NormalizedEvent & { region?: Region; credit: string })[] {
  const title = cleanText(fr(o?.label), TITLE_MAX);
  if (!title || !o?.uuid) return [];
  const loc = first(o.isLocatedAt) ?? {};
  const addr = first(loc.address) ?? {};
  const cityObj = addr.hasAddressCity ?? {};
  const dept = cityObj.isPartOfDepartment?.insee as string | undefined;
  const region = dept ? DEPARTMENT_REGION[dept] : undefined;
  const city = cleanText(fr(cityObj.label) ?? addr.addressLocality, 60);
  const street = (Array.isArray(addr.streetAddress) ? addr.streetAddress : []).map((s: unknown) => cleanText(s)).filter(Boolean) as string[];
  // Nom du lieu : la première ligne d'adresse qui n'est pas un numéro de rue (« Salle des fêtes », « Les Allos - Théâtre de Cluses »)
  const place = street.find(s => !/^\d/.test(s)) ?? street[0] ?? null;
  const lat = typeof loc.geo?.latitude === 'number' ? loc.geo.latitude : null;
  const lon = typeof loc.geo?.longitude === 'number' ? loc.geo.longitude : null;
  const types: string[] = Array.isArray(o.type) ? o.type : [];
  const category = categoryOfTypes(types);
  const contact = first(o.hasContact) ?? {};
  const url = cleanUrl(first(contact.homepage)) ?? cleanUrl(first(o.hasBeenCreatedBy?.homepage)) ?? null;
  const base = {
    title, place, city, latitude: lat, longitude: lon, category, family: category === 'famille', priceText: null,
    status: 'scheduled' as const, url, region, credit: creditOf(o),
  };
  const out: (NormalizedEvent & { region?: Region; credit: string })[] = [];
  const periods = (Array.isArray(o.takesPlaceAt) ? o.takesPlaceAt : [])
    .map((p: any) => ({ start: parisWall(p.startDate, p.startTime), end: parisWall(p.endDate ?? p.startDate, p.endTime ?? '23:59'), startDate: p.startDate as string, endDate: (p.endDate ?? p.startDate) as string }))
    .filter((p: any) => p.start && p.end && p.end >= from && p.start <= to)
    .sort((a: any, b: any) => a.start - b.start);
  for (const p of periods.slice(0, 12)) {
    const days = Math.round((Date.parse(p.endDate) - Date.parse(p.startDate)) / 86400e3);
    const multiDay = days >= 2;
    const end = p.end < p.start ? null : p.end;
    out.push({
      ...base, externalId: `${o.uuid}:${p.startDate}`, startAt: p.start, endAt: end, multiDay,
      dateLabel: multiDay ? `${dmy(p.startDate)} – ${dmy(p.endDate)}` : null,
    });
  }
  return out;
}

export async function fetchDatatourisme(cfg: DatatourismeConfig, from: Date, to: Date): Promise<(NormalizedEvent & { region?: Region; credit: string })[]> {
  const key = process.env.DATATOURISME_API_KEY;
  if (!key) throw new Error('Clé DATATOURISME_API_KEY absente');
  const depts = (cfg.departments ?? []).filter(d => /^\d[\dAB]$/.test(d));
  if (!depts.length) return [];
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const params = new URLSearchParams({
    filters: `isLocatedAt.address.hasAddressCity.isPartOfDepartment.insee[in]=${depts.join(',')} AND takesPlaceAt.endDate[gte]=${day(from)} AND takesPlaceAt.startDate[lte]=${day(to)}`,
    fields: FIELDS, page_size: '100',
  });
  const out: (NormalizedEvent & { region?: Region; credit: string })[] = [];
  let next: string | null = `${API}?${params}`;
  for (let page = 0; next && page < 60; page++) {
    const r = await fetch(next, { headers: { 'X-API-Key': key, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`DATAtourisme : HTTP ${r.status}`);
    const body: any = await r.json();
    for (const o of body.objects ?? []) out.push(...normalizeDatatourismeEvent(o, from, to));
    next = typeof body.meta?.next === 'string' ? body.meta.next : null;
    if (next) await new Promise(res => setTimeout(res, 400));
  }
  return out;
}
