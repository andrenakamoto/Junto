import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Circle, Lock, MessageSquare, Pencil, Play, Plus,
  RotateCcw, Search, Send, Trash2, Unlock, UserPlus, UserMinus,
} from 'lucide-react';
import { Plan, PlanTask, PlanTaskGroup } from '../../types';
import api from '../../services/api';
import { isDemo } from '../../lib/demo';
import { displayName } from '../../lib/names';
import { useResync } from '../../hooks/useResync';
import { Modal } from '../ui/Modal';
import { DateTimeField } from '../ui/DateTimeField';
import { intlLocale, t } from '../../i18n';

// Tâches de préparation d'un Plan (fonction « taches ») : lots, responsables, échéance, statut et dépendances
// (« commencer après »). Vue par lot ou par état (en cours, prêtes, bloquées, terminées). Serveur : routes/tasks.ts.

type Person = { id: string; pseudo: string; firstName?: string | null };
type State = 'ready' | 'blocked' | 'doing' | 'done';
type Data = { groups: PlanTaskGroup[]; tasks: PlanTask[]; people: Person[]; canManage: boolean };

const VIEW_KEY = 'evly_tasks_view';
const NEW_GROUP = '__new';
const dayFmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const commentFmt = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Jour d'aujourd'hui sur l'appareil, « AAAA-MM-JJ »
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysUntil = (due: string, today: string) => Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);

// Miroir de taskState (server/src/lib/tasks.ts)
function stateOf(task: PlanTask, statusOf: Map<string, string>): State {
  if (task.status === 'done') return 'done';
  if (task.status === 'doing') return 'doing';
  return task.dependsOn.some(id => statusOf.get(id) !== 'done') ? 'blocked' : 'ready';
}

const STATE_STYLE: Record<State, string> = {
  ready: 'bg-sky-100 text-sky-700',
  blocked: 'bg-slate-200 text-slate-600',
  doing: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-700',
};

