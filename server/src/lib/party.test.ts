import { describe, expect, it } from 'vitest';
import { comingFrom, occupiedFrom, parseCompanionsMax, parsePartySize } from './party';

describe('accompagnants', () => {
  it('lit le réglage du créateur', () => {
    expect(parseCompanionsMax(undefined)).toBeUndefined();
    expect(parseCompanionsMax(0)).toBe(0);
    expect(parseCompanionsMax('5')).toBe(5);
    expect(parseCompanionsMax(21)).toBeNull();
    expect(parseCompanionsMax(1.5)).toBeNull();
    expect(parseCompanionsMax({})).toBeNull();
  });
  it('borne le nombre de personnes', () => {
    expect(parsePartySize(1, 0)).toBe(1);
    expect(parsePartySize(2, 0)).toBeNull();
    expect(parsePartySize(6, 5)).toBe(6);
    expect(parsePartySize(7, 5)).toBeNull();
    expect(parsePartySize(0, 5)).toBeNull();
    expect(parsePartySize('3', 5)).toBe(3);
  });
  it('compte les places et les personnes qui viennent', () => {
    const members = [{ rsvp: 'in', partySize: 3 }, { rsvp: 'maybe', partySize: 2 }, { rsvp: 'out', partySize: 4 }, { rsvp: 'in' }];
    expect(occupiedFrom(members)).toBe(6);
    expect(comingFrom(members)).toBe(4);
  });
});
