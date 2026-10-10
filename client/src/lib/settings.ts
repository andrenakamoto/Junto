import { t } from '../i18n';
import { AdmissionMode, DeletionMode, EditMode, OptionalFeature, PlanCreationMode, PlanFeature } from '../types';

// Libellés des paramètres avancés (partagés entre création, modification et consultation) : i18n/*/settings.ts

const opt = <V extends string>(group: string, values: V[]) =>
  values.map(value => ({ value, label: t(`settings.${group}.${value}.label` as any), hint: t(`settings.${group}.${value}.hint` as any) }));

export const DELETION_OPTIONS: { value: DeletionMode; label: string; hint: string }[] = opt('deletion', ['vote', 'creator']);
export const ADMISSION_OPTIONS: { value: AdmissionMode; label: string; hint: string }[] = opt('admission', ['vote', 'creator', 'open']);
export const PLAN_CREATION_OPTIONS: { value: PlanCreationMode; label: string; hint: string }[] = opt('planCreation', ['all', 'creator']);
export const POLL_CREATION_OPTIONS: { value: PlanCreationMode; label: string; hint: string }[] = opt('pollCreation', ['all', 'creator']);
export const EDIT_OPTIONS: { value: EditMode; label: string; hint: string }[] = opt('edit', ['creator', 'all']);
export const IMPORTANT_INFO_OPTIONS: { value: EditMode; label: string; hint: string }[] = opt('importantInfo', ['creator', 'all']);

const featureLabel = (value: string) => t(`settings.features.${value}` as any);
export const PLAN_FEATURES: { value: PlanFeature; label: string }[] = (['chat', 'trajets', 'votes', 'depenses', 'fichiers'] as PlanFeature[])
  .map(value => ({ value, label: featureLabel(value) }));

export function isEnabled(plan: { disabledFeatures?: PlanFeature[] }, feature: PlanFeature) {
  return !plan.disabledFeatures?.includes(feature);
}

// Fonctions à activer : absentes tant que le créateur ne les coche pas
export const OPTIONAL_FEATURES: { value: OptionalFeature; label: string }[] = (['benevoles', 'pere_noel', 'killer', 'mot_piege', 'equipes', 'cagnotte', 'assemblee', 'quiz'] as OptionalFeature[])
  .map(value => ({ value, label: featureLabel(value) }));

// Fonctions du Plan rangées par catégorie (fenêtres de création / modification / paramètres).
// `base` : active par défaut (décocher la masque) ; `optional` : à activer. Les catégories `collapsible`
// sont repliées tant qu'aucune de leurs fonctions n'est cochée.
export type FeatureItem =
  | { kind: 'base'; value: PlanFeature; label: string; hint: string }
  | { kind: 'optional'; value: OptionalFeature; label: string; hint: string };

const item = <K extends 'base' | 'optional'>(kind: K, value: K extends 'base' ? PlanFeature : OptionalFeature) =>
  ({ kind, value, label: t(`settings.items.${value}.label` as any), hint: t(`settings.items.${value}.hint` as any) }) as FeatureItem;

export const FEATURE_GROUPS: { key: string; title: string; icon: string; collapsible?: boolean; items: FeatureItem[] }[] = [
  { key: 'echanger', title: t('settings.groups.echanger'), icon: '💬', items: [item('base', 'chat'), item('base', 'votes'), item('base', 'fichiers')] },
  { key: 'organiser', title: t('settings.groups.organiser'), icon: '🧭', items: [item('base', 'trajets'), item('base', 'depenses'), item('optional', 'benevoles'), item('optional', 'assemblee')] },
  { key: 'feter', title: t('settings.groups.feter'), icon: '🎁', collapsible: true, items: [item('optional', 'cagnotte'), item('optional', 'pere_noel')] },
  { key: 'jouer', title: t('settings.groups.jouer'), icon: '🎲', collapsible: true, items: [item('optional', 'quiz'), item('optional', 'killer'), item('optional', 'mot_piege'), item('optional', 'equipes')] },
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
