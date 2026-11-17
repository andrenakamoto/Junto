import { describe, it, expect } from 'vitest';
import { parseSantaInput, santaExpiry } from './santaOnline';

describe('Secret Santa en ligne', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  it('garde les prénoms, ignore les lignes vides, vérifie les emails', () => {
    const r = parseSantaInput({ people: [{ name: ' Léa ' }, { name: '' }, { name: 'Tom', email: 'TOM@ex.ch' }, { name: 'Noah' }], exclusions: [[0, 2], [0, 0], [1, 9]] }, now);
    expect('data' in r && r.data.people).toEqual([{ name: 'Léa', email: null }, { name: 'Tom', email: 'tom@ex.ch' }, { name: 'Noah', email: null }]);
    expect('data' in r && r.data.exclusions).toEqual([[0, 2]]);
    expect('data' in r && r.data.title).toBe('Secret Santa');
  });
  it('refuse trop peu de monde, des doublons, un email faux, une date passée', () => {
    expect(parseSantaInput({ people: [{ name: 'A' }, { name: 'B' }] }, now)).toHaveProperty('error');
    expect(parseSantaInput({ people: [{ name: 'Léa' }, { name: 'léa' }, { name: 'C' }] }, now)).toHaveProperty('error');
    expect(parseSantaInput({ people: [{ name: 'A', email: 'pas-un-email' }, { name: 'B' }, { name: 'C' }] }, now)).toHaveProperty('error');
    expect(parseSantaInput({ people: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], exchangeDate: '2026-10-01' }, now)).toHaveProperty('error');
    expect(parseSantaInput({ people: { name: 'A' } }, now)).toHaveProperty('error');
  });
  it('efface 30 jours après l’échange, sinon 60 jours après la création', () => {
    expect(santaExpiry(new Date('2026-12-24T00:00:00Z'), now).toISOString()).toBe('2027-01-23T00:00:00.000Z');
    expect(santaExpiry(null, now).toISOString()).toBe('2027-01-16T10:00:00.000Z');
  });
});
