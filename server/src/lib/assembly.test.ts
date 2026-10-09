import { describe, expect, it } from 'vitest';
import { countVotes, electionResult, isAdopted, parseItemInput, proxyError, quorumRequired, votingRights } from './assembly';

describe('quorum', () => {
  it('aucun, nombre fixe ou pourcentage arrondi vers le haut', () => {
    expect(quorumRequired('none', 10, 40)).toBeNull();
    expect(quorumRequired('count', 15, 40)).toBe(15);
    expect(quorumRequired('percent', 50, 41)).toBe(21);
  });
});

describe('droits de vote', () => {
  const voters = ['a', 'b', 'c', 'd', 'e'];
  it('les présents votent pour eux et pour les procurations valables', () => {
    const r = votingRights(voters, new Set(['a', 'b']), [{ giverId: 'c', holderId: 'a' }, { giverId: 'd', holderId: 'e' }]);
    expect(r.mandates.get('a')).toEqual(['a', 'c']);
    expect(r.mandates.get('b')).toEqual(['b']);
    expect(r.mandates.has('e')).toBe(false);
    expect(r.represented).toBe(3); // a, b + procuration de c (e absente : la procuration de d ne compte pas)
  });
  it('une procuration tombe si la personne qui l’a donnée est présente', () => {
    const r = votingRights(voters, new Set(['a', 'c']), [{ giverId: 'c', holderId: 'a' }]);
    expect(r.mandates.get('a')).toEqual(['a']);
    expect(r.mandates.get('c')).toEqual(['c']);
    expect(r.represented).toBe(2);
  });
  it('un non-votant ne vote pas, même présent', () => {
    const r = votingRights(['a'], new Set(['a', 'z']), [{ giverId: 'z', holderId: 'a' }]);
    expect(r.mandates.get('a')).toEqual(['a']);
    expect(r.mandates.has('z')).toBe(false);
  });
});

describe('procurations', () => {
  const a = { proxiesAllowed: true, maxProxies: 1, openedAt: null, closedAt: null };
  const voters = ['a', 'b', 'c', 'd'];
  it('règles', () => {
    expect(proxyError(a, voters, [], 'a', 'b')).toBeNull();
    expect(proxyError({ ...a, proxiesAllowed: false }, voters, [], 'a', 'b')).toMatch(/pas autorisées/);
    expect(proxyError({ ...a, openedAt: new Date() }, voters, [], 'a', 'b')).toMatch(/ouverte/);
    expect(proxyError(a, voters, [], 'a', 'a')).toMatch(/autre/);
    expect(proxyError(a, voters, [], 'a', 'z')).toMatch(/votants/);
    expect(proxyError(a, voters, [{ giverId: 'c', holderId: 'b' }], 'a', 'b')).toMatch(/maximum 1/);
    expect(proxyError(a, voters, [{ giverId: 'b', holderId: 'c' }], 'a', 'b')).toMatch(/elle-même/);
    expect(proxyError(a, voters, [{ giverId: 'c', holderId: 'a' }], 'a', 'b')).toMatch(/représentes déjà/);
    // Changer de représentant : sa propre procuration ne compte pas dans le maximum
    expect(proxyError(a, voters, [{ giverId: 'a', holderId: 'b' }], 'a', 'b')).toBeNull();
  });
});

describe('résultat d’un vote', () => {
  it('compte les bulletins', () => {
    expect(countVotes([{ choice: 'yes' }, { choice: 'yes' }, { choice: 'no' }, { choice: 'abstain' }, { choice: null }])).toEqual({ yes: 2, no: 1, abstain: 1 });
  });
  it('majorités', () => {
    expect(isAdopted({ yes: 5, no: 4, abstain: 10 }, 'simple')).toBe(true);
    expect(isAdopted({ yes: 5, no: 5, abstain: 0 }, 'simple')).toBe(false);
    expect(isAdopted({ yes: 5, no: 4, abstain: 10 }, 'absolute')).toBe(false);
    expect(isAdopted({ yes: 10, no: 4, abstain: 5 }, 'absolute')).toBe(true);
    expect(isAdopted({ yes: 20, no: 10, abstain: 9 }, 'two_thirds')).toBe(true);
    expect(isAdopted({ yes: 19, no: 10, abstain: 0 }, 'two_thirds')).toBe(false);
    expect(isAdopted({ yes: 0, no: 0, abstain: 3 }, 'two_thirds')).toBe(false);
  });
});

describe('élection', () => {
  it('les plus de voix sont élus', () => {
    const r = electionResult(['x', 'y', 'z'], [{ candidateIds: ['x', 'y'] }, { candidateIds: ['x'] }, { candidateIds: ['z', 'x'] }], 2);
    expect(r.elected).toEqual(['x']);
    expect(r.tie).toBe(true);
    expect(r.tiedIds?.sort()).toEqual(['y', 'z']);
    const r2 = electionResult(['x', 'y', 'z'], [{ candidateIds: ['x', 'y'] }, { candidateIds: ['x', 'y'] }, { candidateIds: ['z'] }], 2);
    expect(r2.elected).toEqual(['x', 'y']);
    expect(r2.tie).toBe(false);
  });
  it('un candidat sans voix n’est pas élu', () => {
    expect(electionResult(['x', 'y'], [{ candidateIds: ['x'] }], 2).elected).toEqual(['x']);
  });
});

describe('point de l’ordre du jour', () => {
  it('validation', () => {
    expect(parseItemInput({ title: '' })).toEqual({ error: 'Indique le titre du point' });
    const p = parseItemInput({ title: ' Comptes 2026 ', kind: 'vote', majority: 'two_thirds', secret: false });
    expect(p).toMatchObject({ title: 'Comptes 2026', kind: 'vote', majority: 'two_thirds', secret: false, seats: null });
    expect(parseItemInput({ title: 'Comité', kind: 'election', seats: 3 })).toMatchObject({ kind: 'election', seats: 3, secret: true });
    expect(parseItemInput({ title: 'X', kind: 'bidon' })).toMatchObject({ kind: 'info' });
  });
});
