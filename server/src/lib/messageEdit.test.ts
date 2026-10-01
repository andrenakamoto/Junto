import { describe, it, expect } from 'vitest';
import { checkMessageEdit } from './messageEdit';

const now = new Date('2026-10-01T12:00:00Z');
const msg = (minutesAgo: number, extra = {}) => ({ authorId: 'a', createdAt: new Date(now.getTime() - minutesAgo * 60000), deletedAt: null, ...extra });

describe('modification et suppression d\'un message', () => {
  it('autorisé à son auteur pendant 15 minutes', () => {
    expect(checkMessageEdit(msg(14), 'a', now)).toBeNull();
  });
  it('refusé après 15 minutes, à un autre membre, ou sur un message supprimé', () => {
    expect(checkMessageEdit(msg(16), 'a', now)).toMatch(/15 minutes/);
    expect(checkMessageEdit(msg(1), 'b', now)).toMatch(/propres messages/);
    expect(checkMessageEdit(msg(1, { deletedAt: now }), 'a', now)).toMatch(/supprimé/);
    expect(checkMessageEdit(null, 'a', now)).toMatch(/introuvable/);
  });
});
