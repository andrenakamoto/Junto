import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import api from '../../services/api';

interface Step { page: string; label: string; last7: number; last30: number; total: number }

// Parcours d'inscription (serveur : lib/funnel.ts) : totaux anonymes par étape, pour voir où
// les visiteurs décrochent. Barres relatives à la première étape (visites de la page Découvrir).
export function FunnelPanel() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [range, setRange] = useState<'last7' | 'last30' | 'total'>('last30');

  useEffect(() => {
    api.get('/admin/funnel').then(res => setSteps(res.data)).catch(() => setSteps([]));
  }, []);

  const max = Math.max(1, ...(steps ?? []).map(s => s[range]));
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <TrendingDown size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-800">Parcours d'inscription</h2>
        <select value={range} onChange={e => setRange(e.target.value as typeof range)} className="ml-auto text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value="last7">7 jours</option>
          <option value="last30">30 jours</option>
          <option value="total">Depuis le début</option>
        </select>
      </div>
      <p className="text-xs text-slate-500 mb-3">Totaux anonymes par étape (sans cookie ni identifiant), comptés depuis le 5 octobre 2026 sauf les visites de la page Découvrir.</p>
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        {steps === null && <p className="text-sm text-slate-400">Chargement…</p>}
        {steps?.map(s => (
          <div key={s.page}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{s.label}</span>
              <span className="font-semibold text-slate-800">{s[range]}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(s[range] / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
