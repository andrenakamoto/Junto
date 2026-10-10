import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, ImagePlus, Loader2, Minimize2, MonitorPlay, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { Modal } from '../ui/Modal';
import { t } from '../../i18n';

// Quiz (fonction à activer « quiz ») — serveur : routes/quiz.ts. Préparation par la personne qui anime
// (elle ne joue pas), puis partie en direct : chaque question s'affiche en même temps chez tous (heures
// fixées par le serveur, décalage d'horloge corrigé avec serverNow), bonne réponse et classement après
// chaque question, podium à la fin. QuizLiveHost (dans PlanDetail) ouvre la partie en plein écran ;
// QuizScreenPage réutilise QuizStage pour l'écran de salle.

type Player = { id: string; name: string; answered: boolean };
type Line = { userId: string; name: string; points: number; correct: number; rank: number };
type Question = { id: string; text: string; options: string[]; correctIndex: number; attachmentId: string | null };
type Current = {
  index: number; id: string; startAt: number | null; endsAt: number | null; text: string | null; options: string[] | null;
  attachmentId: string | null; answeredCount: number; myAnswer: { option: number; points: number | null } | null;
  correctIndex: number | null; distribution: number[] | null; isLast: boolean;
};
export type QuizState = {
  status: 'preparation' | 'question' | 'reveal' | 'ended'; timeLimit: number; questionCount: number; serverNow: number;
  role: 'editor' | 'player' | 'spectator' | 'screen'; meId: string | null; mediaToken?: string; canEdit: boolean; editors: string[]; players: Player[];
  questions: Question[] | null; current: Current | null; leaderboard: Line[] | null; planTitle?: string;
};

const TIME_LIMITS = [10, 15, 20, 30, 45, 60];
// Couleurs et formes des réponses (reconnaissables de loin sur l'écran de salle)
export const OPTION_STYLES = [
  { bg: 'bg-rose-500', shape: '▲' }, { bg: 'bg-sky-500', shape: '◆' }, { bg: 'bg-amber-500', shape: '●' }, { bg: 'bg-emerald-500', shape: '■' },
];
const errorOf = (e: any) => e?.response?.data?.error || t('common.retryError');
const isLive = (s?: QuizState | null) => s?.status === 'question' || s?.status === 'reveal';

// Heure du serveur (décalage mesuré à chaque chargement), mise à jour toutes les 200 ms
export function useServerNow(offset: number, active = true) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 200);
    return () => clearInterval(id);
  }, [offset, active]);
  return now;
}

// État du quiz d'un Plan, rechargé sur « quiz-updated » et aux moments clés (début / fin de question)
function useQuiz(planId: string) {
  const [state, setState] = useState<QuizState | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<QuizState>(`/plans/${planId}/quiz`);
      setOffset(data.serverNow - Date.now());
      setState(data);
      setError('');
    } catch (e) { setError(errorOf(e)); }
  }, [planId]);
  useEffect(() => { load(); }, [load]);
  useSocketEvent<{ planId: string }>('quiz-updated', p => { if (p.planId === planId) load(); });
  useKeyMoments(state, offset, load);
  return { state, offset, error, load };
}

// Recharge juste après l'heure de début d'une question (texte envoyé à ce moment-là) et après sa fin
export function useKeyMoments(state: QuizState | null, offset: number, load: () => void) {
  const c = state?.status === 'question' ? state.current : null;
  useEffect(() => {
    if (!c) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (serverTime: number | null, extra: number) => {
      if (serverTime === null) return;
      const ms = serverTime - (Date.now() + offset) + extra;
      if (ms > -500) timers.push(setTimeout(load, Math.max(ms, 0)));
    };
    if (!c.text) at(c.startAt, 80);
    at(c.endsAt, 1200);
    return () => timers.forEach(clearTimeout);
  }, [c?.id, c?.text, c?.startAt, c?.endsAt, offset, load]);
}

// ─── La partie (téléphone ou écran de salle) ───────────────────────────────────────────────────────────

