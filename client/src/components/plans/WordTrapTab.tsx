import { useEffect, useState } from 'react';
import { Speech, Play, Eye, EyeOff, Check, UserPlus, Flag, RotateCcw, X, Search, Trophy } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { DateTimeField } from '../ui/DateTimeField';
import { intlLocale, t } from '../../i18n';
import { Trans } from 'react-i18next';

// Le mot piège (serveur : routes/wordGame.ts). Avant le début : règles, réglages de l'organisateur (mode,
// niveaux de mots, mots perso, heure de fin). Pendant : ma mission (cachée par défaut), « Il / elle l'a
// dit ! », confirmation par la cible, « Démasquer », classement en direct. À la fin : toutes les missions.

type Person = { id: string; pseudo: string; firstName?: string | null };
interface WordState {
  started: boolean; ended: boolean; mode: 'points' | 'elimination'; endsAt: string | null; canManage: boolean;
  levels: string[] | null; customWords: string[] | null; poolSize: number | null;
  participants: Person[];
  ranking: { user: Person; points: number; alive: boolean; eliminatedBy?: Person | null }[];
  playingCount: number;
  me: { alive: boolean; points: number; mission: { target: Person | null; word: string } | null; claimed: boolean; accuseBlockedUntil: string | null; eliminatedBy: Person | null } | null;
  pendingClaim: { hunter: Person | null; word: string } | null;
  winner: Person | null;
  newcomers: Person[];
  missions: { hunter: Person | null; target: Person | null; word: string; outcome: string }[] | null;
}

const nameOf = (p?: Person | null) => (p ? displayName(p) ?? `@${p.pseudo}` : t('games.someone'));
const card = 'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm';
const fmtTime = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const LEVELS = (['facile', 'moyen', 'difficile'] as const).map(v => ({ v, label: t(`games.words.levels.${v}.label`), ex: t(`games.words.levels.${v}.ex`) }));
const outcomeLabel = (o: string) => ['success', 'unmasked', 'cancelled', 'open'].includes(o) ? t(`games.words.outcome.${o}` as any) : o;

