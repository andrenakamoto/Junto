import { describe, it, expect } from 'vitest';
import { dedupeEvents } from './dedupe';

const ev = (id: string, sourceId: string, start: string, extra: Partial<any> = {}) => ({
  id, sourceId, title: 'Spectacle son et lumière : « Intelligences en mouvement »', startAt: new Date(start), endAt: null, multiDay: false,
  city: 'Genève', latitude: 46.199, longitude: 6.151, ...extra,
});
const types: Record<string, string> = { ge: 'openagenda', ef: 'eventfrog' };

describe('doublons entre sources', () => {
  it('même titre, même jour, même endroit : la source la plus sûre reste', () => {
    const out = dedupeEvents([ev('b', 'ef', '2026-11-07T17:30:00Z'), ev('a', 'ge', '2026-11-07T18:00:00Z')], s => types[s]);
    expect(out.map(e => e.id)).toEqual(['a']);
  });
  it('l’annonce avec photo passe devant ; la série sur plusieurs jours qui couvre ses dates disparaît', () => {
    const run = ev('a', 'ge', '2026-10-26T17:30:00Z', { title: 'Intelligences en mouvement', multiDay: true, endAt: new Date('2026-11-15T20:00:00Z') });
    const nights = ['2026-10-28T17:30:00Z', '2026-10-29T17:30:00Z'].map((d, i) => ev(`n${i}`, 'ef', d, { imageKey: 'k' }));
    const out = dedupeEvents([run, ...nights], s => types[s]);
    expect(out.map(e => e.id)).toEqual(['n0', 'n1']);
  });
  it('une date couverte par le même événement sur plusieurs jours d’une autre source disparaît', () => {
    const run = ev('a', 'ge', '2026-10-26T17:30:00Z', { multiDay: true, endAt: new Date('2026-11-15T20:00:00Z') });
    const out = dedupeEvents([run, ev('b', 'ef', '2026-11-03T17:30:00Z'), ev('c', 'ef', '2026-11-20T17:30:00Z')], s => types[s]);
    expect(out.map(e => e.id)).toEqual(['a', 'c']);
  });
  it('un titre contenu dans l’autre compte comme le même événement', () => {
    const run = ev('a', 'ge', '2026-10-26T17:30:00Z', { title: 'Intelligences en mouvement', multiDay: true, endAt: new Date('2026-11-15T20:00:00Z') });
    const out = dedupeEvents([run, ev('b', 'ef', '2026-10-28T17:30:00Z')], s => types[s]);
    expect(out.map(e => e.id)).toEqual(['a']);
    expect(out[0].aliases).toEqual(['Spectacle son et lumière : « Intelligences en mouvement »']);
    expect(dedupeEvents([ev('a', 'ge', '2026-10-28T17:30:00Z', { title: 'Jazz' }), ev('b', 'ef', '2026-10-28T19:00:00Z', { title: 'Jazz au parc' })], s => types[s])).toHaveLength(2);
  });
  it('garde ce qui diffère : autre jour, autre lieu, même source', () => {
    const far = ev('b', 'ef', '2026-11-07T17:30:00Z', { latitude: 46.52, longitude: 6.63, city: 'Lausanne' });
    expect(dedupeEvents([ev('a', 'ge', '2026-11-07T18:00:00Z'), far], s => types[s])).toHaveLength(2);
    expect(dedupeEvents([ev('a', 'ef', '2026-11-07T18:00:00Z'), ev('b', 'ef', '2026-11-07T20:00:00Z')], s => types[s])).toHaveLength(2);
  });
});
