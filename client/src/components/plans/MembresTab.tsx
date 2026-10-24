import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Plan, PlanMember } from '../../types';
import { Avatar } from '../ui/Avatar';
import { displayName } from '../../lib/names';
import { useTranslation } from 'react-i18next';

const rsvpCfg = {
  in: { label: 'plan.members.rsvpIn', cls: 'bg-emerald-100 text-emerald-700' },
  maybe: { label: 'plan.members.rsvpMaybe', cls: 'bg-amber-100 text-amber-700' },
  out: { label: 'plan.members.rsvpOut', cls: 'bg-slate-100 text-slate-600' },
} as const;

export function MembresTab({ members, onlineUserIds, waitlist = [], creatorId, canRemove = false, onRemove }: {
  members: PlanMember[]; onlineUserIds?: Set<string>; waitlist?: NonNullable<Plan['waitlist']>;
  /** Créateur du Plan et organisateurs du Cercle : retirer quelqu'un du Plan (DELETE /plans/:id/members/:userId) */
  creatorId?: string; canRemove?: boolean; onRemove?: (userId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove(userId: string) {
    if (!onRemove) return;
    setBusy(true);
    try { await onRemove(userId); setConfirmId(null); }
    catch (err: any) { alert(err.response?.data?.error || t('common.retryError')); }
    finally { setBusy(false); }
  }
  // Une seule liste, dans l'ordre d'arrivée dans le Plan (la réponse est indiquée sur chaque ligne)
  const sorted = [...members].sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
      <h3 className="font-semibold text-slate-800 text-sm mb-3">
        {t('plan.members.count', { count: members.length })}
      </h3>
      <div className="space-y-2">
        {sorted.map(m => (
          <div key={m.userId} className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Avatar pseudo={m.user.pseudo} size="xl" person={{ userId: m.userId, pseudo: m.user.pseudo, firstName: m.user.firstName }} online={onlineUserIds ? onlineUserIds.has(m.userId) : undefined} />
            <span className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-800">{displayName(m.user) ?? `@${m.user.pseudo}`}</span>
              {m.isGuest && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">
                  {t('plan.members.guest')}
                </span>
              )}
              {displayName(m.user) && <span className="block text-xs text-slate-400 truncate">@{m.user.pseudo}</span>}
            </span>
            {confirmId === m.userId ? (
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setConfirmId(null)} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-medium">{t('common.cancel')}</button>
                <button onClick={() => remove(m.userId)} disabled={busy} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50">{t('plan.members.removeConfirm')}</button>
              </span>
            ) : <>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rsvpCfg[m.rsvp].cls}`}>
                {t(rsvpCfg[m.rsvp].label)}
              </span>
              {canRemove && m.userId !== creatorId && (
                <button onClick={() => setConfirmId(m.userId)} title={t('plan.members.remove')} aria-label={t('plan.members.remove')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><UserMinus size={16} /></button>
              )}
            </>}
          </div>
          {confirmId === m.userId && <p className="text-xs text-slate-500 -mt-1 px-1">{t('plan.members.removeHint', { name: displayName(m.user) ?? `@${m.user.pseudo}` })}</p>}
          </div>
        ))}
      </div>
      {waitlist.length > 0 && (
        <>
          <h3 className="font-semibold text-slate-800 text-sm mt-5 mb-1">{t('plan.members.waitlist')}</h3>
          <p className="text-xs text-slate-400 mb-3">{t('plan.members.waitlistHint')}</p>
          <div className="space-y-2">
            {waitlist.map((w, i) => (
              <div key={w.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-dashed border-amber-300">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700">{w.user ? displayName(w.user) ?? `@${w.user.pseudo}` : t('plan.members.member')}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">{t('plan.members.waiting')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
