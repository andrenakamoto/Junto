import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Choix d'une date avec un vrai calendrier (on voit le jour de la semaine), à la place des
// listes défilantes des champs natifs sur téléphone. Même format de valeur que les champs natifs :
// « AAAA-MM-JJTHH:MM » (mode datetime) ou « AAAA-MM-JJ » (mode date), chaîne vide si rien.

interface Props {
  value: string;
  onChange: (value: string) => void;
  mode?: 'datetime' | 'date';
  label?: string;
  placeholder?: string;
  required?: boolean;
  /** Effacer la date (champs facultatifs) */
  clearable?: boolean;
  /** Heure proposée quand on choisit un jour sans heure encore définie */
  defaultTime?: string;
  /** Mois affiché à l'ouverture quand le champ est vide (AAAA-MM-JJ…) */
  openAt?: string;
  dark?: boolean;
  className?: string;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

function parse(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, y: +m[1], mo: +m[2] - 1, time: m[4] ? `${m[4]}:${m[5]}` : null };
}

function formatValue(value: string, mode: 'datetime' | 'date') {
  const p = parse(value);
  if (!p) return '';
  const d = new Date(`${p.date}T12:00`);
  const weekday = d.toLocaleDateString('fr-CH', { weekday: 'long' });
  const day = `${weekday} ${d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const txt = day.charAt(0).toUpperCase() + day.slice(1);
  return mode === 'datetime' && p.time ? `${txt} à ${p.time.replace(':', 'h')}` : txt;
}

export function DateTimeField({ value, onChange, mode = 'datetime', label, placeholder = 'Choisir une date', required, clearable, defaultTime = '19:00', openAt, dark, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const parsed = parse(value);
  const start = parsed ?? parse(openAt ?? '') ?? parse(ymd(new Date()))!;
  const [view, setView] = useState({ y: start.y, mo: start.mo });
  const [draftTime, setDraftTime] = useState(defaultTime);

  useEffect(() => {
    if (open) setView({ y: start.y, mo: start.mo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(view.y, view.mo, 1);
    const offset = (first.getDay() + 6) % 7; // lundi en premier
    const count = new Date(view.y, view.mo + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  }, [view]);

  const today = ymd(new Date());
  const time = parsed?.time ?? draftTime;
  const [hh, mm] = time.split(':');
  const minuteOptions = MINUTES.includes(mm) ? MINUTES : [...MINUTES, mm].sort();

  function pickDay(day: number) {
    const date = `${view.y}-${pad(view.mo + 1)}-${pad(day)}`;
    if (mode === 'date') { onChange(date); setOpen(false); return; }
    onChange(`${date}T${time}`);
  }

  function setTime(h: string, m: string) {
    if (parsed) onChange(`${parsed.date}T${h}:${m}`);
    else setDraftTime(`${h}:${m}`);
  }

  function move(delta: number) {
    setView(v => {
      const d = new Date(v.y, v.mo + delta, 1);
      return { y: d.getFullYear(), mo: d.getMonth() };
    });
  }

  const monthLabel = new Date(view.y, view.mo, 1).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
  const field = dark
    ? 'bg-slate-900/60 border-slate-700 text-white rounded-xl px-4 py-3'
    : 'bg-white border-slate-300 text-slate-900 rounded-lg px-3 py-2';
  const panel = dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800';
  const select = dark
    ? 'bg-slate-900 border-slate-600 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className={`text-sm font-medium ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-2 border text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${field} ${open ? 'ring-2 ring-indigo-500 border-transparent' : ''}`}
        >
          <CalendarDays size={16} className={dark ? 'text-slate-400 flex-shrink-0' : 'text-slate-400 flex-shrink-0'} />
          <span className={`flex-1 truncate ${value ? '' : dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {value ? formatValue(value, mode) : placeholder}
          </span>
        </button>
        {clearable && value && (
          <button type="button" onClick={() => { onChange(''); setOpen(false); }} aria-label="Effacer la date"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500">
            <X size={15} />
          </button>
        )}
        {/* Garde la validation du formulaire (« champ obligatoire ») */}
        {required && (
          <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}}
            className="absolute inset-x-0 bottom-0 h-px opacity-0 pointer-events-none" />
        )}
      </div>

      {open && (
        <div className={`mt-1 rounded-xl border p-3 shadow-sm ${panel}`}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => move(-1)} className="p-1.5 rounded-lg hover:bg-slate-500/15" aria-label="Mois précédent"><ChevronLeft size={18} /></button>
            <span className="text-sm font-semibold capitalize">{monthLabel}</span>
            <button type="button" onClick={() => move(1)} className="p-1.5 rounded-lg hover:bg-slate-500/15" aria-label="Mois suivant"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className={`text-[11px] font-semibold py-1 ${i >= 5 ? 'text-indigo-500' : dark ? 'text-slate-400' : 'text-slate-400'}`}>{d}</span>
            ))}
            {days.map((day, i) => {
              if (!day) return <span key={i} />;
              const date = `${view.y}-${pad(view.mo + 1)}-${pad(day)}`;
              const selected = parsed?.date === date;
              const isToday = date === today;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`h-9 rounded-lg text-sm transition-colors ${
                    selected ? 'bg-indigo-600 text-white font-semibold'
                      : isToday ? 'text-indigo-600 font-semibold ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50/60'
                      : 'hover:bg-slate-500/15'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          {mode === 'datetime' && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-500/20">
              <span className="text-sm font-medium flex-1">Heure</span>
              <select value={hh} onChange={e => setTime(e.target.value, mm)} aria-label="Heure"
                className={`border rounded-lg px-2 py-1.5 text-sm ${select}`}>
                {HOURS.map(h => <option key={h} value={h}>{h} h</option>)}
              </select>
              <select value={mm} onChange={e => setTime(hh, e.target.value)} aria-label="Minutes"
                className={`border rounded-lg px-2 py-1.5 text-sm ${select}`}>
                {minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" onClick={() => setOpen(false)}
                className="ml-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
