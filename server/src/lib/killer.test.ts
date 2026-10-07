import { describe, it, expect } from 'vitest';
import { applyKill, buildMissions, insertPlayer, parseKillerList, repairChain, withdrawPlayer, alive, KillerState } from './killer';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const ids = ['a', 'b', 'c', 'd', 'e'];

// Suit la chaîne depuis un joueur en vie : doit repasser par tous les vivants une seule fois
function chainLength(players: KillerState[]) {
  const living = alive(players);
  const byId = new Map(players.map(p => [p.userId, p]));
  let cur = living[0].userId; const seen = new Set<string>();
  while (!seen.has(cur)) { seen.add(cur); cur = byId.get(cur)!.targetId!; }
  return { seen: seen.size, closes: cur === living[0].userId };
}

describe('Killer', () => {
  it('construit une seule chaîne qui passe par tout le monde', () => {
    const m = buildMissions(ids, ['o1', 'o2'], ['l1'], seeded())!;
    expect(m).toHaveLength(5);
    expect(chainLength(m)).toEqual({ seen: 5, closes: true });
    expect(m.every(p => p.object && p.place === 'l1')).toBe(true);
  });

  it('refuse moins de 3 joueurs', () => {
    expect(buildMissions(['a', 'b'], ['o'], ['l'])).toBeNull();
  });

  it('le tueur hérite de la mission de sa victime', () => {
    const m = buildMissions(ids, ['o1', 'o2', 'o3'], ['l1', 'l2'], seeded(3))!;
    const killer = m[0]; const victim = m.find(p => p.userId === killer.targetId)!;
    const r = applyKill(m, killer.userId, victim.userId)!;
    const k2 = r.players.find(p => p.userId === killer.userId)!;
    expect(r.gameOver).toBe(false);
    expect(k2.kills).toBe(1);
    expect([k2.targetId, k2.object, k2.place]).toEqual([victim.targetId, victim.object, victim.place]);
    expect(r.players.find(p => p.userId === victim.userId)!.eliminatedById).toBe(killer.userId);
    expect(chainLength(r.players)).toEqual({ seen: 4, closes: true });
  });

  it('refuse une élimination qui ne correspond pas à la mission', () => {
    const m = buildMissions(ids, ['o'], ['l'], seeded(5))!;
    const notTarget = m.find(p => p.userId !== m[0].targetId && p.userId !== m[0].userId)!;
    expect(applyKill(m, m[0].userId, notTarget.userId)).toBeNull();
  });

  it('la partie se termine quand il ne reste que le tueur', () => {
    let players = buildMissions(['a', 'b', 'c'], ['o'], ['l'], seeded(7))!;
    let over = false; let guard = 0;
    while (!over && guard++ < 5) {
      const k = alive(players)[0];
      const r = applyKill(players, k.userId, k.targetId!)!;
      players = r.players; over = r.gameOver;
    }
    expect(over).toBe(true);
    expect(alive(players)).toHaveLength(1);
    expect(alive(players)[0].targetId).toBeNull();
  });

  it('un départ referme la chaîne sans compter d’élimination', () => {
    const m = buildMissions(ids, ['o'], ['l'], seeded(11))!;
    const leaving = m[2];
    const hunter = m.find(p => p.targetId === leaving.userId)!;
    const r = withdrawPlayer(m, leaving.userId)!;
    expect(r.heirId).toBe(hunter.userId);
    expect(r.players.find(p => p.userId === hunter.userId)!.targetId).toBe(leaving.targetId);
    expect(r.players.find(p => p.userId === hunter.userId)!.kills).toBe(0);
    expect(chainLength(r.players)).toEqual({ seen: 4, closes: true });
  });

  it('un départ à deux joueurs termine la partie', () => {
    let players = buildMissions(['a', 'b', 'c'], ['o'], ['l'], seeded(2))!;
    players = withdrawPlayer(players, 'a')!.players;
    const r = withdrawPlayer(players, 'b')!;
    expect(r.gameOver).toBe(true);
  });

  it('insère un nouveau joueur dans la chaîne', () => {
    const m = buildMissions(ids, ['o'], ['l'], seeded(13))!;
    const r = insertPlayer(m, 'f', ['o'], ['l'], seeded(4))!;
    expect(r.players.find(p => p.userId === r.hunterId)!.targetId).toBe('f');
    expect(chainLength(r.players)).toEqual({ seen: 6, closes: true });
    expect(insertPlayer(r.players, 'f', ['o'], ['l'])).toBeNull();
  });

  it('répare une chaîne cassée (compte supprimé)', () => {
    const m = buildMissions(ids, ['o'], ['l'], seeded(17))!;
    const gone = m[1].userId;
    const broken = m.filter(p => p.userId !== gone); // la ligne a disparu
    const fixed = repairChain(broken, ['o'], ['l']);
    expect(chainLength(fixed)).toEqual({ seen: 4, closes: true });
  });

  it('valide les listes d’objets et de lieux', () => {
    expect(parseKillerList([' une cuillère ', 'une cuillère', ''])).toEqual(['une cuillère']);
    expect(parseKillerList([])).toBeNull();
    expect(parseKillerList(['x'.repeat(61)])).toBeNull();
    expect(parseKillerList('nope')).toBeNull();
  });
});
