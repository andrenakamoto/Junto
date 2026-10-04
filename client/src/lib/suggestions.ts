// « Proposer une amélioration » : libellés partagés entre la fenêtre des membres
// (SuggestionModal) et le panneau admin (SuggestionsPanel). Serveur : lib/suggestions.ts.
export type SuggestionKind = 'idea' | 'bug' | 'other';
export type SuggestionStatus = 'new' | 'review' | 'planned' | 'done' | 'declined';

export const SUGGESTION_MAX = 1000;

export const SUGGESTION_KINDS: { value: SuggestionKind; label: string; placeholder: string }[] = [
  { value: 'idea', label: '💡 Idée', placeholder: 'Qu’est-ce qui rendrait EvLY plus pratique pour toi ?' },
  { value: 'bug', label: '🐞 Problème', placeholder: 'Qu’est-ce qui ne fonctionne pas ? Où, et que s’est-il passé ?' },
  { value: 'other', label: '💬 Autre', placeholder: 'Ton message pour l’équipe EvLY…' },
];

export const SUGGESTION_STATUSES: { value: SuggestionStatus; label: string; className: string }[] = [
  { value: 'new', label: 'Envoyée', className: 'bg-slate-100 text-slate-600' },
  { value: 'review', label: 'À l’étude', className: 'bg-sky-100 text-sky-700' },
  { value: 'planned', label: 'Prévue', className: 'bg-amber-100 text-amber-800' },
  { value: 'done', label: 'Réalisée', className: 'bg-emerald-100 text-emerald-700' },
  { value: 'declined', label: 'Pas retenue', className: 'bg-slate-100 text-slate-500' },
];

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
