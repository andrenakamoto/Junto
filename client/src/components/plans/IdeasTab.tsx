import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CircleHelp, ClipboardList, Copy, Combine, ListChecks, Maximize2, Minus, Pause, Pencil, Play, Plus,
  RotateCcw, Star, Timer, Trash2, X,
} from 'lucide-react';
import { Plan, PlanTaskGroup } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { hasFeature } from '../../lib/settings';
import { closeTopOverlay, useBackClose } from '../../lib/backClose';
import { useResync } from '../../hooks/useResync';
import { Modal } from '../ui/Modal';
import { t } from '../../i18n';

// Idées d'un Plan (fonction « idees ») : brainstorming en séance, l'app projetée et une personne au clavier. Thèmes
// en colonnes, post-its, statut, votes à main levée (+ / −), couleur, fusion, « transformer en tâche », minuteur.
// Serveur : routes/ideas.ts. Les téléphones suivent la séance en direct (plan-updated).

type Status = 'new' | 'kept' | 'dropped' | 'explore';
type Idea = { id: string; columnId: string | null; text: string; status: Status; votes: number; color: string | null; taskId: string | null; createdAt: string };
type Column = { id: string; title: string };
type Person = { id: string; pseudo: string; firstName?: string | null };

const COLORS: Record<string, string> = { yellow: 'bg-yellow-100 border-yellow-300', pink: 'bg-pink-100 border-pink-300', blue: 'bg-sky-100 border-sky-300', green: 'bg-emerald-100 border-emerald-300', purple: 'bg-violet-100 border-violet-300' };
const DOT: Record<string, string> = { yellow: 'bg-yellow-300', pink: 'bg-pink-300', blue: 'bg-sky-300', green: 'bg-emerald-300', purple: 'bg-violet-300' };
const NONE = '__none__';

