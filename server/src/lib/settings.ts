import prisma from './prisma';
import { IMPORTANT_INFO_MAX, parseRichInput } from './richText';


// Paramètres avancés des Cercles et des Plans (associations, entreprises…).
// Masquer une fonction ne supprime aucune donnée : elle réapparaît telle quelle si on la réactive.

export const DELETION_MODES = ['vote', 'creator'] as const;
export const ADMISSION_MODES = ['vote', 'creator', 'open'] as const;
// Infos et Membres restent toujours actifs.
export const PLAN_FEATURES = ['chat', 'trajets', 'votes', 'depenses', 'fichiers'] as const;

export type PlanFeature = typeof PLAN_FEATURES[number];

export function parseDeletionMode(v: unknown): string | undefined {
  return typeof v === 'string' && (DELETION_MODES as readonly string[]).includes(v) ? v : undefined;
}

export function parseAdmissionMode(v: unknown): string | undefined {
  return typeof v === 'string' && (ADMISSION_MODES as readonly string[]).includes(v) ? v : undefined;
}

export function parseDisabledFeatures(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter((f): f is string => typeof f === 'string' && (PLAN_FEATURES as readonly string[]).includes(f)))];
}

export function featureEnabled(plan: { disabledFeatures: string[] }, feature: PlanFeature): boolean {
  return !plan.disabledFeatures.includes(feature);
}

// Fonctions à activer (absentes par défaut, y compris sur les Plans existants) :
// le planning des bénévoles (lib/volunteers.ts)
export const OPTIONAL_FEATURES = ['benevoles', 'pere_noel', 'killer', 'equipes', 'cagnotte', 'mot_piege', 'assemblee', 'quiz'] as const;
export type OptionalFeature = typeof OPTIONAL_FEATURES[number];

export function parseEnabledFeatures(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter((f): f is string => typeof f === 'string' && (OPTIONAL_FEATURES as readonly string[]).includes(f)))];
}

export const FEATURE_DISABLED_ERROR = 'Cette fonction est désactivée pour ce Plan';

// Vérification côté serveur (le client masque déjà la fonction, mais on ne s'y fie pas)
export async function isFeatureDisabled(planId: string, feature: PlanFeature): Promise<boolean> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { disabledFeatures: true } });
  return !!plan && plan.disabledFeatures.includes(feature);
}

// Qui peut modifier les dates et le lieu d'un Plan (titre, description et le reste : créateur seul)
export const EDIT_MODES = ['creator', 'all'] as const;

export function parseEditMode(v: unknown): string | undefined {
  return typeof v === 'string' && (EDIT_MODES as readonly string[]).includes(v) ? v : undefined;
}

// Informations importantes d'un Plan (affichées après la description) : qui peut les modifier,
// réglage distinct d'editMode — 'creator' (créateur du Plan) ou 'all' (tous les participants)
export { IMPORTANT_INFO_MAX } from './richText';

// Qui ajoute des photos et fichiers dans un Plan (routes/attachments.ts) : tous les participants, ou le créateur et les organisateurs
export const FILES_MODES = ['all', 'managers'] as const;
export function parseFilesMode(v: unknown): 'all' | 'managers' | undefined {
  return v === 'all' || v === 'managers' ? v : undefined;
}

// Qui invite des personnes extérieures dans un Plan (lien /invitation) : du plus ouvert au plus fermé
export const GUEST_INVITE_MODES = ['all', 'managers', 'none'] as const;
export type GuestInviteMode = typeof GUEST_INVITE_MODES[number];
export function parseGuestInviteMode(v: unknown): GuestInviteMode | undefined {
  return (GUEST_INVITE_MODES as readonly unknown[]).includes(v) ? v as GuestInviteMode : undefined;
}

export function parseImportantInfoMode(v: unknown): string | undefined {
  return parseEditMode(v);
}

// Texte des informations importantes (mis en forme, lib/richText.ts) : vide → null ; undefined si trop long
// (IMPORTANT_INFO_MAX caractères visibles, repères de mise en forme non comptés)
export function parseImportantInfo(v: unknown): string | null | undefined {
  const text = parseRichInput(v, IMPORTANT_INFO_MAX);
  return text === undefined ? undefined : (text || null);
}

// Qui peut créer des Plans, et séparément des sondages de dates, dans un Cercle :
// 'all' (tous les membres) ou 'creator' (créateur et organisateurs)
export const PLAN_CREATION_MODES = ['all', 'creator'] as const;

export function parsePlanCreationMode(v: unknown): string | undefined {
  return typeof v === 'string' && (PLAN_CREATION_MODES as readonly string[]).includes(v) ? v : undefined;
}

export const parsePollCreationMode = parsePlanCreationMode;

// Discussion du Cercle : ouverte à tous, annonces (créateur et organisateurs écrivent), désactivée
export const CHAT_MODES = ['open', 'announce', 'off'] as const;
export function parseChatMode(v: unknown): string | undefined {
  return typeof v === 'string' && (CHAT_MODES as readonly string[]).includes(v) ? v : undefined;
}

export const PLAN_CREATION_RESERVED_ERROR = 'Dans ce Cercle, seuls le créateur et les organisateurs peuvent créer des Plans';
export const POLL_CREATION_RESERVED_ERROR = 'Dans ce Cercle, seuls le créateur et les organisateurs peuvent lancer des sondages de dates';
