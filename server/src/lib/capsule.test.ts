import { describe, it, expect } from 'vitest';
import { capsuleExpiresAt, capsuleStage, depositDeadline, oneYearAfter, parseOpenAt } from './capsule';

const day = 24 * 3600e3;
describe('capsule temporelle', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  it('dépôts jusqu’à 7 jours après la fin du Plan', () => {
    expect(depositDeadline(new Date('2026-12-24T23:00:00Z'), now).toISOString()).toBe('2026-12-31T23:00:00.000Z');
    // Plan déjà terminé : 7 jours à partir de maintenant
    expect(depositDeadline(new Date('2026-10-01T00:00:00Z'), now).getTime()).toBe(now.getTime() + 7 * day);
  });
  it('date d’ouverture : après la fin des dépôts, dans l’année au plus', () => {
    const until = new Date('2026-12-31T23:00:00Z');
    expect(parseOpenAt('2027-06-30T10:00:00Z', until)?.toISOString()).toBe('2027-06-30T10:00:00.000Z');
    expect(parseOpenAt('2027-12-31T23:00:00Z', until)?.toISOString()).toBe('2027-12-31T23:00:00.000Z');
    expect(parseOpenAt('2026-12-31T23:30:00Z', until)).toBeNull();
    expect(parseOpenAt('2028-01-02T00:00:00Z', until)).toBeNull();
    expect(parseOpenAt({ evil: true }, until)).toBeNull();
    expect(parseOpenAt('pas une date', until)).toBeNull();
  });
  it('« dans 1 an » : un an après le début du Plan', () => {
    const start = new Date('2026-12-24T18:00:00Z');
    const until = depositDeadline(new Date('2026-12-24T23:00:00Z'), now);
    const d = oneYearAfter(start, until);
    expect(d.toISOString()).toBe('2027-12-24T18:00:00.000Z');
    expect(parseOpenAt(d.toISOString(), until)).not.toBeNull();
  });
  it('étapes et effacement', () => {
    const c = { depositUntil: new Date('2026-11-10T00:00:00Z'), openAt: new Date('2027-11-10T00:00:00Z'), openedAt: null };
    expect(capsuleStage(c, now)).toBe('open_for_deposits');
    expect(capsuleStage(c, new Date('2026-12-01T00:00:00Z'))).toBe('sealed');
    expect(capsuleStage(c, new Date('2027-11-10T00:00:01Z'))).toBe('opened');
    expect(capsuleExpiresAt(c).toISOString()).toBe('2027-12-10T00:00:00.000Z');
  });
});
