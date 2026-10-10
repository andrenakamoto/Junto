import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, FileDown, FileText, Paperclip, Pencil, Plus, Settings2, Trash2, Users, X } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';
import { saveFile } from '../../lib/saveFile';
import { Modal } from '../ui/Modal';
import { Trans } from 'react-i18next';
import { intlLocale, t } from '../../i18n';

// Assemblée (fonction à activer) — serveur : routes/assembly.ts. Avant : ordre du jour, documents,
// convocation, procurations. Pendant : présences (pointées par l'organisateur, code de la salle ou à
// distance si hybride), quorum en direct, votes (bulletin secret ou main levée) et élections. Après :
// procès-verbal PDF, envoyé au créateur du Plan à la clôture. Rechargé à chaque mise à jour du Plan.

type P = { id: string; name: string };
type Item = {
  id: string; position: number; title: string; description: string | null; kind: 'info' | 'vote' | 'election'; notes: string | null;
  documents: { id: string; name: string; mimeType: string }[]; secret: boolean; majority: string; majorityLabel: string; seats: number | null;
  status: 'pending' | 'open' | 'closed' | 'tacit'; eligibleVotes: number | null; votedCount: number;
  myMandates: (P & { voted: boolean })[]; candidates: { id: string; name: string; userId: string | null; elected: boolean }[];
  result: any; openVotes: { name: string; by: string | null; choice: string | null }[];
};
type State = {
  canManage: boolean; isSecretary: boolean; canSeePv: boolean; isVoter: boolean; circleMember: boolean;
  status: 'preparation' | 'open' | 'closed'; convokedAt: string | null; openedAt: string | null; closedAt: string | null; eventDate: string | null;
  settings: { nonVoterIds: string[]; proxiesAllowed: boolean; maxProxies: number; quorumMode: string; quorumValue: number | null; codeCheckIn: boolean; hybrid: boolean; noticeDays: number; secretaryId: string | null };
  checkInCode: string | null;
  members: { id: string; name: string; isVoter: boolean; present: boolean; remote: boolean; proxyTo: P | null }[];
  quorum: { required: number | null; represented: number; presentVoters: number; validProxies: number; voterCount: number; reached: boolean };
  me: { present: boolean; remote: boolean; proxyGivenTo: P | null; proxiesHeld: P[]; mandates: P[] };
  proxies: { id: string; giver: P; holder: P }[];
  items: Item[];
};

