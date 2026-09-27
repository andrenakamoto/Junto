import { AdmissionMode, DeletionMode, EditMode, PlanCreationMode, PlanFeature } from '../types';

// Libellés des paramètres avancés (partagés entre création, modification et consultation)

export const DELETION_OPTIONS: { value: DeletionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres doit voter la suppression' },
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur peut supprimer, sans vote' },
];

export const ADMISSION_OPTIONS: { value: AdmissionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres valide chaque demande' },
  { value: 'creator', label: 'Validation par les organisateurs', hint: 'Le créateur ou un organisateur accepte ou refuse chaque demande' },
  { value: 'open', label: 'Entrée libre', hint: 'Le nom et le code suffisent pour entrer' },
];

export const PLAN_CREATION_OPTIONS: { value: PlanCreationMode; label: string; hint: string }[] = [
  { value: 'all', label: 'Tous les membres', hint: 'Chaque membre peut créer des Plans et proposer des dates' },
  { value: 'creator', label: 'Créateur et organisateurs', hint: 'Seuls eux créent des Plans et des sondages de dates' },
];

export const EDIT_OPTIONS: { value: EditMode; label: string; hint: string }[] = [
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur modifie le Plan' },
  { value: 'all', label: 'Tous les participants', hint: 'Les participants peuvent changer les dates et le lieu (titre et description restent au créateur)' },
];

export const PLAN_FEATURES: { value: PlanFeature; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'trajets', label: 'Trajets (covoiturage)' },
  { value: 'votes', label: 'Sondages' },
  { value: 'depenses', label: 'Dépenses' },
  { value: 'fichiers', label: 'Photos et fichiers' },
];

export function isEnabled(plan: { disabledFeatures?: PlanFeature[] }, feature: PlanFeature) {
  return !plan.disabledFeatures?.includes(feature);
}

// Créateur du Cercle ou organisateur nommé par lui (mêmes droits sur le Cercle, sauf nommer
// des organisateurs et supprimer le Cercle ; aucun droit sur les Plans des autres)
export function isCircleManager(circle: { creatorId: string; members: { userId: string; role: string }[] }, userId?: string) {
  if (!userId) return false;
  return circle.creatorId === userId || circle.members.some(m => m.userId === userId && m.role === 'organizer');
}
