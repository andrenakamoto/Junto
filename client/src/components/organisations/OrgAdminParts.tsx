import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, ShieldCheck, ShieldOff, UserMinus } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';

// Administrateurs et départs d'une Organisation (serveur : routes/orgAdmins.ts, 2026-11-20). Un administrateur en nomme un autre
// seul ; en retirer un demande la majorité des autres (au moins 2 voix, nommés depuis 7 jours). Chacun peut quitter la direction,
// cesser d'être administrateur (sauf le dernier) ou quitter l'Organisation.

export interface AdminsInfo {
  admins: { userId: string; name: string; adminSince: string | null; canVote: boolean }[];
  removals: { id: string; targetId: string; target: string; requestedBy: string; createdAt: string; votes: number; threshold: number | null; myVote: boolean; canVote: boolean }[];
  log: { id: string; action: string; actor: string | null; target: string | null; createdAt: string }[];
}

const errorOf = (e: any) => e?.response?.data?.error ?? t('common.error');
const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

/** Bouton qui demande une confirmation (texte d'explication + « Confirmer ») avant d'agir */
function ConfirmButton({ label, hint, icon, danger, onConfirm }: { label: string; hint: string; icon?: React.ReactNode; danger?: boolean; onConfirm: () => Promise<unknown> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tone = danger ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-slate-700 border-slate-200 hover:bg-slate-50';
  if (!asking) return (
    <button onClick={() => { setAsking(true); setError(''); }} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${tone}`}>{icon}{label}</button>
  );
  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${danger ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-xs text-slate-600">{hint}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setAsking(false)} disabled={busy} className="px-2.5 py-1 rounded-lg text-xs text-slate-600 hover:bg-white">{t('common.cancel')}</button>
        <button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onConfirm(); setAsking(false); } catch (e) { setError(errorOf(e)); } finally { setBusy(false); } }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>{t('org.admins.confirm')}</button>
      </div>
    </div>
  );
}

/** « Ma place dans l'Organisation » : quitter la direction, ne plus être administrateur, quitter l'Organisation */
export function MyPlace({ org, onChanged, onGone }: { org: { id: string; isAdmin: boolean; isDirection?: boolean }; onChanged: () => void; onGone: () => void }) {
  const base = `/organisations/${org.id}`;
  return (
    <section className="rounded-xl border border-slate-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('org.admins.myPlace')}</h3>
      <div className="flex flex-col gap-2 items-start">
        {org.isDirection && (
          <ConfirmButton label={t('org.admins.leaveDirection')} hint={t('org.admins.leaveDirectionHint')} icon={<UserMinus size={13} />}
            onConfirm={() => api.post(`${base}/direction/leave`).then(() => (org.isAdmin ? onChanged() : onGone()))} />
        )}
        {org.isAdmin && (
          <ConfirmButton label={t('org.admins.stepDown')} hint={t('org.admins.stepDownHint')} icon={<ShieldOff size={13} />}
            onConfirm={() => api.post(`${base}/admin/step-down`).then(() => (org.isDirection ? onChanged() : onGone()))} />
        )}
        <ConfirmButton label={t('org.admins.leaveOrg')} hint={t('org.admins.leaveOrgHint')} icon={<LogOut size={13} />} danger
          onConfirm={() => api.post(`${base}/leave`).then(onGone)} />
      </div>
    </section>
  );
}

/** Données des administrateurs (administrateurs seulement) */
export function useAdminsInfo(organisationId: string, enabled: boolean) {
  const [info, setInfo] = useState<AdminsInfo | null>(null);
  const load = useCallback(() => { if (enabled) api.get(`/organisations/${organisationId}/admins`).then(r => setInfo(r.data)).catch(() => {}); }, [organisationId, enabled]);
  useEffect(() => { load(); }, [load]);
  return { info, reload: load };
}

/** Actions d'un administrateur sur une personne de l'onglet « Personnes » */
export function PersonAdminActions({ organisationId, person, meId, info, onChanged }: {
  organisationId: string; person: { userId: string; isAdmin: boolean }; meId?: string; info: AdminsInfo | null; onChanged: () => void;
}) {
  const base = `/organisations/${organisationId}`;
  const [error, setError] = useState('');
  if (person.userId === meId) return null;
  if (!person.isAdmin) return (
    <div className="flex flex-col items-start gap-2 pt-1">
      <ConfirmButton label={t('org.admins.makeAdmin')} hint={t('org.admins.makeAdminHint')} icon={<ShieldCheck size={13} />}
        onConfirm={() => api.put(`${base}/members/${person.userId}/admin`, { isAdmin: true }).then(onChanged)} />
      <ConfirmButton label={t('org.admins.removeFromOrg')} hint={t('org.admins.removeFromOrgHint')} icon={<UserMinus size={13} />} danger
        onConfirm={() => api.delete(`${base}/members/${person.userId}`).then(onChanged)} />
    </div>
  );
  const removal = info?.removals.find(r => r.targetId === person.userId);
  if (!removal) return (
    <div className="pt-1">
      <ConfirmButton label={t('org.admins.requestRemoval')} hint={t('org.admins.requestRemovalHint')} icon={<ShieldOff size={13} />} danger
        onConfirm={() => api.post(`${base}/admins/${person.userId}/removal`).then(onChanged)} />
    </div>
  );
  const vote = (v: boolean) => { setError(''); api.post(`${base}/admin-removals/${removal.id}/vote`, { vote: v }).then(onChanged).catch(e => setError(errorOf(e))); };
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-2">
      <p className="text-xs font-medium text-amber-800">
        {removal.threshold === null ? t('org.admins.pendingStuck', { who: removal.requestedBy }) : t('org.admins.pending', { who: removal.requestedBy, votes: removal.votes, needed: removal.threshold })}
      </p>
      {removal.canVote && (
        <button onClick={() => vote(!removal.myVote)} className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-100">
          {removal.myVote ? t('org.admins.unvote') : t('org.admins.vote')}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Liste des administrateurs, règles et historique (en bas de l'onglet « Personnes ») */
export function AdminsPanel({ info }: { info: AdminsInfo | null }) {
  const [showLog, setShowLog] = useState(false);
  if (!info) return null;
  const daysLeft = (since: string | null) => (since ? Math.max(1, Math.ceil((new Date(since).getTime() + 7 * 864e5 - Date.now()) / 864e5)) : 0);
  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-3 space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><ShieldCheck size={15} className="text-indigo-600" />{t('org.admins.title')}</h3>
      <p className="text-xs text-slate-500">{t('org.admins.help')}</p>
      <ul className="space-y-1">
        {info.admins.map(a => (
          <li key={a.userId} className="text-sm text-slate-700">
            {a.name || t('org.admins.gone')}
            <span className="text-xs text-slate-500">
              {a.adminSince ? ` · ${t('org.admins.since', { date: day(a.adminSince) })}` : ''}
              {!a.canVote ? ` · ${t('org.admins.votesIn', { count: daysLeft(a.adminSince) })}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {info.log.length > 0 && (
        <div>
          <button onClick={() => setShowLog(s => !s)} className="flex items-center gap-1 text-xs font-semibold text-slate-600">
            {showLog ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{t('org.admins.history')} ({info.log.length})
          </button>
          {showLog && (
            <ul className="mt-1.5 space-y-1">
              {info.log.map(l => (
                <li key={l.id} className="text-xs text-slate-600">
                  <span className="text-slate-400">{day(l.createdAt)} · </span>
                  {t(`org.admins.log.${l.action}`, { actor: l.actor ?? t('org.admins.gone'), target: l.target ?? t('org.admins.gone'), defaultValue: l.action })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
