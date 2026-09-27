import { AdmissionMode, DeletionMode, EditMode, PlanFeature } from '../types';

// Libellés des paramètres avancés (partagés entre création, modification et consultation)

export const DELETION_OPTIONS: { value: DeletionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres doit voter la suppression' },
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur peut supprimer, sans vote' },
];

export const ADMISSION_OPTIONS: { value: AdmissionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres valide chaque demande' },
  { value: 'creator', label: 'Validation par le créateur', hint: 'Le créateur accepte ou refuse seul' },
  { value: 'open', label: 'Entrée libre', hint: 'Le nom et le code suffisent pour entrer' },
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
