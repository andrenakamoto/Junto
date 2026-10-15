import { describe, expect, it } from 'vitest';
import { isPlanEnded, planDeletionAt, planRouterLock, PLAN_GRACE_MS } from './planLifecycle';

describe('fin d’un Plan', () => {
  it('terminé à sa date de fin, supprimé 24 h après', () => {
    const end = new Date('2026-10-20T22:00:00Z');
    expect(isPlanEnded(end, new Date('2026-10-20T21:59:00Z'))).toBe(false);
    expect(isPlanEnded(end, new Date('2026-10-20T22:00:00Z'))).toBe(true);
    expect(planDeletionAt(end).getTime() - end.getTime()).toBe(PLAN_GRACE_MS);
  });
  it('écritures encore permises sur un Plan terminé', () => {
    const { allow, fromPath } = planRouterLock;
    expect(allow('PUT', ['p1'])).toBe(true);          // repousser la fin
    expect(allow('DELETE', ['p1'])).toBe(true);
    expect(allow('POST', ['p1', 'vote-delete'])).toBe(true);
    expect(allow('POST', ['p1', 'seen'])).toBe(true);
    expect(allow('PUT', ['p1', 'rsvp'])).toBe(false);
    expect(allow('POST', ['p1', 'expenses'])).toBe(false);
    expect(allow('DELETE', ['expenses', 'e1'])).toBe(false);
    expect(fromPath(['p1', 'quiz', 'answer'])).toBe('p1');
  });
});
