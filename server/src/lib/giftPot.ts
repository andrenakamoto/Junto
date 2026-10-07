import { isCircleManager } from './circleRoles';

// Cagnotte cadeau commune : fonction à activer dans un Plan (enabledFeatures « cagnotte »).
// Chacun annonce sa participation, paie à l'organisateur (Twint, virement… selon ses indications),
// le signale, et l'organisateur confirme la réception. On propose et on vote pour des idées de
// cadeau. Le montant de chacun n'est visible que par l'organisateur ; les autres voient le total.
// Pour une surprise : cacher le Plan à la personne fêtée (Plan surprise).

export const POT_FEATURE = 'cagnotte';
export const POT_DISABLED_ERROR = 'La cagnotte n’est pas activée pour ce Plan';
export const POT_CURRENCIES = ['CHF', 'EUR'] as const;
export const AMOUNT_MAX = 100000;
export const FOR_WHOM_MAX = 60;
export const PAY_INFO_MAX = 300;
export const IDEA_MAX = 150;
export const URL_MAX = 500;
// Une relance au plus toutes les 12 heures
export const REMINDER_GAP_MS = 12 * 3600 * 1000;

export function potEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(POT_FEATURE);
}

export async function canManagePot(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

// Montant : nombre positif (virgule acceptée), arrondi au centime ; null si invalide
export function parseAmount(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.').replace(/[\s']/g, '')) : v;
  if (typeof n !== 'number' || !isFinite(n) || n <= 0 || n > AMOUNT_MAX) return null;
  return Math.round(n * 100) / 100;
}

// Montant facultatif : vide → null, invalide → undefined
export function parseOptionalAmount(v: unknown): number | null | undefined {
  if (v === null || v === '' || v === undefined) return null;
  return parseAmount(v) ?? undefined;
}

export function parseUrl(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > URL_MAX || !/^https?:\/\/[^\s]+$/i.test(s)) return undefined;
  return s;
}

export function potTotals(pledges: { amount: number; receivedAt: Date | null }[]) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    total: round(pledges.reduce((s, p) => s + p.amount, 0)),
    received: round(pledges.filter(p => p.receivedAt).reduce((s, p) => s + p.amount, 0)),
    count: pledges.length,
  };
}

export function formatPotAmount(amount: number, currency: string) {
  return `${new Intl.NumberFormat('fr-CH', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}
