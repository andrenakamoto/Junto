import { describe, it, expect } from 'vitest';
import { normalizeOpenAgendaEvent } from './openagenda';
import { normalizeOsmElement } from './osm';
import { parseIcal, parseIcalDate } from './ical';
import { categoryOf, normalizeGeneverSleepEvent } from './geneversleep';
import { cleanUrl, isSessionSeries, parseManualEvent, parseProInterest } from './model';

const from = new Date('2026-10-26T00:00:00+01:00');
const to = new Date('2026-11-25T00:00:00+01:00');
const cfg = { agendaUid: 1 };

describe('OpenAgenda', () => {
  const base = { uid: 42, title: { fr: 'Concert au parc' }, location: { name: 'Parc des Bastions', city: 'Genève' }, 'type-devenement': [38], 'publics-cibles': [27], conditions: { fr: 'entrée libre' } };
  it('un événement sur un ou deux jours : une ligne par jour, catégorie et public famille', () => {
    const rows = normalizeOpenAgendaEvent({ ...base, timings: [{ begin: '2026-10-30T20:00:00+01:00', end: '2026-10-30T22:00:00+01:00' }, { begin: '2026-10-31T20:00:00+01:00' }] }, cfg, from, to);
    expect(rows.map(r => r.externalId)).toEqual(['42-2026-10-30', '42-2026-10-31']);
    expect(rows[0]).toMatchObject({ category: 'concert', family: true, priceText: 'entrée libre', place: 'Parc des Bastions', multiDay: false });
  });
  it('trois jours ou plus, ou une exposition : une seule ligne « plusieurs jours »', () => {
    const t = ['26', '27', '28'].map(d => ({ begin: `2026-10-${d}T09:00:00+01:00` }));
    const rows = normalizeOpenAgendaEvent({ ...base, timings: t, dateRange: { fr: '26 - 28 octobre' } }, cfg, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: '42', multiDay: true, dateLabel: '26 - 28 octobre' });
  });
  it('une exposition d’un seul soir (vernissage) n’est pas « sur plusieurs jours »', () => {
    const rows = normalizeOpenAgendaEvent({ ...base, 'type-devenement': [41], timings: [{ begin: '2026-10-28T18:00:00+01:00', end: '2026-10-28T21:00:00+01:00' }], dateRange: { fr: 'Mercredi 28 octobre, 18h00' } }, cfg, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: '42', category: 'expo', multiDay: false, dateLabel: null });
  });
  it('statut annulé, lien d’inscription en priorité, rien hors de la période', () => {
    const rows = normalizeOpenAgendaEvent({ ...base, status: 6, registration: [{ type: 'link', value: 'https://billets.example.ch' }], organisator_url: 'https://org.example.ch', timings: [{ begin: '2026-10-30T20:00:00+01:00' }, { begin: '2027-02-01T20:00:00+01:00' }] }, cfg, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'cancelled', url: 'https://billets.example.ch/' });
  });
});

describe('OpenStreetMap', () => {
  it('garde les lieux avec nom et site web', () => {
    expect(normalizeOsmElement({ type: 'node', id: 1, tags: { name: 'Escape X', leisure: 'escape_game', website: 'escapex.ch' } })).toMatchObject({ kind: 'escape', website: 'https://escapex.ch/', family: false });
    expect(normalizeOsmElement({ type: 'node', id: 2, tags: { name: 'Sans site', leisure: 'bowling_alley' } })).toBeNull();
  });
  it('reconnaît les types ajoutés le 2026-10-24', () => {
    const k = (tags: Record<string, string>) => normalizeOsmElement({ type: 'node', id: 3, tags: { name: 'Lieu', website: 'lieu.ch', ...tags } })?.kind;
    expect(k({ craft: 'winery' })).toBe('cave');
    expect(k({ amenity: 'public_bath' })).toBe('bains');
    expect(k({ leisure: 'sports_centre', sport: 'swimming' })).toBe('piscine');
    expect(k({ historic: 'castle', tourism: 'museum' })).toBe('chateau');
    expect(k({ tourism: 'museum' })).toBe('musee');
    expect(k({ sport: 'axe_throwing' })).toBe('defi');
    expect(k({ leisure: 'garden', 'garden:type': 'botanical' })).toBe('jardin');
    expect(k({ amenity: 'library' })).toBe('bibliotheque');
  });
  it('adresse du lieu', () => {
    const p = normalizeOsmElement({ type: 'node', id: 4, tags: { name: 'Bains', amenity: 'public_bath', website: 'bains.ch',
      'addr:street': 'Quai du Mont-Blanc', 'addr:housenumber': '30', 'addr:postcode': '1201', 'addr:city': 'Genève' } });
    expect(p?.address).toBe('Quai du Mont-Blanc 30, 1201 Genève');
    expect(normalizeOsmElement({ type: 'node', id: 5, tags: { name: 'X', amenity: 'library', website: 'x.ch', 'addr:city': 'Sion' } })?.address).toBeNull();
    expect(normalizeOsmElement({ type: 'node', id: 6, tags: { name: 'Y', amenity: 'library', website: 'y.ch', 'addr:housenumber': '30' } })?.address).toBeNull();
  });
});

