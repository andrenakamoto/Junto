import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import api from '../../services/api';

interface VisitDay { day: string; count: number }
interface VisitStats { days: VisitDay[]; last7: number; last30: number; total: number }

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const label = (d: string, fmt = dayFmt) => fmt.format(new Date(`${d}T00:00:00Z`));

// Visites de la page publique « Découvrir » : compteur anonyme (un total par jour,
// sans cookie ni donnée personnelle), 30 derniers jours.
export function PageVisitsPanel() {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    api.get('/admin/page-visits').then(res => setStats(res.data)).catch(() => {});
  }, []);

  if (!stats) return null;
  const max = Math.max(1, ...stats.days.map(d => d.count));
  const shown = hover !== null ? stats.days[hover] : null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Eye size={17} className="text-slate-400" />Page « Découvrir »</h2>
      <p className="text-xs text-slate-500 mb-3">
        Visites de evly.ch/decouvrir.html par jour. Comptage anonyme : ni cookie, ni adresse IP ; robots et personnes connectées à EvLY exclus.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {[['7 derniers jours', stats.last7], ['30 derniers jours', stats.last30], ['Depuis le début', stats.total]].map(([l, v]) => (
          <div key={l as string} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">{l}</p>
            <p className="text-2xl font-bold text-slate-800">{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-baseline justify-between mb-2 h-5">
          <p className="text-xs text-slate-500">Visites par jour</p>
          <p className="text-xs text-slate-700 tabular-nums">
            {shown ? <><span className="font-semibold">{shown.count}</span> visite{shown.count > 1 ? 's' : ''} · {label(shown.day)}</> : <span className="text-slate-400">max. {max}</span>}
          </p>
        </div>
        <div className="relative h-32 border-b border-slate-200" onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {stats.days.map((d, i) => (
              <button
                key={d.day}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${label(d.day)} : ${d.count} visite${d.count > 1 ? 's' : ''}`}
                className="flex-1 h-full flex items-end focus:outline-none group"
              >
                <span
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-indigo-700' : 'bg-indigo-500'} group-focus-visible:ring-2 group-focus-visible:ring-indigo-300`}
                  style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : '0%' }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-slate-400">
          <span>{label(stats.days[0].day, shortFmt)}</span>
          <span>{label(stats.days[15].day, shortFmt)}</span>
          <span>aujourd'hui</span>
        </div>

        <details className="mt-3">
          <summary className="text-xs text-indigo-600 cursor-pointer select-none">Voir le détail par jour</summary>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {[...stats.days].reverse().map(d => (
                <tr key={d.day} className="border-t border-slate-100">
                  <td className="py-1 text-slate-500">{label(d.day)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-700">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
