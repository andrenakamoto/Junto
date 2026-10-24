import { t } from '../i18n';
import { FilesMode, GuestInviteMode, MembersVisibility } from './settings';
import { OptionalFeature, PlanFeature } from '../types';
import { Recurrence } from './recurrence';

// « Créer › Plan spécifique » : chaque type pré-règle la fenêtre de création (fonctions, règles, dates, infos importantes).
// Rien n'est figé : tout reste modifiable dans « Plus d'options », puis dans « Modifier ». Le serveur garde seulement le
// type (Plan.kind) pour les statistiques (server/src/lib/planKinds.ts).
export type PlanKind = 'surprise' | 'pere_noel' | 'assemblee' | 'organisation' | 'annonce' | 'cours' | 'jeux' | 'voyage';

export const PLAN_KINDS: { kind: PlanKind; emoji: string; managersOnly?: boolean }[] = [
  { kind: 'surprise', emoji: '🎂' },
  { kind: 'pere_noel', emoji: '🎅' },
  { kind: 'assemblee', emoji: '🗳️', managersOnly: true },
  { kind: 'organisation', emoji: '📋' },
  { kind: 'annonce', emoji: '📣' },
  { kind: 'cours', emoji: '🔁' },
  { kind: 'jeux', emoji: '🎲' },
  { kind: 'voyage', emoji: '🧳' },
];

// Jeux proposés par « Soirée jeux » (au moins un)
export const KIND_GAMES: OptionalFeature[] = ['quiz', 'killer', 'mot_piege', 'equipes'];

export interface KindPreset {
  title?: string;
  start?: string; end?: string;
  /** Durée proposée quand on choisit le début (3 h sinon) */
  durationMs?: number;
  disabled?: PlanFeature[];
  enabled?: OptionalFeature[];
  membersVisibility?: MembersVisibility;
  filesMode?: FilesMode;
  guestInviteMode?: GuestInviteMode;
  recurrence?: Recurrence;
  /** Plan caché à certaines personnes, pour une surprise */
  surprise?: boolean;
  importantInfo?: string;
  /** Onglet ouvert après la création */
  tab?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
// Père Noël secret : du 24 décembre midi au 31 décembre 22 h (l'année suivante si la date est passée)
export function santaDefaultDates(now = new Date()) {
  let y = now.getFullYear();
  if (now > new Date(y, 11, 24, 12, 0)) y++;
  return { start: `${y}-${pad(12)}-24T12:00`, end: `${y}-${pad(12)}-31T22:00` };
}

export function kindPreset(kind: PlanKind): KindPreset {
  switch (kind) {
    case 'surprise':
      return { enabled: ['cagnotte'], surprise: true, importantInfo: t('plan.kinds.surprise.info'), tab: 'cagnotte' };
    case 'pere_noel':
      return { title: t('plan.kinds.pere_noel.title'), ...santaDefaultDates(), enabled: ['pere_noel'], disabled: ['trajets', 'depenses'],
        importantInfo: t('plan.kinds.pere_noel.info'), tab: 'pere_noel' };
    case 'assemblee':
      return { title: t('plan.kinds.assemblee.title', { year: new Date().getFullYear() }), enabled: ['assemblee'], disabled: ['votes', 'depenses'],
        guestInviteMode: 'none', filesMode: 'managers', importantInfo: t('plan.kinds.assemblee.info'), tab: 'assemblee' };
    case 'organisation':
      return { enabled: ['benevoles'], guestInviteMode: 'managers', importantInfo: t('plan.kinds.organisation.info'), tab: 'benevoles' };
    case 'annonce':
      return { disabled: ['chat', 'trajets', 'votes', 'depenses'], membersVisibility: 'managers', filesMode: 'managers', guestInviteMode: 'all', tab: 'infos' };
    case 'cours':
      return { durationMs: 90 * 60e3, disabled: ['depenses'], recurrence: 'weekly' };
    case 'jeux':
      return {};
    case 'voyage':
      return { durationMs: 2 * 864e5, importantInfo: t('plan.kinds.voyage.info') };
  }
}
