import { describe, it, expect } from 'vitest';
import { cancelPreview } from './planCancel';

describe('Plan annulé', () => {
  it('dit pourquoi le Plan disparaît', () => {
    expect(cancelPreview('deleted', 'andre')).toBe('🚫 Plan annulé par @andre');
    expect(cancelPreview('voted')).toBe('🚫 Plan supprimé par le vote des participants');
    expect(cancelPreview('skipped', 'andre')).toBe('🚫 Annulé cette fois-ci : le Plan suivant est déjà prévu');
    expect(cancelPreview('circle', 'andre')).toBe('🚫 Plan annulé : le Cercle a été supprimé');
  });
});
