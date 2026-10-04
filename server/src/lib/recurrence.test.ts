import { describe, expect, it } from 'vitest';
import { nextOccurrence, parseRecurrence } from './recurrence';

const zurich = (d: Date) => new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' }).format(d);

describe('nextOccurrence', () => {
  it('chaque semaine, même heure', () => {
    expect(zurich(nextOccurrence(new Date('2026-10-05T17:00:00Z'), 'weekly'))).toBe('12.10.26 19:00');
  });
  it('garde 19:00 après le passage à l’heure d’hiver', () => {
    // Lundi 19 octobre 2026 19:00 (heure d'été) → lundi 26 octobre 19:00 (heure d'hiver)
    expect(zurich(nextOccurrence(new Date('2026-10-19T17:00:00Z'), 'weekly'))).toBe('26.10.26 19:00');
  });
  it('garde 19:00 après le passage à l’heure d’été', () => {
    expect(zurich(nextOccurrence(new Date('2027-03-22T18:00:00Z'), 'weekly'))).toBe('29.03.27 19:00');
  });
  it('toutes les 2 semaines', () => {
    expect(zurich(nextOccurrence(new Date('2026-10-05T17:00:00Z'), 'biweekly'))).toBe('19.10.26 19:00');
  });
  it('chaque mois, même jour', () => {
    expect(zurich(nextOccurrence(new Date('2026-10-15T17:30:00Z'), 'monthly'))).toBe('15.11.26 19:30');
  });
  it('chaque mois : 31 janvier → dernier jour de février', () => {
    expect(zurich(nextOccurrence(new Date('2027-01-31T18:00:00Z'), 'monthly'))).toBe('28.02.27 19:00');
  });
  it('décembre → janvier', () => {
    expect(zurich(nextOccurrence(new Date('2026-12-10T18:00:00Z'), 'monthly'))).toBe('10.01.27 19:00');
  });
});

describe('parseRecurrence', () => {
  it('valeurs acceptées', () => {
    expect(parseRecurrence('weekly')).toBe('weekly');
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence('none')).toBeNull();
    expect(parseRecurrence('daily')).toBeUndefined();
  });
});
