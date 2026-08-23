import { describe, it, expect } from 'vitest';
import { icsEscape, icsDate } from './ical';

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
