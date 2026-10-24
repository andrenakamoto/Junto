import { describe, it, expect } from 'vitest';
import { hideReservedList, parseVisibility } from './planAccess';

describe('Cacher à / Réservé à', () => {
  const plan = { creatorId: 'c', visibility: 'reserved', exclusions: [{ userId: 'x' }, { userId: 'y' }] };
  it('envoie la liste des personnes exclues au seul créateur d’un Plan réservé', () => {
    expect(hideReservedList(plan, 'c').exclusions).toHaveLength(2);
    expect(hideReservedList(plan, 'm').exclusions).toEqual([]);
  });
  it('laisse la liste d’un Plan « Cacher à… » (bandeau pour les autres)', () => {
    expect(hideReservedList({ ...plan, visibility: 'hidden' }, 'm').exclusions).toHaveLength(2);
  });
  it('n’accepte que les deux modes', () => {
    expect(parseVisibility('reserved')).toBe('reserved');
    expect(parseVisibility('hidden')).toBe('hidden');
    expect(parseVisibility({ not: 'x' })).toBeUndefined();
  });
});