describe('iCal', () => {
  it('heure locale suisse, UTC et journée', () => {
    expect(parseIcalDate('20261030T200000Z')!.toISOString()).toBe('2026-10-30T20:00:00.000Z');
    expect(parseIcalDate('20261030T200000')!.toISOString()).toBe('2026-10-30T19:00:00.000Z');
    expect(parseIcalDate('20260715T200000')!.toISOString()).toBe('2026-07-15T18:00:00.000Z');
  });
  it('lit les VEVENT de la période', () => {
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a1\r\nSUMMARY:Soirée salsa\\, live\r\nDTSTART;TZID=Europe/Zurich:20261030T210000\r\nLOCATION:Le Bar\r\nURL:https://bar.example.ch\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a2\r\nSUMMARY:Trop tard\r\nDTSTART:20270301T210000\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const rows = parseIcal(ics, { url: 'x', category: 'danse' }, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: 'a1', title: 'Soirée salsa, live', category: 'danse', place: 'Le Bar' });
  });
});

describe('saisies', () => {
  it('liens http(s) seulement', () => {
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
    expect(cleanUrl('www.evly.ch')).toBe('https://www.evly.ch/');
  });
  it('événement manuel', () => {
    expect(parseManualEvent({ title: 'X', region: 'zz', category: 'concert', startAt: '2026-10-30T20:00' })).toEqual({ error: 'Région invalide' });
    const ok = parseManualEvent({ title: 'Loto', region: 'vs', category: 'animation', startAt: '2026-10-30T20:00:00+01:00', endAt: '2026-11-02T20:00:00+01:00' });
    expect('data' in ok && ok.data.multiDay).toBe(true);
  });
  it('demande d’organisateur', () => {
    expect(parseProInterest({ name: 'Ana', email: 'pas-un-email' })).toEqual({ error: 'Adresse email invalide' });
    expect(parseProInterest({ name: 'Ana', email: 'Ana@Bar.CH ' })).toMatchObject({ data: { email: 'ana@bar.ch' } });
  });
});

describe('GeNEVERsleep', () => {
  const from = new Date('2026-10-24T00:00:00Z'), to = new Date('2026-11-24T00:00:00Z');
  const ev = { id: 'gns-2026-10-24-1579aefe', name: 'Carte blanche', venue: 'La Fonte', city: 'Carouge', city_group: 'Genève',
    start: '2026-10-24T16:00:00+02:00', end: null, url: 'https://geneversleep.ch/soiree/x', categories: ['electronic'], cancelled: false };
  it('reprend un événement de la bonne ville, avec son identifiant stable', () => {
    expect(normalizeGeneverSleepEvent(ev, 'Genève', from, to)).toMatchObject({ externalId: 'gns-2026-10-24-1579aefe', place: 'La Fonte', city: 'Carouge', category: 'soiree', status: 'scheduled' });
    expect(normalizeGeneverSleepEvent(ev, 'Lausanne', from, to)).toBeNull();
    // Source unique (2026-10-25) : tout le flux, quelle que soit la ville
    expect(normalizeGeneverSleepEvent({ ...ev, city_group: 'Lausanne' }, undefined, from, to)?.externalId).toBe('gns-2026-10-24-1579aefe');
  });
  it('sans heure de début : laissé de côté ; annulé : signalé', () => {
    expect(normalizeGeneverSleepEvent({ ...ev, start: null }, 'Genève', from, to)).toBeNull();
    expect(normalizeGeneverSleepEvent({ ...ev, cancelled: true }, 'Genève', from, to)?.status).toBe('cancelled');
  });
  it('style live → concert', () => {
    expect(categoryOf(['jazz'])).toBe('concert');
    expect(categoryOf(['house', 'afro'])).toBe('soiree');
  });
});

describe('plusieurs dates', () => {
  it('une série Eventfrog hors exposition et festival : séances, pas une période continue', () => {
    expect(isSessionSeries({ multiDay: true, category: 'atelier' }, 'eventfrog')).toBe(true);
    expect(isSessionSeries({ multiDay: true, category: 'expo' }, 'eventfrog')).toBe(false);
    expect(isSessionSeries({ multiDay: true, category: 'theatre' }, 'openagenda')).toBe(true);
    expect(isSessionSeries({ multiDay: true, category: 'expo' }, 'openagenda')).toBe(false);
    expect(isSessionSeries({ multiDay: true, category: 'atelier' }, 'manual')).toBe(false);
    expect(isSessionSeries({ multiDay: false, category: 'concert' }, 'eventfrog')).toBe(false);
  });
});
