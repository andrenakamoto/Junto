import { describe, expect, it } from 'vitest';
import { canProposeToCircles, isAnnoncePlan, parseAllowCirclePlans } from './planSource';

const now = new Date('2026-10-20T12:00:00Z');
const future = new Date('2026-10-25T23:00:00Z');
const past = new Date('2026-10-19T23:00:00Z');

describe('Y aller avec un Cercle', () => {
  it('reconnaît le Mode annonce à la liste réservée', () => {
    expect(isAnnoncePlan({ membersVisibility: 'managers' })).toBe(true);
    expect(isAnnoncePlan({ membersVisibility: 'all' })).toBe(false);
  });

  it('propose un événement en Mode annonce, autorisé et pas terminé', () => {
    expect(canProposeToCircles({ membersVisibility: 'managers', allowCirclePlans: true, endDate: future }, now)).toBe(true);
  });

  it('refuse un Plan ordinaire, un partage coupé ou un événement terminé', () => {
    expect(canProposeToCircles({ membersVisibility: 'all', allowCirclePlans: true, endDate: future }, now)).toBe(false);
    expect(canProposeToCircles({ membersVisibility: 'managers', allowCirclePlans: false, endDate: future }, now)).toBe(false);
    expect(canProposeToCircles({ membersVisibility: 'managers', allowCirclePlans: true, endDate: past }, now)).toBe(false);
  });

  it('lit le réglage seulement s’il est booléen', () => {
    expect(parseAllowCirclePlans(true)).toBe(true);
    expect(parseAllowCirclePlans(false)).toBe(false);
    expect(parseAllowCirclePlans('true')).toBeUndefined();
    expect(parseAllowCirclePlans(undefined)).toBeUndefined();
  });
});