// Non terminées d'abord, puis par échéance (sans échéance à la fin), puis ordre de création
function sortTasks(list: PlanTask[]) {
  return [...list].sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    if (a.dueDate !== b.dueDate) return !a.dueDate ? 1 : !b.dueDate ? -1 : a.dueDate < b.dueDate ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

const personName = (p: Person) => displayName(p) || `@${p.pseudo}`;

export function TasksTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<'groups' | 'states'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'states' ? 'states' : 'groups'; } catch { return 'groups'; }
  });
  const [filter, setFilter] = useState<'all' | 'mine' | 'late'>('all');
  const [form, setForm] = useState<{ task?: PlanTask; groupId?: string | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Lots repliés à l'ouverture de la rubrique ; ouverts : ceux qu'on déplie, celui où l'on ajoute une tâche
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setOpenGroups(o => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const openGroup = (key: string) => setOpenGroups(o => { const n = new Set(o); if (isDemo()) n.delete(key); else n.add(key); return n; });
  const [error, setError] = useState('');

  async function load() {
    try {
      setData((await api.get(`/plans/${plan.id}/tasks`)).data);
    } catch {
      setData(d => d ?? { groups: [], tasks: [], people: [], canManage: false });
    }
  }
  // Rechargé à chaque mise à jour du Plan (temps réel : plan-updated) et au retour dans l'app
  useEffect(() => { load(); }, [plan]);
  useResync(load);

  function chooseView(v: 'groups' | 'states') {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* stockage indisponible */ }
  }

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

  const today = localDay();
  const derived = useMemo(() => {
    if (!data) return null;
    const statusOf = new Map(data.tasks.map(x => [x.id, x.status]));
    const byId = new Map(data.tasks.map(x => [x.id, x]));
    const state = new Map(data.tasks.map(x => [x.id, stateOf(x, statusOf)]));
    // Tâches qui attendent chacune (pour « Débloque »)
    const waiting = new Map<string, PlanTask[]>();
    for (const x of data.tasks) for (const id of x.dependsOn) waiting.set(id, [...(waiting.get(id) ?? []), x]);
    const late = (x: PlanTask) => x.status !== 'done' && !!x.dueDate && x.dueDate < today;
    return { statusOf, byId, state, waiting, late };
  }, [data, today]);

  if (!data || !derived) return <div className="flex-1 bg-slate-50" />;
  const { tasks, groups, people, canManage } = data;
  const { byId, state, waiting, late } = derived;

  const mine = tasks.filter(x => x.assignees.some(a => a.userId === userId));
  const lateTasks = tasks.filter(late);
  const shown = filter === 'mine' ? mine : filter === 'late' ? lateTasks : tasks;
  const doneCount = tasks.filter(x => x.status === 'done').length;
  const blockedCount = tasks.filter(x => state.get(x.id) === 'blocked').length;
  const isMember = people.some(p => p.id === userId);

  const card = (x: PlanTask, showGroup: boolean) => (
    <TaskCard
      key={x.id} task={x} userId={userId} isMember={isMember} today={today}
      state={state.get(x.id)!} late={late(x)}
      waitsFor={x.dependsOn.map(id => byId.get(id)).filter((d): d is PlanTask => !!d && d.status !== 'done')}
      unlocks={(waiting.get(x.id) ?? []).filter(w => w.status !== 'done')}
      groupTitle={showGroup ? groups.find(g => g.id === x.groupId)?.title : undefined}
      canDelete={x.createdById === userId || canManage}
      open={openId === x.id} onToggle={() => setOpenId(openId === x.id ? null : x.id)}
      onJump={id => { setFilter('all'); setOpenId(id); setTimeout(() => document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}
      onStatus={status => run(() => api.post(`/plans/tasks/${x.id}/status`, { status }))}
      onTake={take => run(() => take ? api.post(`/plans/tasks/${x.id}/me`) : api.delete(`/plans/tasks/${x.id}/me`))}
      onEdit={() => setForm({ task: x })}
      onDelete={() => { if (confirm(t('tasks.deleteConfirm', { title: x.title }))) run(() => api.delete(`/plans/tasks/${x.id}`)); }}
      onComment={content => run(() => api.post(`/plans/tasks/${x.id}/comments`, { content }))}
      onDeleteComment={id => { if (confirm(t('tasks.deleteCommentConfirm'))) run(() => api.delete(`/plans/tasks/comments/${id}`)); }}
      canDeleteComment={c => c.author.id === userId || canManage}
    />
  );

  const empty = tasks.length === 0 && groups.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* Avancement */}
      {tasks.length > 0 && (
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-800">{t('tasks.progress', { done: doneCount, count: tasks.length })}</p>
            {lateTasks.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('tasks.late', { count: lateTasks.length })}</span>}
            {blockedCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{t('tasks.blockedCount', { count: blockedCount })}</span>}
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round(doneCount / tasks.length * 100)}%` }} />
          </div>
        </div>
      )}

      <button onClick={() => setForm({})}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors">
        <Plus size={16} />{t('tasks.add')}
      </button>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {empty ? (
        <div className="text-center px-4 py-6 space-y-3">
          <p className="font-semibold text-slate-700">{t('tasks.emptyTitle')}</p>
          <p className="text-sm text-slate-500">{t('tasks.emptyText')}</p>
          <button onClick={() => run(() => api.post(`/plans/${plan.id}/task-groups`, { titles: t('tasks.starterList').split('|') }))}
            className="px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50">
            {t('tasks.starterGroups')}
          </button>
          <p className="text-xs text-slate-400">{t('tasks.starterList').split('|').join(' · ')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-full bg-white border border-slate-200 p-0.5 mr-1">
            {(['groups', 'states'] as const).map(v => (
              <button key={v} onClick={() => chooseView(v)} aria-pressed={view === v}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${view === v ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {v === 'groups' ? t('tasks.viewGroups') : t('tasks.viewStates')}
              </button>
            ))}
          </div>
          {([['all', t('tasks.all')], ['mine', t('tasks.mine', { count: mine.length })], ['late', t('tasks.lateFilter', { count: lateTasks.length })]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {!empty && filter === 'mine' && mine.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">{t('tasks.noneMine')}</p>}
      {!empty && filter === 'late' && lateTasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">{t('tasks.noneLate')}</p>}

      {!empty && view === 'groups' && (
        <div className="space-y-3">
          {[...groups, ...(shown.some(x => !x.groupId) ? [null] : [])].map(g => {
            const list = sortTasks(shown.filter(x => x.groupId === (g?.id ?? null)));
            if (filter !== 'all' && list.length === 0) return null;
            const all = tasks.filter(x => x.groupId === (g?.id ?? null));
            const key = g?.id ?? 'none';
            // Avec « Mes tâches » / « En retard », ou quand une tâche y est ouverte (lien « Attend »), le lot est déplié
            // Démo : lots dépliés d'emblée (toucher un lot le replie), pour montrer les tâches
            const unfolded = filter !== 'all' || (isDemo() ? !openGroups.has(key) : openGroups.has(key)) || list.some(x => x.id === openId);
            return (
              <GroupBlock key={key} group={g} folded={!unfolded} onToggle={() => toggleGroup(key)} total={all.length} done={all.filter(x => x.status === 'done').length}
                canDelete={!!g && (g.createdById === userId || canManage)}
                onAdd={() => { openGroup(key); setForm({ groupId: g?.id ?? null }); }}
                onRename={title => run(() => api.put(`/plans/task-groups/${g!.id}`, { title }))}
                onDelete={() => { if (confirm(t('tasks.deleteGroupConfirm', { title: g!.title }))) run(() => api.delete(`/plans/task-groups/${g!.id}`)); }}>
                {list.map(x => card(x, false))}
              </GroupBlock>
            );
          })}
          {filter === 'all' && <AddGroup onAdd={title => run(() => api.post(`/plans/${plan.id}/task-groups`, { title }))} />}
        </div>
      )}

      {!empty && view === 'states' && (
        <div className="space-y-4">
          {(['doing', 'ready', 'blocked', 'done'] as State[]).map(st => {
            const list = sortTasks(shown.filter(x => state.get(x.id) === st));
            if (list.length === 0) return null;
            return (
              <StateSection key={st} state={st} count={list.length} collapsed={st === 'done'}>
                {list.map(x => card(x, true))}
              </StateSection>
            );
          })}
        </div>
      )}

      {form && (
        <TaskForm
          planId={plan.id} task={form.task} groupId={form.task ? form.task.groupId : form.groupId ?? null} groups={groups} people={people} tasks={tasks}
          onCancel={() => setForm(null)}
          onSubmit={async body => {
            const ok = await run(() => form.task ? api.put(`/plans/tasks/${form.task.id}`, body) : api.post(`/plans/${plan.id}/tasks`, body));
            if (ok) { openGroup((body as { groupId?: string | null }).groupId ?? 'none'); setForm(null); }
            return ok;
          }}
        />
      )}
    </div>
  );
}

function GroupBlock({ group, folded, onToggle, total, done, canDelete, onAdd, onRename, onDelete, children }: {
  group: PlanTaskGroup | null; folded: boolean; onToggle: () => void; total: number; done: number; canDelete: boolean;
  onAdd: () => void; onRename: (title: string) => Promise<boolean>; onDelete: () => void; children: React.ReactNode;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <section className="rounded-2xl bg-slate-100/80 border border-slate-200 p-2.5">
      <div className="flex items-center gap-1.5 px-1">
        <button onClick={onToggle} aria-expanded={!folded} className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-1">
          {folded ? <ChevronRight size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
          {renaming === null && <span className="font-semibold text-sm text-slate-800 truncate">{group?.title ?? t('tasks.noGroup')}</span>}
          {renaming === null && total > 0 && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${done === total ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'}`}>{done}/{total}</span>}
        </button>
        {renaming !== null && (
          <form className="flex-1 flex gap-1.5" onSubmit={async e => { e.preventDefault(); if (renaming.trim() && await onRename(renaming)) setRenaming(null); }}>
            <input autoFocus value={renaming} maxLength={60} onChange={e => setRenaming(e.target.value)} onBlur={() => setRenaming(null)}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </form>
        )}
        {group && renaming === null && (
          <button onClick={() => setRenaming(group.title)} title={t('tasks.renameGroup')} aria-label={t('tasks.renameGroup')} className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white"><Pencil size={13} /></button>
        )}
        {canDelete && renaming === null && (
          <button onClick={onDelete} title={t('tasks.deleteGroup')} aria-label={t('tasks.deleteGroup')} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-white"><Trash2 size={13} /></button>
        )}
        <button onClick={onAdd} className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-white">
          <Plus size={13} />{t('tasks.addInGroup')}
        </button>
      </div>
      {!folded && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}

