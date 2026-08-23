export function computeBalances(
  memberIds: string[],
  expenses: { amount: number; paidById: string; splitWith?: { userId: string }[] }[],
  reimbursements: { amount: number; fromUserId: string; toUserId: string }[]
) {
  const balance = new Map<string, number>(memberIds.map(id => [id, 0]));
  if (memberIds.length === 0) return balance;

  for (const e of expenses) {
    // Dépenses créées avant l'introduction du partage sélectif : réparties
    // entre tous les membres du Plan (comportement historique préservé).
    const participants = e.splitWith && e.splitWith.length > 0
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
