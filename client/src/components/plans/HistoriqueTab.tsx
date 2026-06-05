import { History } from 'lucide-react';
import { PlanChangeLog } from '../../types';

const fieldLabel: Record<string, string> = {
  title: 'Titre',
  description: 'Description',
  eventDate: "Date de l'événement",
  endDate: 'Date de fin',
};

function formatValue(field: string, value: string | null): string {
  if (value === null) return '—';
  if (field === 'eventDate' || field === 'endDate') {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  }
  return value.length > 80 ? value.slice(0, 80) + '…' : value;
}

interface Props {
  changeLogs: PlanChangeLog[];
}

export function HistoriqueTab({ changeLogs }: Props) {
  if (changeLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 text-slate-400">
        <History size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Aucune modification enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
      {[...changeLogs].reverse().map(log => {
        const date = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date(log.changedAt));

        return (
          <div key={log.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                {fieldLabel[log.field] ?? log.field}
              </span>
              <span className="text-xs text-slate-400">{date}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-400 w-14 flex-shrink-0 pt-0.5">Avant</span>
                <span className="text-xs text-slate-500 bg-red-50 px-2 py-1 rounded-md flex-1 line-through">
                  {formatValue(log.field, log.oldValue)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-400 w-14 flex-shrink-0 pt-0.5">Après</span>
                <span className="text-xs text-slate-800 bg-emerald-50 px-2 py-1 rounded-md flex-1 font-medium">
                  {formatValue(log.field, log.newValue)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
