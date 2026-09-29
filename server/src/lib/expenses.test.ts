import { describe, it, expect } from 'vitest';
import { computeBalances, suggestTransfers, formatAmount, computeByCurrency } from './expenses';

describe('computeBalances', () => {
  it('répartit une dépense unique à parts égales', () => {
    const balance = computeBalances(
      ['a', 'b', 'c'],
      [{ amount: 30, paidById: 'a' }],
      []
    );
    expect(balance.get('a')).toBeCloseTo(20); // a payé 30, doit 10 -> +20
    expect(balance.get('b')).toBeCloseTo(-10);
    expect(balance.get('c')).toBeCloseTo(-10);
  });

  it('le total des soldes est toujours nul', () => {
    const balance = computeBalances(
      ['a', 'b', 'c', 'd'],
      [{ amount: 47, paidById: 'a' }, { amount: 12.5, paidById: 'c' }],
      []
    );
    const total = [...balance.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(0);
  });

  it('un remboursement réduit la dette du payeur et le crédit du receveur', () => {
    const balance = computeBalances(
      ['a', 'b'],
      [{ amount: 20, paidById: 'a' }],
      [{ amount: 10, fromUserId: 'b', toUserId: 'a' }]
    );
    expect(balance.get('a')).toBeCloseTo(0); // +10 initial, -10 remboursé reçu
    expect(balance.get('b')).toBeCloseTo(0); // -10 initial, +10 remboursé payé
  });

  it('renvoie une map vide sans membres', () => {
    const balance = computeBalances([], [], []);
    expect(balance.size).toBe(0);
  });

  it('ne répartit une dépense qu\'entre les participants sélectionnés', () => {
    // d n'est pas dans splitWith, ne doit rien devoir sur cette dépense
    const balance = computeBalances(
      ['a', 'b', 'c', 'd'],
      [{ amount: 30, paidById: 'a', splitWith: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }] }],
      []
    );
    expect(balance.get('a')).toBeCloseTo(20); // a payé 30, doit 10 -> +20
    expect(balance.get('b')).toBeCloseTo(-10);
    expect(balance.get('c')).toBeCloseTo(-10);
    expect(balance.get('d')).toBeCloseTo(0);
  });

  it('répartit entre tous les membres si splitWith est vide (compatibilité anciennes dépenses)', () => {
    const balance = computeBalances(
      ['a', 'b', 'c'],
      [{ amount: 30, paidById: 'a', splitWith: [] }],
      []
    );
    expect(balance.get('a')).toBeCloseTo(20);
    expect(balance.get('b')).toBeCloseTo(-10);
    expect(balance.get('c')).toBeCloseTo(-10);
  });
});

describe('suggestTransfers', () => {
  it('ne suggère rien quand tout le monde est à zéro', () => {
    const balance = new Map([['a', 0], ['b', 0]]);
    expect(suggestTransfers(balance)).toEqual([]);
  });

  it('suggère un virement simple entre deux personnes', () => {
    const balance = new Map([['a', 10], ['b', -10]]);
    const transfers = suggestTransfers(balance);
    expect(transfers).toEqual([{ fromUserId: 'b', toUserId: 'a', amount: 10 }]);
  });

  it('minimise le nombre de virements pour un groupe à 3', () => {
    // a a payé pour tout le monde (30 chacun de part) : a +60, b -30, c -30
    const balance = new Map([['a', 60], ['b', -30], ['c', -30]]);
    const transfers = suggestTransfers(balance);
    expect(transfers.length).toBe(2);
    const total = transfers.reduce((s, t) => s + t.amount, 0);
    expect(total).toBeCloseTo(60);
  });

  it('ignore les écarts négligeables (arrondis)', () => {
    const balance = new Map([['a', 0.001], ['b', -0.001]]);
    expect(suggestTransfers(balance)).toEqual([]);
  });
});

describe('formatAmount', () => {
  it('affiche la monnaie du Plan, CHF par défaut', () => {
    expect(formatAmount(24.5, 'CHF')).toContain('CHF');
    expect(formatAmount(24.5, 'EUR')).toContain('€');
    expect(formatAmount(24.5, 'USD')).toContain('CHF');
    expect(formatAmount(24.5, 'EUR')).toMatch(/24[.,]50/);
  });
});

describe('computeByCurrency', () => {
  it('tient des comptes séparés par devise, sans conversion', () => {
    const res = computeByCurrency(
      ['a', 'b'],
      [
        { amount: 40, currency: 'CHF', paidById: 'a', splitWith: [{ userId: 'a' }, { userId: 'b' }] },
        { amount: 30, currency: 'EUR', paidById: 'b', splitWith: [{ userId: 'a' }, { userId: 'b' }] },
      ],
      [{ amount: 5, currency: 'EUR', fromUserId: 'a', toUserId: 'b' }],
    );
    expect(res.map(r => r.currency)).toEqual(['CHF', 'EUR']);
    expect(res[0].transfers).toEqual([{ fromUserId: 'b', toUserId: 'a', amount: 20 }]);
    expect(res[1].transfers).toEqual([{ fromUserId: 'a', toUserId: 'b', amount: 10 }]);
  });

  it('n\'affiche que les devises utilisées', () => {
    expect(computeByCurrency(['a'], [{ amount: 10, currency: 'CHF', paidById: 'a' }], []).map(r => r.currency)).toEqual(['CHF']);
  });
});
