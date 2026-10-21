import { describe, it, expect } from 'vitest';
import { groupContacts } from './contacts';

const u = (id: string, firstName: string | null = null) => ({ id, pseudo: id, firstName });
const c = (id: string, name = id) => ({ id, name, color: null });

describe('groupContacts', () => {
  it('une ligne par personne, avec ses Cercles en commun', () => {
    const list = groupContacts([
      { user: u('nadia', 'Nadia'), circle: c('c2', 'Les copains') },
      { user: u('nadia', 'Nadia'), circle: c('c1', 'Boxing') },
      { user: u('nadia', 'Nadia'), circle: c('c1', 'Boxing') },
    ], 'moi');
    expect(list).toHaveLength(1);
    expect(list[0].circles.map(x => x.name)).toEqual(['Boxing', 'Les copains']);
  });

  it('sans soi-même ni les personnes masquées', () => {
    const list = groupContacts([
      { user: u('moi'), circle: c('c1') },
      { user: u('tom'), circle: c('c1') },
      { user: u('lea'), circle: c('c1') },
    ], 'moi', new Set(['tom']));
    expect(list.map(x => x.id)).toEqual(['lea']);
  });

  it('triées par prénom, sans tenir compte des accents ni des majuscules', () => {
    const list = groupContacts([
      { user: u('z', 'Zoé'), circle: c('c1') },
      { user: u('e', 'émile'), circle: c('c1') },
      { user: u('b', null), circle: c('c1') },
    ], 'moi');
    expect(list.map(x => x.id)).toEqual(['b', 'e', 'z']);
  });
});
