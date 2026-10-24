import { isCircleManager } from './circleRoles';

// « Qui invite des personnes extérieures » (lien /invitation d'un Plan). Un Plan « Réservé à… » n'est ouvert à l'extérieur
// que par le créateur et les organisateurs, même si la règle dit « tous ». Le Mode annonce et Découvrir créent leur lien
// côté serveur (inscriptions) : ils ne passent pas par ici.
export function effectiveGuestMode(plan: { guestInviteMode?: string | null; visibility?: string | null }): 'all' | 'managers' | 'none' {
  const mode = plan.guestInviteMode === 'managers' || plan.guestInviteMode === 'none' ? plan.guestInviteMode : 'all';
  return plan.visibility === 'reserved' && mode === 'all' ? 'managers' : mode;
}

export async function canInviteGuests(userId: string, plan: { creatorId: string; circleId: string; guestInviteMode?: string | null; visibility?: string | null }): Promise<boolean> {
  const mode = effectiveGuestMode(plan);
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  return plan.creatorId === userId || await isCircleManager(userId, plan.circleId);
}

// La règle devient plus stricte : le lien déjà partagé (souvent par un participant) est remplacé
export const GUEST_ORDER = { all: 0, managers: 1, none: 2 } as const;
