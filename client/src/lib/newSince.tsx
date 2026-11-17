import { createContext, useContext } from 'react';
import { t } from '../i18n';

// Mise en évidence de ce qui a changé depuis la dernière visite d'une rubrique (2026-11-17, demande de l'utilisateur :
// « mettre en évidence le changement là où il s'est fait »). PlanDetail garde, pour le Plan ouvert, la date de la visite
// précédente de chaque rubrique (seenAt du serveur, ou `previous` renvoyé par POST /plans/:id/seen) : tout ce qui est plus
// récent, et pas fait par soi, est entouré d'orange avec « Nouveau » le temps de la visite. Au prochain passage, la rubrique
// a été vue : tout revient à la normale.

export interface NewSince {
  /** Rubrique → date ISO de la visite précédente */
  since: Record<string, string>;
  me: string;
}

const Ctx = createContext<NewSince | null>(null);
export const NewSinceProvider = Ctx.Provider;

/** isNew('membres', member.joinedAt, member.userId) */
export function useIsNew() {
  const c = useContext(Ctx);
  return (section: string, at?: string | null, authorId?: string | null): boolean => {
    if (!c || !at) return false;
    const s = c.since[section];
    if (!s) return false; // jamais vue (ou Plan rejoint avant le 2026-10-01) : rien à mettre en évidence
    if (authorId && authorId === c.me) return false;
    return new Date(at).getTime() > new Date(s).getTime();
  };
}

/** La plus récente des dates (ex. arrivée et changement de réponse d'un membre) */
export const latest = (...dates: (string | null | undefined)[]): string | null =>
  dates.filter(Boolean).sort().pop() ?? null;

/** Cadre orange d'un élément nouveau */
export const NEW_CLASS = 'ring-2 ring-orange-400 bg-orange-50/60';

export function NewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 leading-none ${className}`}>
      {t('notif.highlight.new')}
    </span>
  );
}
