import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';

interface Props {
  onSelectPlan: (plan: Plan) => void;
  selectedPlanId: string | null;
  onBack: () => void;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function CalendarView({ onSelectPlan, selectedPlanId, onBack }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    api.get('/plans').then(res => setPlans(res.data)).finally(() => setLoading(false));
  }, []);

  const plansByDay = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const plan of plans) {
      if (!plan.eventDate) continue;
      const key = dateKey(new Date(plan.eventDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(plan);
    }
    return map;
  }, [plans]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const today = new Date();
  const selectedDayPlans = selectedDay ? (plansByDay.get(dateKey(selectedDay)) ?? []) : [];

  return (
    <div className="w-full bg-slate-800 flex flex-col h-full flex-shrink-0 border-r border-slate-700/50">
      <div className="px-4 py-4 border-b border-slate-700/50 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold text-white text-sm">Calendrier</h2>
      </div>

      <div className="px-3 py-3 flex items-center justify-between">
        <button
          onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-white">{MONTH_NAMES[month]} {year}</span>
        <button
          onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="px-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = dateKey(d);
            const dayPlans = plansByDay.get(key) ?? [];
            const isToday = dateKey(today) === key;
            const isSelected = selectedDay && dateKey(selectedDay) === key;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : d)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-semibold'
                    : isToday
                    ? 'bg-slate-700 text-white font-semibold border border-indigo-500/50'
                    : dayPlans.length > 0
                    ? 'bg-slate-700/50 text-slate-200 hover:bg-slate-700'
                    : 'text-slate-500 hover:bg-slate-700/40'
                }`}
              >
                {d.getDate()}
                {dayPlans.length > 0 && (
                  <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-indigo-400'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 mt-2 border-t border-slate-700/50 space-y-2">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Chargement...</div>
        ) : !selectedDay ? (
          <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
            <CalendarIcon size={24} className="text-slate-600" />
            Sélectionne un jour pour voir les Plans
          </div>
        ) : selectedDayPlans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">Aucun Plan ce jour-là.</div>
        ) : (
          selectedDayPlans.map(plan => (
            <button
              key={plan.id}
              onClick={() => onSelectPlan(plan)}
              className={`w-full text-left p-3 rounded-xl transition-all border ${
                selectedPlanId === plan.id
                  ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md'
                  : 'bg-slate-700/40 border-slate-600/40 hover:bg-slate-700/70 hover:border-slate-500/60'
              }`}
            >
              <h3 className="font-semibold text-white text-sm leading-tight mb-1">{plan.title}</h3>
              <p className="text-indigo-300/80 text-xs">{plan.circle?.name}</p>
              <p className="text-indigo-300 text-xs mt-1">
                {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate!))}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
