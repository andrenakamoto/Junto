import { describe, it, expect } from 'vitest';
import { comparePlans, sortCircles } from './planOrder';

const p = (eventDate: string | null, endDate: string) => ({ eventDate, endDate });

describe('ordre des Plans et des Cercles', () => {
  it('Plans datés du plus proche au plus lointain, sans date à la fin', () => {
    const plans = [p(null, '2026-10-02'), p('2026-10-10', '2026-10-11'), p('2026-10-03', '2026-10-04'), p(null, '2026-10-01')];
    expect([...plans].sort(comparePlans)).toEqual([
      p('2026-10-03', '2026-10-04'), p('2026-10-10', '2026-10-11'), p(null, '2026-10-01'), p(null, '2026-10-02'),
    ]);
  });

  it('Cercles selon leur prochain Plan, ceux sans Plan à la fin dans le même ordre', () => {
    const circles = [
      { name: 'sans plan A', plans: [] },
      { name: 'plus tard', plans: [p('2026-10-20', '2026-10-21')] },
      { name: 'sans date', plans: [p(null, '2026-10-05')] },
      { name: 'bientôt', plans: [p('2026-10-01', '2026-10-02')] },
      { name: 'sans plan B', plans: [] },
    ];
    expect(sortCircles(circles).map(c => c.name)).toEqual(['bientôt', 'plus tard', 'sans date', 'sans plan A', 'sans plan B']);
  });
});

import { compareByActivity, planLastActivity, sortCirclesByActivity } from './planOrder';

describe('ordre par dernière activité', () => {
  it('activité d’un Plan : création ou dernière rubrique modifiée', () => {
    expect(planLastActivity({ createdAt: '2026-10-01T10:00:00Z' }).toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(planLastActivity({ createdAt: '2026-10-01T10:00:00Z', activities: [{ at: '2026-10-05T08:00:00Z' }, { at: '2026-10-03T08:00:00Z' }] }).toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });

  it('Plans : le plus récemment modifié d’abord, puis le plus proche', () => {
    const plans = [
      { id: 'ancien', lastActivityAt: '2026-10-01', eventDate: '2026-10-02', endDate: '2026-10-03' },
      { id: 'recent', lastActivityAt: '2026-10-07', eventDate: '2026-12-01', endDate: '2026-12-02' },
      { id: 'egal-loin', lastActivityAt: '2026-10-05', eventDate: '2026-11-20', endDate: '2026-11-21' },
      { id: 'egal-proche', lastActivityAt: '2026-10-05', eventDate: '2026-10-20', endDate: '2026-10-21' },
    ];
    expect([...plans].sort(compareByActivity).map(p => p.id)).toEqual(['recent', 'egal-proche', 'egal-loin', 'ancien']);
  });

  it('Cercles : la plus récente activité d’abord, ordre conservé à égalité', () => {
    const circles = [{ id: 'a', lastActivityAt: '2026-10-01' }, { id: 'b', lastActivityAt: '2026-10-06' }, { id: 'c', lastActivityAt: null }, { id: 'd', lastActivityAt: '2026-10-06' }];
    expect(sortCirclesByActivity(circles).map(c => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});
