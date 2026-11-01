import { useState, type ReactNode } from 'react';
import { BellRing, UserMinus } from 'lucide-react';
import { Plan, PlanMember } from '../../types';
import { Avatar } from '../ui/Avatar';
import { displayName } from '../../lib/names';
import { intlLocale } from '../../i18n';
import { useTranslation } from 'react-i18next';

// Rubrique Membres d'un Plan : un résumé qui sert de filtre, puis des groupes séparés — « Je suis in », « Peut-être »,
// liste d'attente, « Absent(e) » (ont répondu non) et « Pas encore répondu » (membres des Cercles qui peuvent encore
// rejoindre, `plan.pending`, jamais les personnes à qui le Plan est caché). Le créateur du Plan et l'organisation peuvent
// relancer ceux qui n'ont pas répondu, une fois par jour (POST /plans/:id/nudge).

type Group = 'in' | 'maybe' | 'out' | 'pending';
const GROUP_STYLE: Record<Group, { dot: string; chip: string; on: string }> = {
  in: { dot: 'bg-emerald-500', chip: 'text-emerald-700', on: 'bg-emerald-600 text-white border-emerald-600' },
  maybe: { dot: 'bg-amber-400', chip: 'text-amber-700', on: 'bg-amber-500 text-white border-amber-500' },
  out: { dot: 'bg-red-400', chip: 'text-red-700', on: 'bg-red-500 text-white border-red-500' },
  pending: { dot: 'bg-slate-300', chip: 'text-slate-600', on: 'bg-slate-600 text-white border-slate-600' },
};
const PENDING_FOLDED = 6;

