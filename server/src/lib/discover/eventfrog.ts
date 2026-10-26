import { promises as fs } from 'fs';
import path from 'path';
import type { Category, NormalizedEvent } from './model';
import { cleanText, cleanUrl, TITLE_MAX } from './model';
import { STORAGE_DIR } from '../storage';
import { IMAGE_HORIZON_MS, SourceImage } from './images';

// Connecteur Eventfrog (Public API v1, accord par email du 2026-10-26, conditions générales § 17 « Utilisation de l'API ») :
// événements de toute la Suisse, clé « Public API: Read » dans EVENTFROG_API_KEY (/etc/evly/app.env, limitée à l'adresse IP du
// serveur, valable jusqu’au 26.10.2030). Règles : mention « Source : Eventfrog » et lien vers la page de l'événement, contenu non
// modifié, mise à jour chaque jour, retrait de ce que l'API ne fournit plus (synchronisation complète, `removeMissing`), données
// et clé gardées chez EvLY. Images : `emblemToShow` copiée chez nous avec `emblemCredits` (lib/discover/images.ts), 14 prochains jours seulement.
// Limites : 30 requêtes / minute, 2 000 / jour → une pause entre deux requêtes, lieux mis en cache sur le disque.

const API = 'https://api.eventfrog.net/public/v1';
export interface EventfrogConfig { country?: string }

// Thèmes Eventfrog (`parentId` 0) → nos catégories ; quelques sous-catégories précisées à part
const PARENT_CATEGORY: Record<number, Category> = {
  900: 'soiree', 901: 'animation', 902: 'animation', 903: 'festival', 904: 'atelier', 905: 'atelier', 906: 'famille',
  907: 'concert', 908: 'concert', 909: 'expo', 910: 'atelier', 911: 'animation', 912: 'animation', 913: 'theatre',
  914: 'soiree', 915: 'animation', 916: 'sport', 917: 'theatre', 918: 'festival', 919: 'atelier', 920: 'festival',
  921: 'atelier', 922: 'theatre', 923: 'danse', 924: 'festival', 925: 'atelier', 1204: 'animation',
};
const RUBRIC_CATEGORY: Record<number, Category> = {
  // Jeux : escape game, quiz, jeux de société / cartes / réflexion, loto, jeux vidéo, groupes et jeux
  1208: 'jeux', 1220: 'jeux', 1221: 'jeux', 1222: 'jeux', 1223: 'jeux', 1224: 'jeux', 10: 'jeux', 11: 'jeux',
  // Visites et expositions
  34: 'expo', 35: 'expo', 90: 'expo',
  // Danse : salsa / bachata, danse moderne, spectacle de danse, festival de danse, ballet, danse sportive
  165: 'danse', 136: 'danse', 140: 'danse', 27: 'danse', 59: 'danse', 217: 'danse',
  // Afterwork, scène ouverte, opéra hors festival
  149: 'bar', 78: 'scene', 61: 'concert',
};
const FAMILY_RUBRICS = new Set([48, 99, 117]);

export function categoryOf(rubricId: number, parentOf: Map<number, number>): { category: Category; family: boolean } {
  const parent = parentOf.get(rubricId) ?? 0;
  const category = RUBRIC_CATEGORY[rubricId] ?? PARENT_CATEGORY[parent] ?? PARENT_CATEGORY[rubricId] ?? 'animation';
  return { category, family: parent === 906 || rubricId === 906 || FAMILY_RUBRICS.has(rubricId) };
}

// Textes multilingues : le français d'abord, sinon la langue fournie par l'organisateur (contenu non traduit, non modifié)
export function pickLang(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const t = o as Record<string, unknown>;
  for (const k of ['fr', 'de', 'it', 'en', ...Object.keys(t)]) if (typeof t[k] === 'string' && (t[k] as string).trim()) return (t[k] as string).trim();
  return null;
}

export interface EventfrogLocation { name: string | null; city: string | null; lat: number | null; lon: number | null; at: number }

