import { describe, expect, it } from 'vitest';
import { electionResult, paperBallots, paperRights } from './assembly';

describe('paperRights', () => {
  it('compte les voix des présents sur papier, procurations comprises', () => {
    const mandates = new Map([['a', ['a', 'x']], ['b', ['b']], ['c', ['c']]]);
    expect(paperRights(mandates, new Set(['a', 'c']))).toBe(3);
    expect(paperRights(mandates, new Set())).toBe(0);
  });
});

describe('paperBallots', () => {
  it('vote : un bulletin par voix', () => {
    const rows = paperBallots('vote', { yes: 2, no: 1, abstain: 0 }, 4, 1, []);
    expect(rows).toEqual([{ choice: 'yes', candidateIds: [] }, { choice: 'yes', candidateIds: [] }, { choice: 'no', candidateIds: [] }]);
  });
  it('vote : pas plus que les voix sur papier', () => {
    expect(paperBallots('vote', { yes: 3, no: 2, abstain: 0 }, 4, 1, [])).toEqual({ error: '4 voix sur papier au plus' });
    expect('error' in (paperBallots('vote', { yes: -1, no: 0, abstain: 0 }, 4, 1, []) as any)).toBe(true);
  });
  it('élection : répartit les noms sans doublon ni dépassement des sièges', () => {
    const rows = paperBallots('election', { ballots: 3, votes: { a: 3, b: 2, c: 1 } }, 3, 2, ['a', 'b', 'c']) as any[];
    expect(rows).toHaveLength(3);
    for (const r of rows) { expect(new Set(r.candidateIds).size).toBe(r.candidateIds.length); expect(r.candidateIds.length).toBeLessThanOrEqual(2); }
    const res = electionResult(['a', 'b', 'c'], rows, 2);
    expect(res.ranking).toEqual([{ id: 'a', votes: 3 }, { id: 'b', votes: 2 }, { id: 'c', votes: 1 }]);
  });
  it('élection : bulletins blancs gardés', () => {
    const rows = paperBallots('election', { ballots: 2, votes: { a: 1 } }, 2, 1, ['a']) as any[];
    expect(rows.filter(r => r.candidateIds.length === 0)).toHaveLength(1);
  });
  it('élection : refuse trop de voix', () => {
    expect(paperBallots('election', { ballots: 2, votes: { a: 3 } }, 2, 1, ['a'])).toEqual({ error: 'Un candidat ne peut pas avoir plus de voix que de bulletins' });
    expect(paperBallots('election', { ballots: 2, votes: { a: 2, b: 1 } }, 2, 1, ['a', 'b'])).toEqual({ error: 'Chaque bulletin porte 1 nom au plus' });
  });
});