export function QuizStage({ state, offset, plan, variant, onAnswer, onAction, busy }: {
  state: QuizState; offset: number; plan?: Pick<Plan, 'mediaToken'>; variant: 'phone' | 'screen';
  onAnswer?: (option: number) => void; onAction?: (action: 'reveal' | 'next') => void; busy?: boolean;
}) {
  const c = state.current;
  const now = useServerNow(offset, isLive(state));
  const big = variant === 'screen';
  if (state.status === 'ended' || !c) return <Podium state={state} big={big} />;
  const total = state.questionCount;
  const beforeStart = c.startAt !== null && now < c.startAt;
  const revealed = state.status === 'reveal';
  const remaining = c.endsAt !== null ? Math.max(0, Math.ceil((c.endsAt - now) / 1000)) : 0;
  const progress = c.startAt && c.endsAt ? Math.min(1, Math.max(0, (now - c.startAt) / (c.endsAt - c.startAt))) : 0;
  const players = state.players.length;
  const editor = state.role === 'editor';
  const mine = c.myAnswer;
  const myLine = state.leaderboard?.find(l => l.userId === state.meId);

  return (
    <div className={`flex flex-col gap-4 ${big ? 'gap-8' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`font-bold text-indigo-200 uppercase tracking-wide ${big ? 'text-2xl' : 'text-xs'}`}>{t('games.quiz.questionOf', { n: c.index + 1, total })}</span>
        {!beforeStart && !revealed && <span className={`font-black tabular-nums ${remaining <= 5 ? 'text-rose-300' : 'text-white'} ${big ? 'text-6xl' : 'text-2xl'}`}>{remaining}</span>}
      </div>

      {beforeStart && !editor ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          <p className={`font-black text-white ${big ? 'text-8xl' : 'text-5xl'}`}>{Math.max(1, Math.ceil(((c.startAt ?? now) - now) / 1000))}</p>
          <p className={`mt-3 text-indigo-200 font-semibold ${big ? 'text-4xl' : 'text-lg'}`}>{t('games.quiz.ready')}</p>
        </div>
      ) : (
        <>
          {!revealed && <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-white transition-[width] duration-200" style={{ width: `${(1 - progress) * 100}%` }} /></div>}
          <h2 className={`font-bold text-white text-center leading-snug ${big ? 'text-6xl' : 'text-xl'}`}>{c.text}</h2>
          {c.attachmentId && (
            <img src={mediaUrl(c.attachmentId, plan?.mediaToken ?? state.mediaToken, big ? 1200 : 600)} alt=""
              className={`mx-auto rounded-2xl object-contain bg-black/20 ${big ? 'max-h-[38vh]' : 'max-h-56'}`} />
          )}
          <div className={`grid gap-3 ${big ? 'grid-cols-2 gap-6' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {(c.options ?? []).map((o, i) => {
              const style = OPTION_STYLES[i];
              const isCorrect = c.correctIndex === i;
              const chosen = mine?.option === i;
              const dim = (revealed && !isCorrect) || (!revealed && mine && !chosen);
              const canTap = variant === 'phone' && state.role === 'player' && !mine && !revealed && !!onAnswer && !busy;
              return (
                <button key={i} disabled={!canTap} onClick={() => canTap && onAnswer!(i)}
                  className={`relative flex items-center gap-3 rounded-2xl text-left text-white font-bold shadow-lg transition ${style.bg} ${dim ? 'opacity-35' : ''} ${chosen ? 'ring-4 ring-white' : ''} ${big ? 'p-6 text-4xl' : 'p-4 text-base'} ${canTap ? 'active:scale-[0.98]' : ''}`}>
                  <span className={`${big ? 'text-4xl' : 'text-xl'} opacity-80`}>{style.shape}</span>
                  <span className="flex-1 min-w-0 break-words">{o}</span>
                  {(revealed || editor) && isCorrect && <Check size={big ? 44 : 24} strokeWidth={3} className="flex-shrink-0" />}
                  {revealed && c.distribution && <span className={`flex-shrink-0 rounded-full bg-black/25 px-2.5 py-0.5 ${big ? 'text-3xl' : 'text-sm'}`}>{c.distribution[i]}</span>}
                </button>
              );
            })}
          </div>

          {!revealed && (
            <p className={`text-center text-indigo-100 ${big ? 'text-3xl' : 'text-sm'}`}>
              {state.role === 'player' && mine ? `${t('games.quiz.waiting')} ` : ''}{t('games.quiz.answered', { count: c.answeredCount, total: players })}
            </p>
          )}
          {revealed && state.role === 'player' && (
            <p className={`text-center font-bold rounded-xl py-2 ${mine?.points ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/10 text-white'}`}>
              {mine ? (mine.points ? t('games.quiz.right', { points: mine.points }) : t('games.quiz.wrong')) : t('games.quiz.noAnswer')}
            </p>
          )}
          {revealed && myLine && <MyRank line={myLine} />}
          {revealed && state.leaderboard && <Ranking lines={state.leaderboard} big={big} limit={big ? 8 : 5} me={myLine?.userId} />}
        </>
      )}

      {editor && variant === 'phone' && onAction && (
        state.status === 'question'
          ? <button onClick={() => onAction('reveal')} disabled={busy} className="w-full py-3 rounded-xl bg-white/15 text-white font-semibold">{t('games.quiz.revealNow')}</button>
          : <button onClick={() => onAction('next')} disabled={busy} className="w-full py-3 rounded-xl bg-white text-indigo-700 font-bold">{c.isLast ? t('games.quiz.finalRanking') : t('games.quiz.next')}</button>
      )}
    </div>
  );
}

