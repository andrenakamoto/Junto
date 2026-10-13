import { describe, it, expect } from 'vitest';
import { maskMembers, seesMembers, parseMembersVisibility } from './memberPrivacy';

describe('liste des participants réservée', () => {
  const plan = {
    creatorId: 'c', circleId: 'k', membersVisibility: 'managers', maxParticipants: 10,
    members: [{ userId: 'c', rsvp: 'in' }, { userId: 'a', rsvp: 'in' }, { userId: 'b', rsvp: 'maybe' }, { userId: 'd', rsvp: 'out' }],
    waitlist: [{ userId: 'x', createdAt: 1 }, { userId: 'a2', createdAt: 2 }],
    deleteVotes: [{ userId: 'b' }],
  };
  it('qui voit tout', () => {
    expect(seesMembers(plan, 'c', new Set())).toBe(true);
    expect(seesMembers(plan, 'o', new Set(['k']))).toBe(true);
    expect(seesMembers(plan, 'a', new Set())).toBe(false);
    expect(seesMembers({ ...plan, membersVisibility: 'all' }, 'a', new Set())).toBe(true);
    expect(parseMembersVisibility('managers')).toBe('managers');
    expect(parseMembersVisibility('x')).toBeUndefined();
  });
  it('un participant ne voit que sa réponse et le nombre de places', () => {
    const m = maskMembers(plan, 'a');
    expect(m.members).toEqual([{ userId: 'a', rsvp: 'in' }]);
    expect(m.participantCount).toBe(3);
    expect(m.deleteVotes).toEqual([]);
    expect(m.waitlist).toEqual([{ createdAt: 1, userId: '' }, { createdAt: 2, userId: '' }]);
    expect(maskMembers({ ...plan, maxParticipants: null }, 'a').participantCount).toBeUndefined();
  });
});
