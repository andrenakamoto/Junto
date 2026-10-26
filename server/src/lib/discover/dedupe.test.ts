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
  it('une date couverte par le même événement sur plusieurs jours d’une autre source disparaît', () => {
    const run = ev('a', 'ge', '2026-10-26T17:30:00Z', { multiDay: true, endAt: new Date('2026-11-15T20:00:00Z') });
    const out = dedupeEvents([run, ev('b', 'ef', '2026-11-03T17:30:00Z'), ev('c', 'ef', '2026-11-20T17:30:00Z')], s => types[s]);
    expect(out.map(e => e.id)).toEqual(['a', 'c']);
  });
  it('garde ce qui diffère : autre jour, autre lieu, même source', () => {
    const far = ev('b', 'ef', '2026-11-07T17:30:00Z', { latitude: 46.52, longitude: 6.63, city: 'Lausanne' });
    expect(dedupeEvents([ev('a', 'ge', '2026-11-07T18:00:00Z'), far], s => types[s])).toHaveLength(2);
    expect(dedupeEvents([ev('a', 'ef', '2026-11-07T18:00:00Z'), ev('b', 'ef', '2026-11-07T20:00:00Z')], s => types[s])).toHaveLength(2);
  });
});