function StateSection({ state, count, collapsed, children }: { state: State; count: number; collapsed: boolean; children: React.ReactNode }) {
  const [folded, setFolded] = useState(collapsed);
  const Icon = state === 'doing' ? Play : state === 'ready' ? Unlock : state === 'blocked' ? Lock : CheckCircle2;
  return (
    <section>
      <button onClick={() => setFolded(!folded)} className="w-full flex items-center gap-2 px-1 py-1 text-left">
        <Icon size={14} className="text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`tasks.sections.${state}`)}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${STATE_STYLE[state]}`}>{count}</span>
        <span className="flex-1" />
        {folded ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {!folded && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}

function AddGroup({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState<string | null>(null);
  if (title === null) return (
    <button onClick={() => setTitle('')} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:bg-white">
      <Plus size={14} />{t('tasks.addGroup')}
    </button>
  );
  return (
    <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); if (title.trim() && await onAdd(title)) setTitle(null); }}>
      <input autoFocus value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder={t('tasks.groupPlaceholder')}
        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <button type="button" onClick={() => setTitle(null)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">{t('common.cancel')}</button>
      <button type="submit" disabled={!title.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{t('common.add')}</button>
    </form>
  );
}

function dueLabel(due: string, today: string) {
  const d = daysUntil(due, today);
  const date = dayFmt.format(new Date(`${due}T12:00:00Z`));
  if (d < 0) return { text: t('tasks.dueLate', { date }), cls: 'bg-red-100 text-red-700' };
  if (d === 0) return { text: t('tasks.dueToday'), cls: 'bg-amber-100 text-amber-800' };
  if (d === 1) return { text: t('tasks.dueTomorrow'), cls: 'bg-amber-100 text-amber-800' };
  return { text: date, cls: d <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600' };
}

function TaskCard({ task: x, userId, isMember, today, state, late, waitsFor, unlocks, groupTitle, canDelete, open, onToggle, onJump, onStatus, onTake, onEdit, onDelete, onComment, onDeleteComment, canDeleteComment }: {
  task: PlanTask; userId: string; isMember: boolean; today: string; state: State; late: boolean;
  waitsFor: PlanTask[]; unlocks: PlanTask[]; groupTitle?: string; canDelete: boolean; open: boolean;
  onToggle: () => void; onJump: (id: string) => void; onStatus: (s: PlanTask['status']) => Promise<boolean>; onTake: (take: boolean) => void;
  onEdit: () => void; onDelete: () => void; onComment: (content: string) => Promise<boolean>; onDeleteComment: (id: string) => void;
  canDeleteComment: (c: PlanTask['comments'][number]) => boolean;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const done = x.status === 'done';
  const mine = x.assignees.some(a => a.userId === userId);
  const due = x.dueDate && !done ? dueLabel(x.dueDate, today) : null;

  function start() {
    if (waitsFor.length && !confirm(t('tasks.startBlockedConfirm', { title: x.title, waits: waitsFor.map(w => w.title).join(', ') }))) return;
    onStatus('doing');
  }

  const border = done ? 'border-emerald-200 bg-emerald-50/50' : late ? 'border-red-200 bg-white' : state === 'doing' ? 'border-amber-200 bg-white' : state === 'blocked' ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white';
  return (
    <div id={`task-${x.id}`} className={`rounded-xl border shadow-sm ${border}`}>
      <div className="flex items-start gap-2.5 p-3">
        {/* Cocher = terminer, décocher = rouvrir */}
        <button onClick={() => onStatus(done ? 'todo' : 'done')} aria-label={done ? t('tasks.reopen') : t('tasks.finish')} title={done ? t('tasks.reopen') : t('tasks.finish')}
          className={`flex-shrink-0 mt-0.5 ${done ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-500'}`}>
          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-semibold break-words ${done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800'}`}>{x.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${STATE_STYLE[state]}`}>
              {state === 'blocked' && <Lock size={10} />}{t(`tasks.states.${state}`)}
            </span>
            {due && <span className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${due.cls}`}><CalendarDays size={10} />{due.text}</span>}
            {groupTitle && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{groupTitle}</span>}
            {x.assignees.length === 0 && !done
              ? <span className="text-[11px] text-slate-400 italic">{t('tasks.nobody')}</span>
              : x.assignees.map(a => (
                <span key={a.userId} className={`text-[11px] px-1.5 py-0.5 rounded-full ${a.userId === userId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{personName(a.user)}</span>
              ))}
            {x.comments.length > 0 && <span className="flex items-center gap-0.5 text-[11px] text-slate-400"><MessageSquare size={11} />{x.comments.length}</span>}
          </div>
          {!open && !done && waitsFor.length > 0 && (
            <p className="flex items-start gap-1 text-xs text-slate-600 mt-1.5"><Lock size={12} className="flex-shrink-0 mt-0.5 text-slate-400" />
              <span>{t('tasks.waitsFor', { titles: waitsFor.map(w => w.title).join(', ') })}</span></p>
          )}
          {!open && !done && unlocks.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-slate-400 mt-1"><Unlock size={12} />{t('tasks.unlocks', { count: unlocks.length })}</p>
          )}
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-slate-100">
          {x.note && <p className="pt-2.5 text-sm text-slate-600 whitespace-pre-wrap break-words">{x.note}</p>}
          {/* Tâches liées : toucher l'une d'elles l'ouvre */}
          {waitsFor.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-0.5">{t('tasks.waitsLabel')}</span>
              {waitsFor.map(w => (
                <button key={w.id} onClick={() => onJump(w.id)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><Lock size={11} />{w.title}</button>
              ))}
            </div>
          )}
          {unlocks.length > 0 && (
            <div className={`${waitsFor.length ? '' : 'pt-2 '}flex flex-wrap items-center gap-1.5`}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-0.5">{t('tasks.unlocksLabel')}</span>
              {unlocks.map(w => (
                <button key={w.id} onClick={() => onJump(w.id)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"><Unlock size={11} />{w.title}</button>
              ))}
            </div>
          )}
          {done && x.doneBy && <p className="pt-2 text-xs text-emerald-700">{t('tasks.doneBy', { pseudo: x.doneBy.pseudo })}</p>}

          {x.comments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {x.comments.map(c => (
                <div key={c.id} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <MessageSquare size={12} className="flex-shrink-0 mt-0.5 text-slate-400" />
                  <p className="flex-1 min-w-0 text-xs text-slate-700 whitespace-pre-wrap break-words">
                    <span className="font-semibold">@{c.author.pseudo}</span><span className="text-slate-400"> · {commentFmt.format(new Date(c.createdAt))}</span><br />{c.content}
                  </p>
                  {canDeleteComment(c) && (
                    <button onClick={() => onDeleteComment(c.id)} title={t('tasks.deleteComment')} aria-label={t('tasks.deleteComment')} className="flex-shrink-0 p-0.5 rounded text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <form className="flex gap-1.5 pt-1" onSubmit={async e => {
            e.preventDefault();
            if (!draft.trim()) return;
            setSending(true);
            if (await onComment(draft)) setDraft('');
            setSending(false);
          }}>
            <input value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder={t('tasks.commentPlaceholder')}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={sending || !draft.trim()} title={t('tasks.send')} aria-label={t('tasks.send')}
              className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send size={14} /></button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!done && x.status === 'todo' && (
              <button onClick={start} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600"><Play size={13} />{t('tasks.start')}</button>
            )}
            {!done && (
              <button onClick={() => onStatus('done')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 size={13} />{t('tasks.finish')}</button>
            )}
            {x.status === 'doing' && (
              <button onClick={() => onStatus('todo')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">{t('tasks.backToTodo')}</button>
            )}
            {done && (
              <button onClick={() => onStatus('todo')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"><RotateCcw size={13} />{t('tasks.reopen')}</button>
            )}
            {!done && (mine ? (
              <button onClick={() => onTake(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"><UserMinus size={13} />{t('tasks.dropIt')}</button>
            ) : isMember && (
              <button onClick={() => onTake(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"><UserPlus size={13} />{t('tasks.takeIt')}</button>
            ))}
            <span className="flex-1" />
            <button onClick={onEdit} title={t('tasks.edit')} aria-label={t('tasks.edit')} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={15} /></button>
            {canDelete && <button onClick={onDelete} title={t('tasks.delete')} aria-label={t('tasks.delete')} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

// Formulaire d'une tâche, aussi utilisé par « Transformer en tâche » des Idées (IdeasTab) : `initialTitle`,
// `heading` et `submitLabel` y remplacent les textes. « + Nouveau lot… » crée le lot à l'envoi.
export function TaskForm({ planId, task, groupId: initialGroup, groups, people, tasks, onSubmit, onCancel, initialTitle, heading, submitLabel }: {
  planId: string; task?: PlanTask; groupId: string | null; groups: PlanTaskGroup[]; people: Person[]; tasks: PlanTask[];
  onSubmit: (body: object) => Promise<boolean>; onCancel: () => void;
  initialTitle?: string; heading?: string; submitLabel?: string;
}) {
  const [title, setTitle] = useState(task?.title ?? initialTitle ?? '');
  const [groupId, setGroupId] = useState<string>(initialGroup ?? '');
  const [newGroup, setNewGroup] = useState('');
  const [groupError, setGroupError] = useState('');
  const [assignees, setAssignees] = useState<string[]>(task?.assignees.map(a => a.userId) ?? []);
  const [due, setDue] = useState(task?.dueDate ?? '');
  const [deps, setDeps] = useState<string[]>(task?.dependsOn ?? []);
  const [note, setNote] = useState(task?.note ?? '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

  // Tâches qu'on ne peut pas attendre : elle-même et celles qui l'attendent déjà (boucle)
  const forbidden = useMemo(() => {
    const out = new Set<string>(task ? [task.id] : []);
    if (!task) return out;
    let added = true;
    while (added) {
      added = false;
      for (const x of tasks) if (!out.has(x.id) && x.dependsOn.some(id => out.has(id))) { out.add(x.id); added = true; }
    }
    return out;
  }, [task, tasks]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const candidates = tasks.filter(x => !forbidden.has(x.id) && (!search.trim() || norm(x.title).includes(norm(search.trim()))));
  const groupName = (id: string | null) => groups.find(g => g.id === id)?.title;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setMissing(true); return; }
    if (groupId === NEW_GROUP && !newGroup.trim()) { setGroupError(t('tasks.form.newGroupRequired')); return; }
    setBusy(true);
    let group: string | null = groupId || null;
    if (groupId === NEW_GROUP) {
      // Un lot du même nom existe déjà : on le reprend (le serveur ne crée pas de doublon)
      const same = groups.find(g => g.title.trim().toLowerCase() === newGroup.trim().toLowerCase());
      try {
        group = same ? same.id : (await api.post(`/plans/${planId}/task-groups`, { title: newGroup.trim() })).data.ids[0] ?? null;
      } catch (err: any) {
        setGroupError(err.response?.data?.error || t('common.retryError'));
        setBusy(false);
        return;
      }
    }
    await onSubmit({ title, groupId: group, assigneeIds: assignees, dueDate: due || null, dependsOnIds: deps, note });
    setBusy(false);
  }

  const toggle = (list: string[], set: (l: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  return (
    <Modal title={heading ?? (task ? t('tasks.form.editTitle') : t('tasks.form.newTitle'))} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.title')}</label>
          <input autoFocus value={title} maxLength={120} onChange={e => { setTitle(e.target.value); setMissing(false); }} placeholder={t('tasks.form.titlePlaceholder')} className={input} />
          {missing && <p className="text-xs text-red-500 mt-1">{t('tasks.form.titleRequired')}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.group')}</label>
          <select value={groupId} onChange={e => { setGroupId(e.target.value); setGroupError(''); }} className={input}>
            <option value="">{t('tasks.noGroup')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            <option value={NEW_GROUP}>{t('tasks.form.newGroup')}</option>
          </select>
          {groupId === NEW_GROUP && (
            <input autoFocus value={newGroup} maxLength={60} onChange={e => { setNewGroup(e.target.value); setGroupError(''); }}
              placeholder={t('tasks.groupPlaceholder')} className={`${input} mt-2`} />
          )}
          {groupError && <p className="text-xs text-red-500 mt-1">{groupError}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.assignees')}</label>
          <div className="flex flex-wrap gap-1.5">
            {people.map(p => (
              <button type="button" key={p.id} onClick={() => toggle(assignees, setAssignees, p.id)} aria-pressed={assignees.includes(p.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${assignees.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {personName(p)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{t('tasks.form.assigneesHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.due')}</label>
          <DateTimeField mode="date" value={due} onChange={setDue} placeholder={t('tasks.form.duePlaceholder')} clearable />
          <p className="text-[11px] text-slate-400 mt-1">{t('tasks.form.dueHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.dependsOn')}</label>
          {deps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {deps.map(id => tasks.find(x => x.id === id)).filter((x): x is PlanTask => !!x).map(x => (
                <button type="button" key={x.id} onClick={() => toggle(deps, setDeps, x.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-white">
                  <Lock size={11} />{x.title} ✕
                </button>
              ))}
            </div>
          )}
          {tasks.length - forbidden.size > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {tasks.length > 8 && (
                <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                  <Search size={14} className="text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tasks.form.dependsOnSearch')} className="flex-1 min-w-0 text-sm outline-none bg-transparent" />
                </label>
              )}
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                {candidates.map(x => (
                  <label key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={deps.includes(x.id)} onChange={() => toggle(deps, setDeps, x.id)} className="accent-indigo-600" />
                    <span className={`flex-1 min-w-0 truncate ${x.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{x.title}</span>
                    {groupName(x.groupId) && <span className="text-[11px] text-slate-400 truncate max-w-[40%]">{groupName(x.groupId)}</span>}
                  </label>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 italic">{t('tasks.form.dependsOnNone')}</p>}
          <p className="text-[11px] text-slate-400 mt-1">{t('tasks.form.dependsOnHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('tasks.form.note')}</label>
          <textarea rows={3} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder={t('tasks.form.notePlaceholder')} className={`${input} resize-none`} />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {submitLabel ?? (task ? t('tasks.form.save') : t('tasks.form.create'))}
          </button>
        </div>
      </form>
    </Modal>
  );
}

