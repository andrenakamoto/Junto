import prisma from '../prisma';
import type { DiscoverSource } from '@prisma/client';
import { fetchOpenAgenda, OpenAgendaConfig } from './openagenda';
import { fetchOsmPlaces, OsmConfig } from './osm';
import { fetchIcal, IcalConfig } from './ical';
import { fetchGeneverSleep, GeneverSleepConfig } from './geneversleep';
import { fetchEventfrog, EventfrogConfig } from './eventfrog';
import type { NormalizedEvent, NormalizedPlace, Region } from './model';
import { nearestRegion, withCoords } from './geo';

// Synchronisation des sources actives (tâche planifiée, protégée comme les autres, et bouton du panneau admin).
// Événements : les 30 prochains jours ; une ligne supprimée chez la source disparaît, une ligne masquée par l'admin
// reste masquée. Lieux : remplacés à chaque synchronisation, sauf ceux masqués.

export const EVENT_WINDOW_DAYS = 30;
const EVENT_SYNC_MS = 12 * 3600e3;      // agendas : deux fois par jour
const PLACE_SYNC_MS = 7 * 24 * 3600e3;  // OpenStreetMap : une fois par semaine
const GNS_SYNC_MS = 2 * 3600e3;         // GeNEVERsleep : toutes les 2 h (leur recommandation : 1 à 3 h)

// Sources qui couvrent plusieurs régions (GeNEVERsleep, Eventfrog) : chaque événement va dans la région la plus proche de sa
// ville (anciennes apps qui cherchent par région). `removeMissing` : tout ce que la source ne fournit plus disparaît, même un
// événement déjà commencé (règle d'Eventfrog) ; `needCoords` : sans position, l'événement est laissé de côté (toute la Suisse).
async function saveEvents(source: DiscoverSource, region: Region, events: NormalizedEvent[], regionFromPlace = false, opts: { removeMissing?: boolean; needCoords?: boolean } = {}) {
  const now = new Date();
  const located = events.map(e => withCoords(e, region)).filter(e => !opts.needCoords || (e.latitude != null && e.longitude != null));
  const keep = new Set(located.map(e => e.externalId));
  for (const e of located) {
    const { externalId, ...data } = e;
    const r = regionFromPlace && data.latitude != null && data.longitude != null ? nearestRegion({ lat: data.latitude, lon: data.longitude }) : region;
    await prisma.discoverEvent.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId } },
      create: { ...data, externalId, sourceId: source.id, region: r, state: source.autoPublish ? 'published' : 'pending' },
      update: { ...data, region: r }, // l'état (publié, à valider, masqué) choisi dans le panneau admin est gardé
    });
  }
  // Retirés chez la source (sauf `removeMissing` : seulement les événements à venir, le passé est effacé par cleanPastEvents).
  // Comparaison faite ici plutôt qu'en base : des dizaines de milliers d'identifiants avec Eventfrog
  const existing = await prisma.discoverEvent.findMany({ where: { sourceId: source.id, ...(opts.removeMissing ? {} : { startAt: { gte: now } }) }, select: { id: true, externalId: true } });
  const gone = existing.filter(x => !keep.has(x.externalId)).map(x => x.id);
  for (let i = 0; i < gone.length; i += 1000) await prisma.discoverEvent.deleteMany({ where: { id: { in: gone.slice(i, i + 1000) } } });
  return located.length;
}

async function savePlaces(source: DiscoverSource, region: Region, places: NormalizedPlace[]) {
  const keep = new Set(places.map(p => p.externalId));
  for (const p of places) {
    const { externalId, ...data } = withCoords(p, region);
    await prisma.discoverPlace.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId } },
      create: { ...data, externalId, sourceId: source.id, region, state: 'published' },
      update: data,
    });
  }
  await prisma.discoverPlace.deleteMany({ where: { sourceId: source.id, externalId: { notIn: [...keep] }, state: { not: 'hidden' } } });
  return places.length;
}

export async function syncSource(source: DiscoverSource): Promise<{ count: number } | { error: string }> {
  if (source.status !== 'active' || !source.region) return { error: 'Source inactive' };
  const region = source.region as Region;
  const from = new Date();
  const to = new Date(from.getTime() + EVENT_WINDOW_DAYS * 24 * 3600e3);
  try {
    let count = 0;
    if (source.type === 'openagenda') count = await saveEvents(source, region, await fetchOpenAgenda(source.config as unknown as OpenAgendaConfig, from, to));
    else if (source.type === 'ical') count = await saveEvents(source, region, await fetchIcal(source.config as unknown as IcalConfig, from, to));
    else if (source.type === 'eventfrog') count = await saveEvents(source, region, await fetchEventfrog(source.config as unknown as EventfrogConfig, from, to), true, { removeMissing: true, needCoords: true });
    else if (source.type === 'geneversleep') count = await saveEvents(source, region, await fetchGeneverSleep(source.config as unknown as GeneverSleepConfig, from, to), true);
    else if (source.type === 'osm') count = await savePlaces(source, region, await fetchOsmPlaces(source.config as unknown as OsmConfig));
    else return { error: 'Cette source ne se synchronise pas' };
    await prisma.discoverSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date(), lastError: null, lastCount: count } });
    discoverCache.clear();
    return { count };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await prisma.discoverSource.update({ where: { id: source.id }, data: { lastError: msg } });
    console.error('[discover sync]', source.key, msg);
    return { error: msg };
  }
}

// Tâche planifiée : chaque source active dont la dernière synchronisation est trop ancienne
// Une seule tournée à la fois (26 cantons OpenStreetMap peuvent prendre plus d'une heure si Overpass est chargé), au plus
// 8 cantons par tournée et une pause entre deux pour ménager le service public
let syncing = false;
const OSM_PER_RUN = 8;
export async function syncDueSources() {
  if (syncing) return;
  syncing = true;
  try {
    const sources = await prisma.discoverSource.findMany({ where: { status: 'active', type: { in: ['openagenda', 'ical', 'osm', 'geneversleep', 'eventfrog'] } }, orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } } });
    let osm = 0;
    for (const s of sources) {
      const every = s.type === 'osm' ? PLACE_SYNC_MS : s.type === 'geneversleep' ? GNS_SYNC_MS : EVENT_SYNC_MS;
      if (s.lastSyncAt && Date.now() - s.lastSyncAt.getTime() < every) continue;
      if (s.type === 'osm') {
        if (osm >= OSM_PER_RUN) continue;
        if (osm++ > 0) await new Promise(r => setTimeout(r, 20_000));
      }
      await syncSource(s);
    }
    await cleanPastEvents();
  } finally { syncing = false; }
}

// Événements terminés : effacés le lendemain
export async function cleanPastEvents() {
  const limit = new Date(Date.now() - 24 * 3600e3);
  await prisma.discoverEvent.deleteMany({ where: { OR: [{ endAt: { lt: limit } }, { endAt: null, startAt: { lt: limit } }] } });
  discoverCache.clear();
}

// Cache des réponses publiques (GET /api/discover), vidé à chaque changement
export const discoverCache = new Map<string, { at: number; body: unknown }>();