export function MembresTab({ plan, members, onlineUserIds, waitlist = [], creatorId, canRemove = false, onRemove, onNudge }: {
  plan?: Plan;
  members: PlanMember[]; onlineUserIds?: Set<string>; waitlist?: NonNullable<Plan['waitlist']>;
  /** Créateur du Plan et organisateurs du Cercle : retirer quelqu'un du Plan (DELETE /plans/:id/members/:userId) */
  creatorId?: string; canRemove?: boolean; onRemove?: (userId: string) => Promise<void>;
  /** Relancer les membres sans réponse ; renvoie le nombre de personnes prévenues */
  onNudge?: () => Promise<number>;
}) {
  const { t } = useTranslation();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Group | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);
  const [nudgeState, setNudgeState] = useState<{ sent?: number; error?: string }>({});

  async function remove(userId: string) {
    if (!onRemove) return;
    setBusy(true);
    try { await onRemove(userId); setConfirmId(null); }
    catch (err: any) { alert(err.response?.data?.error || t('common.retryError')); }
    finally { setBusy(false); }
  }
  const pending = plan?.pending ?? [];
  async function nudge() {
    if (!onNudge || !confirm(t('plan.members.nudgeConfirm', { count: pending.length }))) return;
    setBusy(true);
    try { setNudgeState({ sent: await onNudge() }); }
    catch (err: any) { setNudgeState({ error: err.response?.data?.error || t('common.retryError') }); }
    finally { setBusy(false); }
  }

  // Dans chaque groupe, l'ordre d'arrivée dans le Plan
  const sorted = [...members].sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));
  const byRsvp = (r: PlanMember['rsvp']) => sorted.filter(m => m.rsvp === r);
  const counts: Record<Group, number> = { in: byRsvp('in').length, maybe: byRsvp('maybe').length, out: byRsvp('out').length, pending: pending.length };
  const groups: Group[] = (['in', 'maybe', 'out', 'pending'] as Group[]).filter(g => g !== 'pending' || plan?.pending);
  const visible = (g: Group) => !filter || filter === g;
  const nextNudge = plan?.nextNudgeAt ? new Date(plan.nextNudgeAt) : null;
  const canNudgeNow = !!plan?.canNudge && !!onNudge && pending.length > 0 && !(nextNudge && nextNudge > new Date()) && nudgeState.sent === undefined;

  const memberRow = (m: PlanMember) => (
    <div key={m.userId} className="space-y-2">
      <div className={`flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm ${m.rsvp === 'out' ? 'border-red-100' : 'border-slate-200'}`}>
        <Avatar pseudo={m.user.pseudo} size="xl" person={{ userId: m.userId, pseudo: m.user.pseudo, firstName: m.user.firstName }} online={onlineUserIds ? onlineUserIds.has(m.userId) : undefined} />
        <span className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${m.rsvp === 'out' ? 'text-slate-500' : 'text-slate-800'}`}>{displayName(m.user) ?? `@${m.user.pseudo}`}</span>
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
        ) : canRemove && m.userId !== creatorId && (
          <button onClick={() => setConfirmId(m.userId)} title={t('plan.members.remove')} aria-label={t('plan.members.remove')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><UserMinus size={16} /></button>
        )}
      </div>
      {confirmId === m.userId && <p className="text-xs text-slate-500 -mt-1 px-1">{t('plan.members.removeHint', { name: displayName(m.user) ?? `@${m.user.pseudo}` })}</p>}
    </div>
  );

  const section = (g: Group, title: string, children: ReactNode, hint?: string) => (
    <section key={g}>
      <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${GROUP_STYLE[g].dot}`} />{title}
        <span className="text-slate-400 font-normal">({counts[g]})</span>
      </h3>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <div className="space-y-2 mt-2">{counts[g] ? children : <p className="text-xs text-slate-400 italic">{t('plan.members.empty')}</p>}</div>
    </section>
  );

  const shownPending = showAllPending || filter === 'pending' ? pending : pending.slice(0, PENDING_FOLDED);
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-5 short:flex-none short:overflow-visible">
      {/* Résumé : toucher un groupe n'affiche que lui */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter(null)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${!filter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>
          {t('plan.members.filterAll')}
        </button>
        {groups.map(g => (
          <button key={g} onClick={() => setFilter(filter === g ? null : g)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${filter === g ? GROUP_STYLE[g].on : `bg-white border-slate-200 ${GROUP_STYLE[g].chip}`}`}>
            <span className={`w-2 h-2 rounded-full ${filter === g ? 'bg-white' : GROUP_STYLE[g].dot}`} />
            {t(`plan.members.summary${g === 'in' ? 'In' : g === 'maybe' ? 'Maybe' : g === 'out' ? 'Out' : 'Pending'}`, { count: counts[g] })}
          </button>
        ))}
      </div>

      {visible('in') && section('in', t('common.rsvp.in'), byRsvp('in').map(memberRow))}
      {visible('maybe') && section('maybe', t('common.rsvp.maybe'), byRsvp('maybe').map(memberRow))}

      {!filter && waitlist.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-800 text-sm mb-1">{t('plan.members.waitlist')} <span className="text-slate-400 font-normal">({waitlist.length})</span></h3>
          <p className="text-xs text-slate-400 mb-2">{t('plan.members.waitlistHint')}</p>
          <div className="space-y-2">
            {waitlist.map((w, i) => (
              <div key={w.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-dashed border-amber-300">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700">{w.user ? displayName(w.user) ?? `@${w.user.pseudo}` : t('plan.members.member')}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">{t('plan.members.waiting')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {visible('out') && section('out', t('common.rsvp.out'), byRsvp('out').map(memberRow), t('plan.members.groupOutHint'))}

      {visible('pending') && plan?.pending && section('pending', t('plan.members.groupPending'), <>
        {shownPending.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-dashed border-slate-200">
            <span className="opacity-60"><Avatar pseudo={u.pseudo} size="xl" person={{ userId: u.id, pseudo: u.pseudo, firstName: u.firstName ?? undefined }} /></span>
            <span className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-500">{displayName(u) ?? `@${u.pseudo}`}</span>
              {displayName(u) && <span className="block text-xs text-slate-400 truncate">@{u.pseudo}</span>}
            </span>
            <span className="text-xs text-slate-400 italic flex-shrink-0">{t('plan.members.noResponse')}</span>
          </div>
        ))}
        {shownPending.length < pending.length && (
          <button onClick={() => setShowAllPending(true)} className="w-full py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 rounded-lg">
            {t('plan.members.showAll', { count: pending.length })}
          </button>
        )}
        {plan.canNudge && onNudge && (
          <div className="pt-1">
            {canNudgeNow && (
              <button onClick={nudge} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
                <BellRing size={16} /> {t('plan.members.nudge')}
              </button>
            )}
            {nudgeState.sent !== undefined && <p className="text-sm text-emerald-700 text-center">✅ {t('plan.members.nudged', { count: nudgeState.sent })}</p>}
            {nudgeState.error && <p className="text-sm text-red-600 text-center">{nudgeState.error}</p>}
            {nudgeState.sent === undefined && nextNudge && nextNudge > new Date() && (
              <p className="text-xs text-slate-400 text-center">{t('plan.members.nudgeLater', { when: nextNudge.toLocaleString(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>
            )}
          </div>
        )}
      </>, t('plan.members.groupPendingHint'))}
    </div>
  );
}
