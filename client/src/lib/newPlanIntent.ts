// Intention « créer tel Plan spécifique » venue d'une page publique (/pere-noel) : gardée sur l'appareil 7 jours, pour
// survivre à l'inscription et à la validation de l'email ; DashboardPage la lit une fois (takeNewPlanIntent) et ouvre la
// création du Plan.
import type { PlanKind } from './planKinds';

const KEY = 'evly_new_plan';
const KEEP_MS = 7 * 864e5;

export function requestNewPlan(kind: PlanKind) {
  try { localStorage.setItem(KEY, JSON.stringify({ kind, at: Date.now() })); } catch { /* stockage indisponible */ }
}

export function takeNewPlanIntent(): PlanKind | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { kind: PlanKind; at: number } | null;
    localStorage.removeItem(KEY);
    return saved && Date.now() - saved.at < KEEP_MS ? saved.kind : null;
  } catch { return null; }
}
