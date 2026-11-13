// Accompagnants (2026-11-13) : chaque réponse indique le nombre de personnes qui viennent, la personne comprise
// (PlanMember.partySize, 1 par défaut). Le créateur du Plan règle le maximum d'accompagnants par réponse
// (Plan.companionsMax, 0 = désactivé). Les places d'un Plan limité comptent toutes ces personnes (lib/waitlist.ts).

export const COMPANIONS_DEFAULT = 5;
export const COMPANIONS_LIMIT = 20;

// Réglage du créateur : entier de 0 à 20 ; undefined = absent, null = invalide
export function parseCompanionsMax(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > COMPANIONS_LIMIT) return null;
  return n;
}

// Nombre de personnes demandé pour une réponse : de 1 à 1 + maximum d'accompagnants ; null = invalide
export function parsePartySize(value: unknown, companionsMax: number): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 1 + Math.max(0, companionsMax)) return null;
  return n;
}

// Places occupées : « Je suis in » et « Peut-être », avec leurs accompagnants
export function occupiedFrom(members: { rsvp: string; partySize?: number | null }[]): number {
  return members.reduce((sum, m) => sum + (m.rsvp === 'out' ? 0 : Math.max(1, m.partySize ?? 1)), 0);
}

// Personnes qui viennent (« Je suis in » seulement), accompagnants compris
export function comingFrom(members: { rsvp: string; partySize?: number | null }[]): number {
  return members.reduce((sum, m) => sum + (m.rsvp === 'in' ? Math.max(1, m.partySize ?? 1) : 0), 0);
}
