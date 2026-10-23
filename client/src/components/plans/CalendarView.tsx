import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';

interface Props {
  onSelectPlan: (plan: Plan) => void;
  selectedPlanId: string | null;
  onBack: () => void;
  refreshSignal?: number;
}

// Initiales des jours (lundi → dimanche) et nom du mois, dans la langue de l'app
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
const monthName = (year: number, month: number) => {
  const s = new Intl.DateTimeFormat(intlLocale(), { month: 'long' }).format(new Date(year, month, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const nextDay = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };
const DEFAULT_COLOR = '#ea5a2b';
const MAX_LANES = 2;
const MAX_DOTS = 3;

export function CalendarView({ onSelectPlan, selectedPlanId, onBack, refreshSignal }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    api.get('/plans').then(res => setPlans(res.data)).finally(() => setLoading(false));
  }, [refreshSignal]);

  // Jours couverts par chaque Plan (du jour du début au jour de fin ; une soirée qui finit avant 6 h compte pour un
  // seul jour), et « piste » des Plans sur plusieurs jours (2 traits au plus l'un sous l'autre)
  const { plansByDay, spanOf, laneOf } = useMemo(() => {
    const byDay = new Map<string, Plan[]>();
    const spans = new Map<string, { first: number; last: number }>();
    for (const plan of plans) {
      if (!plan.eventDate) continue;
      const first = dayStart(new Date(plan.eventDate));
      const last = Math.max(first, dayStart(new Date(new Date(plan.endDate).getTime() - 6 * 3600e3)));
      spans.set(plan.id, { first, last });
      for (let d = first; d <= last; d = nextDay(d)) {
        const key = dateKey(new Date(d));
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(plan);
      }
    }
    const lanes = new Map<string, number>();
    const laneEnds: number[] = [];
    for (const plan of [...plans].filter(p => spans.has(p.id) && spans.get(p.id)!.last > spans.get(p.id)!.first)
      .sort((a, b) => spans.get(a.id)!.first - spans.get(b.id)!.first)) {
      const { first, last } = spans.get(plan.id)!;
      let lane = laneEnds.findIndex(end => end < first);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(last); } else laneEnds[lane] = last;
      lanes.set(plan.id, lane);
    }
    return { plansByDay: byDay, spanOf: spans, laneOf: lanes };
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
    <div className="w-full bg-slate-50 flex flex-col h-full flex-shrink-0 border-r border-slate-200 short:overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold text-slate-900 text-sm">{t('plan.calendar.title')}</h2>
      </div>

      <div className="px-3 py-3 flex items-center justify-between">
        <button
          onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-900">{monthName(year, month)} {year}</span>
        <button
          onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
            const t0 = d.getTime();
            const dayPlans = plansByDay.get(key) ?? [];
            const spanning = dayPlans.filter(p => laneOf.has(p.id) && laneOf.get(p.id)! < MAX_LANES);
            const single = dayPlans.filter(p => !spanning.includes(p));
            const isToday = dateKey(today) === key;
            const isSelected = selectedDay && dateKey(selectedDay) === key;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : d)}
                aria-label={`${d.getDate()} · ${dayPlans.length}`}
                className={`h-12 rounded-lg flex flex-col items-stretch pt-1 text-xs relative transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-semibold'
                    : isToday
                    ? 'bg-indigo-50 text-indigo-700 font-semibold ring-1 ring-inset ring-indigo-300'
                    : dayPlans.length > 0
                    ? 'bg-white text-slate-800 hover:bg-slate-100'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="text-center leading-4">{d.getDate()}</span>
                {/* Traits : un Plan sur plusieurs jours, d'un bout à l'autre */}
                <span className="mt-1 flex flex-col gap-[3px]">
                  {Array.from({ length: MAX_LANES }, (_, lane) => {
                    const p = spanning.find(x => laneOf.get(x.id) === lane);
                    if (!p) return <span key={lane} className="h-1" />;
                    const { first, last } = spanOf.get(p.id)!;
                    const starts = first === t0, ends = last === t0;
                    return (
                      <span key={lane} title={p.title}
                        className={`h-1 ${starts ? 'ml-1.5 rounded-l-full' : '-ml-[3px]'} ${ends ? 'mr-1.5 rounded-r-full' : '-mr-[3px]'}`}
                        style={{ background: isSelected ? '#fff' : p.circle?.color || DEFAULT_COLOR }} />
                    );
                  })}
                </span>
                {/* Points : un par Plan d'un seul jour */}
                {single.length > 0 && (
                  <span className="mt-[3px] flex items-center justify-center gap-[3px]">
                    {single.slice(0, MAX_DOTS).map(p => (
                      <span key={p.id} className="w-[5px] h-[5px] rounded-full" style={{ background: isSelected ? '#fff' : p.circle?.color || DEFAULT_COLOR }} />
                    ))}
                    {single.length > MAX_DOTS && <span className={`text-[9px] leading-none font-semibold ${isSelected ? 'text-white' : 'text-slate-500'}`}>+{single.length - MAX_DOTS}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-[5px] h-[5px] rounded-full bg-indigo-500" />{t('plan.calendar.legendDay')}</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded-full bg-indigo-500" />{t('plan.calendar.legendSpan')}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 mt-2 border-t border-slate-200 space-y-2 short:flex-none short:overflow-visible">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('common.loading')}</div>
        ) : !selectedDay ? (
          <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
            <CalendarIcon size={24} className="text-slate-400" />
            {t('plan.calendar.pickDay')}
          </div>
        ) : selectedDayPlans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('plan.calendar.noPlan')}</div>
        ) : (
          selectedDayPlans.map(plan => (
            <button
              key={plan.id}
              onClick={() => onSelectPlan(plan)}
              className={`w-full text-left p-3 rounded-xl transition-all border ${
                selectedPlanId === plan.id
                  ? 'bg-indigo-50 border-indigo-400 shadow-md'
                  : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow'
              }`}
            >
              <h3 className="font-semibold text-slate-900 text-sm leading-tight mb-1">{plan.title}</h3>
              <p className="text-slate-500 text-xs">{plan.isGuest ? t('plan.allPlans.invitation') : plan.circle?.name}</p>
              <p className="text-slate-500 text-xs mt-1">
                {(spanOf.get(plan.id)?.last ?? 0) > (spanOf.get(plan.id)?.first ?? 0)
                  ? [plan.eventDate!, plan.endDate].map(v => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(v))).join(' – ')
                  : new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate!))}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
