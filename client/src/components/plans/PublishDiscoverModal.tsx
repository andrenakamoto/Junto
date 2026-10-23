import { useState } from 'react';
import { Check, Compass } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { Plan } from '../../types';
import { CATEGORY_GROUPS, IDEAS, REGIONS, catLabel, regionLabel, savedRegion } from '../../lib/discover';
import { t } from '../../i18n';

const CATEGORIES = CATEGORY_GROUPS.flatMap(([, l]) => l).filter(c => c !== IDEAS);

// « Publier dans Découvrir » (comptes autorisés dans le panneau admin, créateur du Plan ou gestionnaires du Cercle) :
// Plan en Mode annonce → annonce publique qui suit le Plan (serveur : lib/discover/planPublish.ts)
export function PublishDiscoverModal({ plan, onChanged, onClose }: { plan: Plan; onChanged: () => void; onClose: () => void }) {
  const [region, setRegion] = useState(plan.discover?.region ?? savedRegion());
  const [category, setCategory] = useState(plan.discover?.category ?? 'soiree');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocker = plan.discoverBlocker ?? null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); onChanged(); } catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
    finally { setBusy(false); }
  }
  const select = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <Modal title={t('discover.publish.title')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t('discover.publish.intro')}</p>
        {plan.discover && (
          <p className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <Check size={15} />{t('discover.publish.published')} · {regionLabel(plan.discover.region)} · {catLabel(plan.discover.category)}
          </p>
        )}
        {blocker ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">{t(`discover.publish.${blocker}` as any)}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="text-xs font-medium text-slate-500">{t('discover.publish.region')}</span>
                <select className={select} value={region} onChange={e => setRegion(e.target.value as any)}>{REGIONS.map(r => <option key={r} value={r}>{regionLabel(r)}</option>)}</select>
              </label>
              <label className="space-y-1"><span className="text-xs font-medium text-slate-500">{t('discover.publish.category')}</span>
                <select className={select} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}</select>
              </label>
            </div>
            <p className="text-xs text-slate-500">{t('discover.publish.follows')}</p>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {!blocker && (
            <button disabled={busy} onClick={() => run(() => api.put(`/plans/${plan.id}/discover`, { region, category }))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Compass size={15} />{plan.discover ? t('discover.publish.update') : t('discover.publish.publish')}
            </button>
          )}
          {plan.discover && (
            <button disabled={busy} onClick={() => run(() => api.delete(`/plans/${plan.id}/discover`))}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              {t('discover.publish.unpublish')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
