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
