import { Repeat } from 'lucide-react';
import { Recurrence, RECURRENCE_OPTIONS, recurrenceLabel } from '../../lib/recurrence';

// Choix « Répéter » d'un Plan (création et modification, créateur seul). `until` : date
// AAAA-MM-JJ (facultative) ; la répétition demande une date et une heure d'événement.
export function RecurrenceField({ value, until, eventDateISO, onChange }: {
  value: Recurrence | '';
  until: string;
  eventDateISO: string | null;
  onChange: (value: Recurrence | '', until: string) => void;
}) {
  const label = recurrenceLabel(value || null, eventDateISO);
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
        <Repeat size={14} className="text-slate-400" /> Répéter
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as Recurrence | '', until)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm bg-white"
      >
        {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {value && (
        <div className="mt-2 space-y-1">
          {!eventDateISO ? (
            <p className="text-xs text-amber-600">Indique la date et l'heure de l'événement pour pouvoir répéter le Plan.</p>
          ) : (
            <p className="text-xs text-slate-500">
              {label}. Le Plan suivant est créé automatiquement dès que celui-ci est passé ; chacun y répond à nouveau.
            </p>
          )}
          <label className="block text-xs font-medium text-slate-600">Jusqu'au (facultatif)</label>
          <input
            type="date"
            value={until}
            onChange={e => onChange(value, e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
      )}
    </div>
  );
}

// Date « jusqu'au » (AAAA-MM-JJ) → fin de journée, en ISO pour le serveur
export function untilToISO(until: string): string | null {
  return until ? new Date(`${until}T23:59`).toISOString() : null;
}

// ISO → AAAA-MM-JJ (champ date)
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
