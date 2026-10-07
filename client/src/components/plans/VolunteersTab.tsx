import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Plan, VolunteerShift } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { DateTimeField } from '../ui/DateTimeField';

// Planning des bénévoles (fonction à activer dans les paramètres avancés du Plan) : le créateur
// du Plan et les gestionnaires du Cercle créent les postes, chacun s'inscrit — ce qui vaut
// « Je suis in ». Serveur : routes/volunteers.ts.

const dayTime = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit' });

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
      setError(err.response?.data?.error || 'Erreur, réessaie dans un instant');
      await load();
      return false;
    }
  }

  if (!shifts) return <div className="flex-1 bg-slate-50" />;

  const isMine = (s: VolunteerShift) => s.signups.some(x => x.userId === userId);
  const mine = shifts.filter(isMine);
  const missing = shifts.reduce((n, s) => n + Math.max(0, s.needed - s.signups.length), 0);
  const openShifts = shifts.filter(s => s.signups.length < s.needed).length;
  const myRsvp = plan.members.find(m => m.userId === userId)?.rsvp;
  const list = mineOnly ? mine : shifts;

  async function signUp(s: VolunteerShift) {
    const clash = mine.find(m => overlap(m, s));
    if (clash && !confirm(`Tu es déjà inscrit(e) à « ${clash.title} » sur ce créneau. T’inscrire quand même ?`)) return;
    await run(() => api.post(`/plans/shifts/${s.id}/signup`), myRsvp !== 'in');
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* Résumé */}
      {shifts.length > 0 && (
        missing > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0" />
            Il manque {missing} personne{missing > 1 ? 's' : ''} sur {openShifts} poste{openShifts > 1 ? 's' : ''}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            Tous les postes sont pourvus, merci à tous !
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
          <Plus size={16} />Ajouter un poste
        </button>
      ))}

      {shifts.length > 0 && (
        <div className="flex gap-1.5">
          {[{ v: false, l: 'Tous les postes' }, { v: true, l: `Mes postes (${mine.length})` }].map(o => (
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
          {canManage ? 'Aucun poste pour l’instant. Ajoute les postes à pourvoir : buvette, caisse, rangement…' : 'Aucun poste pour l’instant.'}
        </p>
      )}
      {mineOnly && mine.length === 0 && shifts.length > 0 && (
        <p className="text-sm text-slate-400 italic text-center py-4">Tu n’es inscrit(e) à aucun poste.</p>
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
            onEdit={() => setEditing(s.id)}
            onDelete={() => {
              if (confirm(`Supprimer le poste « ${s.title} » ?${s.signups.length ? ' Les inscrits seront prévenus.' : ''}`)) run(() => api.delete(`/plans/shifts/${s.id}`));
            }}
          />
        ))}
      </div>

      {shifts.length > 0 && (
        <p className="text-xs text-slate-400 text-center">S’inscrire à un poste vaut « Je suis in ». Répondre « Absent(e) » libère tes postes.</p>
      )}
    </div>
  );
}

function ShiftCard({ shift: s, userId, canManage, clash, onSignUp, onWithdraw, onRemove, onEdit, onDelete }: {
  shift: VolunteerShift; userId: string; canManage: boolean; clash: boolean;
  onSignUp: () => void; onWithdraw: () => void; onRemove: (userId: string) => void; onEdit: () => void; onDelete: () => void;
}) {
  const mine = s.signups.some(x => x.userId === userId);
  const full = s.signups.length >= s.needed;
  const hours = shiftHours(s);
  return (
    <div className={`p-3.5 rounded-xl border shadow-sm ${mine ? 'bg-indigo-50/60 border-indigo-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 break-words">{s.title}</p>
          {hours && <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5"><Clock size={11} />{hours}</p>}
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${full ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {s.signups.length}/{s.needed}
        </span>
        {canManage && (
          <span className="flex-shrink-0 flex -mr-1">
            <button onClick={onEdit} title="Modifier ce poste" className="p-1 rounded-md text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={14} /></button>
            <button onClick={onDelete} title="Supprimer ce poste" className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
          </span>
        )}
      </div>
      {s.note && <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap break-words">{s.note}</p>}

      {s.signups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {s.signups.map(x => (
            <span key={x.userId} className={`flex items-center gap-1 pl-2 ${canManage && x.userId !== userId ? 'pr-1' : 'pr-2'} py-0.5 rounded-full text-xs ${x.userId === userId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {displayName(x.user) ? `${displayName(x.user)} ` : ''}<span className="opacity-70">@{x.user.pseudo}</span>
              {canManage && x.userId !== userId && (
                <button onClick={() => { if (confirm(`Retirer @${x.user.pseudo} de ce poste ?`)) onRemove(x.userId); }} title="Retirer" className="p-0.5 rounded-full hover:bg-slate-200"><X size={11} /></button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {mine ? (
          <button onClick={onWithdraw} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">Me désinscrire</button>
        ) : full ? (
          <span className="text-xs text-slate-400">Complet</span>
        ) : (
          <button onClick={onSignUp} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">Je m’inscris</button>
        )}
        {clash && !full && <span className="text-xs text-amber-600">Chevauche un de tes postes</span>}
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
        <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Poste : buvette, caisse, rangement…" className={`flex-1 ${input}`} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
          <input type="number" min={1} max={200} required value={needed} onChange={e => setNeeded(e.target.value)} className={`w-16 ${input}`} aria-label="Nombre de personnes" />
          pers.
        </label>
      </div>
      <div className="flex flex-wrap gap-2 items-start">
        <div className="text-xs text-slate-500 flex items-start gap-1.5 flex-1 min-w-[14rem]">
          <span className="pt-2.5">Début</span>
          <DateTimeField value={start} onChange={setStart} placeholder="Horaire (facultatif)" clearable
            openAt={toLocalInput(plan.eventDate)} defaultTime={toLocalInput(plan.eventDate).slice(11, 16) || '09:00'} className="flex-1 min-w-0" />
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-1.5">
          Fin
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} disabled={!start} className={`w-28 ${input} disabled:opacity-50`} />
        </label>
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Remarque (facultatif) : tenue, lieu de rendez-vous…" className={input} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">Annuler</button>
        <button type="submit" disabled={busy || !title.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {shift ? 'Enregistrer' : 'Ajouter le poste'}
        </button>
      </div>
    </form>
  );
}
