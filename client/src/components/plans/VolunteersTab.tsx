import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Pencil, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { Plan, VolunteerShift } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { DateTimeField } from '../ui/DateTimeField';
import { intlLocale, t } from '../../i18n';

// Planning des bénévoles (fonction à activer dans les paramètres avancés du Plan) : le créateur
// du Plan et les gestionnaires du Cercle créent les postes, chacun s'inscrit — ce qui vaut
// « Je suis in ». Serveur : routes/volunteers.ts.

const dayTime = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' });

export function shiftHours(s: { startsAt: string | null; endsAt: string | null }) {
  if (!s.startsAt) return '';
  const start = dayTime.format(new Date(s.startsAt));
  return s.endsAt ? `${start} – ${timeOnly.format(new Date(s.endsAt))}` : start;
}

// Miroir de shiftsOverlap (server/src/lib/volunteers.ts)
function overlap(a: VolunteerShift, b: VolunteerShift) {
  if (!a.startsAt || !b.startsAt) return false;
  const aS = +new Date(a.startsAt), bS = +new Date(b.startsAt);
  const aE = a.endsAt ? +new Date(a.endsAt) : aS, bE = b.endsAt ? +new Date(b.endsAt) : bS;
  if (aS === aE || bS === bE) return aS <= bE && bS <= aE;
  return aS < bE && bS < aE;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toTimeInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function VolunteersTab({ plan, userId, onPlanUpdated }: { plan: Plan; userId: string; onPlanUpdated: (plan: Plan) => void }) {
  const [shifts, setShifts] = useState<VolunteerShift[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const { data } = await api.get(`/plans/${plan.id}/shifts`);
      setShifts(data.shifts);
      setCanManage(data.canManage);
    } catch {
      setShifts([]);
    }
  }

  // Rechargé à chaque mise à jour du Plan (temps réel : plan-updated)
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>, reloadPlan = false) {
    setError('');
    try {
      await action();
      await load();
      if (reloadPlan) onPlanUpdated((await api.get(`/plans/${plan.id}`)).data);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.retryError'));
      await load();
      return false;
    }
  }

  if (!shifts) return <div className="flex-1 bg-slate-50" />;

  const isMine = (s: VolunteerShift) => s.signups.some(x => x.userId === userId);
  const mine = shifts.filter(isMine);
  // Les lignes à 0 personne sont du programme : pas d'inscription, pas comptées dans le résumé
  const toFill = shifts.filter(s => s.needed > 0);
  // Un poste terminé ne manque plus de personne
  const stillOpen = toFill.filter(s => !s.doneAt);
  const missing = stillOpen.reduce((n, s) => n + Math.max(0, s.needed - s.signups.length), 0);
  const openShifts = stillOpen.filter(s => s.signups.length < s.needed).length;
  const myRsvp = plan.members.find(m => m.userId === userId)?.rsvp;
  const list = mineOnly ? mine : shifts;

  async function signUp(s: VolunteerShift) {
    const clash = mine.find(m => overlap(m, s));
    if (clash && !confirm(t('games.volunteers.clashConfirm', { title: clash.title }))) return;
    await run(() => api.post(`/plans/shifts/${s.id}/signup`), myRsvp !== 'in');
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* Résumé */}
      {toFill.length > 0 && (
        missing > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0" />
            {t('games.volunteers.missing', { people: t('games.volunteers.people', { count: missing }), shifts: t('games.volunteers.shifts', { count: openShifts }) })}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            {t('games.volunteers.allFilled')}
          </div>
        )
      )}

      {canManage && (editing === 'new' ? (
        <ShiftForm plan={plan} onCancel={() => setEditing(null)}
          onSubmit={async body => { if (await run(() => api.post(`/plans/${plan.id}/shifts`, body))) setEditing(null); }} />
      ) : (
        <button
          onClick={() => setEditing('new')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />{t('games.volunteers.addShift')}
        </button>
      ))}

      {shifts.length > 0 && (
        <div className="flex gap-1.5">
          {[{ v: false, l: t('games.volunteers.all') }, { v: true, l: t('games.volunteers.mine', { count: mine.length }) }].map(o => (
            <button key={String(o.v)} onClick={() => setMineOnly(o.v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mineOnly === o.v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              {o.l}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {shifts.length === 0 && (
        <p className="text-sm text-slate-400 italic text-center py-6">
          {canManage ? t('games.volunteers.emptyManager') : t('games.volunteers.empty')}
        </p>
      )}
      {mineOnly && mine.length === 0 && shifts.length > 0 && (
        <p className="text-sm text-slate-400 italic text-center py-4">{t('games.volunteers.noneMine')}</p>
      )}

      <div className="space-y-2.5">
        {list.map(s => editing === s.id ? (
          <ShiftForm key={s.id} plan={plan} shift={s} onCancel={() => setEditing(null)}
            onSubmit={async body => { if (await run(() => api.put(`/plans/shifts/${s.id}`, body))) setEditing(null); }} />
        ) : (
          <ShiftCard
            key={s.id} shift={s} userId={userId} canManage={canManage}
            clash={!isMine(s) && mine.some(m => overlap(m, s))}
            onSignUp={() => signUp(s)}
            onWithdraw={() => run(() => api.delete(`/plans/shifts/${s.id}/signup`))}
            onRemove={uid => run(() => api.delete(`/plans/shifts/${s.id}/signups/${uid}`))}
            onComment={content => run(() => api.post(`/plans/shifts/${s.id}/comments`, { content }))}
            onDeleteComment={id => { if (confirm(t('games.volunteers.deleteCommentConfirm'))) run(() => api.delete(`/plans/shifts/comments/${id}`)); }}
            onDone={done => run(() => api.post(`/plans/shifts/${s.id}/done`, { done }))}
            onEdit={() => setEditing(s.id)}
            onDelete={() => {
              if (confirm(t('games.volunteers.deleteConfirm', { title: s.title }) + (s.signups.length ? t('games.volunteers.deleteNotify') : ''))) run(() => api.delete(`/plans/shifts/${s.id}`));
            }}
          />
        ))}
      </div>

      {toFill.length > 0 && (
        <p className="text-xs text-slate-400 text-center">{t('games.volunteers.footer')}</p>
      )}
    </div>
  );
}

function ShiftCard({ shift: s, userId, canManage, clash, onSignUp, onWithdraw, onRemove, onComment, onDeleteComment, onDone, onEdit, onDelete }: {
  shift: VolunteerShift; userId: string; canManage: boolean; clash: boolean;
  onSignUp: () => void; onWithdraw: () => void; onRemove: (userId: string) => void;
  onComment: (content: string) => Promise<boolean>; onDeleteComment: (id: string) => void; onDone: (done: boolean) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const mine = s.signups.some(x => x.userId === userId);
  // Inscrits du poste et gestionnaires : commenter, déclarer terminé
  const canWork = mine || canManage;
  const done = !!s.doneAt;
  const comments = s.comments ?? [];
  const full = s.signups.length >= s.needed;
  const hours = shiftHours(s);
  const actions = canManage && (
    <span className="flex-shrink-0 flex -mr-1">
      <button onClick={onEdit} title={t('games.volunteers.editShift')} className="p-1 rounded-md text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={14} /></button>
      <button onClick={onDelete} title={t('games.volunteers.deleteShift')} className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
    </span>
  );
  // Ligne de programme (0 personne) : horaire et remarque, sans inscription
  if (s.needed === 0) return (
    <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/70">
      <div className="flex items-start gap-2">
        <Clock size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 break-words">{hours && <span className="font-semibold text-slate-800">{hours} · </span>}{s.title}</p>
          {s.note && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap break-words">{s.note}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
  return (
    <div className={`p-3.5 rounded-xl border shadow-sm ${done ? 'bg-emerald-50/60 border-emerald-200' : mine ? 'bg-indigo-50/60 border-indigo-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 break-words">{s.title}</p>
          {hours && <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5"><Clock size={11} />{hours}</p>}
        </div>
        {done ? (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
            <CheckCircle2 size={12} />{t('games.volunteers.done')}
          </span>
        ) : (
          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${full ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {s.signups.length}/{s.needed}
          </span>
        )}
        {actions}
      </div>
      {s.note && <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap break-words">{s.note}</p>}

      {s.signups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {s.signups.map(x => (
            <span key={x.userId} className={`flex items-center gap-1 pl-2 ${canManage && x.userId !== userId ? 'pr-1' : 'pr-2'} py-0.5 rounded-full text-xs ${x.userId === userId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {displayName(x.user) ? `${displayName(x.user)} ` : ''}<span className="opacity-70">@{x.user.pseudo}</span>
              {canManage && x.userId !== userId && (
                <button onClick={() => { if (confirm(t('games.volunteers.removeConfirm', { pseudo: x.user.pseudo }))) onRemove(x.userId); }} title={t('games.volunteers.remove')} className="p-0.5 rounded-full hover:bg-slate-200"><X size={11} /></button>
              )}
            </span>
          ))}
        </div>
      )}

      {done && s.doneBy && <p className="text-xs text-emerald-700 mt-2">{t('games.volunteers.doneBy', { pseudo: s.doneBy.pseudo })}</p>}

      {comments.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
              <MessageSquare size={12} className="flex-shrink-0 mt-0.5 text-slate-400" />
              <p className="flex-1 min-w-0 text-xs text-slate-700 whitespace-pre-wrap break-words">
                <span className="font-semibold">@{c.author.pseudo}</span>
                <span className="text-slate-400"> · {dayTime.format(new Date(c.createdAt))}</span><br />{c.content}
              </p>
              {(c.author.id === userId || canManage) && (
                <button onClick={() => onDeleteComment(c.id)} title={t('games.volunteers.deleteComment')} className="flex-shrink-0 p-0.5 rounded text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {writing && (
        <form className="mt-2.5" onSubmit={async e => {
          e.preventDefault();
          if (!draft.trim()) return;
          setSending(true);
          if (await onComment(draft)) { setDraft(''); setWriting(false); }
          setSending(false);
        }}>
          <div className="flex gap-1.5">
            <textarea autoFocus rows={2} maxLength={500} value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('games.volunteers.commentPlaceholder')}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" />
            <button type="submit" disabled={sending || !draft.trim()} title={t('games.volunteers.send')}
              className="self-end p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send size={15} /></button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{t('games.volunteers.commentHint')}</p>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mine ? (
          <button onClick={onWithdraw} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">{t('games.volunteers.withdraw')}</button>
        ) : done ? null : full ? (
          <span className="text-xs text-slate-400">{t('common.full')}</span>
        ) : (
          <button onClick={onSignUp} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">{t('games.volunteers.signUp')}</button>
        )}
        {canWork && !writing && (
          <button onClick={() => setWriting(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
            <MessageSquare size={13} />{t('games.volunteers.comment')}
          </button>
        )}
        {canWork && (done ? (
          <button onClick={() => onDone(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
            <RotateCcw size={13} />{t('games.volunteers.reopen')}
          </button>
        ) : (
          <button onClick={() => onDone(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
            <CheckCircle2 size={13} />{t('games.volunteers.markDone')}
          </button>
        ))}
        {clash && !full && !done && <span className="text-xs text-amber-600">{t('games.volunteers.clash')}</span>}
      </div>
    </div>
  );
}

function ShiftForm({ plan, shift, onSubmit, onCancel }: {
  plan: Plan; shift?: VolunteerShift; onSubmit: (body: object) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(shift?.title ?? '');
  const [needed, setNeeded] = useState(String(shift?.needed ?? 1));
  const [start, setStart] = useState(shift ? toLocalInput(shift.startsAt) : '');
  const [end, setEnd] = useState(toTimeInput(shift?.endsAt));
  const [note, setNote] = useState(shift?.note ?? '');
  const [busy, setBusy] = useState(false);
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let startsAt: string | null = null, endsAt: string | null = null;
    if (start) {
      const s = new Date(start);
      startsAt = s.toISOString();
      if (end) {
        // Heure de fin le même jour (le lendemain si elle tombe avant le début : poste de nuit)
        const [h, m] = end.split(':').map(Number);
        const e2 = new Date(s); e2.setHours(h, m, 0, 0);
        if (e2 <= s) e2.setDate(e2.getDate() + 1);
        endsAt = e2.toISOString();
      }
    }
    setBusy(true);
    await onSubmit({ title, needed: Number(needed), note, startsAt, endsAt });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2.5">
      <div className="flex gap-2">
        <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder={t('games.volunteers.titlePlaceholder')} className={`flex-1 ${input}`} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
          <input type="number" min={0} max={200} required value={needed} onChange={e => setNeeded(e.target.value)} className={`w-16 ${input}`} aria-label={t('games.volunteers.peopleCount')} />
          {t('games.volunteers.persons')}
        </label>
      </div>
      <div className="flex flex-wrap gap-2 items-start">
        <div className="text-xs text-slate-500 flex items-start gap-1.5 flex-1 min-w-[14rem]">
          <span className="pt-2.5">{t('games.volunteers.start')}</span>
          <DateTimeField value={start} onChange={setStart} placeholder={t('games.volunteers.timePlaceholder')} clearable
            openAt={toLocalInput(plan.eventDate)} defaultTime={toLocalInput(plan.eventDate).slice(11, 16) || '09:00'} className="flex-1 min-w-0" />
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-1.5">
          {t('games.volunteers.end')}
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} disabled={!start} className={`w-28 ${input} disabled:opacity-50`} />
        </label>
      </div>
      {needed === '0' && <p className="text-xs text-slate-500">{t('games.volunteers.zeroHint')}</p>}
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={t('games.volunteers.notePlaceholder')} className={input} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">{t('common.cancel')}</button>
        <button type="submit" disabled={busy || !title.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {shift ? t('common.save') : t('games.volunteers.addSubmit')}
        </button>
      </div>
    </form>
  );
}
