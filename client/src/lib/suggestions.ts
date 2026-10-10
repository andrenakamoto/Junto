import { t } from '../i18n';
// « Proposer une amélioration » : libellés partagés entre la fenêtre des membres
// (SuggestionModal) et le panneau admin (SuggestionsPanel). Serveur : lib/suggestions.ts.
export type SuggestionKind = 'idea' | 'bug' | 'other';
export type SuggestionStatus = 'new' | 'review' | 'planned' | 'done' | 'declined';

export const SUGGESTION_MAX = 1000;

export const SUGGESTION_KINDS: { value: SuggestionKind; label: string; placeholder: string }[] = (['idea', 'bug', 'other'] as SuggestionKind[])
  .map(value => ({ value, label: t(`settings.suggestion.kinds.${value}.label`), placeholder: t(`settings.suggestion.kinds.${value}.placeholder`) }));

const STATUS_CLASS: Record<SuggestionStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  review: 'bg-sky-100 text-sky-700',
  planned: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-slate-100 text-slate-500',
};
export const SUGGESTION_STATUSES: { value: SuggestionStatus; label: string; className: string }[] = (Object.keys(STATUS_CLASS) as SuggestionStatus[])
  .map(value => ({ value, label: t(`settings.suggestion.statuses.${value}`), className: STATUS_CLASS[value] }));

export const kindLabel = (k: string) => SUGGESTION_KINDS.find(x => x.value === k)?.label ?? k;
export const statusOf = (s: string) => SUGGESTION_STATUSES.find(x => x.value === s) ?? SUGGESTION_STATUSES[0];

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  content: string;
  status: SuggestionStatus;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
  platform?: string | null;
  appVersion?: string | null;
  user?: { pseudo: string; firstName: string | null };
}
