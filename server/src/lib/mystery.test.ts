import { describe, it, expect } from 'vitest';
import { defaultRevealAt, mysteryView, parseClues, parseGuess, parseRevealAt } from './mystery';

const now = new Date('2026-11-20T12:00:00Z');
const start = new Date('2026-11-21T18:00:00Z');
const end = new Date('2026-11-21T23:00:00Z');
const m = { realTitle: 'Escape game au château', realLocation: 'Rue du Château 3, Nyon', revealAt: new Date('2026-11-21T17:00:00Z'), revealedAt: null, accompliceIds: ['complice'] };
const clues = [
  { id: 'c1', text: 'Chaussures confortables', revealAt: new Date('2026-11-20T10:00:00Z'), revealedAt: new Date('2026-11-20T10:00:00Z'), position: 0 },
  { id: 'c2', text: 'Il y aura des énigmes', revealAt: new Date('2026-11-21T09:00:00Z'), revealedAt: null, position: 1 },
];
const guesses = [{ userId: 'invite2', text: 'Karting', user: { id: 'invite2', pseudo: 'lea', firstName: 'Léa' } }];

describe('Plan mystère', () => {
  it('un invité ne reçoit ni le vrai titre, ni le vrai lieu, ni les indices à venir, ni les paris des autres', () => {
    const v = mysteryView(m, clues, guesses, { userId: 'invite', manager: false }, now);
    const json = JSON.stringify(v);
    expect(json).not.toContain('château');
    expect(json).not.toContain('Nyon');
    expect(json).not.toContain('énigmes');
    expect(json).not.toContain('Karting');
    expect(v.clues.map(c => c.id)).toEqual(['c1']);
    expect(v.clueCount).toBe(2);
    expect(v.nextClueAt?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    expect(v.guessCount).toBe(1);
  });
  it('l’organisation et les complices voient tout', () => {
    for (const viewer of [{ userId: 'orga', manager: true }, { userId: 'complice', manager: false }]) {
      const v = mysteryView(m, clues, guesses, viewer, now);
      expect(v.realTitle).toBe('Escape game au château');
      expect(v.allClues).toHaveLength(2);
      expect(v.guesses).toHaveLength(1);
    }
  });
  it('après le dévoilement, tout le monde voit la destination et les paris', () => {
    const v = mysteryView({ ...m, revealedAt: now }, clues, guesses, { userId: 'invite', manager: false }, now);
    expect(v.realLocation).toBe('Rue du Château 3, Nyon');
    expect(v.guesses?.[0].text).toBe('Karting');
    expect(v.nextClueAt).toBeNull();
    expect(v.allClues).toBeUndefined();
  });
  it('dates et saisies', () => {
    expect(defaultRevealAt(start, end).toISOString()).toBe('2026-11-21T17:00:00.000Z');
    expect(parseRevealAt('2026-11-21T19:00:00Z', start, end)).toBeNull();
    expect(parseRevealAt({ not: '' }, start, end)).toBeNull();
    const reveal = new Date('2026-11-21T17:00:00Z');
    expect(parseClues([{ text: ' A ', revealAt: '2026-11-21T10:00:00Z' }, { text: 'B', revealAt: '2026-11-20T10:00:00Z' }], reveal)?.map(c => c.text)).toEqual(['B', 'A']);
    expect(parseClues([{ text: 'Trop tard', revealAt: '2026-11-21T18:00:00Z' }], reveal)).toBeNull();
    expect(parseClues(Array.from({ length: 9 }, () => ({ text: 'x', revealAt: '2026-11-20T10:00:00Z' })), reveal)).toBeNull();
    expect(parseGuess('  Karting  ')).toBe('Karting');
    expect(parseGuess('x'.repeat(151))).toBeNull();
  });
});
