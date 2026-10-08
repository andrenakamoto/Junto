import { describe, it, expect } from 'vitest';
import {
  applyAccusation, applySuccess, insertWordPlayer, parseCustomWords, pickWord, playing, ranking, startMissions,
  winnerOf, withdrawWordPlayer, wordPool, WordState,
} from './wordGame';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const ids = ['a', 'b', 'c', 'd', 'e'];
let n = 0;
const word = () => `mot${n++}`;

function chainLength(players: WordState[]) {
  const living = playing(players);
  const byId = new Map(players.map(p => [p.userId, p]));
  let cur = living[0].userId; const seen = new Set<string>();
  while (!seen.has(cur)) { seen.add(cur); cur = byId.get(cur)!.targetId!; }
  return { seen: seen.size, closes: cur === living[0].userId };
}

describe('Le mot piège', () => {
  it('missions de départ : une chaîne, un mot chacun', () => {
    const m = startMissions(ids, word, seeded())!;
    expect(chainLength(m)).toEqual({ seen: 5, closes: true });
    expect(new Set(m.map(p => p.word)).size).toBe(5);
  });

  it('réserve de mots : niveaux + mots perso, sans doublon ; un mot n’est pas tiré deux fois', () => {
    const pool = wordPool(['facile'], ['Raclette', 'vacances']);
    expect(pool.filter(w => w.toLowerCase() === 'vacances')).toHaveLength(1);
    const used = new Set<string>();
    const drawn = Array.from({ length: pool.length }, () => pickWord(pool, used, seeded(3)));
    expect(new Set(drawn.map(w => w.toLowerCase())).size).toBe(pool.length);
    expect(pool).toContain(pickWord(pool, used, seeded(5))); // réserve épuisée : on recommence
  });

  it('points : +1 et nouvelle mission (autre cible, autre mot), personne n’est éliminé', () => {
    const m = startMissions(ids, word, seeded(7))!;
    const h = m[0];
    const r = applySuccess(m, 'points', h.userId, h.targetId!, word, seeded(2))!;
    const h2 = r.players.find(p => p.userId === h.userId)!;
    expect(h2.points).toBe(1);
    expect(h2.targetId).not.toBe(h.targetId);
    expect(h2.targetId).not.toBe(h.userId);
    expect(h2.word).not.toBe(h.word);
    expect(playing(r.players)).toHaveLength(5);
    expect(r.gameOver).toBe(false);
  });

  it('élimination : la cible sort, le piégeur reprend sa cible ; fin quand il reste seul', () => {
    let players = startMissions(['a', 'b', 'c'], word, seeded(9))!;
    const h = players[0]; const t = players.find(p => p.userId === h.targetId)!;
    const r = applySuccess(players, 'elimination', h.userId, t.userId, word)!;
    expect(r.players.find(p => p.userId === t.userId)!.eliminatedById).toBe(h.userId);
    expect(r.players.find(p => p.userId === h.userId)!.targetId).toBe(t.targetId);
    players = r.players;
    const h2 = playing(players).find(p => p.targetId)!;
    const r2 = applySuccess(players, 'elimination', h2.userId, h2.targetId!, word)!;
    expect(r2.gameOver).toBe(true);
    expect(winnerOf(r2.players, 'elimination')).toBe(h2.userId);
  });

  it('refuse un mot qui ne correspond pas à la mission', () => {
    const m = startMissions(ids, word, seeded(11))!;
    const notTarget = m.find(p => p.userId !== m[0].targetId && p.userId !== m[0].userId)!;
    expect(applySuccess(m, 'points', m[0].userId, notTarget.userId, word)).toBeNull();
  });

  it('démasquer : juste → point pour l’accusateur et nouveau mot pour le piégeur ; faux → rien ne change', () => {
    const m = startMissions(ids, word, seeded(13))!;
    const victim = m[0]; const hunter = m.find(p => p.targetId === victim.userId)!;
    const other = m.find(p => p.userId !== victim.userId && p.userId !== hunter.userId)!;
    const wrong = applyAccusation(m, 'points', victim.userId, other.userId, word)!;
    expect(wrong.correct).toBe(false);
    expect(wrong.players).toBe(m);
    const right = applyAccusation(m, 'points', victim.userId, hunter.userId, word, seeded(1))!;
    expect(right.correct).toBe(true);
    expect(right.players.find(p => p.userId === victim.userId)!.points).toBe(1);
    const h2 = right.players.find(p => p.userId === hunter.userId)!;
    expect(h2.word).not.toBe(hunter.word);
    expect(h2.targetId).not.toBe(victim.userId);
    // En élimination, même cible, nouveau mot
    const elim = applyAccusation(m, 'elimination', victim.userId, hunter.userId, word)!;
    expect(elim.players.find(p => p.userId === hunter.userId)!.targetId).toBe(victim.userId);
  });

  it('départ : ceux qui le visaient reçoivent une autre mission', () => {
    const m = startMissions(ids, word, seeded(17))!;
    const leaving = m[2]; const hunter = m.find(p => p.targetId === leaving.userId)!;
    const pts = withdrawWordPlayer(m, 'points', leaving.userId, word, seeded(3))!;
    expect(pts.changed).toEqual([hunter.userId]);
    expect(pts.players.find(p => p.userId === hunter.userId)!.targetId).not.toBe(leaving.userId);
    const elim = withdrawWordPlayer(m, 'elimination', leaving.userId, word)!;
    expect(elim.players.find(p => p.userId === hunter.userId)!.targetId).toBe(leaving.targetId);
    expect(chainLength(elim.players)).toEqual({ seen: 4, closes: true });
  });

  it('arrivée en cours de partie : insérée dans la chaîne', () => {
    const m = startMissions(ids, word, seeded(19))!;
    const r = insertWordPlayer(m, 'elimination', 'f', word, seeded(2))!;
    expect(chainLength(r.players)).toEqual({ seen: 6, closes: true });
    expect(insertWordPlayer(r.players, 'points', 'f', word)).toBeNull();
  });

  it('classement et vainqueur en mode points', () => {
    const p = (userId: string, points: number, out = false): WordState => ({ userId, points, targetId: null, word: null, eliminatedAt: out ? new Date() : null, eliminatedById: null });
    expect(ranking([p('a', 1), p('b', 3), p('c', 3, true)]).map(x => x.userId)).toEqual(['b', 'c', 'a']);
    expect(winnerOf([p('a', 1), p('b', 3)], 'points')).toBe('b');
    expect(winnerOf([p('a', 3), p('b', 3)], 'points')).toBeNull();
    expect(winnerOf([p('a', 0), p('b', 0)], 'points')).toBeNull();
  });

  it('mots personnalisés validés', () => {
    expect(parseCustomWords([' Raclette ', 'raclette', ''])).toEqual(['Raclette']);
    expect(parseCustomWords(['x'.repeat(41)])).toBeNull();
    expect(parseCustomWords('non')).toBeNull();
  });
});
