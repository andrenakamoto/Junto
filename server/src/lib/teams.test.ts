import { describe, it, expect } from 'vitest';
import { drawTeams, knockoutFirstRound, knockoutWinner, leagueSchedule, leagueStandings, nextKnockoutRound, parseScore } from './teams';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('Tirage des équipes', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, level: (i % 3) + 1 }));

  it('répartit tout le monde, tailles égales à une personne près', () => {
    const teams = drawTeams(ten.slice(0, 7), 3, false, seeded());
    expect(teams.flat().sort()).toEqual(ten.slice(0, 7).map(p => p.id).sort());
    const sizes = teams.map(t => t.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('équilibre les niveaux', () => {
    const people = [3, 3, 3, 3, 1, 1, 1, 1].map((level, i) => ({ id: `q${i}`, level }));
    const teams = drawTeams(people, 2, true, seeded(9));
    const sum = (t: string[]) => t.reduce((s, id) => s + people.find(p => p.id === id)!.level, 0);
    expect(sum(teams[0])).toBe(sum(teams[1]));
  });

  it('ne crée pas plus d’équipes que de personnes', () => {
    expect(drawTeams(ten.slice(0, 2), 4, false, seeded())).toHaveLength(2);
  });
});

describe('Championnat', () => {
  it('chacun rencontre chacun une fois (nombre pair)', () => {
    const f = leagueSchedule(['a', 'b', 'c', 'd']);
    expect(f).toHaveLength(6);
    const pairs = new Set(f.map(m => [m.homeId, m.awayId].sort().join('-')));
    expect(pairs.size).toBe(6);
    expect(Math.max(...f.map(m => m.round))).toBe(3);
  });

  it('gère un nombre impair (une équipe au repos)', () => {
    const f = leagueSchedule(['a', 'b', 'c']);
    expect(f).toHaveLength(3);
    expect(f.every(m => m.homeId && m.awayId)).toBe(true);
  });

  it('classe aux points, puis à la différence de buts', () => {
    const s = leagueStandings(['a', 'b', 'c'], [
      { homeId: 'a', awayId: 'b', homeScore: 2, awayScore: 0 },
      { homeId: 'b', awayId: 'c', homeScore: 5, awayScore: 0 },
      { homeId: 'c', awayId: 'a', homeScore: 1, awayScore: 0 },
    ]);
    expect(s.map(x => x.teamId)).toEqual(['b', 'a', 'c']);
    expect(s[0]).toMatchObject({ points: 3, diff: 3, played: 2 });
  });
});

describe('Élimination directe', () => {
  it('exempte les équipes en trop au premier tour', () => {
    const r1 = knockoutFirstRound(['a', 'b', 'c', 'd', 'e'], seeded());
    expect(r1.filter(m => !m.awayId)).toHaveLength(3);
    expect(r1.filter(m => m.awayId)).toHaveLength(1);
    expect(r1.flatMap(m => [m.homeId, m.awayId]).filter(Boolean).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('crée le tour suivant quand tout est joué, jusqu’à la finale', () => {
    const r1 = knockoutFirstRound(['a', 'b', 'c', 'd'], seeded(4)).map(m => ({ ...m, winnerId: m.homeId }));
    const r2 = nextKnockoutRound(r1)!;
    expect(r2).toHaveLength(1);
    expect(nextKnockoutRound([...r1, { ...r2[0], winnerId: r2[0].homeId }])).toBeNull();
    expect(nextKnockoutRound([{ round: 1, position: 0, winnerId: null }, { round: 1, position: 1, winnerId: 'x' }])).toBeNull();
  });

  it('désigne le vainqueur au score ou par choix en cas d’égalité', () => {
    const m = { homeId: 'a', awayId: 'b' };
    expect(knockoutWinner(m, 2, 1)).toBe('a');
    expect(knockoutWinner(m, 1, 1)).toBeNull();
    expect(knockoutWinner(m, 1, 1, 'b')).toBe('b');
    expect(knockoutWinner(m, 1, 1, 'z')).toBeNull();
  });

  it('valide les scores', () => {
    expect(parseScore('3')).toBe(3);
    expect(parseScore(-1)).toBeNull();
    expect(parseScore(1.5)).toBeNull();
    expect(parseScore('')).toBeNull();
  });
});