function MyRank({ line }: { line: Line }) {
  return (
    <p className="text-center text-white font-semibold">
      {line.rank === 1 ? t('games.quiz.yourRankFirst', { points: line.points }) : t('games.quiz.yourRank', { rank: line.rank, points: line.points })}
    </p>
  );
}

function Ranking({ lines, big, limit, me }: { lines: Line[]; big?: boolean; limit: number; me?: string }) {
  const shown = lines.slice(0, limit);
  return (
    <div className={`rounded-2xl bg-white/10 text-left ${big ? 'p-6' : 'p-3'}`}>
      <p className={`font-bold text-indigo-100 uppercase tracking-wide mb-2 ${big ? 'text-2xl' : 'text-xs'}`}>{t('games.quiz.ranking')}</p>
      <ol className="space-y-1">
        {shown.map(l => (
          <li key={l.userId} className={`flex items-center gap-3 text-white ${big ? 'text-3xl py-1' : 'text-sm'} ${l.userId === me ? 'font-bold' : ''}`}>
            <span className="w-8 text-center">{l.rank <= 3 ? ['🥇', '🥈', '🥉'][l.rank - 1] : l.rank}</span>
            <span className="flex-1 truncate">{l.name}</span>
            <span className="tabular-nums">{t('games.quiz.points', { points: l.points })}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Podium({ state, big }: { state: QuizState; big: boolean }) {
  const lines = state.leaderboard ?? [];
  const winner = lines[0];
  const mine = lines.find(l => l.userId === state.meId);
  return (
    <div className={`flex flex-col gap-4 text-center ${big ? 'gap-8' : ''}`}>
      <Trophy size={big ? 96 : 48} className="mx-auto text-amber-300" />
      <p className={`font-bold text-indigo-100 uppercase tracking-wide ${big ? 'text-3xl' : 'text-sm'}`}>{t('games.quiz.ended')}</p>
      {winner && <h2 className={`font-black text-white ${big ? 'text-7xl' : 'text-2xl'}`}>{t('games.quiz.winner', { name: winner.name })}</h2>}
      {mine && <MyRank line={mine} />}
      <Ranking lines={lines} big={big} limit={big ? 10 : 50} me={mine?.userId} />
    </div>
  );
}

// ─── Plein écran dans l'app : ouvert au lancement, pendant la partie et au podium ──────────────────────

export function QuizLiveHost({ plan }: { plan: Plan }) {
  const { state, offset, load } = useQuiz(plan.id);
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wasLive = useRef(false);
  const run = state ? `${state.questionCount}-${state.status === 'ended' ? 'end' : 'live'}` : null;
  useEffect(() => {
    const open = () => setDismissedRun(null);
    window.addEventListener('evly-quiz-open', open);
    return () => window.removeEventListener('evly-quiz-open', open);
  }, []);
  useEffect(() => { if (isLive(state)) wasLive.current = true; }, [state]);
  if (!state || state.role === 'spectator' && !isLive(state)) return null;
  // Ouvert pendant la partie, et au podium seulement si on la suivait
  const show = (isLive(state) || (state.status === 'ended' && wasLive.current)) && dismissedRun !== run;
  if (!show) return null;
  async function act(path: string, body?: object) {
    setBusy(true); setError('');
    try { await api.post(`/plans/${plan.id}/quiz/${path}`, body); await load(); } catch (e) { setError(errorOf(e)); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-700 via-indigo-600 to-rose-600 overflow-y-auto" style={{ paddingTop: 'var(--sa-top, 0px)', paddingBottom: 'var(--sa-bottom, 0px)' }}>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-bold truncate">🧠 {plan.title}</span>
          <button onClick={() => { setDismissedRun(run); if (state.status === 'ended') wasLive.current = false; }} aria-label={state.status === 'ended' ? t('games.quiz.close') : t('games.quiz.minimize')} className="p-2 rounded-full bg-white/15 text-white">
            {state.status === 'ended' ? <X size={18} /> : <Minimize2 size={18} />}
          </button>
        </div>
        {error && <p className="mb-3 text-sm text-white bg-black/30 rounded-lg px-3 py-2">{error}</p>}
        <QuizStage state={state} offset={offset} plan={plan} variant="phone" busy={busy}
          onAnswer={option => act('answer', { questionId: state.current?.id, option })}
          onAction={a => act(a)} />
      </div>
    </div>
  );
}

// ─── L'onglet du Plan ──────────────────────────────────────────────────────────────────────────────────

export function QuizTab({ plan }: { plan: Plan; userId: string }) {
  const { state, error: loadError, load } = useQuiz(plan.id);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [screenUrl, setScreenUrl] = useState('');
  const [copied, setCopied] = useState(false);
  if (!state) return <div className="flex-1 p-6 text-sm text-slate-400">{loadError || t('common.loading')}</div>;

  async function run(action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError('');
    try { await action(); await load(); } catch (e) { setError(errorOf(e)); }
  }
  async function showScreen() {
    try { setScreenUrl((await api.get(`/plans/${plan.id}/quiz/screen-link`)).data.url); } catch (e) { setError(errorOf(e)); }
  }
  async function move(i: number, d: -1 | 1) {
    const ids = state!.questions!.map(q => q.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await run(() => api.put(`/plans/${plan.id}/quiz/order`, { ids }));
  }
  const editor = state.role === 'editor';
  const card = 'bg-white rounded-xl border border-slate-200 shadow-sm p-4';

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <div className={card}>
        <p className="font-semibold text-slate-900">🧠 {t('games.quiz.title')}</p>
        <p className="text-sm text-slate-500 mt-1">{t('games.quiz.intro')}</p>
        {state.editors.length > 0 && <p className="text-xs text-slate-400 mt-2">{t('games.quiz.prepBy', { names: state.editors.join(', ') })} · {t('games.quiz.questionCount', { count: state.questionCount })}</p>}
      </div>
      {(error) && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Partie en cours ou terminée */}
      {isLive(state) && (
        <div className={`${card} text-center`}>
          <p className="font-semibold text-slate-800">{t('games.quiz.running', { n: (state.current?.index ?? 0) + 1, total: state.questionCount })}</p>
          <button onClick={() => window.dispatchEvent(new Event('evly-quiz-open'))} className="mt-3 w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">
            {state.role === 'player' || editor ? t('games.quiz.join') : t('games.quiz.follow')}
          </button>
        </div>
      )}
      {state.status === 'ended' && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-700 to-rose-600 p-5">
          <QuizStage state={state} offset={0} variant="phone" />
        </div>
      )}

      {/* Préparation */}
      {state.status === 'preparation' && !editor && (
        <div className={card}>
          {state.questionCount === 0 && <p className="text-sm text-slate-500">{t('games.quiz.notReady')}</p>}
          {state.role === 'player' && <p className="text-sm text-emerald-700 mt-1">{t('games.quiz.youPlay')}</p>}
          {state.role === 'spectator' && !state.canEdit && <p className="text-sm text-slate-500 mt-1">{t('games.quiz.answerToPlay')}</p>}
          {state.canEdit ? (
            <>
              <p className="text-xs text-slate-400 mt-2">{t('games.quiz.managersPrepare')}</p>
              <button onClick={() => run(() => api.post(`/plans/${plan.id}/quiz/edit`), t('games.quiz.prepareConfirm'))} className="mt-3 w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('games.quiz.prepare')}</button>
            </>
          ) : <p className="text-xs text-slate-400 mt-2">{t('games.quiz.managersPrepare')}</p>}
        </div>
      )}

      {editor && state.status === 'preparation' && (
        <>
          <div className={card}>
            <p className="text-sm text-indigo-700 font-medium">{t('games.quiz.youHost')}</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">{t('games.quiz.timeLimit')}
              <select value={state.timeLimit} onChange={e => run(() => api.put(`/plans/${plan.id}/quiz/settings`, { timeLimit: Number(e.target.value) }))}
                className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white">
                {TIME_LIMITS.map(s => <option key={s} value={s}>{t('games.quiz.seconds', { count: s })}</option>)}
              </select>
            </label>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-800 flex-1">{t('games.quiz.questions')} ({state.questions?.length ?? 0})</p>
              <button onClick={() => setEditing('new')} className="text-sm text-indigo-600 font-semibold flex items-center gap-1"><Plus size={15} /> {t('games.quiz.addQuestion')}</button>
            </div>
            {!state.questions?.length && <p className="text-sm text-slate-400 italic">{t('games.quiz.noQuestion')}</p>}
            <ol className="space-y-2">
              {state.questions?.map((q, i) => (
                <li key={q.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <p className="flex-1 text-sm font-medium text-slate-800">{q.text}{q.attachmentId && ' 📷'}</p>
                    <div className="flex items-center text-slate-400">
                      {i > 0 && <button onClick={() => move(i, -1)} aria-label="↑" className="p-1"><ArrowUp size={14} /></button>}
                      {i < state.questions!.length - 1 && <button onClick={() => move(i, 1)} aria-label="↓" className="p-1"><ArrowDown size={14} /></button>}
                      <button onClick={() => setEditing(q)} aria-label={t('common.edit')} className="p-1"><Pencil size={14} /></button>
                      <button onClick={() => run(() => api.delete(`/plans/quiz/questions/${q.id}`), t('games.quiz.deleteConfirm'))} aria-label={t('common.delete')} className="p-1 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <ul className="mt-1.5 pl-8 space-y-0.5">
                    {q.options.map((o, j) => (
                      <li key={j} className={`text-xs ${j === q.correctIndex ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>{OPTION_STYLES[j].shape} {o}{j === q.correctIndex && ' ✓'}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>

          <div className={card}>
            <p className="text-sm font-semibold text-slate-800">{t('games.quiz.players', { count: state.players.length })}</p>
            {state.players.length
              ? <p className="text-sm text-slate-500 mt-1">{state.players.map(p => p.name).join(', ')}</p>
              : <p className="text-sm text-slate-400 mt-1">{t('games.quiz.noPlayers')}</p>}
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/quiz/start`), t('games.quiz.startConfirm'))}
              disabled={!state.questions?.length || !state.players.length}
              className="mt-3 w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-40">🧠 {t('games.quiz.start')}</button>
          </div>
        </>
      )}

      {/* Écran de salle et « Rejouer » (personne qui anime) */}
      {editor && (
        <div className={card}>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><MonitorPlay size={16} /> {t('games.quiz.screen')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('games.quiz.screenHint')}</p>
          {screenUrl ? (
            <div className="mt-2 flex gap-2">
              <input readOnly value={screenUrl} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50" />
              <button onClick={async () => { try { await navigator.clipboard.writeText(screenUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* rien */ } }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs flex items-center gap-1"><Copy size={13} /> {copied ? t('games.quiz.copied') : t('games.quiz.copy')}</button>
              <a href={screenUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs flex items-center gap-1"><ExternalLink size={13} /> {t('games.quiz.openScreen')}</a>
            </div>
          ) : (
            <button onClick={showScreen} className="mt-2 text-sm text-indigo-600 font-semibold">{t('games.quiz.screen')} →</button>
          )}
          {state.status === 'ended' && (
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/quiz/reset`), t('games.quiz.replayConfirm'))} className="mt-3 w-full py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-semibold">{t('games.quiz.replay')}</button>
          )}
        </div>
      )}

      {editing && <QuestionModal plan={plan} question={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function QuestionModal({ plan, question, onClose, onSaved }: { plan: Plan; question: Question | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(question?.text ?? '');
  const [options, setOptions] = useState<string[]>(question?.options ?? ['', '']);
  const [correct, setCorrect] = useState(question?.correctIndex ?? 0);
  const [photo, setPhoto] = useState<string | null>(question?.attachmentId ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError(t('votes.match.photoTooBig')); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file, `quiz-${file.name || 'photo.jpg'}`);
      const { data } = await api.post(`/attachments/plans/${plan.id}?via=quiz`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPhoto(data.id);
    } catch (e) { setError(errorOf(e)); }
    setUploading(false);
  }
  async function save() {
    setBusy(true); setError('');
    const body = { text, options, correctIndex: correct, attachmentId: photo };
    try {
      if (question) await api.put(`/plans/quiz/questions/${question.id}`, body);
      else await api.post(`/plans/${plan.id}/quiz/questions`, body);
      onSaved();
    } catch (e) { setError(errorOf(e)); setBusy(false); }
  }
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

  return (
    <Modal title={question ? t('games.quiz.editQuestion') : t('games.quiz.newQuestion')} onClose={onClose}>
      <div className="space-y-3">
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={300} placeholder={t('games.quiz.questionPlaceholder')} className={input} />
        <p className="text-sm text-slate-600">{t('games.quiz.answers')}</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => setCorrect(i)} aria-label={t('games.quiz.correct')}
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${OPTION_STYLES[i].bg} ${correct === i ? 'ring-4 ring-emerald-300' : 'opacity-60'}`}>
              {correct === i ? <Check size={16} strokeWidth={3} /> : OPTION_STYLES[i].shape}
            </button>
            <input value={o} onChange={e => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={120} placeholder={t('games.quiz.answerPlaceholder', { n: i + 1 })} className={input} />
            {options.length > 2 && (
              <button type="button" onClick={() => { setOptions(options.filter((_, j) => j !== i)); setCorrect(c => (c === i ? 0 : c > i ? c - 1 : c)); }} aria-label={t('common.delete')} className="p-1 text-slate-400 hover:text-red-600"><X size={16} /></button>
            )}
          </div>
        ))}
        {options.length < 4 && <button type="button" onClick={() => setOptions([...options, ''])} className="text-sm text-indigo-600 font-medium flex items-center gap-1"><Plus size={14} /> {t('games.quiz.addAnswer')}</button>}
        <div>
          <p className="text-sm text-slate-600 mb-1">{t('games.quiz.photo')}</p>
          {photo ? (
            <div className="flex items-center gap-3">
              <img src={mediaUrl(photo, plan.mediaToken, 200)} alt="" className="w-20 h-20 rounded-lg object-cover" />
              <button type="button" onClick={() => setPhoto(null)} className="text-sm text-red-600">{t('games.quiz.removePhoto')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm flex items-center gap-2">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} {t('games.quiz.photo')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={save} disabled={busy || uploading || !text.trim() || options.some(o => !o.trim())} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? t('common.wait') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
