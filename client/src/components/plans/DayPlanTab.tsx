import { useEffect, useState } from 'react';
import { ChevronDown, HandHeart, ListOrdered } from 'lucide-react';
import { t } from '../../i18n';
import type { Plan } from '../../types';
import { ProgramTab } from './ProgramTab';
import { FullscreenButton, FullscreenFrame } from '../ui/FullscreenFrame';
import { VolunteersTab } from './VolunteersTab';

// Onglet « Jour J » (2026-11-03, demande de l'utilisateur : trop d'onglets dans un Plan d'organisation) : quand un Plan a
// les deux fonctions, un seul onglet de PlanDetail réunit le Déroulé puis le Planning, chacun repliable et replié à
// l'ouverture. Ouvrir une rubrique la marque « vue » (`onSeen`) ; une notification du Planning ouvre directement le Planning
// (`focus`).
type Section = 'deroule' | 'benevoles';

export function DayPlanTab({ plan, userId, onPlanUpdated, unseen, onSeen, focus, onFocusUsed }: {
  plan: Plan; userId: string; onPlanUpdated: (plan: Plan) => void;
  unseen: string[]; onSeen: (section: Section) => void; focus?: { section: Section; n: number } | null; onFocusUsed?: () => void;
}) {
  const [open, setOpen] = useState<Record<Section, boolean>>({ deroule: false, benevoles: false });
  const [full, setFull] = useState(false);
  useEffect(() => { setOpen({ deroule: false, benevoles: false }); }, [plan.id]);
  // Lien direct (notification, « En bref ») : la rubrique demandée s'ouvre, une seule fois
  useEffect(() => { if (focus) { setOpen(o => ({ ...o, [focus.section]: true })); onFocusUsed?.(); } }, [focus?.n]);
  // Rubrique ouverte : marquée « vue », y compris quand du nouveau arrive pendant qu'elle est ouverte
  useEffect(() => {
    (['deroule', 'benevoles'] as const).forEach(s => { if (open[s] && unseen.includes(s)) onSeen(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open.deroule, open.benevoles, unseen.join(',')]);

  const sections: { key: Section; Icon: typeof ListOrdered; title: string; hint: string }[] = [
    { key: 'deroule', Icon: ListOrdered, title: t('plan.detail.tabs.deroule'), hint: t('settings.items.deroule.hint') },
    { key: 'benevoles', Icon: HandHeart, title: t('plan.detail.tabs.benevoles'), hint: t('settings.items.benevoles.hint') },
  ];
  return (
    <FullscreenFrame full={full} onClose={() => setFull(false)} title={`${t('plan.detail.tabs.dayPlan')} · ${plan.title}`}>
    <div className={`flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-3 ${full ? '' : 'short:flex-none short:overflow-visible'}`}>
      {!full && <div className="flex justify-end"><FullscreenButton onClick={() => setFull(true)} /></div>}
      {sections.map(({ key, Icon, title, hint }) => (
        <section key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setOpen(o => ({ ...o, [key]: !o[key] }))} aria-expanded={open[key]}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-2xl">
            <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon size={18} /></span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                {title}
                {unseen.includes(key) && !open[key] && <span className="w-2 h-2 rounded-full bg-orange-500" />}
              </span>
              <span className="block text-xs text-slate-500 truncate">{hint}</span>
            </span>
            <ChevronDown size={18} className={`text-slate-400 flex-shrink-0 transition-transform ${open[key] ? 'rotate-180' : ''}`} />
          </button>
          {open[key] && (
            <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-slate-100">
              {key === 'deroule' ? <ProgramTab plan={plan} userId={userId} embedded /> : <VolunteersTab plan={plan} userId={userId} onPlanUpdated={onPlanUpdated} embedded />}
            </div>
          )}
        </section>
      ))}
    </div>
    </FullscreenFrame>
  );
}
