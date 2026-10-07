import { describe, it, expect } from 'vitest';
import { drawPairs, withoutParticipant, withParticipant, pairKey, santaDateError } from './secretSanta';

// Générateur pseudo-aléatoire reproductible
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ids = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('drawPairs', () => {
  it('chacun offre à une seule personne, jamais à soi-même, un seul grand cercle', () => {
    for (let s = 1; s < 50; s++) {
      const m = drawPairs(ids, new Set(), seeded(s))!;
      expect(m.size).toBe(6);
      expect(new Set(m.values()).size).toBe(6);
      for (const [g, r] of m) expect(g).not.toBe(r);
      // un seul cercle : en suivant les flèches depuis a, on visite tout le monde
      let cur = 'a'; const seen = new Set<string>();
      do { seen.add(cur); cur = m.get(cur)!; } while (cur !== 'a');
      expect(seen.size).toBe(6);
    }
  });
  it('respecte les exclusions, dans les deux sens', () => {
    const ex = new Set([pairKey('a', 'b'), pairKey('c', 'd')]);
    for (let s = 1; s < 50; s++) {
      const m = drawPairs(ids, ex, seeded(s))!;
      for (const [g, r] of m) expect(ex.has(pairKey(g, r))).toBe(false);
    }
  });
  it('refuse moins de 3 personnes ou des exclusions impossibles', () => {
    expect(drawPairs(['a', 'b'], new Set())).toBeNull();
    expect(drawPairs(['a', 'b', 'c'], new Set([pairKey('a', 'b'), pairKey('a', 'c')]))).toBeNull();
  });
});

describe('désistement et arrivée après le tirage', () => {
  const cycle = new Map([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]);
  it('le Père Noël de la personne qui part reprend sa personne', () => {
    const m = withoutParticipant(cycle, 'b');
    expect([...m.entries()].sort()).toEqual([['a', 'c'], ['c', 'd'], ['d', 'a']]);
  });
  it('de trois à deux : les deux restants s’offrent mutuellement ; de deux à un : plus de paire', () => {
    expect([...withoutParticipant(new Map([['a', 'b'], ['b', 'c'], ['c', 'a']]), 'c').entries()].sort()).toEqual([['a', 'b'], ['b', 'a']]);
    expect(withoutParticipant(new Map([['a', 'b'], ['b', 'a']]), 'b').size).toBe(0);
  });
  it('une arrivée s’insère dans une paire existante', () => {
    const m = withParticipant(cycle, 'e', new Set(), seeded(3))!;
    expect(m.size).toBe(5);
    expect(new Set(m.values()).size).toBe(5);
    for (const [g, r] of m) expect(g).not.toBe(r);
  });
});

describe('santaDateError', () => {
  const d = (s: string) => new Date(s);
  it('exige la date de l’échange et une fin après', () => {
    expect(santaDateError(['pere_noel'], null, d('2026-12-21'))).toMatch(/date/);
    expect(santaDateError(['pere_noel'], d('2026-12-20T19:00'), d('2026-12-20T18:00'))).toMatch(/après/);
    expect(santaDateError(['pere_noel'], d('2026-12-20T19:00'), d('2026-12-21T02:00'))).toBeNull();
    expect(santaDateError([], null, d('2026-12-21'))).toBeNull();
  });
});
