import { describe, it, expect } from 'vitest';
import { isBot, visitDay, fillDays } from './pageVisits';

describe('pageVisits', () => {
  it('écarte les robots et les requêtes sans navigateur', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('facebookexternalhit/1.1')).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe(false);
  });

  it('compte le jour à l\'heure suisse', () => {
    // 23:30 UTC le 28 septembre = 01:30 le 29 à Genève (heure d'été)
    expect(visitDay(new Date('2026-09-28T23:30:00Z')).toISOString()).toBe('2026-09-29T00:00:00.000Z');
    expect(visitDay(new Date('2026-09-28T12:00:00Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('complète les jours sans visite par 0', () => {
    const today = new Date('2026-09-29T00:00:00Z');
    const rows = [{ day: new Date('2026-09-27T00:00:00Z'), count: 4 }, { day: new Date('2026-09-29T00:00:00Z'), count: 2 }];
    expect(fillDays(rows, 3, today)).toEqual([
      { day: '2026-09-27', count: 4 }, { day: '2026-09-28', count: 0 }, { day: '2026-09-29', count: 2 },
    ]);
  });
});
