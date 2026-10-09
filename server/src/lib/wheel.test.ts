import { describe, it, expect } from 'vitest';
import { pickWinner, wheelCandidates } from './wheel';

describe('Qui s’y colle ?', () => {
  const ids = ['ana', 'ben', 'cleo', 'dan'];
  it('retire les personnes retirées volontairement', () => {
    expect(wheelCandidates(ids, ['ben', 'zoe'], [], false)).toEqual({ candidates: ['ana', 'cleo', 'dan'], excluded: ['ben'], skipped: [] });
  });
  it('« pas deux fois la même personne » : les déjà tirés sont mis de côté', () => {
    expect(wheelCandidates(ids, ['ben'], ['cleo', 'ben'], true)).toEqual({ candidates: ['ana', 'dan'], excluded: ['ben'], skipped: ['cleo'] });
    expect(wheelCandidates(ids, [], ['cleo'], false).candidates).toEqual(ids);
  });
  it('tire une des personnes sur la roue', () => {
    expect(pickWinner(['ana', 'ben'], () => 1)).toBe('ben');
    expect(pickWinner([])).toBeNull();
    const seen = new Set(Array.from({ length: 200 }, () => pickWinner(ids)));
    expect(seen.size).toBe(4);
  });
});
