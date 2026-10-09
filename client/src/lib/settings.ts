import { AdmissionMode, DeletionMode, EditMode, OptionalFeature, PlanCreationMode, PlanFeature } from '../types';

// Libellés des paramètres avancés (partagés entre création, modification et consultation)

export const DELETION_OPTIONS: { value: DeletionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres doit voter la suppression' },
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur peut supprimer, sans vote' },
];

export const ADMISSION_OPTIONS: { value: AdmissionMode; label: string; hint: string }[] = [
  { value: 'vote', label: 'Vote à la majorité', hint: 'La moitié des membres valide chaque demande' },
  { value: 'creator', label: 'Validation par les organisateurs', hint: 'Le créateur ou un organisateur accepte ou refuse chaque demande' },
  { value: 'open', label: 'Entrée libre', hint: 'Le code suffit pour entrer' },
];

export const PLAN_CREATION_OPTIONS: { value: PlanCreationMode; label: string; hint: string }[] = [
  { value: 'all', label: 'Tous les membres', hint: 'Chaque membre peut créer des Plans' },
  { value: 'creator', label: 'Créateur et organisateurs', hint: 'Seuls eux créent des Plans' },
];

export const POLL_CREATION_OPTIONS: { value: PlanCreationMode; label: string; hint: string }[] = [
  { value: 'all', label: 'Tous les membres', hint: 'Chaque membre peut proposer des dates' },
  { value: 'creator', label: 'Créateur et organisateurs', hint: 'Seuls eux lancent des sondages de dates' },
];

export const EDIT_OPTIONS: { value: EditMode; label: string; hint: string }[] = [
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur modifie le Plan' },
  { value: 'all', label: 'Tous les participants', hint: 'Les participants peuvent changer les dates et le lieu (titre et description restent au créateur)' },
];

export const IMPORTANT_INFO_OPTIONS: { value: EditMode; label: string; hint: string }[] = [
  { value: 'creator', label: 'Créateur seul', hint: 'Seul le créateur modifie les informations importantes' },
  { value: 'all', label: 'Tous les participants', hint: 'Chaque participant peut compléter ou corriger les informations importantes' },
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

// Fonctions à activer : absentes tant que le créateur ne les coche pas
export const OPTIONAL_FEATURES: { value: OptionalFeature; label: string }[] = [
  { value: 'benevoles', label: 'Bénévoles (planning)' },
  { value: 'pere_noel', label: 'Père Noël secret' },
  { value: 'killer', label: 'Killer (jeu de l’assassin)' },
  { value: 'mot_piege', label: 'Le mot piège (jeu)' },
  { value: 'equipes', label: 'Tirage des équipes et tournoi' },
  { value: 'cagnotte', label: 'Cagnotte cadeau' },
  { value: 'assemblee', label: 'Assemblée (ordre du jour, votes, PV)' },
];

// Fonctions du Plan rangées par catégorie (fenêtres de création / modification / paramètres).
// `base` : active par défaut (décocher la masque) ; `optional` : à activer. Les catégories `collapsible`
// sont repliées tant qu'aucune de leurs fonctions n'est cochée.
export type FeatureItem =
  | { kind: 'base'; value: PlanFeature; label: string; hint: string }
  | { kind: 'optional'; value: OptionalFeature; label: string; hint: string };

export const FEATURE_GROUPS: { key: string; title: string; icon: string; collapsible?: boolean; items: FeatureItem[] }[] = [
  { key: 'echanger', title: 'Échanger', icon: '💬', items: [
    { kind: 'base', value: 'chat', label: 'Chat', hint: 'Discuter, photos et messages vocaux' },
    { kind: 'base', value: 'votes', label: 'Sondages', hint: 'Voter sur une question' },
    { kind: 'base', value: 'fichiers', label: 'Photos et fichiers', hint: 'Galerie et documents partagés' },
  ] },
  { key: 'organiser', title: 'Organiser', icon: '🧭', items: [
    { kind: 'base', value: 'trajets', label: 'Trajets', hint: 'Covoiturage : places et demandes' },
    { kind: 'base', value: 'depenses', label: 'Dépenses', hint: 'Qui apporte quoi, frais partagés' },
    { kind: 'optional', value: 'benevoles', label: 'Bénévoles', hint: 'Postes à pourvoir, chacun s’inscrit' },
    { kind: 'optional', value: 'assemblee', label: 'Assemblée', hint: 'Ordre du jour, procurations, votes, procès-verbal' },
  ] },
  { key: 'feter', title: 'Fêter et offrir', icon: '🎁', collapsible: true, items: [
    { kind: 'optional', value: 'cagnotte', label: 'Cagnotte cadeau', hint: 'Un cadeau commun, idées et votes' },
    { kind: 'optional', value: 'pere_noel', label: 'Père Noël secret', hint: 'Tirage au sort et cadeaux anonymes' },
  ] },
  { key: 'jouer', title: 'Jouer', icon: '🎲', collapsible: true, items: [
    { kind: 'optional', value: 'killer', label: 'Killer', hint: 'Une cible, un objet, un lieu' },
    { kind: 'optional', value: 'mot_piege', label: 'Le mot piège', hint: 'Faire dire un mot secret' },
    { kind: 'optional', value: 'equipes', label: 'Équipes et tournoi', hint: 'Tirage des équipes, scores' },
  ] },
];

export function hasFeature(plan: { enabledFeatures?: OptionalFeature[] }, feature: OptionalFeature) {
  return !!plan.enabledFeatures?.includes(feature);
}

// Créateur du Cercle ou organisateur nommé par lui (mêmes droits sur le Cercle, sauf nommer
// des organisateurs et supprimer le Cercle ; aucun droit sur les Plans des autres)
export function isCircleManager(circle: { creatorId: string; members: { userId: string; role: string }[] }, userId?: string) {
  if (!userId) return false;
  return circle.creatorId === userId || circle.members.some(m => m.userId === userId && m.role === 'organizer');
}
