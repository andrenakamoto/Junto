import { XMLParser } from 'fast-xml-parser';
import prisma from './prisma';
import { notifyUser } from './push';

// Transports publics (rubrique Trajets) : horaires de tous les transports publics suisses (CFF, bus et trams
// urbains comme les TPG, Léman Express…) via l'API officielle **OJP 2.0** d'opentransportdata.swiss (données en
// Suisse). Appelée depuis le serveur seulement, avec la clé OJP_API_KEY (/etc/evly/app.env, jamais dans le dépôt) et
// un cache de quelques minutes. Les arrêts se choisissent dans une liste (recherche par nom).

const API = 'https://api.opentransportdata.swiss/ojp20';
const CACHE_MS = 5 * 60 * 1000;
export const TRANSIT_REMINDER_BEFORE_MS = 30 * 60 * 1000;
// Arrivée visée : 10 minutes avant le début du Plan
export const ARRIVE_EARLY_MS = 10 * 60 * 1000;
export const NOTE_MAX = 200;
export const STOP_NAME_MAX = 120;

export type Stop = { id: string; name: string; kind: string | null };
export type Leg = { kind: 'walk' | 'bus' | 'tram' | 'train' | 'boat' | 'other'; line: string | null; direction: string | null; from: string; to: string; platform: string | null; departureAt: string | null; arrivalAt: string | null; walkMinutes: number | null };
export type Connection = { departureAt: string; arrivalAt: string; minutes: number; transfers: number; legs: Leg[] };

export const ojpParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, isArray: name => ['PlaceResult', 'TripResult', 'Leg', 'Mode'].includes(name) });
const cache = new Map<string, { at: number; data: any }>();

const xmlEscape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));

function envelope(body: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?><OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0"><OJPRequest><siri:ServiceRequest><siri:RequestTimestamp>${now}</siri:RequestTimestamp><siri:RequestorRef>EvLY</siri:RequestorRef>${body.replace('{now}', now)}</siri:ServiceRequest></OJPRequest></OJP>`;
}

async function ojp(body: string): Promise<any> {
  const hit = cache.get(body);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const key = process.env.OJP_API_KEY;
  if (!key) throw new Error('OJP_API_KEY absente');
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/xml', Accept: 'application/xml' },
    body: envelope(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`OJP ${r.status}`);
  const data = ojpParser.parse(await r.text());
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(body, { at: Date.now(), data });
  return data;
}

// Date et heure suisses (AAAA-MM-JJ, HH:MM)
export function zurichDateTime(d: Date): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Texte d'un élément OJP (<X><Text>…</Text></X>)
const text = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  const t = v.Text ?? v['#text'];
  return t == null ? null : typeof t === 'object' ? String(t['#text'] ?? '') : String(t);
};

// Ligne lisible : « Bus 9 », « Tram 12 », « IR 90 », « RL5 »
export function lineOf(ptMode: string | null | undefined, published: string | null | undefined, category: string | null | undefined): { kind: Leg['kind']; line: string | null } {
  const pub = (published ?? '').trim();
  const mode = (ptMode ?? '').trim();
  if (mode === 'bus' || mode === 'trolleyBus' || mode === 'coach') return { kind: 'bus', line: pub ? `Bus ${pub}` : 'Bus' };
  if (mode === 'tram') return { kind: 'tram', line: pub ? `Tram ${pub}` : 'Tram' };
  if (mode === 'water') return { kind: 'boat', line: pub ? `${category ?? 'BAT'} ${pub}`.trim() : category ?? 'BAT' };
  const cat = (category ?? '').trim();
  const line = /^\d+$/.test(pub) && cat ? `${cat} ${pub}` : pub || cat || null;
  if (mode === 'rail' || mode === 'metro' || mode === 'urbanRail') return { kind: 'train', line };
  return { kind: 'other', line };
}

// Durée ISO (PT1H23M) en minutes
export function isoMinutes(d: string | null | undefined): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d ?? '');
  return m ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

