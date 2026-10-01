import { describe, it, expect } from 'vitest';
import { icsEscape, icsDate, icsEventTimes } from './ical';

describe('icsEscape', () => {
  it('échappe les virgules, points-virgules et antislashs', () => {
    expect(icsEscape('Resto, chez Marco; ambiance\\cool')).toBe('Resto\\, chez Marco\\; ambiance\\\\cool');
  });

  it('convertit les retours à la ligne', () => {
    expect(icsEscape('ligne1\nligne2')).toBe('ligne1\\nligne2');
  });

  it('laisse le texte simple inchangé', () => {
    expect(icsEscape('Anniversaire de Léa')).toBe('Anniversaire de Léa');
  });
});

describe('icsDate', () => {
  it('formate en UTC basique (YYYYMMDDTHHMMSSZ)', () => {
    const d = new Date(Date.UTC(2026, 7, 24, 9, 55, 30));
    expect(icsDate(d)).toBe('20260824T095530Z');
  });
});

describe('icsEventTimes', () => {
  const at = (h: number, day = 10) => new Date(Date.UTC(2026, 9, day, h));
  it('exporte la vraie date de fin du Plan', () => {
    expect(icsEventTimes(at(17), at(23))).toEqual({ start: at(17), end: at(23) });
    expect(icsEventTimes(at(9), at(18, 11))).toEqual({ start: at(9), end: at(18, 11) });
  });
  it('2 heures par défaut si la fin précède le début', () => {
    expect(icsEventTimes(at(17), at(16))).toEqual({ start: at(17), end: at(19) });
  });
  it('sans date de début : placé sur la date de fin', () => {
    expect(icsEventTimes(null, at(23))).toEqual({ start: at(23), end: at(23) });
  });
});
