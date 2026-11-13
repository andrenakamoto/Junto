import { describe, expect, it } from 'vitest';
import { availableFor, findConflicts, parseItemInput, whereNow } from './equipment';

const d = (h: number) => new Date(Date.UTC(2026, 10, 20, h));
const bk = (id: string, q: number, s: number, e: number, returned = false, taken = false) =>
  ({ id, quantity: q, startsAt: d(s), endsAt: d(e), returnedAt: returned ? d(e) : null, takenAt: taken ? d(s) : null });

describe('matériel', () => {
  it('lit une fiche', () => {
    expect(parseItemInput({ name: '  Tables  ', quantity: '10', category: 'mobilier' }, true)).toEqual({ data: { name: 'Tables', quantity: 10, category: 'mobilier' } });
    expect('error' in parseItemInput({ name: '' }, true)).toBe(true);
    expect('error' in parseItemInput({ name: 'Sono', quantity: 0 }, true)).toBe(true);
    expect('error' in parseItemInput({ category: 'fusée' }, false)).toBe(true);
  });
  it('calcule la quantité libre', () => {
    const item = { quantity: 10, status: 'ok' };
    const bookings = [bk('a', 6, 8, 12), bk('b', 3, 14, 18), bk('c', 4, 9, 11, true)];
    expect(availableFor(item, bookings, { startsAt: d(10), endsAt: d(15) })).toBe(1);
    expect(availableFor(item, bookings, { startsAt: d(19), endsAt: d(20) })).toBe(10);
    expect(availableFor(item, bookings, { startsAt: d(10), endsAt: d(11) }, 'a')).toBe(10);
    expect(availableFor({ quantity: 10, status: 'repair' }, [], { startsAt: d(1), endsAt: d(2) })).toBe(0);
  });
  it('trouve les conflits', () => {
    const now = d(0);
    const c = findConflicts({ quantity: 10, status: 'ok' }, [bk('a', 6, 8, 12), bk('b', 6, 10, 14), bk('c', 2, 20, 22)], now);
    expect(c).toHaveLength(1);
    expect(c[0].shortBy).toBe(2);
    expect(c[0].bookings.map(b => b.id).sort()).toEqual(['a', 'b']);
    expect(findConflicts({ quantity: 10, status: 'ok' }, [bk('a', 6, 8, 12), bk('b', 4, 10, 14)], now)).toHaveLength(0);
  });
  it('dit où est le matériel', () => {
    const w = whereNow([bk('a', 1, 8, 12, false, true), bk('b', 1, 20, 22), bk('c', 1, 1, 2, true, true)], d(13));
    expect(w.out.map(b => b.id)).toEqual(['a']);
    expect(w.late.map(b => b.id)).toEqual(['a']);
    expect(w.upcoming.map(b => b.id)).toEqual(['b']);
  });
});