export function parseStops(data: any): Stop[] {
  const results = data?.OJP?.OJPResponse?.ServiceDelivery?.OJPLocationInformationDelivery?.PlaceResult ?? [];
  return results.flatMap((r: any): Stop[] => {
    const sp = r?.Place?.StopPlace;
    const id = sp?.StopPlaceRef;
    const name = text(sp?.StopPlaceName);
    if (!id || !name) return [];
    const modes = (r.Place.Mode ?? []).map((m: any) => m?.PtMode);
    const kind = modes.includes('tram') ? 'tram' : modes.includes('rail') ? 'train' : modes.includes('water') ? 'ship' : 'bus';
    return [{ id: String(id), name, kind }];
  });
}

export function parseConnections(data: any): Connection[] {
  const results = data?.OJP?.OJPResponse?.ServiceDelivery?.OJPTripDelivery?.TripResult ?? [];
  return results.flatMap((r: any): Connection[] => {
    const trip = r?.Trip;
    if (!trip?.StartTime || !trip?.EndTime) return [];
    const legs: Leg[] = (trip.Leg ?? []).flatMap((l: any): Leg[] => {
      if (l.TimedLeg) {
        const t = l.TimedLeg, s = t.Service ?? {};
        const { kind, line } = lineOf(s.Mode?.[0]?.PtMode, text(s.PublishedServiceName) ?? s.PublicCode, text(s.ProductCategory?.ShortName));
        return [{
          kind, line, direction: text(s.DestinationText),
          from: text(t.LegBoard?.StopPointName) ?? '', to: text(t.LegAlight?.StopPointName) ?? '',
          platform: text(t.LegBoard?.EstimatedQuay) ?? text(t.LegBoard?.PlannedQuay),
          departureAt: t.LegBoard?.ServiceDeparture?.TimetabledTime ?? null, arrivalAt: t.LegAlight?.ServiceArrival?.TimetabledTime ?? null, walkMinutes: null,
        }];
      }
      const w = l.TransferLeg ?? l.ContinuousLeg;
      if (!w) return [];
      return [{ kind: 'walk', line: null, direction: null, from: text(w.LegStart?.Name) ?? '', to: text(w.LegEnd?.Name) ?? '', platform: null, departureAt: null, arrivalAt: null, walkMinutes: Math.max(1, isoMinutes(w.Duration ?? l.Duration)) }];
    });
    return [{ departureAt: trip.StartTime, arrivalAt: trip.EndTime, minutes: isoMinutes(trip.Duration), transfers: Number(trip.Transfers ?? 0), legs }];
  });
}

export async function searchStops(query: string): Promise<Stop[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const data = await ojp(`<OJPLocationInformationRequest><siri:RequestTimestamp>{now}</siri:RequestTimestamp><InitialInput><Name>${xmlEscape(q)}</Name></InitialInput><Restrictions><Type>stop</Type><NumberOfResults>8</NumberOfResults></Restrictions></OJPLocationInformationRequest>`);
  return parseStops(data).slice(0, 8);
}

// Correspondances pour arriver avant `at` (isArrival) ou partir après `at`
export async function fetchConnections(fromId: string, toId: string, at: Date, isArrival: boolean, limit = 4): Promise<Connection[]> {
  const when = `<DepArrTime>${at.toISOString().replace(/\.\d{3}Z$/, 'Z')}</DepArrTime>`;
  const place = (id: string, withTime: boolean) => `<PlaceRef><StopPlaceRef>${xmlEscape(id)}</StopPlaceRef><Name><Text>${xmlEscape(id)}</Text></Name></PlaceRef>${withTime ? when : ''}`;
  const data = await ojp(`<OJPTripRequest><siri:RequestTimestamp>{now}</siri:RequestTimestamp><Origin>${place(fromId, !isArrival)}</Origin><Destination>${place(toId, isArrival)}</Destination><Params><NumberOfResults>${limit}</NumberOfResults><IncludeIntermediateStops>false</IncludeIntermediateStops></Params></OJPTripRequest>`);
  return parseConnections(data);
}

// Dernière correspondance de la nuit de l'événement : le dernier départ avant 5 h du matin
export function lastBefore(connections: Connection[], limit: Date): Connection | null {
  const ok = connections.filter(c => new Date(c.departureAt).getTime() < limit.getTime());
  return ok.length ? ok.reduce((a, b) => (new Date(b.departureAt) > new Date(a.departureAt) ? b : a)) : null;
}