// `inSeries` : l'événement fait partie d'un groupe Eventfrog de plusieurs dates (un spectacle chaque soir…). Des organisateurs y
// saisissent une fin des semaines plus tard : chaque date redevient une soirée (même heure de fin, le jour même), à son jour.
export function normalizeEventfrogEvent(e: any, loc: EventfrogLocation | undefined, parentOf: Map<number, number>, from: Date, to: Date, inSeries = false): NormalizedEvent | null {
  if (!e || e.visible !== true || e.published !== true) return null;
  const externalId = typeof e.id === 'string' ? e.id : null;
  const title = cleanText(pickLang(e.title), TITLE_MAX);
  const startAt = typeof e.begin === 'string' ? new Date(e.begin) : null;
  if (!externalId || !title || !startAt || isNaN(startAt.getTime())) return null;
  let endAt = typeof e.end === 'string' && !isNaN(new Date(e.end).getTime()) ? new Date(e.end) : null;
  if (inSeries && endAt && endAt.getTime() - startAt.getTime() > 24 * 3600e3) {
    endAt = new Date(startAt.getTime() + ((endAt.getTime() - startAt.getTime()) % (24 * 3600e3) || 3 * 3600e3));
  }
  // Dans la fenêtre : commence avant la fin de la fenêtre, n'est pas terminé
  if (startAt > to || (endAt ?? new Date(startAt.getTime() + 3 * 3600e3)) < from) return null;
  const { category, family } = categoryOf(Number(e.rubricId), parentOf);
  const price = typeof e.lowestTicketPrice === 'number' && e.lowestTicketPrice > 0 && !e.agendaEntryOnly ? e.lowestTicketPrice : null;
  return {
    externalId, title,
    place: cleanText(pickLang(e.locationAlias) ?? loc?.name ?? null),
    city: cleanText(loc?.city ?? null, 60),
    latitude: loc?.lat ?? null, longitude: loc?.lon ?? null,
    category, family,
    priceText: price ? `CHF ${price.toFixed(2)}` : null,
    status: e.cancelled === true ? 'cancelled' : e.soldOut === true ? 'full' : 'scheduled',
    startAt, endAt,
    multiDay: !inSeries && !!endAt && endAt.getTime() - startAt.getTime() >= 3 * 24 * 3600e3, dateLabel: null,
    url: cleanUrl(e.url) ?? 'https://eventfrog.ch/',
  };
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(pathAndQuery: string): Promise<any> {
  const key = process.env.EVENTFROG_API_KEY;
  if (!key) throw new Error('Clé API Eventfrog manquante (EVENTFROG_API_KEY)');
  for (let attempt = 0; ; attempt++) {
    await pause(2200); // 30 requêtes par minute au plus
    const res = await fetch(`${API}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'User-Agent': 'EvLY/1.0 (info@evly.ch)' },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) return res.json();
    if (attempt < 2 && [429, 502, 503, 504].includes(res.status)) { await pause(30_000 * (attempt + 1)); continue; }
    throw new Error(`Eventfrog ${res.status}`);
  }
}

// Lieux : gardés sur le disque (beaucoup d'événements partagent les mêmes salles), relus au bout de 30 jours
const LOC_FILE = path.join(STORAGE_DIR, 'discover', 'eventfrog-locations.json');
const LOC_TTL = 30 * 24 * 3600e3;
async function loadLocations(): Promise<Record<string, EventfrogLocation>> {
  try { return JSON.parse(await fs.readFile(LOC_FILE, 'utf8')); } catch { return {}; }
}
async function saveLocations(locs: Record<string, EventfrogLocation>) {
  await fs.mkdir(path.dirname(LOC_FILE), { recursive: true });
  await fs.writeFile(LOC_FILE, JSON.stringify(locs));
}

export async function fetchEventfrog(cfg: EventfrogConfig, from: Date, to: Date): Promise<{ events: NormalizedEvent[]; images: Map<string, SourceImage> }> {
  const country = cfg.country ?? 'CH';
  const rubrics = await get('/rubrics?perPage=1000');
  const parentOf = new Map<number, number>((rubrics.rubrics ?? []).map((r: any) => [Number(r.id), Number(r.parentId)]));
  // Tous les événements de la fenêtre (1 000 par page)
  const events: any[] = [];
  const day = (d: Date) => d.toISOString().slice(0, 10);
  for (let page = 1; page <= 60; page++) {
    const data = await get(`/events?country=${encodeURIComponent(country)}&from=${day(from)}&to=${day(to)}&perPage=1000&page=${page}`);
    events.push(...(data.events ?? []));
    if (!data.events?.length || events.length >= (data.totalNumberOfResources ?? 0)) break;
  }
  // Lieux manquants ou trop anciens, par paquets de 100
  const locs = await loadLocations();
  const now = Date.now();
  const needed = [...new Set(events.map(e => e.locationIds?.[0]).filter((id: unknown): id is string => typeof id === 'string'))]
    .filter(id => !locs[id] || now - locs[id].at > LOC_TTL);
  for (let i = 0; i < needed.length; i += 100) {
    const ids = needed.slice(i, i + 100);
    const data = await get(`/locations?perPage=100&${ids.map(id => `id=${encodeURIComponent(id)}`).join('&')}`);
    for (const l of data.locations ?? []) {
      locs[String(l.id)] = {
        name: cleanText(pickLang(l.title)), city: cleanText(l.city ?? null, 60),
        lat: typeof l.lat === 'number' ? l.lat : null, lon: typeof l.lng === 'number' ? l.lng : null, at: now,
      };
    }
    if (i % 1000 === 0) await saveLocations(locs);
  }
  await saveLocations(locs);
  const groupSize = new Map<string, number>();
  for (const e of events) if (e.groupId && e.groupId !== '0') groupSize.set(e.groupId, (groupSize.get(e.groupId) ?? 0) + 1);
  const list = events
    .map(e => normalizeEventfrogEvent(e, locs[e.locationIds?.[0]], parentOf, from, to, (groupSize.get(e.groupId) ?? 0) > 1))
    .filter((e): e is NormalizedEvent => !!e);
  // Images des événements des 14 prochains jours (ce que Découvrir montre), avec leur crédit
  const horizon = from.getTime() + IMAGE_HORIZON_MS;
  const kept = new Set(list.filter(e => e.startAt.getTime() <= horizon).map(e => e.externalId));
  const images = new Map<string, SourceImage>();
  for (const e of events) {
    const url = e.emblemToShow?.url;
    if (kept.has(e.id) && typeof url === 'string') images.set(e.id, { url, credit: cleanText(e.emblemCredits ?? null, 120) });
  }
  return { events: list, images };
}
