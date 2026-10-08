import { describe, it, expect } from 'vitest';
import { parseShiftInput, shiftsOverlap, sortShifts } from './volunteers';

const d = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 10, h, m));

describe('parseShiftInput', () => {
  it('accepte un poste sans horaire, 1 personne par défaut', () => {
    expect(parseShiftInput({ title: '  Buvette ' })).toEqual({ title: 'Buvette', needed: 1, note: null, startsAt: null, endsAt: null });
  });
  it('refuse un nom vide, un nombre invalide, une fin sans début ou avant le début', () => {
    expect(parseShiftInput({ title: ' ' })).toHaveProperty('error');
    expect(parseShiftInput({ title: 'A', needed: 0 })).toHaveProperty('error');
    expect(parseShiftInput({ title: 'A', needed: 2.5 })).toHaveProperty('error');
    expect(parseShiftInput({ title: 'A', endsAt: d(10).toISOString() })).toHaveProperty('error');
    expect(parseShiftInput({ title: 'A', startsAt: d(10).toISOString(), endsAt: d(9).toISOString() })).toHaveProperty('error');
    expect(parseShiftInput({ title: 'A', startsAt: 'pas une date' })).toHaveProperty('error');
  });
  it('garde horaire, nombre et remarque', () => {
    const r = parseShiftInput({ title: 'Caisse', needed: '3', note: ' Apporter de la monnaie ', startsAt: d(10).toISOString(), endsAt: d(12).toISOString() });
    expect(r).toEqual({ title: 'Caisse', needed: 3, note: 'Apporter de la monnaie', startsAt: d(10), endsAt: d(12) });
  });
});

describe('shiftsOverlap', () => {
  it('détecte un chevauchement, pas des créneaux qui se suivent', () => {
    expect(shiftsOverlap({ startsAt: d(10), endsAt: d(12) }, { startsAt: d(11), endsAt: d(13) })).toBe(true);
    expect(shiftsOverlap({ startsAt: d(10), endsAt: d(12) }, { startsAt: d(12), endsAt: d(14) })).toBe(false);
  });
  it('un créneau sans fin occupe son heure de début ; sans horaire, jamais de conflit', () => {
    expect(shiftsOverlap({ startsAt: d(11), endsAt: null }, { startsAt: d(10), endsAt: d(12) })).toBe(true);
    expect(shiftsOverlap({ startsAt: d(12, 30), endsAt: null }, { startsAt: d(10), endsAt: d(12) })).toBe(false);
    expect(shiftsOverlap({ startsAt: null, endsAt: null }, { startsAt: d(10), endsAt: d(12) })).toBe(false);
  });
});

describe('sortShifts', () => {
  it('trie par heure de début, postes sans horaire à la fin', () => {
    const c = (n: number) => new Date(2026, 0, n);
    const s = sortShifts([
      { id: 'sans', startsAt: null, createdAt: c(1) },
      { id: '12h', startsAt: d(12), createdAt: c(2) },
      { id: '10h', startsAt: d(10), createdAt: c(3) },
    ]);
    expect(s.map(x => x.id)).toEqual(['10h', '12h', 'sans']);
  });
});

import { shiftReminderText } from './volunteers';

describe('rappel de poste', () => {
  const start = new Date('2026-10-10T17:00:00Z'); // 19h00 à Genève
  it('une heure avant', () => {
    expect(shiftReminderText({ title: 'Buvette', startsAt: start }, start.getTime() - 58 * 60000)).toBe('⏰ Ton poste « Buvette » commence à 19h00, dans une heure');
  });
  it('plus tard : le vrai délai', () => {
    expect(shiftReminderText({ title: 'Caisse', startsAt: start }, start.getTime() - 41 * 60000)).toBe('⏰ Ton poste « Caisse » commence à 19h00, dans 40 minutes');
  });
});