export async function fetchLastConnection(fromId: string, toId: string, eventDay: Date): Promise<Connection | null> {
  const { date } = zurichDateTime(eventDay);
  const next = new Date(new Date(`${date}T12:00:00Z`).getTime() + 24 * 3600 * 1000);
  const nextDate = zurichDateTime(next).date;
  const limit = new Date(`${nextDate}T05:00:00${zurichOffset(next)}`);
  // Après minuit d'abord (bus de nuit), sinon le soir même
  const late = await fetchConnections(fromId, toId, new Date(`${nextDate}T00:00:00${zurichOffset(next)}`), false, 10);
  const night = lastBefore(late, limit);
  if (night) return night;
  const evening = await fetchConnections(fromId, toId, new Date(`${date}T22:30:00${zurichOffset(eventDay)}`), false, 10);
  return lastBefore(evening, limit);
}

// Décalage horaire suisse d'une date (+01:00 ou +02:00)
export function zurichOffset(d: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', timeZoneName: 'shortOffset' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = /GMT([+-])(\d+)/.exec(name);
  return m ? `${m[1]}${m[2].padStart(2, '0')}:00` : '+01:00';
}

// Texte des lignes d'un voyage partagé : « Bus 9 › Tram 12 »
export function linesText(legs: Leg[]): string {
  return legs.filter(l => l.kind !== 'walk' && l.line).map(l => l.line).join(' › ').slice(0, 120);
}

// Étapes d'une correspondance envoyée par le client, nettoyées avant d'être gardées avec un voyage partagé
const LEG_KINDS = ['walk', 'bus', 'tram', 'train', 'boat', 'other'] as const;
export function sanitizeLegs(v: unknown): Leg[] {
  if (!Array.isArray(v)) return [];
  const str = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);
  const date = (x: unknown) => (typeof x === 'string' && !isNaN(new Date(x).getTime()) ? new Date(x).toISOString() : null);
  return v.slice(0, 12).flatMap((l: any): Leg[] => {
    if (!l || typeof l !== 'object' || !LEG_KINDS.includes(l.kind)) return [];
    const walkMinutes = typeof l.walkMinutes === 'number' && l.walkMinutes > 0 ? Math.min(Math.round(l.walkMinutes), 600) : null;
    return [{ kind: l.kind, line: str(l.line, 40), direction: str(l.direction, STOP_NAME_MAX), from: str(l.from, STOP_NAME_MAX) ?? '', to: str(l.to, STOP_NAME_MAX) ?? '', platform: str(l.platform, 20), departureAt: date(l.departureAt), arrivalAt: date(l.arrivalAt), walkMinutes }];
  });
}

export function parseStop(v: unknown): { id: string; name: string } | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return undefined;
  const { id, name } = v as any;
  if (typeof id !== 'string' || typeof name !== 'string' || !/^[0-9A-Za-z:_-]{1,40}$/.test(id) || !name.trim()) return undefined;
  return { id, name: name.trim().slice(0, STOP_NAME_MAX) };
}

export function departureReminderText(g: { lines: string; departureAt: Date; fromName: string; platform: string | null }): string {
  const time = new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(g.departureAt);
  return g.platform
    ? `🚌 Départ à ${time} : ${g.lines}, ${g.fromName} (quai ${g.platform})`
    : `🚌 Départ à ${time} : ${g.lines}, ${g.fromName}`;
}

// Rappel 30 minutes avant un voyage partagé, à chacun de ses membres (toutes les 5 minutes, gated comme les crons)
export async function sendTransitReminders(io: any) {
  try {
    const now = Date.now();
    const due = await prisma.transitGroup.findMany({
      where: { reminderSentAt: null, departureAt: { gt: new Date(now), lte: new Date(now + TRANSIT_REMINDER_BEFORE_MS) }, plan: { archived: false } },
      include: { plan: { select: { id: true, title: true, circleId: true } }, members: { select: { userId: true } } },
    });
    for (const g of due) {
      const claimed = await prisma.transitGroup.updateMany({ where: { id: g.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
      if (!claimed.count) continue;
      for (const { userId } of g.members) {
        notifyUser(io, userId, { type: 'transit_reminder', planId: g.plan.id, planTitle: g.plan.title, circleId: g.plan.circleId, preview: departureReminderText(g) });
      }
    }
  } catch (e) {
    console.error('[transit reminders]', e);
  }
}
