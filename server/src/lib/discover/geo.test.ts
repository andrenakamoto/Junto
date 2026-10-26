import { describe, it, expect } from 'vitest';
import { distanceKm, locateCity, locateInText, searchLocalities, withCoords, nearestRegion, boundingBox } from './geo';

describe('geo (Découvrir par lieu et rayon)', () => {
  it('distance Genève – Lausanne ≈ 51 km', () => {
    expect(distanceKm({ lat: 46.2044, lon: 6.1432 }, { lat: 46.5197, lon: 6.6323 })).toBeGreaterThan(48);
    expect(distanceKm({ lat: 46.2044, lon: 6.1432 }, { lat: 46.5197, lon: 6.6323 })).toBeLessThan(54);
  });
  it('situe une ville, sans accents, avec NPA ou canton', () => {
    const nyon = locateCity('Nyon')!;
    expect(nyon.lat).toBeCloseTo(46.38, 1);
    expect(locateCity('1260 Nyon')).toEqual(nyon);
    expect(locateCity('geneve')).not.toBeNull();
    expect(locateCity('Ville inexistante')).toBeNull();
  });
  it('choisit la localité la plus proche quand le nom est ambigu', () => {
    const near = locateCity('Carouge', { lat: 46.2044, lon: 6.1432 })!;
    expect(distanceKm(near, { lat: 46.2044, lon: 6.1432 })).toBeLessThan(5);
  });
  it('trouve une localité citée dans un texte', () => {
    const p = locateInText('Salle communale, 1110 Morges');
    expect(p && distanceKm(p, locateCity('Morges')!)).toBeLessThan(1);
  });
  it('recherche : début de nom d\'abord', () => {
    const r = searchLocalities('nyo');
    expect(r[0].name).toBe('Nyon');
    expect(searchLocalities('n')).toEqual([]);
  });
  it('complète les coordonnées manquantes, garde celles qui existent', () => {
    expect(withCoords({ city: 'Nyon', latitude: null, longitude: null }, 'la').latitude).toBeCloseTo(46.38, 1);
    expect(withCoords({ city: 'Nyon', latitude: 1, longitude: 2 }, 'la').latitude).toBe(1);
    expect(withCoords({ city: null, place: 'Bar inconnu', latitude: null, longitude: null }, 'ge').latitude).toBeNull();
  });
  it('région la plus proche et rectangle', () => {
    expect(nearestRegion(locateCity('Nyon')!)).toBe('ge');
    expect(nearestRegion(locateCity('Montreux')!)).toBe('la');
    const b = boundingBox({ lat: 46.5, lon: 6.6 }, 10);
    expect(b.maxLat - b.minLat).toBeCloseTo(0.18, 2);
  });
});

import { cantonAt, searchAreas } from './geo';
describe('cantons et régions', () => {
  it('canton d’une position', () => {
    expect(cantonAt(46.3887, 6.2357)).toBe('VD');  // Nyon
    expect(cantonAt(46.2044, 6.1432)).toBe('GE');
    expect(cantonAt(46.2208, 7.3612)).toBe('VS');  // Sion
    expect(cantonAt(47.3769, 8.5417)).toBe('ZH');
  });
  it('recherche : canton dans toutes les langues, régions', () => {
    expect(searchAreas('waadt')[0]).toEqual({ kind: 'canton', code: 'VD' });
    expect(searchAreas('vs')[0]).toEqual({ kind: 'canton', code: 'VS' });
    expect(searchAreas('riviera').map(h => h.kind === 'region' && h.name)).toContain('Riviera');
    expect(searchAreas('oberwallis').some(h => h.kind === 'region')).toBe(true);
    expect(searchAreas('x')).toEqual([]);
  });
});
