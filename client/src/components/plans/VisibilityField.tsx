import { useState } from 'react';
import { Check, EyeOff, Search } from 'lucide-react';
import { t } from '../../i18n';
import { Plan } from '../../types';

// « Qui voit ce Plan ? » : tout le Cercle, « Cacher à… » (avec, en option, « C'est une surprise ») ou « Réservé à… ».
// Les deux derniers modes reposent sur les exclusions du serveur (lib/planAccess.ts) ; en « Réservé à… », le serveur exclut
// aussi les personnes qui rejoignent le Cercle ensuite.
export type VisibilityMode = 'all' | 'hidden' | 'reserved';
export interface VisibilityValue { mode: VisibilityMode; excluded: string[]; allowed: string[]; surprise: boolean }

type Member = { userId: string; user: { pseudo: string } };

export const emptyVisibility = (excluded: string[] = [], surprise = false): VisibilityValue =>
  ({ mode: excluded.length ? 'hidden' : 'all', excluded, allowed: [], surprise: excluded.length > 0 && surprise });

// État de départ d'un Plan existant (fenêtre « Modifier »)
export function visibilityOf(plan: Plan, members: Member[]): VisibilityValue {
  const excluded = (plan.exclusions ?? []).map(e => e.userId);
  if (plan.visibility === 'reserved') {
    const out = new Set(excluded);
    return { mode: 'reserved', excluded: [], allowed: members.map(m => m.userId).filter(id => id !== plan.creatorId && !out.has(id)), surprise: false };
  }
  return { mode: excluded.length ? 'hidden' : 'all', excluded, allowed: [], surprise: excluded.length > 0 && plan.surprise !== false };
}

// Champs envoyés au serveur (POST /circles/:id/plans, PUT /plans/:id)
export function visibilityPayload(v: VisibilityValue) {
  if (v.mode === 'reserved') return { visibility: 'reserved', allowedUserIds: v.allowed, surprise: false };
  return { visibility: 'hidden', excludedUserIds: v.mode === 'hidden' ? v.excluded : [], surprise: v.mode === 'hidden' && v.surprise };
}

// Résumé de la ligne « Participants » (nombre de personnes cachées, ou « réservé à N »)
export function visibilityCount(v: VisibilityValue): { hidden: number; reserved: number | null } {
  return { hidden: v.mode === 'hidden' ? v.excluded.length : 0, reserved: v.mode === 'reserved' ? v.allowed.length : null };
}

export function VisibilityField({ members, currentUserId, value, onChange }: {
  members: Member[]; currentUserId: string; value: VisibilityValue; onChange: (v: VisibilityValue) => void;
}) {
  const [q, setQ] = useState('');
  const candidates = members.filter((m, i, all) => m.userId !== currentUserId && all.findIndex(x => x.userId === m.userId) === i);
  if (candidates.length === 0) return null;
  const list = value.mode === 'reserved' ? value.allowed : value.excluded;
  const setList = (ids: string[]) => onChange(value.mode === 'reserved' ? { ...value, allowed: ids } : { ...value, excluded: ids });
  const toggle = (id: string) => setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = q.trim() ? candidates.filter(m => norm(m.user.pseudo).includes(norm(q.trim()))) : candidates;
  const MODES: VisibilityMode[] = ['all', 'hidden', 'reserved'];

  return (
    <div className={`rounded-xl border p-3 ${value.mode !== 'all' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200'}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><EyeOff size={15} className="text-indigo-500" />{t('plan.visibility.label')}</p>
      <div className="grid grid-cols-3 gap-1.5 mt-2" role="radiogroup" aria-label={t('plan.visibility.label')}>
        {MODES.map(m => (
          <button key={m} type="button" role="radio" aria-checked={value.mode === m}
            onClick={() => onChange({ ...value, mode: m })}
            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${value.mode === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
            {t(`plan.visibility.${m}`)}
          </button>
        ))}
      </div>

      {value.mode !== 'all' && (
        <div className="mt-2.5">
          <p className="text-xs text-slate-500 mb-2">{t(value.mode === 'reserved' ? 'plan.visibility.reservedHint' : 'plan.visibility.hiddenHint')}</p>
          {candidates.length > 12 && (
            <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2">
              <Search size={13} className="text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('plan.visibility.search')} className="flex-1 min-w-0 text-xs outline-none bg-transparent" />
            </label>
          )}
          <div className="flex flex-wrap gap-1.5">
            {shown.map(m => {
              const selected = list.includes(m.userId);
              return (
                <button key={m.userId} type="button" onClick={() => toggle(m.userId)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {selected && <Check size={11} />}@{m.user.pseudo}
                </button>
              );
            })}
          </div>
          {value.mode === 'reserved' && candidates.length > 3 && (
            <div className="flex gap-3 mt-2 text-xs">
              <button type="button" onClick={() => setList(candidates.map(m => m.userId))} className="text-indigo-700 font-medium">{t('plan.visibility.all_select')}</button>
              <button type="button" onClick={() => setList([])} className="text-slate-500">{t('plan.visibility.none_select')}</button>
            </div>
          )}
          {list.length === 0
            ? <p className="text-xs text-amber-600 mt-2">{t(value.mode === 'reserved' ? 'plan.visibility.pickReserved' : 'plan.surprise.pickOne')}</p>
            : value.mode === 'reserved' && <p className="text-xs text-slate-500 mt-2">{t('plan.visibility.reservedCount', { count: list.length })}</p>}
          {value.mode === 'hidden' && (
            <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
              <input type="checkbox" checked={value.surprise} onChange={e => onChange({ ...value, surprise: e.target.checked })} className="accent-indigo-600 mt-0.5" />
              <span className="text-sm text-slate-700">{t('plan.visibility.surprise')}<span className="block text-xs text-slate-500">{t('plan.visibility.surpriseHint')}</span></span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