const KIND_LABEL = { info: t('games.assembly.kind.info'), vote: t('games.assembly.kind.vote'), election: t('games.assembly.kind.election') };
const CHOICES = [
  { value: 'yes', label: t('games.assembly.choice.yes'), cls: 'bg-emerald-600' },
  { value: 'no', label: t('games.assembly.choice.no'), cls: 'bg-red-600' },
  { value: 'abstain', label: t('games.assembly.choice.abstain'), cls: 'bg-slate-500' },
];
const CHOICE_LABEL: Record<string, string> = { yes: t('games.assembly.choiceLower.yes'), no: t('games.assembly.choiceLower.no'), abstain: t('games.assembly.choiceLower.abstain') };
const errorOf = (e: any) => e?.response?.data?.error || t('common.retryError');
const dateFmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function AssemblyTab({ plan }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/assembly`)).data); } catch (e) { setError(errorOf(e)); }
  }
  useEffect(() => { load(); }, [plan]);
  async function run(action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError('');
    try { await action(); await load(); } catch (e) { setError(errorOf(e)); }
  }
  if (!s) return <div className="flex-1 p-6 text-sm text-slate-400">{error || t('common.loading')}</div>;

  const openItem = s.items.find(i => i.status === 'open');
  const daysBefore = s.eventDate ? Math.floor((+new Date(s.eventDate) - Date.now()) / 86400000) : null;
  async function downloadPv() {
    const res = await api.get(`/plans/${plan.id}/assembly/pv`, { responseType: 'blob' });
    await saveFile(res.data, t('games.assembly.pvFile', { title: plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80) }), t('games.assembly.pvShare', { title: plan.title }));
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* État de l'assemblée */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === 'open' ? 'bg-emerald-100 text-emerald-700' : s.status === 'closed' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
            {s.status === 'open' ? t('games.assembly.statusOpen') : s.status === 'closed' ? t('games.assembly.statusClosed') : t('games.assembly.statusPrep')}
          </span>
          {s.eventDate && <span className="text-xs text-slate-500">{dateFmt.format(new Date(s.eventDate))}</span>}
          {s.canManage && <button onClick={() => setShowSettings(true)} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label={t('games.assembly.settingsAria')}><Settings2 size={16} /></button>}
        </div>
        {s.status === 'preparation' && (
          <p className="text-sm text-slate-600 mt-2">
            {s.convokedAt ? t('games.assembly.convokedOn', { date: new Date(s.convokedAt).toLocaleDateString(intlLocale()) }) : t('games.assembly.notConvoked')}
          </p>
        )}
        {s.canManage && s.status === 'preparation' && !s.convokedAt && daysBefore !== null && daysBefore < s.settings.noticeDays && (
          <p className="text-xs text-amber-700 mt-1 flex gap-1"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{t('games.assembly.noticeWarning', { count: Math.max(daysBefore, 0), days: s.settings.noticeDays })}</p>
        )}
        {s.canManage && (
          <div className="flex flex-wrap gap-2 mt-3">
            {s.status === 'preparation' && <button onClick={() => run(() => api.post(`/plans/${plan.id}/assembly/convoke`), t('games.assembly.convokeConfirm'))} className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold">📣 {s.convokedAt ? t('games.assembly.convokeAgain') : t('games.assembly.convoke')}</button>}
            {s.status === 'preparation' && <button onClick={() => run(() => api.post(`/plans/${plan.id}/assembly/open`), t('games.assembly.openConfirm'))} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('games.assembly.open')}</button>}
            {s.status === 'open' && <button onClick={() => run(() => api.post(`/plans/${plan.id}/assembly/close`), t('games.assembly.closeConfirm'))} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold">{t('games.assembly.close')}</button>}
            {s.status === 'closed' && <button onClick={() => run(() => api.post(`/plans/${plan.id}/assembly/reopen`), t('games.assembly.reopenConfirm'))} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm">{t('games.assembly.reopen')}</button>}
          </div>
        )}
        {s.canSeePv && (
          <button onClick={() => run(downloadPv)} className="mt-3 w-full py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2">
            <FileDown size={16} /> {s.status === 'closed' ? t('games.assembly.pv') : t('games.assembly.pvDraft')}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Vote en cours : toujours en haut */}
      {openItem && <VoteCard item={openItem} state={s} onRun={run} />}

      {/* Ma participation */}
      {s.circleMember && <MyParticipation plan={plan} s={s} onRun={run} />}

      {/* Quorum et code de la salle */}
      {s.status !== 'preparation' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-sm text-slate-700"><Trans i18nKey="games.assembly.quorumLine" values={{ present: s.quorum.presentVoters, proxies: s.quorum.validProxies, represented: s.quorum.represented, voters: s.quorum.voterCount }} components={{ b: <strong /> }} /></p>
          {s.quorum.required !== null && <p className={`text-sm font-semibold mt-1 ${s.quorum.reached ? 'text-emerald-700' : 'text-red-600'}`}>{s.quorum.reached ? t('games.assembly.quorumReached') : t('games.assembly.quorumMissed')} {t('games.assembly.quorumRequired', { count: s.quorum.required })}</p>}
          {s.checkInCode && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-50 text-center">
              <p className="text-xs text-indigo-700">{t('games.assembly.roomCode')}</p>
              <p className="text-4xl font-black tracking-[0.3em] text-indigo-700">{s.checkInCode}</p>
            </div>
          )}
        </div>
      )}

      {/* Ordre du jour */}
      <div className="flex items-center gap-2 pt-1">
        <h3 className="text-sm font-semibold text-slate-700 flex-1">{t('games.assembly.agenda')}</h3>
        {s.canManage && s.status !== 'closed' && <button onClick={() => setEditing('new')} className="text-sm text-indigo-600 font-semibold flex items-center gap-1"><Plus size={15} /> {t('games.assembly.addItem')}</button>}
      </div>
      {s.items.length === 0 && <p className="text-sm text-slate-400 italic">{s.canManage ? t('games.assembly.emptyManager') : t('games.assembly.emptyMember')}</p>}
      {s.items.map((item, n) => (
        <ItemCard key={item.id} plan={plan} item={item} index={n} s={s} onRun={run} onEdit={() => setEditing(item)} />
      ))}

      {/* Présences et procurations (organisateur) */}
      {s.canManage && <AttendancePanel plan={plan} s={s} onRun={run} />}

      {editing && <ItemModal plan={plan} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {showSettings && <SettingsModal plan={plan} s={s} onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); load(); }} />}
    </div>
  );
}

type Run = (action: () => Promise<unknown>, confirmText?: string) => Promise<void>;

function MyParticipation({ plan, s, onRun }: { plan: Plan; s: State; onRun: Run }) {
  const [holder, setHolder] = useState('');
  const [code, setCode] = useState('');
  const others = s.members.filter(m => m.isVoter && m.id !== undefined && !s.me.mandates.some(x => x.id === m.id));
  if (!s.isVoter && s.status === 'preparation') return <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-500">{t('games.assembly.noVoteRight')}</div>;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
      <p className="text-sm font-semibold text-slate-800">{t('games.assembly.myParticipation')}</p>
      {!s.isVoter && <p className="text-sm text-slate-500">{t('games.assembly.noVoteRightShort')}</p>}
      {s.status === 'open' && (s.me.present
        ? <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={16} /> {s.me.remote ? t('games.assembly.presentRemote') : t('games.assembly.present')}</p>
        : (
          <div className="space-y-2">
            {s.settings.codeCheckIn && (
              <div className="flex gap-2">
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder={t('games.assembly.roomCodePlaceholder')} className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm tracking-widest" />
                <button onClick={() => onRun(() => api.post(`/plans/${plan.id}/assembly/checkin`, { code }))} disabled={code.length !== 4} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{t('games.assembly.imHere')}</button>
              </div>
            )}
            {s.settings.hybrid && <button onClick={() => onRun(() => api.post(`/plans/${plan.id}/assembly/checkin`, { remote: true }))} className="w-full py-2 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold">{t('games.assembly.remote')}</button>}
            {!s.settings.codeCheckIn && !s.settings.hybrid && <p className="text-sm text-slate-500">{t('games.assembly.organizerChecks')}</p>}
          </div>
        ))}
      {s.isVoter && s.me.proxiesHeld.length > 0 && <p className="text-sm text-slate-700"><Trans i18nKey="games.assembly.youRepresent" values={{ names: s.me.proxiesHeld.map(p => p.name).join(', ') }} components={{ b: <strong /> }} />{s.status === 'open' && !s.me.present ? t('games.assembly.validOnceHere') : ''}</p>}
      {s.isVoter && s.settings.proxiesAllowed && s.status === 'preparation' && (s.me.proxyGivenTo
        ? <p className="text-sm text-slate-700 flex items-center gap-2 flex-wrap"><span><Trans i18nKey="games.assembly.proxyGiven" values={{ name: s.me.proxyGivenTo.name }} components={{ b: <strong /> }} /></span>
            <button onClick={() => onRun(() => api.delete(`/plans/${plan.id}/assembly/proxy`))} className="text-xs text-red-600 underline">{t('games.assembly.withdraw')}</button></p>
        : s.me.proxiesHeld.length === 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-1">{t('games.assembly.cantCome')}</p>
            <div className="flex gap-2">
              <select value={holder} onChange={e => setHolder(e.target.value)} className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                <option value="">{t('games.assembly.chooseMember')}</option>
                {others.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={() => onRun(() => api.post(`/plans/${plan.id}/assembly/proxy`, { holderId: holder }))} disabled={!holder} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{t('games.assembly.give')}</button>
            </div>
          </div>
        ))}
      {s.isVoter && s.me.proxyGivenTo && s.status === 'open' && !s.me.present && <p className="text-sm text-slate-600">{t('games.assembly.proxyVotes', { name: s.me.proxyGivenTo.name })}</p>}
    </div>
  );
}

function VoteCard({ item, state, onRun }: { item: Item; state: State; onRun: Run }) {
  const [choices, setChoices] = useState<Record<string, string | string[]>>({});
  const todo = item.myMandates.filter(m => !m.voted);
  const seats = item.seats ?? 1;
  const ready = todo.length > 0 && todo.every(m => item.kind === 'vote' ? !!choices[m.id] : Array.isArray(choices[m.id]));
  function toggleCandidate(mid: string, cid: string) {
    const cur = (choices[mid] as string[] | undefined) ?? [];
    const next = cur.includes(cid) ? cur.filter(x => x !== cid) : cur.length < seats ? [...cur, cid] : cur;
    setChoices({ ...choices, [mid]: next });
  }
  function submit() {
    const votes = todo.map(m => item.kind === 'vote' ? { onBehalfOfId: m.id, choice: choices[m.id] } : { onBehalfOfId: m.id, candidateIds: choices[m.id] });
    return onRun(() => api.post(`/plans/assembly/items/${item.id}/vote`, { votes }));
  }
  return (
    <div className="bg-white rounded-xl border-2 border-indigo-400 shadow-md p-4">
      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{t('games.assembly.voteOpen', { mode: item.secret ? t('games.assembly.secret') : t('games.assembly.handRaise') })}</p>
      <p className="text-base font-bold text-slate-900 mt-1">{item.title}</p>
      {item.kind === 'vote' && <p className="text-xs text-slate-500 mt-0.5">{t(`games.assembly.majorityAdopted.${item.majority}` as any, { defaultValue: item.majorityLabel })}</p>}
      {item.kind === 'election' && <p className="text-xs text-slate-500 mt-0.5">{t('games.assembly.seatsHint', { count: seats })}</p>}
      <p className="text-sm text-slate-600 mt-2">{t('games.assembly.votedCount', { voted: item.votedCount, eligible: item.eligibleVotes ?? '?' })}</p>
      {item.myMandates.length === 0 && <p className="text-sm text-slate-500 mt-2">{state.isVoter ? t('games.assembly.checkInToVote') : t('games.assembly.notVoter')}</p>}
      {item.myMandates.length > 0 && todo.length === 0 && <p className="text-sm text-emerald-700 font-semibold mt-2 flex items-center gap-1.5"><CheckCircle2 size={16} /> {item.myMandates.length > 1 ? t('games.assembly.votedAll') : t('games.assembly.voted')}</p>}
      {todo.map(m => (
        <div key={m.id} className="mt-3">
          {item.myMandates.length > 1 && <p className="text-xs font-semibold text-slate-600 mb-1">{m.id === item.myMandates[0].id ? t('games.assembly.myVote') : t('games.assembly.forProxy', { name: m.name })}</p>}
          {item.kind === 'vote' ? (
            <div className="grid grid-cols-3 gap-2">
              {CHOICES.map(c => (
                <button key={c.value} onClick={() => setChoices({ ...choices, [m.id]: c.value })}
                  className={`py-3 rounded-xl text-sm font-bold ${choices[m.id] === c.value ? `${c.cls} text-white` : 'bg-slate-100 text-slate-700'}`}>{c.label}</button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {item.candidates.map(c => {
                const on = ((choices[m.id] as string[] | undefined) ?? []).includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleCandidate(m.id, c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-700'}`}>
                    {on ? '☑' : '☐'} {c.name}
                  </button>
                );
              })}
              {!Array.isArray(choices[m.id]) && <button onClick={() => setChoices({ ...choices, [m.id]: [] })} className="text-xs text-slate-500 underline">{t('games.assembly.blankBallot')}</button>}
            </div>
          )}
        </div>
      ))}
      {todo.length > 0 && <button onClick={submit} disabled={!ready} className="mt-3 w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">{todo.length > 1 ? t('games.assembly.voteN', { count: todo.length }) : t('games.assembly.vote')}</button>}
      {state.canManage && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/close`), t('games.assembly.closeVoteConfirm'))} className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold">{t('games.assembly.closeVote')}</button>
          <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/reset`), t('games.assembly.resetVoteConfirm'))} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm">{t('common.cancel')}</button>
        </div>
      )}
    </div>
  );
}

