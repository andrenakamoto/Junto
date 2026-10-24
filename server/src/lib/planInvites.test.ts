import { describe, it, expect } from 'vitest';
import { effectiveGuestMode } from './planInvites';

describe('Qui invite des personnes extérieures', () => {
  it('suit la règle du Plan', () => {
    expect(effectiveGuestMode({ guestInviteMode: 'none' })).toBe('none');
    expect(effectiveGuestMode({ guestInviteMode: 'managers' })).toBe('managers');
    expect(effectiveGuestMode({})).toBe('all');
  });
  it('un Plan « Réservé à… » ne s’ouvre à l’extérieur que par l’organisation', () => {
    expect(effectiveGuestMode({ guestInviteMode: 'all', visibility: 'reserved' })).toBe('managers');
    expect(effectiveGuestMode({ guestInviteMode: 'none', visibility: 'reserved' })).toBe('none');
  });
});
