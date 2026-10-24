import { describe, it, expect } from 'vitest';
import { parsePlanKind, zurichEndOfDay } from './planKinds';

describe('Types de Plan', () => {
  it('n’accepte que les types connus', () => {
    expect(parsePlanKind('pere_noel')).toBe('pere_noel');
    expect(parsePlanKind('autre')).toBeNull();
    expect(parsePlanKind({ not: '' })).toBeNull();
  });
  it('fin de journée à l’heure suisse', () => {
    expect(zurichEndOfDay(new Date('2026-12-24T19:30:00Z')).toISOString()).toBe('2026-12-24T22:59:00.000Z'); // hiver, UTC+1
    expect(zurichEndOfDay(new Date('2026-07-03T21:30:00Z')).toISOString()).toBe('2026-07-03T21:59:00.000Z'); // été, UTC+2
    expect(zurichEndOfDay(new Date('2026-12-24T23:30:00Z')).toISOString()).toBe('2026-12-25T22:59:00.000Z'); // déjà le 25 à Zurich
  });
});