export function IdeasTab({ plan }: { plan: Plan; userId: string }) {
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projecting, setProjecting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const tasksOn = hasFeature(plan, 'taches');

  async function load() {
    try {
      const { data } = await api.get(`/plans/${plan.id}/ideas`);
      setColumns(data.columns);
      setIdeas(data.ideas);
    } catch {
      setColumns(c => c ?? []);
    }
  }
  useEffect(() => { load(); }, [plan]);
  useResync(load);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.retryError'));
      await load();
      return false;
    }
  }

  if (!columns) return <div className="flex-1 bg-slate-50" />;
  const kept = ideas.filter(i => i.status === 'kept').length;

  async function copyReport() {
    const groups = [...columns!.map(c => ({ id: c.id, title: c.title })), { id: null, title: t('ideas.noColumn') }];
    const lines: string[] = [plan.title, ''];
    for (const g of groups) {
      const list = ideas.filter(i => i.columnId === g.id && i.status !== 'dropped').sort((a, b) => b.votes - a.votes);
      if (list.length === 0) continue;
      lines.push(g.title.toUpperCase());
      const part = (status: Status, label: string, mark: string) => {
        const items = list.filter(i => i.status === status);
        if (items.length === 0) return;
        lines.push(`${label} :`);
        for (const i of items) lines.push(`${mark} ${i.text}${i.votes ? ` (${t('ideas.votes', { count: i.votes })})` : ''}${i.taskId ? ` → ${t('ideas.reportTask')}` : ''}`);
      };
      part('kept', t('ideas.reportKept'), '⭐');
      part('explore', t('ideas.reportExplore'), '❓');
      part('new', t('ideas.reportOther'), '•');
      lines.push('');
    }
    const txt = lines.join('\n').trim();
    try { await navigator.clipboard.writeText(txt); } catch {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const board = (big: boolean) => (
    <Board big={big} plan={plan} columns={columns} ideas={ideas} tasksOn={tasksOn} run={run} />
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {ideas.length + columns.length > 0 ? (
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2.5">
          <p className="text-sm font-semibold text-slate-800">{t('ideas.count', { count: ideas.length })} · {t('ideas.keptCount', { count: kept })}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setProjecting(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
              <Maximize2 size={14} />{t('ideas.project')}
            </button>
            <button onClick={copyReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}{copied ? t('ideas.reportCopied') : t('ideas.report')}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center px-4 py-6 space-y-3">
          <p className="font-semibold text-slate-700">{t('ideas.emptyTitle')}</p>
          <p className="text-sm text-slate-500">{t('ideas.emptyText')}</p>
          <button onClick={() => run(() => api.post(`/plans/${plan.id}/idea-columns`, { titles: t('ideas.starterList').split('|') }))}
            className="px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50">{t('ideas.starter')}</button>
          <p className="text-xs text-slate-400">{t('ideas.starterList').split('|').join(' · ')}</p>
        </div>
      )}
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {board(false)}
      {projecting && (
        <Projection title={plan.title} onClose={() => setProjecting(false)} error={error}>
          {board(true)}
        </Projection>
      )}
    </div>
  );
}

// Plein écran pour la salle (Échap ou bouton retour Android pour sortir), avec le minuteur
function Projection({ title, onClose, error, children }: { title: string; onClose: () => void; error: string; children: React.ReactNode }) {
  useBackClose(onClose);
  useEffect(() => {
    // Échap ferme la fenêtre du dessus : une fenêtre ouverte par-dessus la projection, sinon la projection
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTopOverlay(); };
    window.addEventListener('keydown', h);
    document.documentElement.requestFullscreen?.().catch(() => { /* refusé : la fenêtre reste normale */ });
    return () => {
      window.removeEventListener('keydown', h);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-slate-100 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <p className="text-xl font-bold text-slate-800 truncate flex-1 min-w-0">{title}</p>
        <CountDown />
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700"><X size={16} />{t('ideas.exit')}</button>
      </div>
      {error && <p className="mx-6 mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function CountDown() {
  const [total, setTotal] = useState(10 * 60);
  const [left, setLeft] = useState(10 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const end = Date.now() + left * 1000;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setRunning(false);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const over = left === 0 && !running && total > 0;
  return (
    <div className="flex items-center gap-1.5">
      <Timer size={18} className="text-slate-400" />
      {!running && left === total && [5, 10, 15].map(m => (
        <button key={m} onClick={() => { setTotal(m * 60); setLeft(m * 60); }}
          className={`px-2 py-1 rounded-md text-xs font-semibold ${total === m * 60 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>{m}′</button>
      ))}
      <span className={`text-2xl font-bold tabular-nums px-2 rounded-lg ${over ? 'bg-red-600 text-white animate-pulse' : left <= 60 && running ? 'text-red-600' : 'text-slate-800'}`}>
        {over ? t('ideas.timeUp') : `${mm}:${ss}`}
      </span>
      <button onClick={() => { if (left === 0) setLeft(total); setRunning(!running); }} title={running ? t('ideas.timerPause') : t('ideas.timerStart')} aria-label={running ? t('ideas.timerPause') : t('ideas.timerStart')}
        className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">{running ? <Pause size={16} /> : <Play size={16} />}</button>
      <button onClick={() => { setRunning(false); setLeft(total); }} title={t('ideas.timerReset')} aria-label={t('ideas.timerReset')}
        className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><RotateCcw size={16} /></button>
    </div>
  );
}

function Board({ big, plan, columns, ideas, tasksOn, run }: {
  big: boolean; plan: Plan; columns: Column[]; ideas: Idea[]; tasksOn: boolean; run: (a: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [active, setActive] = useState<string>(columns[0]?.id ?? NONE);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [merging, setMerging] = useState<Idea | null>(null);
  const [sort, setSort] = useState<'created' | 'votes'>('created');
  const [keptOnly, setKeptOnly] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [taskFor, setTaskFor] = useState<Idea | null>(null);
  const [newColumn, setNewColumn] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (active !== NONE && !columns.some(c => c.id === active)) setActive(columns[0]?.id ?? NONE); }, [columns, active]);

  const hasLoose = ideas.some(i => !i.columnId);
  const cols: (Column & { loose?: boolean })[] = [...columns, ...(hasLoose || columns.length === 0 ? [{ id: NONE, title: t('ideas.noColumn'), loose: true }] : [])];

  const listFor = (colId: string) => {
    let list = ideas.filter(i => (i.columnId ?? NONE) === colId && (!keptOnly || i.status === 'kept'));
    list = [...list].sort((a, b) => {
      if ((a.status === 'dropped') !== (b.status === 'dropped')) return a.status === 'dropped' ? 1 : -1;
      if (sort === 'votes' && a.votes !== b.votes) return b.votes - a.votes;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
    return list;
  };

  async function add(colId: string, text: string) {
    if (!text.trim()) return false;
    return run(() => api.post(`/plans/${plan.id}/ideas`, { text, columnId: colId === NONE ? null : colId }));
  }
  const put = (i: Idea, body: object) => run(() => api.put(`/plans/ideas/${i.id}`, body));

  function clickIdea(i: Idea) {
    if (merging) {
      if (merging.id !== i.id) run(() => api.post(`/plans/ideas/${merging.id}/merge`, { intoId: i.id }));
      setMerging(null);
      return;
    }
    setSelected(selected === i.id ? null : i.id);
  }

  const toolbar = (
    <div className={`flex flex-wrap items-center gap-1.5 ${big ? 'px-6 pt-3' : ''}`}>
      {([['created', t('ideas.sortCreated')], ['votes', t('ideas.sortVotes')]] as const).map(([v, l]) => (
        <button key={v} onClick={() => setSort(v)} className={`px-3 py-1 rounded-full text-xs font-semibold ${sort === v ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{l}</button>
      ))}
      <span className="w-2" />
      {([[false, t('ideas.all')], [true, t('ideas.keptOnly')]] as const).map(([v, l]) => (
        <button key={String(v)} onClick={() => setKeptOnly(v)} className={`px-3 py-1 rounded-full text-xs font-medium ${keptOnly === v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <>
      {(ideas.length > 0 || big) && toolbar}
      {merging && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-800 ${big ? 'mx-6 mt-3 text-base' : ''}`}>
          <Combine size={16} className="flex-shrink-0" /><span className="flex-1">{t('ideas.mergeHint', { text: merging.text.slice(0, 60) })}</span>
          <button onClick={() => setMerging(null)} className="px-2 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-semibold">{t('ideas.mergeCancel')}</button>
        </div>
      )}
      <div className={big ? 'flex-1 min-h-0 flex gap-4 overflow-x-auto px-6 py-4' : 'flex flex-col md:flex-row gap-3 md:overflow-x-auto md:pb-2'}>
        {cols.map((c, k) => {
          const list = listFor(c.id);
          return (
            <section key={c.id}
              onDragOver={e => { e.preventDefault(); setDragOver(c.id); }} onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData('text/idea'); const i = ideas.find(x => x.id === id); if (i && (i.columnId ?? NONE) !== c.id) put(i, { columnId: c.id === NONE ? null : c.id }); }}
              className={`flex flex-col rounded-2xl border p-2.5 ${big ? 'w-80 flex-shrink-0 min-h-0' : 'md:w-72 md:flex-shrink-0'} ${dragOver === c.id ? 'bg-indigo-50 border-indigo-300' : active === c.id && big ? 'bg-white border-indigo-300 ring-2 ring-indigo-200' : 'bg-slate-100/80 border-slate-200'}`}>
              <ColumnHeader big={big} column={c} count={list.length} first={k === 0} last={k === columns.length - 1}
                onPick={() => { setActive(c.id); input.current?.focus(); }}
                onRename={title => run(() => api.put(`/plans/idea-columns/${c.id}`, { title }))}
                onMove={dir => run(() => api.post(`/plans/idea-columns/${c.id}/move`, { dir }))}
                onDelete={() => { if (confirm(t('ideas.deleteColumnConfirm', { title: c.title }))) run(() => api.delete(`/plans/idea-columns/${c.id}`)); }} />
              <div className={`space-y-2 mt-2 ${big ? 'flex-1 min-h-0 overflow-y-auto pr-1' : ''}`}>
                {list.map(i => (
                  <IdeaCard key={i.id} idea={i} big={big} selected={selected === i.id} mergeTarget={!!merging && merging.id !== i.id} tasksOn={tasksOn}
                    onClick={() => clickIdea(i)}
                    onStatus={s => put(i, { status: i.status === s ? 'new' : s })}
                    onVote={d => run(() => api.post(`/plans/ideas/${i.id}/vote`, { delta: d }))}
                    onColor={color => put(i, { color })}
                    onEdit={text => put(i, { text })}
                    onMerge={() => { setMerging(i); setSelected(null); }}
                    onTask={() => setTaskFor(i)}
                    onDelete={() => { if (confirm(t('ideas.deleteConfirm'))) run(() => api.delete(`/plans/ideas/${i.id}`)); }} />
                ))}
              </div>
              {!big && <QuickAdd onAdd={text => add(c.id, text)} />}
            </section>
          );
        })}
        {newColumn === null ? (
          <button onClick={() => setNewColumn('')} className={`flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 hover:bg-white ${big ? 'w-56 flex-shrink-0 self-start py-3' : 'py-2 md:w-48 md:flex-shrink-0 md:self-start'}`}>
            <Plus size={14} />{t('ideas.addColumn')}
          </button>
        ) : (
          <form className={`flex gap-1.5 ${big ? 'w-72 flex-shrink-0 self-start' : 'md:w-72 md:flex-shrink-0 md:self-start'}`}
            onSubmit={async e => { e.preventDefault(); if (newColumn.trim() && await run(() => api.post(`/plans/${plan.id}/idea-columns`, { title: newColumn }))) setNewColumn(null); }}>
            <input autoFocus value={newColumn} maxLength={60} onChange={e => setNewColumn(e.target.value)} onBlur={() => !newColumn.trim() && setNewColumn(null)} placeholder={t('ideas.columnPlaceholder')}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" className="px-3 rounded-lg bg-indigo-600 text-white"><Check size={16} /></button>
          </form>
        )}
      </div>

      {/* Saisie au clavier pour la salle : Entrée ajoute l'idée dans le thème choisi */}
      {big && (
        <form className="px-6 py-4 bg-white border-t border-slate-200" onSubmit={async e => { e.preventDefault(); const text = draft; setDraft(''); if (!(await add(active, text))) setDraft(text); input.current?.focus(); }}>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-sm text-slate-500 mr-1">{t('ideas.addTo')}</span>
            {cols.map(c => (
              <button type="button" key={c.id} onClick={() => { setActive(c.id); input.current?.focus(); }}
                className={`px-3 py-1 rounded-full text-sm font-semibold ${active === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c.title}</button>
            ))}
          </div>
          <input ref={input} autoFocus value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} placeholder={t('ideas.addPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border-2 border-indigo-300 text-xl focus:outline-none focus:border-indigo-600" />
        </form>
      )}

      {taskFor && <TaskFromIdea plan={plan} idea={taskFor} onClose={() => setTaskFor(null)} run={run} />}
    </>
  );
}

function ColumnHeader({ big, column, count, first, last, onPick, onRename, onMove, onDelete }: {
  big: boolean; column: Column & { loose?: boolean }; count: number; first: boolean; last: boolean;
  onPick: () => void; onRename: (title: string) => Promise<boolean>; onMove: (dir: 'left' | 'right') => void; onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  if (renaming !== null) return (
    <form className="flex gap-1.5" onSubmit={async e => { e.preventDefault(); if (renaming.trim() && await onRename(renaming)) setRenaming(null); }}>
      <input autoFocus value={renaming} maxLength={60} onChange={e => setRenaming(e.target.value)} onBlur={() => setRenaming(null)}
        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </form>
  );
  const icon = 'p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white disabled:opacity-30';
  return (
    <div className="flex items-center gap-1 px-1">
      <button onClick={onPick} className="flex-1 min-w-0 flex items-center gap-1.5 text-left py-1">
        <span className={`font-bold text-slate-800 truncate ${big ? 'text-lg' : 'text-sm'}`}>{column.title}</span>
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-500">{count}</span>
      </button>
      {!column.loose && <>
        <button disabled={first} onClick={() => onMove('left')} title={t('ideas.moveLeft')} aria-label={t('ideas.moveLeft')} className={`${icon} hidden md:block`}><ArrowLeft size={13} /></button>
        <button disabled={last} onClick={() => onMove('right')} title={t('ideas.moveRight')} aria-label={t('ideas.moveRight')} className={`${icon} hidden md:block`}><ArrowRight size={13} /></button>
        <button onClick={() => setRenaming(column.title)} title={t('ideas.renameColumn')} aria-label={t('ideas.renameColumn')} className={icon}><Pencil size={13} /></button>
        <button onClick={onDelete} title={t('ideas.deleteColumn')} aria-label={t('ideas.deleteColumn')} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-white"><Trash2 size={13} /></button>
      </>}
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  return (
    <form className="flex gap-1.5 mt-2" onSubmit={async e => { e.preventDefault(); const v = text; setText(''); if (!(await onAdd(v))) setText(v); }}>
      <input value={text} maxLength={300} onChange={e => setText(e.target.value)} placeholder={t('ideas.quickAdd')}
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <button type="submit" disabled={!text.trim()} aria-label={t('ideas.quickAdd')} className="px-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40"><Plus size={16} /></button>
    </form>
  );
}

function IdeaCard({ idea: i, big, selected, mergeTarget, tasksOn, onClick, onStatus, onVote, onColor, onEdit, onMerge, onTask, onDelete }: {
  idea: Idea; big: boolean; selected: boolean; mergeTarget: boolean; tasksOn: boolean;
  onClick: () => void; onStatus: (s: Status) => void; onVote: (d: 1 | -1) => void; onColor: (c: string | null) => void;
  onEdit: (text: string) => Promise<boolean>; onMerge: () => void; onTask: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const dropped = i.status === 'dropped';
  const tone = i.color ? COLORS[i.color] : 'bg-white border-slate-200';
  const ring = i.status === 'kept' ? 'ring-2 ring-amber-400' : i.status === 'explore' ? 'ring-2 ring-sky-300' : '';
  const btn = 'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border';
  return (
    <div draggable={!editing} onDragStart={e => e.dataTransfer.setData('text/idea', i.id)}
      className={`rounded-xl border shadow-sm ${tone} ${ring} ${dropped ? 'opacity-50' : ''} ${mergeTarget ? 'cursor-copy hover:ring-2 hover:ring-indigo-400' : 'cursor-pointer'}`}>
      {editing !== null ? (
        <form className="p-2" onSubmit={async e => { e.preventDefault(); if (await onEdit(editing)) setEditing(null); }}>
          <textarea autoFocus rows={3} value={editing} maxLength={300} onChange={e => setEditing(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
            className="w-full px-2 py-1 rounded-lg border border-slate-300 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </form>
      ) : (
        <div onClick={onClick} onDoubleClick={() => setEditing(i.text)} className={big ? 'p-3' : 'p-2.5'}>
          <p className={`text-slate-800 whitespace-pre-wrap break-words ${big ? 'text-lg font-medium leading-snug' : 'text-sm'} ${dropped ? 'line-through' : ''}`}>{i.text}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {i.status === 'kept' && <span className="flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800"><Star size={10} fill="currentColor" />{t('ideas.status.kept')}</span>}
            {i.status === 'explore' && <span className="flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800"><CircleHelp size={10} />{t('ideas.status.explore')}</span>}
            {i.taskId && <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><ListChecks size={10} />{t('ideas.taskDone')}</span>}
            <span className="flex-1" />
            {(i.votes > 0 || selected) && <span className={`font-bold tabular-nums ${big ? 'text-base' : 'text-xs'} text-indigo-700`}>👍 {i.votes}</span>}
          </div>
        </div>
      )}
      {selected && editing === null && (
        <div className="px-2.5 pb-2.5 pt-2 border-t border-black/5 space-y-2" onClick={e => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => onVote(1)} title={t('ideas.voteUp')} aria-label={t('ideas.voteUp')} className={`${btn} bg-indigo-600 border-indigo-600 text-white`}><Plus size={13} />1</button>
            <button onClick={() => onVote(-1)} disabled={i.votes === 0} title={t('ideas.voteDown')} aria-label={t('ideas.voteDown')} className={`${btn} bg-white border-slate-200 text-slate-600 disabled:opacity-40`}><Minus size={13} />1</button>
            <button onClick={() => onStatus('kept')} className={`${btn} ${i.status === 'kept' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-300 text-amber-700'}`}><Star size={13} />{t('ideas.status.kept')}</button>
            <button onClick={() => onStatus('explore')} className={`${btn} ${i.status === 'explore' ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-300 text-sky-700'}`}><CircleHelp size={13} />{t('ideas.status.explore')}</button>
            <button onClick={() => onStatus('dropped')} className={`${btn} ${dropped ? 'bg-slate-500 border-slate-500 text-white' : 'bg-white border-slate-300 text-slate-600'}`}><X size={13} />{t('ideas.status.dropped')}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="sr-only">{t('ideas.color')}</span>
            {Object.keys(DOT).map(c => (
              <button key={c} onClick={() => onColor(i.color === c ? null : c)} aria-label={`${t('ideas.color')} ${c}`} aria-pressed={i.color === c}
                className={`w-5 h-5 rounded-full ${DOT[c]} ${i.color === c ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`} />
            ))}
            <span className="flex-1" />
            <button onClick={() => setEditing(i.text)} title={t('ideas.edit')} aria-label={t('ideas.edit')} className="p-1.5 rounded-md text-slate-500 hover:bg-white"><Pencil size={14} /></button>
            <button onClick={onMerge} title={t('ideas.merge')} aria-label={t('ideas.merge')} className="p-1.5 rounded-md text-slate-500 hover:bg-white"><Combine size={14} /></button>
            {tasksOn && !i.taskId && <button onClick={onTask} title={t('ideas.toTask')} aria-label={t('ideas.toTask')} className="p-1.5 rounded-md text-slate-500 hover:bg-white"><ClipboardList size={14} /></button>}
            <button onClick={onDelete} title={t('ideas.delete')} aria-label={t('ideas.delete')} className="p-1.5 rounded-md text-slate-500 hover:text-red-500 hover:bg-white"><Trash2 size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// « Transformer en tâche » : crée la tâche (routes/tasks.ts) puis la relie à l'idée, qui passe « retenue »
function TaskFromIdea({ plan, idea, onClose, run }: { plan: Plan; idea: Idea; onClose: () => void; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [title, setTitle] = useState(idea.text.slice(0, 120));
  const [groups, setGroups] = useState<PlanTaskGroup[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [groupId, setGroupId] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(`/plans/${plan.id}/tasks`).then(r => { setGroups(r.data.groups); setPeople(r.data.people); }).catch(() => {});
  }, [plan.id]);
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
  return (
    <div className="relative z-[80]">
      <Modal title={t('ideas.taskForm.title')} onClose={onClose}>
        <form className="space-y-4" onSubmit={async e => {
          e.preventDefault();
          if (!title.trim()) return;
          setBusy(true);
          const ok = await run(async () => {
            const { data } = await api.post(`/plans/${plan.id}/tasks`, { title, groupId: groupId || null, assigneeIds: assignees });
            await api.put(`/plans/ideas/${idea.id}`, { taskId: data.id });
          });
          setBusy(false);
          if (ok) onClose();
        }}>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('ideas.taskForm.name')}</label>
            <input autoFocus value={title} maxLength={120} onChange={e => setTitle(e.target.value)} className={input} />
          </div>
          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('ideas.taskForm.group')}</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)} className={input}>
                <option value="">{t('tasks.noGroup')}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          {people.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('ideas.taskForm.assignees')}</label>
              <div className="flex flex-wrap gap-1.5">
                {people.map(p => (
                  <button type="button" key={p.id} aria-pressed={assignees.includes(p.id)} onClick={() => setAssignees(a => a.includes(p.id) ? a.filter(x => x !== p.id) : [...a, p.id])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${assignees.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {displayName(p) || `@${p.pseudo}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">{t('common.cancel')}</button>
            <button type="submit" disabled={busy || !title.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{t('ideas.taskForm.create')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
