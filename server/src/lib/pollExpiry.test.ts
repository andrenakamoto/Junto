import { describe, it, expect } from 'vitest';
import { pollExpiresAt, isPastOption, POLL_MAX_DAYS } from './pollExpiry';

const DAY = 24 * 60 * 60 * 1000;
const created = new Date('2026-10-01T10:00:00Z');
const at = (days: number) => new Date(created.getTime() + days * DAY);

describe('pollExpiresAt', () => {
  it('expire le lendemain de la dernière date proposée', () => {
    expect(pollExpiresAt(created, [at(3), at(10), at(5)])).toEqual(at(11));
  });

  it('plafonne à 30 jours après la création pour des dates lointaines', () => {
    expect(pollExpiresAt(created, [at(60), at(90)])).toEqual(at(POLL_MAX_DAYS));
  });

  it('30 jours sans aucune date', () => {
    expect(pollExpiresAt(created, [null, null])).toEqual(at(POLL_MAX_DAYS));
  });

  it('ignore les options sans date', () => {
    expect(pollExpiresAt(created, [null, at(4)])).toEqual(at(5));
  });
});

describe('isPastOption', () => {
  it('une date passée ne se vote plus, une option sans date reste ouverte', () => {
    expect(isPastOption(at(1), at(2))).toBe(true);
    expect(isPastOption(at(3), at(2))).toBe(false);
    expect(isPastOption(null, at(2))).toBe(false);
  });
});