export function WordTrapTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<WordState | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showMission, setShowMission] = useState(false);

  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/words`)).data); }
    catch (err: any) { setError(err.response?.data?.error || t('games.loadError')); }
  }
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>) {
    setError(''); setInfo('');
    try { await action(); await load(); return true; }
    catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); return false; }
  }

  if (!s) return <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-400">{error}</div>;
  const running = s.started && !s.ended;
  const isParticipant = s.participants.some(p => p.id === userId);
  const points = s.mode === 'points';

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-700 to-purple-950 text-white">
        <p className="text-lg font-bold flex items-center gap-2"><Speech size={20} /> {t('games.words.title')}</p>
        <p className="text-sm text-white/85 mt-1">
          {t('games.words.intro')}
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-white/20">{points ? t('games.words.modePoints') : t('games.words.modeElimination')}</span>
          {s.endsAt && !s.ended && points && <span className="px-2.5 py-1 rounded-full bg-white/20">{t('games.words.endsAt', { time: fmtTime(s.endsAt) })}</span>}
          {running && !points && <span className="px-2.5 py-1 rounded-full bg-white/20">{t('games.words.playing', { count: s.playingCount })}</span>}
          {s.ended && <span className="px-2.5 py-1 rounded-full bg-white/20">{t('games.killer.ended')}</span>}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {info && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{info}</p>}

      {s.ended && (
        <div className={card}>
          <p className="text-center text-4xl">🏆</p>
          <p className="text-center text-lg font-bold text-slate-900 mt-1">{s.winner ? t('games.killer.wins', { name: nameOf(s.winner) }) : t('games.words.tie')}</p>
        </div>
      )}

      {/* Quelqu'un dit que j'ai prononcé mon mot */}
      {running && s.pendingClaim && (
        <div className="p-4 rounded-2xl bg-violet-50 border-2 border-violet-300">
          <p className="font-semibold text-violet-900">{t('games.words.claimTitle', { name: nameOf(s.pendingClaim.hunter), word: s.pendingClaim.word })}</p>
          <p className="text-sm text-violet-800 mt-1">{t('games.words.claimHint')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/words/answer`, { confirm: true }))} className="px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-semibold hover:bg-violet-800">{t('games.words.confirmSaid')}</button>
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/words/answer`, { confirm: false }))} className="px-4 py-2 rounded-xl bg-white border border-violet-200 text-violet-800 text-sm font-medium hover:bg-violet-100">{t('games.killer.contest')}</button>
          </div>
        </div>
      )}

      {/* Ma mission */}
      {running && s.me?.alive && s.me.mission && (
        showMission ? (
          <div className={card}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-500">{t('games.killer.secretMission')}</p>
              <button onClick={() => setShowMission(false)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><EyeOff size={13} /> {t('games.killer.hide')}</button>
            </div>
            <p className="mt-2 text-lg text-slate-800">
              <Trans i18nKey="games.words.mission" values={{ word: s.me.mission.word, name: nameOf(s.me.mission.target) }} components={{ w: <span className="font-bold text-violet-700" />, b: <span className="font-bold" /> }} />
            </p>
            {s.me.claimed ? (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center justify-between gap-2">
                <span>{t('games.killer.waitingConfirm', { name: nameOf(s.me.mission.target) })}</span>
                <button onClick={() => run(() => api.delete(`/plans/${plan.id}/words/claim`))} className="text-xs underline flex-shrink-0">{t('common.cancel')}</button>
              </div>
            ) : (
              <button onClick={() => run(() => api.post(`/plans/${plan.id}/words/claim`))} className="mt-3 w-full py-3 rounded-xl bg-violet-700 text-white font-semibold flex items-center justify-center gap-2 hover:bg-violet-800">
                <Check size={18} /> {t('games.words.saidIt', { name: nameOf(s.me.mission.target) })}
              </button>
            )}
          </div>
        ) : (
          <button onClick={() => setShowMission(true)} className="w-full p-6 rounded-2xl bg-white border-2 border-dashed border-violet-300 text-center hover:bg-violet-50 transition-colors">
            <span className="block text-5xl">🤫</span>
            <span className="block mt-2 font-semibold text-slate-800 flex items-center justify-center gap-1.5"><Eye size={16} /> {t('games.killer.showMission')}</span>
            <span className="block text-xs text-slate-400 mt-1">{t('games.killer.noOneLooking')}</span>
          </button>
        )
      )}

      {/* Démasquer */}
      {running && s.me?.alive && <Unmask s={s} userId={userId} planId={plan.id} setInfo={setInfo} setError={setError} reload={load} />}

      {running && s.me && !s.me.alive && (
        <div className={card}>
          <p className="font-semibold text-slate-800">{s.me.eliminatedBy ? t('games.words.trapped', { name: nameOf(s.me.eliminatedBy) }) : t('games.killer.notInGame')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('games.words.followEnd')}</p>
        </div>
      )}

      {running && !s.me && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
          {t('games.killer.runningWithout')}{isParticipant ? t('games.killer.askAdd') : t('games.killer.answerThenAsk')}
        </p>
      )}

      {!s.started && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">{t('games.killer.howTitle')}</p>
          <ol className="text-sm text-slate-600 space-y-1.5 list-decimal pl-5">
            <li>{t('games.words.how1')}</li>
            <li>{t('games.words.how2')}</li>
            <li><Trans i18nKey="games.words.how3" components={{ b: <strong /> }} /></li>
            {points
              ? <li>{t('games.words.how4Points')}</li>
              : <li>{t('games.words.how4Elimination')}</li>}
          </ol>
          <p className="text-sm text-slate-700 mt-3">
            <Trans i18nKey="games.killer.playersSoFar" count={s.participants.length} components={{ b: <strong /> }} />
            {s.participants.length > 0 && <span className="text-slate-500"> : {s.participants.map(nameOf).join(', ')}</span>}
          </p>
          {!isParticipant && <p className="text-xs text-slate-400 mt-1">{t('games.killer.answerToPlay')}</p>}
        </div>
      )}

      {/* Classement en direct */}
      {s.started && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5"><Trophy size={16} /> {running ? t('games.words.rankingLive') : t('games.words.ranking')}</p>
          <ul className="space-y-1">
            {s.ranking.map((r, i) => (
              <li key={r.user.id} className="text-sm flex items-center gap-2">
                <span className="w-5 text-slate-400 text-right">{i + 1}</span>
                {!points && <span className={`w-2 h-2 rounded-full ${r.alive ? 'bg-emerald-500' : 'bg-slate-300'}`} />}
                <span className={`flex-1 truncate ${r.user.id === userId ? 'font-semibold text-violet-700' : r.alive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{nameOf(r.user)}{r.user.id === userId ? t('games.words.you') : ''}</span>
                {s.ended && !r.alive && r.eliminatedBy && <span className="text-xs text-slate-400">{t('games.words.trappedBy', { name: nameOf(r.eliminatedBy) })}</span>}
                <span className="font-bold tabular-nums text-slate-800">{t('games.words.points', { count: r.points })}</span>
                {s.canManage && running && r.alive && (
                  <button onClick={() => { if (confirm(t('games.words.removeConfirm', { name: nameOf(r.user) }))) run(() => api.post(`/plans/${plan.id}/words/remove`, { userId: r.user.id })); }}
                    className="text-slate-300 hover:text-red-500" title={t('games.killer.remove')}><X size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Révélation : toutes les missions */}
      {s.ended && s.missions && s.missions.length > 0 && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">{t('games.words.allMissions')}</p>
          <ul className="space-y-1.5">
            {s.missions.map((m, i) => (
              <li key={i} className="text-sm text-slate-700">
                <Trans i18nKey="games.words.missionLine" values={{ hunter: nameOf(m.hunter), word: m.word, target: nameOf(m.target) }} components={{ h: <span className="font-medium" />, w: <span className="font-semibold text-violet-700" /> }} />
                <span className="text-xs text-slate-400"> · {outcomeLabel(m.outcome)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.canManage && <ManagerPanel s={s} planId={plan.id} run={run} />}
    </div>
  );
}

function Unmask({ s, userId, planId, setInfo, setError, reload }: {
  s: WordState; userId: string; planId: string;
  setInfo: (t: string) => void; setError: (t: string) => void; reload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [suspect, setSuspect] = useState('');
  const others = s.ranking.filter(r => r.alive && r.user.id !== userId);
  const blocked = s.me?.accuseBlockedUntil;
  if (blocked) return <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">{t('games.words.unmaskBlocked', { time: fmtTime(blocked) })}</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full p-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50">
        <Search size={16} /> {t('games.words.unmaskOpen')}
      </button>
    );
  }
  async function accuse() {
    setError(''); setInfo('');
    try {
      const { data } = await api.post(`/plans/${planId}/words/accuse`, { suspectId: suspect });
      setInfo(data.correct ? t('games.words.unmaskRight') : t('games.words.unmaskWrong', { time: fmtTime(data.blockedUntil) }));
      setOpen(false); setSuspect('');
      await reload();
    } catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); }
  }
  return (
    <div className="p-4 rounded-2xl bg-white border border-violet-200 space-y-2">
      <p className="font-semibold text-slate-800">{t('games.words.whoTraps')}</p>
      <p className="text-xs text-slate-500">{t('games.words.unmaskHint')}</p>
      <select value={suspect} onChange={e => setSuspect(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
        <option value="">{t('games.words.pickPlayer')}</option>
        {others.map(r => <option key={r.user.id} value={r.user.id}>{nameOf(r.user)}</option>)}
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">{t('common.cancel')}</button>
        <button disabled={!suspect} onClick={accuse} className="px-3 py-1.5 bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-40">{t('games.words.unmask')}</button>
      </div>
    </div>
  );
}

function ManagerPanel({ s, planId, run }: { s: WordState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [custom, setCustom] = useState((s.customWords ?? []).join('\n'));
  const [endsAt, setEndsAt] = useState(toLocalInput(s.endsAt));
  const running = s.started && !s.ended;
  const save = (body: object) => run(() => api.put(`/plans/${planId}/words`, body));
  const saveEnd = (v: string) => { setEndsAt(v); if (!v || v.length >= 16) save({ endsAt: v ? new Date(v).toISOString() : null }); };

  return (
    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{t('games.organization')}</p>

      {!s.started && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{t('games.words.mode')}</p>
            <div className="grid grid-cols-2 gap-2">
              {([['points', t('games.words.modePoints'), t('games.words.pointsHint')], ['elimination', t('games.words.modeElimination'), t('games.words.eliminationHint')]] as const).map(([v, l, d]) => (
                <button key={v} onClick={() => save({ mode: v })} className={`p-2.5 rounded-xl border text-left ${s.mode === v ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
                  <span className="block text-sm font-semibold text-slate-800">{l}</span>
                  <span className="block text-xs text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{t('games.words.wordsTitle')}</p>
            {LEVELS.map(l => (
              <label key={l.v} className="flex items-start gap-2 text-sm text-slate-700 py-0.5 cursor-pointer">
                <input type="checkbox" className="accent-violet-700 mt-0.5" checked={s.levels?.includes(l.v) ?? false}
                  onChange={e => save({ levels: e.target.checked ? [...(s.levels ?? []), l.v] : (s.levels ?? []).filter(x => x !== l.v) })} />
                <span><strong>{l.label}</strong> <span className="text-slate-400">: {l.ex}</span></span>
              </label>
            ))}
            <label className="block text-xs text-slate-500 mt-2">{t('games.words.customLabel')}</label>
            <textarea value={custom} onChange={e => setCustom(e.target.value)} onBlur={() => save({ customWords: custom.split('\n').map(x => x.trim()).filter(Boolean) })} rows={3}
              placeholder={t('games.words.customPlaceholder')} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            <p className="text-xs text-slate-400">{t('games.words.poolSize', { count: s.poolSize ?? 0 })}</p>
          </div>
        </>
      )}

      {s.mode === 'points' && !s.ended && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-1">{t('games.words.endTitle')}</p>
          <DateTimeField value={endsAt} onChange={saveEnd} placeholder={t('games.words.noEnd')} clearable defaultTime="23:00" />
        </div>
      )}

      {!s.started && (
        <>
          <button
            disabled={s.participants.length < 3}
            onClick={() => { if (confirm(t('games.killer.startConfirm'))) run(() => api.post(`/plans/${planId}/words/start`)); }}
            className="w-full py-3 rounded-xl bg-violet-700 text-white font-semibold flex items-center justify-center gap-2 hover:bg-violet-800 disabled:opacity-40"
          >
            <Play size={18} /> {t('games.killer.start')}
          </button>
          {s.participants.length < 3 && <p className="text-xs text-slate-400 text-center">{t('games.killer.needThree')}</p>}
        </>
      )}

      {running && s.newcomers.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">{t('games.killer.newcomers', { names: s.newcomers.map(nameOf).join(', ') })}</p>
          <button onClick={() => run(() => api.post(`/plans/${planId}/words/add`))} className="mt-2 text-sm font-medium text-amber-900 flex items-center gap-1.5 hover:underline"><UserPlus size={15} /> {t('games.killer.addThem')}</button>
        </div>
      )}

      {running && (
        <button onClick={() => { if (confirm(t('games.words.endConfirm'))) run(() => api.post(`/plans/${planId}/words/end`)); }}
          className="text-sm text-slate-600 flex items-center gap-1.5 hover:text-slate-800"><Flag size={15} /> {t('games.killer.end')}</button>
      )}
      {s.started && (
        <button onClick={() => { if (confirm(t('games.words.resetConfirm'))) run(() => api.post(`/plans/${planId}/words/reset`)); }}
          className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-red-600"><RotateCcw size={15} /> {s.ended ? t('games.killer.replay') : t('games.killer.restart')}</button>
      )}
    </div>
  );
}
