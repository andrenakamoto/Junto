import { describe, it, expect } from 'vitest';
import { attractionKind, normalizeAttraction, normalizeTour, tourKind } from './myswitzerland';
import { dedupePlaces } from './dedupe';

const cls = (o: Record<string, string[]>) => Object.entries(o).map(([name, v]) => ({ name, values: v.map(x => ({ name: x })) }));
const geo = { latitude: 46.2, longitude: 7.3 };

describe('Suisse Tourisme', () => {
  it('range les attractions par type', () => {
    expect(attractionKind({ classification: cls({ sporttype: ['toboggan'] }) })).toBe('luge');
    expect(attractionKind({ classification: cls({ naturetype: ['canyons'], buildingstype: ['bridge'] }) })).toBe('nature');
    expect(attractionKind({ classification: cls({ wellnesstype: ['thermalbaths'] }) })).toBe('bains');
    expect(attractionKind({ classification: cls({ transporttype: ['cablerailway'] }) })).toBe('excursion');
    expect(attractionKind({ classification: cls({ achitekturtyp: ['churches'] }) })).toBe('patrimoine');
    expect(attractionKind({ classification: cls({ seasons: ['summer'] }) })).toBeNull();
  });
  it('garde le lien MySwitzerland et la position', () => {
    const p = normalizeAttraction({ identifier: 'x1', name: 'Gorges', url: 'https://www.myswitzerland.com/fr/x/', geo, address: [{ addressLocality: 'Sion' }],
      classification: cls({ naturetype: ['waterfall'], suitablefortype: ['family'] }) });
    expect(p).toMatchObject({ externalId: 'a:x1', kind: 'nature', city: 'Sion', website: 'https://www.myswitzerland.com/fr/x/', latitude: 46.2, family: true });
    expect(normalizeAttraction({ identifier: 'x2', name: 'Sans lien', geo, classification: cls({ naturetype: ['waterfall'] }) })).toBeNull();
    expect(normalizeAttraction({ identifier: 'x3', name: 'Loin', url: 'https://a.ch', geo: { latitude: 40, longitude: 2 }, classification: cls({ naturetype: ['waterfall'] }) })).toBeNull();
  });
  it('itinéraires : type, distance dans le nom, départ', () => {
    expect(tourKind({ classification: cls({ routestypes: ['snowshoe'] }) })).toBe('raquettes');
    const t = normalizeTour({ identifier: 't1', name: 'Tour du lac', url: 'https://www.myswitzerland.com/fr/r/', geo, specs: { distance: 12.4 },
      itinerary: [{ name: 'Champex' }], classification: cls({ routestypes: ['hike'], requirementconditions: ['easy'] }) });
    expect(t).toMatchObject({ externalId: 't:t1', kind: 'randonnee', name: 'Tour du lac (12 km)', city: 'Champex', family: true });
  });
  it('doublon avec OpenStreetMap : la fiche de Suisse Tourisme reste', () => {
    const rows = [
      { name: 'Les Bains de Saillon', sourceId: 'st', latitude: 46.17, longitude: 7.19 },
      { name: 'Bains de Saillon', sourceId: 'osm', latitude: 46.171, longitude: 7.191 },
      { name: 'Bains de Saillon', sourceId: 'osm', latitude: 46.3, longitude: 7.5 },
      { name: 'Piscine', sourceId: 'osm', latitude: 46.17, longitude: 7.19 },
    ];
    const out = dedupePlaces(rows, id => id === 'st' ? 'myswitzerland' : 'osm');
    expect(out.map(r => r.latitude)).toEqual([46.17, 46.3, 46.17]);
  });
});
