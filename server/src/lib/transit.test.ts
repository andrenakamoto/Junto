import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isoMinutes, ojpParser as parser, lastBefore, lineOf, linesText, parseConnections, parseStop, parseStops, placeRef, sanitizeLegs, sharedLegs, zurichDateTime, zurichOffset } from './transit';

// Réponses réelles de l'API OJP 2.0 (opentransportdata.swiss), enregistrées le 12 octobre 2026
const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('transports publics', () => {
  it('nomme les lignes', () => {
    expect(lineOf('bus', '9', 'B')).toEqual({ kind: 'bus', line: 'Bus 9' });
    expect(lineOf('tram', '12', 'T')).toEqual({ kind: 'tram', line: 'Tram 12' });
    expect(lineOf('rail', '90', 'IR')).toEqual({ kind: 'train', line: 'IR 90' });
    expect(lineOf('rail', 'RL5', 'R')).toEqual({ kind: 'train', line: 'RL5' });
    expect(lineOf('water', '1', 'BAT')).toEqual({ kind: 'boat', line: 'BAT 1' });
    expect(isoMinutes('PT1H23M')).toBe(83);
    expect(isoMinutes('PT5M')).toBe(5);
  });

  it('lit les arrêts OJP', () => {
    const stops = parseStops(parser.parse(fixture('ojp-stops.xml')));
    expect(stops[0]).toMatchObject({ id: 'ch:1:sloid:87907', name: 'Genève, Plainpalais' });
  });

  it('lit un trajet OJP en bus et tram (TPG)', () => {
    const [c] = parseConnections(parser.parse(fixture('ojp-trip-tpg.xml')));
    expect(c.minutes).toBeGreaterThan(0);
    expect(c.legs.map(l => l.kind)).toEqual(expect.arrayContaining(['tram', 'walk', 'bus']));
    expect(c.legs.find(l => l.kind === 'tram')).toMatchObject({ line: 'Tram 15', platform: 'A', from: 'Genève, Plainpalais' });
    expect(linesText(c.legs)).toMatch(/^Tram 15 › Bus 11/);
  });

  it('lit un trajet OJP en train', () => {
    const [c] = parseConnections(parser.parse(fixture('ojp-trip-train.xml')));
    expect(c.legs.find(l => l.kind === 'train')).toMatchObject({ line: 'RL5' });
  });

  it('trouve le dernier départ avant la limite', () => {
    const c = (dep: string) => ({ departureAt: dep, arrivalAt: dep, minutes: 0, transfers: 0, legs: [] });
    const list = [c('2026-10-18T00:37:00+0200'), c('2026-10-18T01:13:00+0200'), c('2026-10-18T05:30:00+0200')];
    expect(lastBefore(list, new Date('2026-10-18T05:00:00+0200'))?.departureAt).toBe('2026-10-18T01:13:00+0200');
    expect(lastBefore([c('2026-10-18T06:00:00+0200')], new Date('2026-10-18T05:00:00+0200'))).toBeNull();
  });

  it('donne l’heure suisse, été comme hiver', () => {
    expect(zurichDateTime(new Date('2026-10-17T16:30:00Z'))).toEqual({ date: '2026-10-17', time: '18:30' });
    expect(zurichDateTime(new Date('2026-12-17T23:30:00Z'))).toEqual({ date: '2026-12-18', time: '00:30' });
    expect(zurichOffset(new Date('2026-07-01T12:00:00Z'))).toBe('+02:00');
    expect(zurichOffset(new Date('2026-12-01T12:00:00Z'))).toBe('+01:00');
  });

  it('valide un arrêt', () => {
    expect(parseStop({ id: '8587907', name: ' Genève, Plainpalais ' })).toEqual({ id: '8587907', name: 'Genève, Plainpalais' });
    expect(parseStop(null)).toBeNull();
    expect(parseStop({ id: '<script>', name: 'x' })).toBeUndefined();
    expect(parseStop({ id: '1', name: '' })).toBeUndefined();
  });

  it('nettoie les étapes d’un voyage partagé', () => {
    const legs = sanitizeLegs([
      { kind: 'bus', line: 'Bus 1', direction: 'Rive', from: 'Castan', to: 'Rive', platform: 'T', departureAt: '2026-10-17T16:15:00Z', arrivalAt: '2026-10-17T16:27:00Z', walkMinutes: null, extra: 'x' },
      { kind: 'walk', to: 'Rive', walkMinutes: 3 },
      { kind: '<script>' }, null,
    ]);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({ kind: 'bus', line: 'Bus 1', direction: 'Rive', from: 'Castan', to: 'Rive', platform: 'T', departureAt: '2026-10-17T16:15:00.000Z', arrivalAt: '2026-10-17T16:27:00.000Z', walkMinutes: null });
    expect(legs[1]).toMatchObject({ kind: 'walk', walkMinutes: 3, from: '' });
    expect(sanitizeLegs('x')).toEqual([]);
  });

  it('lit les adresses et les lieux', () => {
    const [a] = parseStops(parser.parse(fixture('ojp-addresses.xml')));
    expect(a).toEqual({ id: 'geo:6.14345,46.19419', name: 'Rue de Carouge 50 (Genève)', kind: 'address' });
    expect(parseStop({ id: a.id, name: a.name })).toEqual({ id: a.id, name: a.name });
    expect(parseStop({ id: 'geo:6.1,46.2,<x>', name: 'x' })).toBeUndefined();
  });

  it('cherche un trajet depuis une adresse (coordonnées) ou un arrêt', () => {
    expect(placeRef({ id: 'geo:6.14345,46.19419', name: 'Rue de Carouge 50' })).toContain('<siri:Longitude>6.14345</siri:Longitude><siri:Latitude>46.19419</siri:Latitude>');
    expect(placeRef({ id: 'ch:1:sloid:87907', name: 'Genève, Plainpalais' })).toContain('<StopPlaceRef>ch:1:sloid:87907</StopPlaceRef>');
    expect(placeRef({ id: 'ch:1:sloid:1', name: 'A & B' })).toContain('A &amp; B');
  });

  it('lit un trajet qui part d’une adresse, sans la montrer aux autres', () => {
    const [c] = parseConnections(parser.parse(fixture('ojp-trip-address.xml')));
    expect(c.legs[0]).toMatchObject({ kind: 'walk', from: 'Rue de Carouge 50', walkMinutes: 2 });
    expect(c.legs[1]).toMatchObject({ kind: 'tram', line: 'Tram 18' });
    const shared = sharedLegs(c.legs);
    expect(shared[0].kind).toBe('tram');
    expect(JSON.stringify(shared)).not.toContain('Rue de Carouge');
  });
});
