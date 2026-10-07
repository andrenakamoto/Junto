import { describe, it, expect } from 'vitest';
import { formatPotAmount, parseAmount, parseOptionalAmount, parseUrl, potTotals } from './giftPot';

describe('Cagnotte', () => {
  it('lit les montants (virgule, apostrophe suisse, arrondi)', () => {
    expect(parseAmount('20,5')).toBe(20.5);
    expect(parseAmount("1'000")).toBe(1000);
    expect(parseAmount(12.345)).toBe(12.35);
    expect(parseAmount(0)).toBeNull();
    expect(parseAmount(-5)).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount(200000)).toBeNull();
  });

  it('montant facultatif : vide ou invalide', () => {
    expect(parseOptionalAmount('')).toBeNull();
    expect(parseOptionalAmount('30')).toBe(30);
    expect(parseOptionalAmount('x')).toBeUndefined();
  });

  it('n’accepte que des liens web', () => {
    expect(parseUrl('https://exemple.ch/cadeau')).toBe('https://exemple.ch/cadeau');
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('javascript:alert(1)')).toBeUndefined();
    expect(parseUrl('https://a b')).toBeUndefined();
  });

  it('calcule le total et ce qui est reçu', () => {
    expect(potTotals([
      { amount: 20, receivedAt: new Date() },
      { amount: 15.5, receivedAt: null },
    ])).toEqual({ total: 35.5, received: 20, count: 2 });
  });

  it('formate au format suisse', () => {
    expect(formatPotAmount(1250, 'CHF').replace(/\s/g, ' ')).toMatch(/^1.250 CHF$/);
    expect(formatPotAmount(20.5, 'EUR')).toBe('20,50 EUR');
  });
});
