import { describe, it, expect } from 'vitest';
import { deckOrder, finishedCount, isUnanimous, parseMatchUrl, rankOptions, remainingFor, Swipe } from './matchPoll';

const options = [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }, { id: 'o4' }];
const s = (optionId: string, userId: string, like: boolean): Swipe => ({ optionId, userId, like });

describe('match de groupe', () => {
  it('ordre des cartes : mélangé, stable, propre à chacun', () => {
    const a = deckOrder(options, 'ana').map(o => o.id);
    expect(deckOrder(options, 'ana').map(o => o.id)).toEqual(a);
    expect([...a].sort()).toEqual(['o1', 'o2', 'o3', 'o4']);
    const others = ['ben', 'cleo', 'dan', 'eva', 'fred'].map(u => deckOrder(options, u).map(o => o.id).join());
    expect(others.some(o => o !== a.join())).toBe(true);
  });

  it('cartes restantes : celles pas encore jouées', () => {
    expect(remainingFor(options, [s('o1', 'ana', true), s('o3', 'ana', false), s('o2', 'ben', true)], 'ana').map(o => o.id).sort()).toEqual(['o2', 'o4']);
  });

  it('match : oui de tous les joueurs, au moins deux', () => {
    const swipes = [s('o1', 'ana', true), s('o1', 'ben', true), s('o1', 'cleo', true), s('o2', 'ana', true), s('o2', 'ben', false)];
    expect(isUnanimous('o1', ['ana', 'ben', 'cleo'], swipes)).toBe(true);
    expect(isUnanimous('o2', ['ana', 'ben', 'cleo'], swipes)).toBe(false);
    expect(isUnanimous('o1', ['ana', 'ben', 'cleo', 'dan'], swipes)).toBe(false); // Dan n'a pas encore joué
    expect(isUnanimous('o1', ['ana'], swipes)).toBe(false);
  });

  it('joueurs qui ont fini', () => {
    const swipes = ['o1', 'o2'].flatMap(o => [s(o, 'ana', true), s(o, 'ben', false)]).concat(s('o1', 'cleo', true));
    expect(finishedCount(['o1', 'o2'], ['ana', 'ben', 'cleo'], swipes)).toBe(2);
  });

  it('classement : plus de oui, puis moins de non', () => {
    const r = rankOptions(options, [s('o2', 'a', true), s('o2', 'b', true), s('o3', 'a', true), s('o3', 'b', true), s('o3', 'c', false), s('o1', 'a', true)]);
    expect(r.map(o => o.id)).toEqual(['o2', 'o3', 'o1', 'o4']);
    expect(r[0]).toMatchObject({ yes: 2, no: 0 });
  });

  it('liens : seulement http(s)', () => {
    expect(parseMatchUrl('https://damario.ch')).toBe('https://damario.ch');
    expect(parseMatchUrl('')).toBeNull();
    expect(parseMatchUrl('javascript:alert(1)')).toBeUndefined();
  });
});
