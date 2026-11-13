import { describe, expect, it } from 'vitest';
import { isOverdue, pendingIds, teamStatus } from './cockpit';

const now = new Date('2026-11-13T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('cockpit', () => {
  it('donne la pastille d’une équipe', () => {
    expect(teamStatus({ upcoming: 0, lastActivityAt: daysAgo(30), responseRate: null }, now)).toBe('quiet');
    expect(teamStatus({ upcoming: 0, lastActivityAt: null, responseRate: null }, now)).toBe('quiet');
    expect(teamStatus({ upcoming: 1, lastActivityAt: daysAgo(30), responseRate: 0.8 }, now)).toBe('watch');
    expect(teamStatus({ upcoming: 2, lastActivityAt: daysAgo(2), responseRate: 0.3 }, now)).toBe('watch');
    expect(teamStatus({ upcoming: 2, lastActivityAt: daysAgo(2), responseRate: 0.7 }, now)).toBe('ok');
    expect(teamStatus({ upcoming: 0, lastActivityAt: daysAgo(5), responseRate: null }, now)).toBe('ok');
  });
  it('compte les personnes sans réponse', () => {
    const audience = ['a', 'b', 'c', 'd', 'e', 'a'];
    expect(pendingIds(audience, new Set(['b']), new Set(['c']), new Set(['d']))).toEqual(['a', 'e']);
  });
  it('repère une échéance dépassée', () => {
    expect(isOverdue('2026-11-12', '2026-11-13')).toBe(true);
    expect(isOverdue('2026-11-13', '2026-11-13')).toBe(false);
    expect(isOverdue(null, '2026-11-13')).toBe(false);
  });
});