function ItemResult({ item }: { item: Item }) {
  const r = item.result;
  if (!r) return null;
  if (item.kind === 'vote') {
    const ok = r.adopted;
    return (
      <div className={`mt-2 p-2.5 rounded-lg text-sm ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
        <strong>{ok ? t('games.assembly.adopted') : t('games.assembly.rejected')}</strong>{r.tacit ? t('games.assembly.tacitAcclaim') : t('games.assembly.counts', { yes: r.counts.yes, no: r.counts.no, count: r.counts.abstain })}
        {item.openVotes.length > 0 && <p className="text-xs mt-1 opacity-80">{item.openVotes.map(v => `${v.by ? t('games.assembly.by', { name: v.name, by: v.by }) : v.name} : ${CHOICE_LABEL[v.choice ?? ''] ?? '?'}`).join(' · ')}</p>}
      </div>
    );
  }
  return (
    <div className="mt-2 p-2.5 rounded-lg text-sm bg-emerald-50 text-emerald-900">
      <strong>{r.elected.length ? t('games.assembly.elected', { names: r.elected.join(', ') }) : t('games.assembly.nobodyElected')}</strong>{r.tacit ? t('games.assembly.tacitly') : ''}
      {!r.tacit && <p className="text-xs mt-1 opacity-80">{r.ranking.map((x: any) => `${x.name} : ${x.votes}`).join(' · ')}{r.blank ? t('games.assembly.blanks', { count: r.blank }) : ''}</p>}
      {r.tie && <p className="text-xs mt-1 text-amber-800 font-semibold">{t('games.assembly.tie')}</p>}
    </div>
  );
}

function ItemCard({ plan, item, index, s, onRun, onEdit }: { plan: Plan; item: Item; index: number; s: State; onRun: Run; onEdit: () => void }) {
  const [notes, setNotes] = useState(item.notes ?? '');
  const [editNotes, setEditNotes] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [tacit, setTacit] = useState<string[] | null>(null);
  const [tiePick, setTiePick] = useState<string[]>([]);
  useEffect(() => { if (!editNotes) setNotes(item.notes ?? ''); }, [item.notes, editNotes]);
  const canNotes = s.canManage || s.isSecretary;
  const pending = item.status === 'pending';
  const live = s.status === 'open';
  const move = (dir: -1 | 1) => {
    const ids = s.items.map(i => i.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    return onRun(() => api.put(`/plans/${plan.id}/assembly/order`, { ids }));
  };
  const free = (item.seats ?? 1) - (item.result?.elected?.length ?? 0);
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${item.status === 'open' ? 'border-indigo-300' : 'border-slate-200'}`}>
      <div className="flex items-start gap-2">
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
          <p className="text-xs text-slate-500">{KIND_LABEL[item.kind]}{item.kind !== 'info' ? ` · ${item.secret ? t('games.assembly.secret') : t('games.assembly.handRaise')}` : ''}{item.kind === 'election' ? ` · ${t('games.assembly.seats', { count: item.seats ?? 1 })}` : ''}</p>
        </div>
        {s.canManage && s.status !== 'closed' && (
          <div className="flex items-center gap-0.5 text-slate-400">
            {index > 0 && <button onClick={() => move(-1)} aria-label={t('games.assembly.up')} className="p-1 hover:text-slate-700"><ArrowUp size={14} /></button>}
            {index < s.items.length - 1 && <button onClick={() => move(1)} aria-label={t('games.assembly.down')} className="p-1 hover:text-slate-700"><ArrowDown size={14} /></button>}
            <button onClick={onEdit} aria-label={t('common.edit')} className="p-1 hover:text-slate-700"><Pencil size={14} /></button>
            {pending && <button onClick={() => onRun(() => api.delete(`/plans/assembly/items/${item.id}`), t('games.assembly.deleteItemConfirm'))} aria-label={t('common.delete')} className="p-1 hover:text-red-600"><Trash2 size={14} /></button>}
          </div>
        )}
      </div>
      {item.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{item.description}</p>}
      {item.documents.length > 0 && (
        <div className="mt-2 space-y-1">
          {item.documents.map(d => (
            <a key={d.id} href={mediaUrl(d.id, plan.mediaToken)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-700 underline">
              <FileText size={14} className="flex-shrink-0" /><span className="truncate">{d.name}</span>
            </a>
          ))}
        </div>
      )}
      {item.kind === 'election' && pending && (
        <div className="mt-2">
          <p className="text-xs text-slate-500">{t('games.assembly.candidates')}{item.candidates.length ? '' : t('games.assembly.noCandidate')}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {item.candidates.map(c => (
              <span key={c.id} className="text-xs bg-slate-100 text-slate-700 rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1">{c.name}
                {s.canManage && <button onClick={() => onRun(() => api.delete(`/plans/assembly/candidates/${c.id}`))} aria-label={t('games.assembly.removeName', { name: c.name })}><X size={12} /></button>}
              </span>
            ))}
          </div>
          {s.canManage && (
            <div className="flex gap-2 mt-2">
              <select value={candidate} onChange={e => setCandidate(e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white">
                <option value="">{t('games.assembly.addMember')}</option>
                {s.members.filter(m => !item.candidates.some(c => c.userId === m.id)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={() => { const id = candidate; setCandidate(''); onRun(() => api.post(`/plans/assembly/items/${item.id}/candidates`, { userId: id })); }} disabled={!candidate} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-40">{t('common.add')}</button>
            </div>
          )}
        </div>
      )}
      <ItemResult item={item} />
      {s.canManage && item.result?.tie && (
        <div className="mt-2 p-2.5 rounded-lg bg-amber-50 text-sm">
          <p className="text-amber-900 mb-1">{t('games.assembly.tieBreak', { count: free })}</p>
          {item.candidates.filter(c => item.result.tiedIds.includes(c.id)).map(c => (
            <label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={tiePick.includes(c.id)} onChange={e => setTiePick(e.target.checked ? [...tiePick, c.id] : tiePick.filter(x => x !== c.id))} className="accent-indigo-600" />{c.name}</label>
          ))}
          <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/elect`, { candidateIds: tiePick }))} disabled={tiePick.length !== free} className="mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40">{t('games.assembly.validate')}</button>
        </div>
      )}
      {s.canManage && live && pending && item.kind !== 'info' && !s.items.some(i => i.status === 'open') && (
        <div className="mt-3 space-y-2">
          <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/open`))} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('games.assembly.openVote')}</button>
          {item.kind === 'vote' ? (
            <div className="flex gap-2 text-xs">
              <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/tacit`, { adopted: true }), t('games.assembly.acclaimConfirm'))} className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">{t('games.assembly.acclaim')}</button>
              <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/tacit`, { adopted: false }), t('games.assembly.rejectTacitConfirm'))} className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">{t('games.assembly.rejectTacit')}</button>
            </div>
          ) : tacit === null ? (
            <button onClick={() => setTacit([])} disabled={!item.candidates.length} className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs disabled:opacity-40">{t('games.assembly.tacitElection')}</button>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-50 text-sm">
              <p className="text-slate-600 mb-1">{t('games.assembly.tacitElected')}</p>
              {item.candidates.map(c => <label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={tacit.includes(c.id)} onChange={e => setTacit(e.target.checked ? [...tacit, c.id] : tacit.filter(x => x !== c.id))} className="accent-indigo-600" />{c.name}</label>)}
              <div className="flex gap-2 mt-1">
                <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/tacit`, { candidateIds: tacit }))} disabled={!tacit.length} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40">{t('games.assembly.save')}</button>
                <button onClick={() => setTacit(null)} className="text-xs text-slate-500">{t('common.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {s.canManage && (item.status === 'closed' || item.status === 'tacit') && s.status === 'open' && (
        <button onClick={() => onRun(() => api.post(`/plans/assembly/items/${item.id}/reset`), t('games.assembly.resetResultConfirm'))} className="mt-2 text-xs text-slate-400 underline">{t('games.assembly.resetResult')}</button>
      )}
      {/* Notes du procès-verbal */}
      {(item.notes || canNotes) && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          {editNotes ? (
            <div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} maxLength={4000} autoFocus placeholder={t('games.assembly.notesPlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              <div className="flex gap-2 mt-1">
                <button onClick={() => onRun(() => api.put(`/plans/assembly/items/${item.id}/notes`, { notes })).then(() => setEditNotes(false))} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">{t('games.assembly.save')}</button>
                <button onClick={() => setEditNotes(false)} className="text-xs text-slate-500">{t('common.cancel')}</button>
              </div>
            </div>
          ) : item.notes ? (
            <div className="text-sm text-slate-600 whitespace-pre-line">
              <span className="text-xs font-semibold text-slate-400 block">{t('games.assembly.notes')}</span>{item.notes}
              {canNotes && <button onClick={() => setEditNotes(true)} className="block text-xs text-indigo-600 mt-1">{t('games.assembly.editNotes')}</button>}
            </div>
          ) : (
            <button onClick={() => setEditNotes(true)} className="text-xs text-indigo-600 font-medium">{t('games.assembly.addNotes')}</button>
          )}
        </div>
      )}
    </div>
  );
}

function AttendancePanel({ plan, s, onRun }: { plan: Plan; s: State; onRun: Run }) {
  const [open, setOpen] = useState(s.status === 'open');
  const present = s.members.filter(m => m.present).length;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 text-left">
        <Users size={16} className="text-slate-500" />
        <span className="flex-1 text-sm font-semibold text-slate-800">{t('games.assembly.attendance')}</span>
        <span className="text-xs text-slate-500">{t('games.assembly.attendanceCount', { present, proxies: s.proxies.length })}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {s.status === 'open' && (
            <div className="divide-y divide-slate-100">
              {s.members.map(m => (
                <label key={m.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <input type="checkbox" checked={m.present} onChange={e => onRun(() => api.put(`/plans/${plan.id}/assembly/attendance/${m.id}`, { present: e.target.checked }))} className="accent-indigo-600 w-4 h-4" />
                  <span className="flex-1">{m.name}{!m.isVoter && <span className="text-xs text-slate-400">{t('games.assembly.noVoteRightTag')}</span>}</span>
                  {m.remote && <span className="text-xs text-indigo-600">{t('games.assembly.remoteTag')}</span>}
                  {m.proxyTo && !m.present && <span className="text-xs text-slate-400">→ {m.proxyTo.name}</span>}
                </label>
              ))}
            </div>
          )}
          {s.status !== 'open' && <p className="text-xs text-slate-500">{t('games.assembly.attendanceLater')}</p>}
          {s.proxies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">{t('games.assembly.proxies')}</p>
              {s.proxies.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                  <span className="flex-1">{p.giver.name} → {p.holder.name}</span>
                  {s.status !== 'closed' && <button onClick={() => onRun(() => api.delete(`/plans/${plan.id}/assembly/proxies/${p.id}`), t('games.assembly.refuseProxyConfirm', { name: p.giver.name }))} className="text-xs text-red-600">{t('games.assembly.refuse')}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemModal({ plan, item, onClose, onSaved }: { plan: Plan; item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [kind, setKind] = useState<Item['kind']>(item?.kind ?? 'info');
  const [secret, setSecret] = useState(item?.secret ?? true);
  const [majority, setMajority] = useState(item?.majority ?? 'simple');
  const [seats, setSeats] = useState(item?.seats ?? 1);
  const [docs, setDocs] = useState(item?.documents ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = !!item && item.status !== 'pending';
  async function upload(file: File) {
    setBusy(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post(`/attachments/plans/${plan.id}?via=assemblee`, fd);
      setDocs(d => [...d, { id: data.id, name: data.name, mimeType: data.mimeType }]);
    } catch (e) { setError(errorOf(e)); }
    setBusy(false);
  }
  async function save() {
    setBusy(true); setError('');
    const body = { title, description, kind, secret, majority, seats, attachmentIds: docs.map(d => d.id) };
    try {
      if (item) await api.put(`/plans/assembly/items/${item.id}`, body);
      else await api.post(`/plans/${plan.id}/assembly/items`, body);
      onSaved();
    } catch (e) { setError(errorOf(e)); setBusy(false); }
  }
  return (
    <Modal title={item ? t('games.assembly.editItem') : t('games.assembly.newItem')} onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder={t('games.assembly.titlePlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder={t('games.assembly.descPlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
        <div className="grid grid-cols-3 gap-1.5">
          {(['info', 'vote', 'election'] as const).map(k => (
            <button key={k} disabled={locked} onClick={() => setKind(k)} className={`py-2 rounded-lg text-sm font-medium ${kind === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-60`}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        {kind !== 'info' && (
          <div className="space-y-2 p-3 rounded-lg bg-slate-50">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={locked} checked={secret} onChange={e => setSecret(e.target.checked)} className="accent-indigo-600" />{t('games.assembly.secretBallot')} <span className="text-xs text-slate-400">{t('games.assembly.secretHint')}</span></label>
            {kind === 'vote' && (
              <select disabled={locked} value={majority} onChange={e => setMajority(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                <option value="simple">{t('games.assembly.majSimple')}</option>
                <option value="absolute">{t('games.assembly.majAbsolute')}</option>
                <option value="two_thirds">{t('games.assembly.majTwoThirds')}</option>
              </select>
            )}
            {kind === 'election' && (
              <label className="flex items-center gap-2 text-sm">{t('games.assembly.seatsToFill')}
                <input type="number" disabled={locked} min={1} max={20} value={seats} onChange={e => setSeats(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-sm" />
              </label>
            )}
            {kind === 'election' && <p className="text-xs text-slate-500">{t('games.assembly.candidatesLater')}</p>}
            {locked && <p className="text-xs text-slate-500">{t('games.assembly.locked')}</p>}
          </div>
        )}
        <div>
          <p className="text-sm text-slate-600 mb-1">{t('games.assembly.documents')}</p>
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-sm py-0.5">
              <FileText size={14} className="text-slate-400" /><span className="flex-1 truncate">{d.name}</span>
              <button onClick={() => setDocs(docs.filter(x => x.id !== d.id))} className="text-slate-400 hover:text-red-600" aria-label={t('games.assembly.withdraw')}><X size={14} /></button>
            </div>
          ))}
          <label className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium cursor-pointer mt-1">
            <Paperclip size={14} /> {t('games.assembly.attach')}
            <input type="file" className="hidden" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={save} disabled={busy || !title.trim()} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? t('common.wait') : t('games.assembly.save')}</button>
      </div>
    </Modal>
  );
}

function SettingsModal({ plan, s, onClose, onSaved }: { plan: Plan; s: State; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ ...s.settings });
  const [error, setError] = useState('');
  const [showVoters, setShowVoters] = useState(false);
  const voterCount = useMemo(() => s.members.filter(m => !v.nonVoterIds.includes(m.id)).length, [s.members, v.nonVoterIds]);
  const set = (patch: Partial<State['settings']>) => setV({ ...v, ...patch });
  async function save() {
    setError('');
    try { await api.put(`/plans/${plan.id}/assembly`, v); onSaved(); } catch (e) { setError(errorOf(e)); }
  }
  const check = (label: string, value: boolean, onChange: (b: boolean) => void, hint?: string) => (
    <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-indigo-600 mt-0.5" />
      <span>{label}{hint && <span className="block text-xs text-slate-400">{hint}</span>}</span>
    </label>
  );
  return (
    <Modal title={t('games.assembly.settingsTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <button onClick={() => setShowVoters(!showVoters)} className="text-sm text-slate-700 w-full text-left"><Trans i18nKey="games.assembly.voters" values={{ count: voterCount, total: s.members.length }} components={{ b: <strong /> }} /> <span className="text-indigo-600 text-xs">{showVoters ? t('games.assembly.closeList') : t('games.assembly.editList')}</span></button>
          {showVoters && (
            <div className="mt-2 max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
              {s.members.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!v.nonVoterIds.includes(m.id)} onChange={e => set({ nonVoterIds: e.target.checked ? v.nonVoterIds.filter(x => x !== m.id) : [...v.nonVoterIds, m.id] })} className="accent-indigo-600" />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">{t('games.assembly.votersHint')}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('games.assembly.quorum')}</p>
          <select value={v.quorumMode} onChange={e => set({ quorumMode: e.target.value, quorumValue: e.target.value === 'none' ? null : v.quorumValue ?? (e.target.value === 'percent' ? 50 : 10) })} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm bg-white">
            <option value="none">{t('games.assembly.quorumNone')}</option>
            <option value="count">{t('games.assembly.quorumCount')}</option>
            <option value="percent">{t('games.assembly.quorumPercent')}</option>
          </select>
          {v.quorumMode !== 'none' && (
            <label className="flex items-center gap-2 text-sm">{t('games.assembly.atLeast')}
              <input type="number" min={1} max={v.quorumMode === 'percent' ? 100 : 10000} value={v.quorumValue ?? ''} onChange={e => set({ quorumValue: Number(e.target.value) || null })} className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-sm" />
              {v.quorumMode === 'percent' ? t('games.assembly.percentOfVoters') : t('games.assembly.votesUnit')}
            </label>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('games.assembly.attendanceVotes')}</p>
          {check(t('games.assembly.codeCheckIn'), v.codeCheckIn, b => set({ codeCheckIn: b }), t('games.assembly.codeCheckInHint'))}
          {check(t('games.assembly.hybrid'), v.hybrid, b => set({ hybrid: b }), t('games.assembly.hybridHint'))}
          {check(t('games.assembly.proxiesAllowed'), v.proxiesAllowed, b => set({ proxiesAllowed: b }))}
          {v.proxiesAllowed && (
            <label className="flex items-center gap-2 text-sm pl-6">{t('games.assembly.maxProxies')}
              <input type="number" min={1} max={10} value={v.maxProxies} onChange={e => set({ maxProxies: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-sm" />
            </label>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('games.assembly.minutes')}</p>
          <select value={v.secretaryId ?? ''} onChange={e => set({ secretaryId: e.target.value || null })} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm bg-white">
            <option value="">{t('games.assembly.noSecretary')}</option>
            {s.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <p className="text-xs text-slate-400">{t('games.assembly.secretaryHint')}</p>
          <label className="flex items-center gap-2 text-sm">{t('games.assembly.notice')}
            <input type="number" min={0} max={90} value={v.noticeDays} onChange={e => set({ noticeDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-sm" /> {t('games.assembly.days')}
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={save} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('games.assembly.save')}</button>
      </div>
    </Modal>
  );
}
