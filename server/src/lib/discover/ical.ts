import type { Category, NormalizedEvent } from './model';
import { cleanText, cleanUrl, TITLE_MAX } from './model';

// Connecteur iCal : flux .ics d'une salle ou d'un organisateur qui a donné son accord. Lecture simple des VEVENT
// (SUMMARY, DTSTART, DTEND, LOCATION, URL, UID, STATUS) ; pas de règles de répétition (RRULE) : chaque occurrence
// doit figurer dans le flux.

export interface IcalConfig { url: string; category?: Category; city?: string; family?: boolean }

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

// Date iCal : 20261030T200000Z, 20261030T200000 (heure suisse, TZID ignoré) ou 20261030 (journée)
export function parseIcalDate(v: string): Date | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  // Heure locale suisse : décalage calculé pour la date (heure d'été ou d'hiver)
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const zurich = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (zurich.getTime() - utc.getTime()));
}

export function parseIcal(text: string, cfg: IcalConfig, from: Date, to: Date): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur) {
        const startAt = cur.DTSTART ? parseIcalDate(cur.DTSTART) : null;
        const endAt = cur.DTEND ? parseIcalDate(cur.DTEND) : null;
        const title = cleanText(unescape(cur.SUMMARY ?? ''), TITLE_MAX);
        if (startAt && title && (endAt ?? startAt) >= from && startAt <= to) {
          const multiDay = !!endAt && endAt.getTime() - startAt.getTime() > 26 * 3600e3;
          out.push({
            externalId: cleanText(cur.UID, 200) ?? `${startAt.toISOString()}-${title}`,
            title, place: cleanText(unescape(cur.LOCATION ?? '')), city: cfg.city ?? null, latitude: null, longitude: null,
            category: cfg.category ?? 'animation', family: !!cfg.family, priceText: null,
            status: cur.STATUS === 'CANCELLED' ? 'cancelled' : 'scheduled',
            startAt, endAt, multiDay, dateLabel: null, url: cleanUrl(cur.URL) ?? null,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase();
    if (!(key in cur)) cur[key] = line.slice(i + 1);
  }
  return out;
}

export async function fetchIcal(cfg: IcalConfig, from: Date, to: Date): Promise<NormalizedEvent[]> {
  const res = await fetch(cfg.url, { headers: { 'User-Agent': 'EvLY/1.0 (info@evly.ch)' } });
  if (!res.ok) throw new Error(`iCal ${res.status}`);
  return parseIcal(await res.text(), cfg, from, to);
}
