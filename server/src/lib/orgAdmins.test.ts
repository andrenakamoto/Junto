import { describe, expect, it } from 'vitest';
import { ADMIN_VOTE_DELAY_MS, canVoteOnRemoval, removalExpired, removalThreshold, REMOVAL_TTL_MS } from './orgAdmins';

describe('retrait d’un administrateur', () => {
  it('jamais seul : au moins 2 voix', () => {
    expect(removalThreshold(0)).toBeNull();
    expect(removalThreshold(1)).toBeNull(); // 2 administrateurs : l'un ne peut pas sortir l'autre
    expect(removalThreshold(2)).toBe(2);
    expect(removalThreshold(3)).toBe(2);
  });
  it('majorité des autres administrateurs', () => {
    expect(removalThreshold(4)).toBe(3); // 5 administrateurs : 3 voix parmi les 4 autres
    expect(removalThreshold(5)).toBe(3);
    expect(removalThreshold(6)).toBe(4);
  });
  it('un administrateur nommé depuis moins de 7 jours ne vote pas', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    expect(canVoteOnRemoval(new Date(now.getTime() - ADMIN_VOTE_DELAY_MS + 1000), now)).toBe(false);
    expect(canVoteOnRemoval(new Date(now.getTime() - ADMIN_VOTE_DELAY_MS), now)).toBe(true);
    expect(canVoteOnRemoval(null, now)).toBe(true);
  });
  it('une demande sans majorité s’efface après 14 jours', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    expect(removalExpired(new Date(now.getTime() - REMOVAL_TTL_MS + 1000), now)).toBe(false);
    expect(removalExpired(new Date(now.getTime() - REMOVAL_TTL_MS - 1000), now)).toBe(true);
  });
});
