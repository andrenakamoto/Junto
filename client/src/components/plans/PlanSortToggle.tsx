import { t } from '../../i18n';
import type { PlanSort } from '../../lib/planSort';

// Deux boutons accolés « Activité » / « Date » en tête d'une liste de Plans
export function PlanSortToggle({ value, onChange }: { value: PlanSort; onChange: (s: PlanSort) => void }) {
  return (
    <div role="group" aria-label={t('plan.sort.label')} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold">
      {(['activity', 'date'] as const).map(s => (
        <button key={s} type="button" onClick={() => onChange(s)} aria-pressed={value === s}
          className={`px-2.5 py-1 rounded-md transition-colors ${value === s ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
          {t(`plan.sort.${s}`)}
        </button>
      ))}
    </div>
  );
}
