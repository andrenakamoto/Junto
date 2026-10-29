import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import api from '../../services/api';

interface Row { source: string; label: string; visits30: number; visits: number; signups30: number; signups: number }

// Provenance des visiteurs (serveur : lib/funnel.ts, client : lib/source.ts) : visites et inscriptions par source de
// campagne (liens evly.ch/…?src=instagram), totaux anonymes.
export function SourcesPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { api.get('/admin/sources').then(r => setRows(r.data)).catch(() => setRows([])); }, []);
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone size={18} className="text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-800">Provenance des visiteurs</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Liens de campagne avec <code>?src=</code> (ex. <code>evly.ch/pere-noel?src=instagram</code>). Une visite par source et par session ;
        une inscription compte si elle a lieu dans les 30 jours sur le même appareil. Totaux anonymes.
      </p>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-left font-medium px-4 py-2">Source (<code>src=</code>)</th>
              <th className="text-right font-medium px-3 py-2">Visites 30 j</th>
              <th className="text-right font-medium px-3 py-2">Inscriptions 30 j</th>
              <th className="text-right font-medium px-4 py-2">Total (visites / inscriptions)</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan={4} className="px-4 py-3 text-slate-400">Chargement…</td></tr>}
            {rows?.map(r => (
              <tr key={r.source} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 text-slate-700">{r.label} <span className="text-xs text-slate-400">{r.source}</span></td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.visits30}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.signups30}</td>
                <td className="px-4 py-2 text-right text-slate-500">{r.visits} / {r.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
