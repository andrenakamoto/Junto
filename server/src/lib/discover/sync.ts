import prisma from '../prisma';
import type { DiscoverSource } from '@prisma/client';
import { fetchOpenAgenda, OpenAgendaConfig } from './openagenda';
import { fetchOsmPlaces, OsmConfig } from './osm';
import { fetchIcal, IcalConfig } from './ical';
import { fetchGeneverSleep, GeneverSleepConfig } from './geneversleep';
import type { NormalizedEvent, NormalizedPlace, Region } from './model';
import { withCoords } from './geo';

// Synchronisation des sources actives (tâche planifiée, protégée comme les autres, et bouton du panneau admin).
// Événements : les 30 prochains jours ; une ligne supprimée chez la source disparaît, une ligne masquée par l'admin
// reste masquée. Lieux : remplacés à chaque synchronisation, sauf ceux masqués.

export const EVENT_WINDOW_DAYS = 30;
const EVENT_SYNC_MS = 12 * 3600e3;      // agendas : deux fois par jour
const PLACE_SYNC_MS = 7 * 24 * 3600e3;  // OpenStreetMap : une fois par semaine
const GNS_SYNC_MS = 2 * 3600e3;         // GeNEVERsleep : toutes les 2 h (leur recommandation : 1 à 3 h)

async function saveEvents(source: DiscoverSource, region: Region, events: NormalizedEvent[]) {
  const now = new Date();
  const keep = new Set(events.map(e => e.externalId));
  for (const e of events) {
    const { externalId, ...data } = withCoords(e, region);
    await prisma.discoverEvent.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId } },
      create: { ...data, externalId, sourceId: source.id, region, state: source.autoPublish ? 'published' : 'pending' },
      update: data, // l'état (publié, à valider, masqué) choisi dans le panneau admin est gardé
    });
  }
  // Retirés chez la source (seulement les événements à venir : le passé est effacé par cleanPastEvents)
  await prisma.discoverEvent.deleteMany({ where: { sourceId: source.id, externalId: { notIn: [...keep] }, startAt: { gte: now } } });
  return events.length;
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
    else if (source.type === 'geneversleep') count = await saveEvents(source, region, await fetchGeneverSleep(source.config as unknown as GeneverSleepConfig, from, to));
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
export async function syncDueSources() {
  const sources = await prisma.discoverSource.findMany({ where: { status: 'active', type: { in: ['openagenda', 'ical', 'osm', 'geneversleep'] } } });
  for (const s of sources) {
    const every = s.type === 'osm' ? PLACE_SYNC_MS : s.type === 'geneversleep' ? GNS_SYNC_MS : EVENT_SYNC_MS;
    if (s.lastSyncAt && Date.now() - s.lastSyncAt.getTime() < every) continue;
    await syncSource(s);
  }
  await cleanPastEvents();
}

// Événements terminés : effacés le lendemain
export async function cleanPastEvents() {
  const limit = new Date(Date.now() - 24 * 3600e3);
  await prisma.discoverEvent.deleteMany({ where: { OR: [{ endAt: { lt: limit } }, { endAt: null, startAt: { lt: limit } }] } });
  discoverCache.clear();
}

// Cache des réponses publiques (GET /api/discover), vidé à chaque changement
export const discoverCache = new Map<string, { at: number; body: unknown }>();
