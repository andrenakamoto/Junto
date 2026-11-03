import { CalendarDays, List } from 'lucide-react';
import { t } from '../../i18n';

// « Tous mes plans » : liste ou calendrier (2026-11-03 : le Calendrier n'a plus son propre bouton dans la colonne des Cercles)
export function PlansViewToggle({ value, onChange }: { value: 'list' | 'calendar'; onChange: (v: 'list' | 'calendar') => void }) {
  const item = (v: 'list' | 'calendar', Icon: typeof List, label: string) => (
    <button onClick={() => v !== value && onChange(v)} aria-pressed={value === v}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${value === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
      <Icon size={15} />{label}
    </button>
  );
  return (
    <div className="flex gap-1 p-1 mx-3 mt-3 rounded-xl bg-slate-200/70">
      {item('list', List, t('plan.calendar.list'))}
      {item('calendar', CalendarDays, t('plan.calendar.title'))}
    </div>
  );
}
