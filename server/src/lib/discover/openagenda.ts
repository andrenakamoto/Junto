import type { Category, NormalizedEvent } from './model';
import { cleanText, cleanUrl, TITLE_MAX } from './model';

// Connecteur OpenAgenda : API publique de lecture (https://openagenda.com/api/agendas/<uid>/events), sans clé. Utilisé
// seulement pour les agendas publiés sous licence ouverte (licence affichée dans Découvrir). Chaque agenda a son propre
// schéma : `typeField` / `typeMap` relient ses types d'événement aux catégories d'EvLY, `familyField` / `familyValue`
// repèrent le public « enfants et famille ». Configuration par défaut : agenda de la Ville de Genève.

export interface OpenAgendaConfig {
  agendaUid: number;
  typeField?: string;
  typeMap?: Record<string, Category>;
  familyField?: string;
  familyValue?: number;
  defaultCategory?: Category;
}

// Types de l'agenda de la Ville de Genève (champ « type-devenement »)
export const GENEVA_TYPE_MAP: Record<string, Category> = {
  34: 'animation', 35: 'atelier', 36: 'animation', 86: 'soiree', 38: 'concert', 39: 'atelier', 40: 'danse', 41: 'expo',
  61: 'festival', 42: 'expo', 43: 'theatre', 44: 'animation', 84: 'concert', 45: 'festival', 70: 'sport', 73: 'animation',
  47: 'theatre', 48: 'expo',
};

const STATUS: Record<number, NormalizedEvent['status']> = { 2: 'postponed', 4: 'postponed', 5: 'full', 6: 'cancelled' };
const TZ = 'Europe/Zurich';
const fr = (v: any): string => (v && typeof v === 'object' ? v.fr ?? Object.values(v)[0] ?? '' : v ?? '') as string;
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

// Un événement OpenAgenda → une ou plusieurs lignes : une par jour s'il a lieu au plus 2 jours dans la période,
// sinon une seule ligne « sur plusieurs jours » (expositions, ateliers répétés…)
export function normalizeOpenAgendaEvent(e: any, cfg: OpenAgendaConfig, from: Date, to: Date): NormalizedEvent[] {
  const title = cleanText(fr(e.title), TITLE_MAX);
  if (!title || e.state === 0) return [];
  const timings = (e.timings ?? [])
    .map((t: any) => ({ begin: new Date(t.begin), end: t.end ? new Date(t.end) : null }))
    .filter((t: any) => !isNaN(t.begin.getTime()) && (t.end ?? t.begin) >= from && t.begin <= to)
    .sort((a: any, b: any) => a.begin - b.begin);
  if (!timings.length) return [];
  const rawType = e[cfg.typeField ?? 'type-devenement'];
  const firstType = Array.isArray(rawType) ? rawType[0] : rawType;
  const map = cfg.typeMap ?? GENEVA_TYPE_MAP;
  const category: Category = (firstType != null && map[String(firstType)]) || cfg.defaultCategory || 'animation';
  const pub = e[cfg.familyField ?? 'publics-cibles'];
  const family = (Array.isArray(pub) ? pub : [pub]).includes(cfg.familyValue ?? 27);
  const loc = e.location ?? {};
  const place = cleanText(loc.name);
  const city = cleanText(loc.city, 60);
  const reg = (e.registration ?? []).find((r: any) => r?.type === 'link' && cleanUrl(r.value));
  const url = cleanUrl(reg?.value) ?? cleanUrl(e.organisator_url) ?? cleanUrl(e.canonicalUrl) ?? cleanUrl(`https://openagenda.com/agendas/${cfg.agendaUid}/events/${e.uid}`);
  const base = {
    title, place, city, category, family, url,
    latitude: typeof loc.latitude === 'number' ? loc.latitude : null,
    longitude: typeof loc.longitude === 'number' ? loc.longitude : null,
    priceText: cleanText(fr(e.conditions), 80),
    status: STATUS[e.status] ?? 'scheduled',
  };
  const days = [...new Set(timings.map((t: any) => dayKey(t.begin)))] as string[];
  if (category === 'expo' || days.length > 2) {
    const last = timings[timings.length - 1];
    return [{ ...base, externalId: `${e.uid}`, startAt: timings[0].begin, endAt: last.end ?? last.begin, multiDay: true, dateLabel: cleanText(fr(e.dateRange), 60) }];
  }
  return days.map(d => {
    const t = timings.find((x: any) => dayKey(x.begin) === d)!;
    return { ...base, externalId: `${e.uid}-${d}`, startAt: t.begin, endAt: t.end, multiDay: false, dateLabel: null };
  });
}

export async function fetchOpenAgenda(cfg: OpenAgendaConfig, from: Date, to: Date): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = [];
  let after: unknown[] | null = null;
  for (let page = 0; page < 40; page++) {
    const params = new URLSearchParams({ size: '100', detailed: '1', 'timings[gte]': from.toISOString(), 'timings[lte]': to.toISOString() });
    if (after) for (const a of after) params.append('after[]', String(a));
    const res = await fetch(`https://openagenda.com/api/agendas/${cfg.agendaUid}/events?${params}`, { headers: { 'User-Agent': 'EvLY/1.0 (info@evly.ch)' } });
    if (!res.ok) throw new Error(`OpenAgenda ${res.status}`);
    const data: any = await res.json();
    for (const e of data.events ?? []) out.push(...normalizeOpenAgendaEvent(e, cfg, from, to));
    after = Array.isArray(data.after) && data.events?.length ? data.after : null;
    if (!after) break;
  }
  return out;
}

// Recherche d'agendas (panneau admin, pour ajouter une source)
export async function searchOpenAgendas(q: string) {
  const res = await fetch(`https://openagenda.com/api/agendas?search=${encodeURIComponent(q)}&size=30`, { headers: { 'User-Agent': 'EvLY/1.0 (info@evly.ch)' } });
  if (!res.ok) throw new Error(`OpenAgenda ${res.status}`);
  const data: any = await res.json();
  return (data.agendas ?? []).map((a: any) => ({ uid: a.uid, title: a.title, official: !!a.official, description: a.description ?? '' }));
}

// Licence d'un agenda (affichée dans Découvrir ; une source n'est activée que si elle est ouverte)
export async function openAgendaLicense(uid: number): Promise<{ license: string | null; licenseUrl: string | null; publisher: string | null }> {
  const res = await fetch(`https://openagenda.com/api/agendas/${uid}`, { headers: { 'User-Agent': 'EvLY/1.0 (info@evly.ch)' } });
  if (!res.ok) throw new Error(`OpenAgenda ${res.status}`);
  const data: any = await res.json();
  const a = data.agenda ?? data;
  return { license: a.rights?.license?.name ?? null, licenseUrl: cleanUrl(a.rights?.license?.url), publisher: a.rights?.publisher?.name ?? a.title ?? null };
}
