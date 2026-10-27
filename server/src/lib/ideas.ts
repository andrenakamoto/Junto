// Idées d'un Plan (fonction à activer « idees ») : un brainstorming en séance, l'app projetée sur un seul écran et une
// personne au clavier. Thèmes en colonnes, post-its ajoutés au clavier, statut (retenue, écartée, à creuser), votes à
// main levée notés avec + et −, couleur, fusion de deux idées proches, « transformer en tâche » (lib/tasks.ts). Tout le
// monde qui voit le Plan modifie le tableau (Plan réservé à l'équipe) ; pas de notification : la séance se fait ensemble.

export const IDEAS_FEATURE = 'idees';
export const IDEA_TEXT_MAX = 300;
// Deux idées fusionnées peuvent dépasser la limite d'une saisie
export const IDEA_MERGED_MAX = 1000;
export const COLUMN_TITLE_MAX = 60;
export const MAX_IDEAS = 500;
export const MAX_COLUMNS = 20;
export const IDEAS_DISABLED_ERROR = 'Les idées ne sont pas activées pour ce Plan';

export const IDEA_STATUSES = ['new', 'kept', 'dropped', 'explore'] as const;
export const IDEA_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;

export function ideasEnabled(plan: { enabledFeatures: string[] }): boolean {
  return plan.enabledFeatures.includes(IDEAS_FEATURE);
}

export function parseIdeaText(v: unknown): string | { error: string } {
  const text = typeof v === 'string' ? v.trim() : '';
  if (!text) return { error: 'Idée vide' };
  if (text.length > IDEA_TEXT_MAX) return { error: `Idée : ${IDEA_TEXT_MAX} caractères maximum` };
  return text;
}

export function parseColumnTitle(v: unknown): string | { error: string } {
  const title = typeof v === 'string' ? v.trim() : '';
  if (!title) return { error: 'Nom du thème requis' };
  if (title.length > COLUMN_TITLE_MAX) return { error: `Nom du thème : ${COLUMN_TITLE_MAX} caractères maximum` };
  return title;
}

export const isIdeaStatus = (v: unknown): v is typeof IDEA_STATUSES[number] => typeof v === 'string' && (IDEA_STATUSES as readonly string[]).includes(v);
export const isIdeaColor = (v: unknown): v is typeof IDEA_COLORS[number] => typeof v === 'string' && (IDEA_COLORS as readonly string[]).includes(v);

// Fusion : le texte de l'idée absorbée s'ajoute (sauf s'il y est déjà), les votes s'additionnent, le statut le plus
// avancé est gardé (retenue > à creuser > nouvelle > écartée)
const RANK: Record<string, number> = { kept: 3, explore: 2, new: 1, dropped: 0 };
export function mergeIdeas(into: { text: string; votes: number; status: string }, from: { text: string; votes: number; status: string }) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const text = norm(into.text).includes(norm(from.text)) ? into.text : `${into.text} / ${from.text}`;
  return {
    text: text.slice(0, IDEA_MERGED_MAX),
    votes: into.votes + from.votes,
    status: (RANK[from.status] ?? 0) > (RANK[into.status] ?? 0) ? from.status : into.status,
  };
}

export function moveInList(ids: string[], id: string, dir: 'left' | 'right'): string[] {
  const i = ids.indexOf(id);
  const j = dir === 'left' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
