export function computeBalances(
  memberIds: string[],
  // splitWith obligatoire : une requête qui oublierait de le charger ne compile pas
  // (sinon chaque dépense serait silencieusement partagée entre tous les membres)
  expenses: { amount: number; paidById: string; splitWith: { userId: string }[] }[],
  reimbursements: { amount: number; fromUserId: string; toUserId: string }[]
) {
  const balance = new Map<string, number>(memberIds.map(id => [id, 0]));
  if (memberIds.length === 0) return balance;

  for (const e of expenses) {
    // Dépenses créées avant l'introduction du partage sélectif : réparties
    // entre tous les membres du Plan (comportement historique préservé).
    const participants = e.splitWith.length > 0
      ? e.splitWith.map(s => s.userId)
      : memberIds;
    const share = e.amount / participants.length;
    for (const id of participants) {
      balance.set(id, (balance.get(id) ?? 0) - share);
    }
    balance.set(e.paidById, (balance.get(e.paidById) ?? 0) + e.amount);
  }
  for (const r of reimbursements) {
    balance.set(r.fromUserId, (balance.get(r.fromUserId) ?? 0) + r.amount);
    balance.set(r.toUserId, (balance.get(r.toUserId) ?? 0) - r.amount);
  }
  return balance;
}

// Simplifie les dettes en un nombre minimal de virements suggérés
export function suggestTransfers(balance: Map<string, number>) {
  const EPS = 0.01;
  const creditors = [...balance.entries()].filter(([, b]) => b > EPS).map(([id, b]) => ({ id, amount: b }));
  const debtors = [...balance.entries()].filter(([, b]) => b < -EPS).map(([id, b]) => ({ id, amount: -b }));
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: { fromUserId: string; toUserId: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > EPS) {
      transfers.push({ fromUserId: debtors[i].id, toUserId: creditors[j].id, amount: Math.round(amount * 100) / 100 });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount <= EPS) i++;
    if (creditors[j].amount <= EPS) j++;
  }
  return transfers;
}

// Devises des dépenses. Pas de conversion : les comptes sont tenus séparément
// pour chaque devise (un solde et des virements suggérés par devise).
export const CURRENCIES = ['CHF', 'EUR'] as const;
export type Currency = typeof CURRENCIES[number];

export function parseCurrency(v: unknown): Currency | undefined {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v) ? v as Currency : undefined;
}

export function formatAmount(amount: number, currency: string): string {
  return amount.toLocaleString('fr-CH', { style: 'currency', currency: parseCurrency(currency) ?? 'CHF' });
}

// Soldes et virements suggérés, devise par devise (seulement les devises utilisées)
export function computeByCurrency(
  memberIds: string[],
  expenses: { amount: number; currency: string; paidById: string; splitWith: { userId: string }[] }[],
  reimbursements: { amount: number; currency: string; fromUserId: string; toUserId: string }[],
) {
  const used = CURRENCIES.filter(c => expenses.some(e => e.currency === c) || reimbursements.some(r => r.currency === c));
  return used.map(currency => {
    const balance = computeBalances(
      memberIds,
      expenses.filter(e => e.currency === currency),
      reimbursements.filter(r => r.currency === currency),
    );
    return { currency, balance, transfers: suggestTransfers(balance) };
  });
}
