import { useEffect, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';
import { BIG_CITIES, RADII, Radius, Spot, SpotChoice, norm, recentSpots } from '../../lib/discover';

// « Où chercher ? » de Découvrir : autour de moi, une ville ou un village (répertoire de swisstopo, GET
// /api/discover/localities), le rayon, les lieux récents et les grandes villes.
export function PlacePicker({ value, onChange, onClose, hereError }: {
  value: SpotChoice; onChange: (c: SpotChoice) => void; onClose: () => void; hereError?: boolean;
}) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<(Spot & { canton: string })[] | null>(null);
  const recent = recentSpots();
  const pill = (active: boolean) => `px-3 py-1.5 rounded-full border text-[13px] font-medium ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`;

  useEffect(() => {
    if (norm(q).trim().length < 2) { setFound(null); return; }
    const timer = setTimeout(() => {
      api.get('/discover/localities', { params: { q } }).then(r => setFound(r.data)).catch(() => setFound([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (spot: Spot) => { onChange({ spot, here: false, radius: value.radius }); onClose(); };
  const setRadius = (radius: Radius) => onChange({ ...value, radius });
  const isCurrent = (s: Spot) => !value.here && value.spot?.name === s.name;

  return (
    <Modal title={t('discover.place.title')} onClose={onClose}>
      <div className="space-y-4">
        <button onClick={() => { onChange({ spot: null, here: true, radius: value.radius }); onClose(); }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold ${value.here ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-800 hover:bg-slate-50'}`}>
          <LocateFixed size={16} className="text-indigo-600" />{t('discover.place.here')}
        </button>
        {hereError && <p className="text-xs text-red-600 -mt-2">{t('discover.place.denied')}</p>}

        <div className="space-y-2">
          <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <span className="sr-only">{t('discover.place.search')}</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('discover.place.searchPlaceholder')}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none" autoComplete="off" />
          </label>
          {found && (found.length === 0
            ? <p className="text-xs text-slate-500 px-1">{t('discover.place.noResult')}</p>
            : <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {found.map(l => (
                  <button key={`${l.name}-${l.canton}-${l.lat}`} onClick={() => pick({ name: l.name, lat: l.lat, lon: l.lon })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-slate-800">{l.name}</span>
                    {l.canton && <span className="text-xs text-slate-400">{l.canton}</span>}
                  </button>
                ))}
              </div>)}
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('discover.place.radius')}</p>
          <div className="flex gap-1.5">
            {RADII.map(r => <button key={r} onClick={() => setRadius(r)} aria-pressed={value.radius === r} className={pill(value.radius === r)}>{r} km</button>)}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('discover.place.recent')}</p>
            <div className="flex flex-wrap gap-1.5">{recent.map(s => <button key={s.name} onClick={() => pick(s)} className={pill(isCurrent(s))}>{s.name}</button>)}</div>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('discover.place.cities')}</p>
          <div className="flex flex-wrap gap-1.5">{BIG_CITIES.map(s => <button key={s.name} onClick={() => pick(s)} className={pill(isCurrent(s))}>{s.name}</button>)}</div>
        </div>

        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">{t('discover.place.done')}</button>
        <p className="text-[11px] text-slate-400 text-center">{t('discover.place.credit')}</p>
      </div>
    </Modal>
  );
}
