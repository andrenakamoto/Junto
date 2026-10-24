import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '../../services/api';

interface Row { kind: string; label: string; last30: number; total: number; active: number }

// Plans créés par type (« Créer › Plan standard / Plan spécifique », serveur : lib/planKinds.ts). Compteurs anonymes
// (PageVisit) depuis le 24 octobre 2026, plus les Plans en cours de chaque type.
export function PlanKindsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [range, setRange] = useState<'last30' | 'total' | 'active'>('last30');

  useEffect(() => {
    api.get('/admin/plan-kinds').then(res => setRows(res.data)).catch(() => setRows([]));
  }, []);

  const max = Math.max(1, ...(rows ?? []).map(r => r[range]));
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-800">Types de Plans</h2>
        <select value={range} onChange={e => setRange(e.target.value as typeof range)} className="ml-auto text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value="last30">Créés (30 jours)</option>
          <option value="total">Créés (depuis le début)</option>
          <option value="active">En cours</option>
        </select>
      </div>
      <p className="text-xs text-slate-500 mb-3">Plans créés par type depuis le menu « Créer », comptés depuis le 24 octobre 2026 (les Plans plus anciens sont « standard »).</p>
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
        {rows === null && <p className="text-sm text-slate-400">Chargement…</p>}
        {rows?.map(r => (
          <div key={r.kind}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{r.label}</span>
              <span className="font-semibold text-slate-800">{r[range]}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r[range] / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
