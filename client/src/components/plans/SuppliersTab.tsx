import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, ChevronDown, FileText, Globe, History as HistoryIcon, Lock, Mail, Pause, Paperclip, Pencil, Phone, Play, Plus, RotateCcw, Search, Send, Trash2, X } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { useResync } from '../../hooks/useResync';
import { saveFile } from '../../lib/saveFile';
import { Modal } from '../ui/Modal';
import { DateTimeField } from '../ui/DateTimeField';
import { intlLocale, t } from '../../i18n';

// Fournisseurs d'un Plan (fonction « fournisseurs », Préparer en équipe) : engagements suivis par l'équipe (état,
// responsable, lot, notes, commentaires), montants et documents réservés aux organisateurs (le serveur ne les envoie
// qu'à eux), et carnet du Cercle pour retrouver un fournisseur d'un événement à l'autre. Serveur : routes/suppliers.ts.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;

export const SUPPLIER_CATEGORIES = ['repas', 'boissons', 'salle', 'technique', 'location', 'animation', 'impression', 'transport', 'securite', 'autre'] as const;
type Category = typeof SUPPLIER_CATEGORIES[number];
const STATUSES = ['todo', 'quote_requested', 'quote_received', 'confirmed', 'paid'] as const;
type Status = typeof STATUSES[number];
const FLOW: Status[] = [...STATUSES];

export const CATEGORY_EMOJI: Record<string, string> = {
  repas: '🍽️', boissons: '🍷', salle: '🏛️', technique: '🔊', location: '📦', animation: '🎤', impression: '🖨️', transport: '🚌', securite: '🛡️', autre: '📇',
};
const STATUS_STYLE: Record<Status, string> = {
  todo: 'bg-slate-100 text-slate-600',
  quote_requested: 'bg-sky-100 text-sky-700',
  quote_received: 'bg-violet-100 text-violet-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-600 text-white',
};
const HOLD_STYLE = 'bg-slate-200 text-slate-500';

type Person = { id: string; pseudo: string; firstName?: string | null };
export type SupplierFields = {
  name: string; category: Category; contactName?: string | null; phone?: string | null; email?: string | null;
  website?: string | null; address?: string | null; notes?: string | null;
};
type Supplier = SupplierFields & { id: string; createdById?: string | null };
type Doc = { id: string; name: string; mimeType: string; size: number; createdAt: string };
type HistoryItem = { at: string; by: string; from?: Status; to?: Status; hold?: boolean };
type Entry = {
  id: string; status: Status; steps: Partial<Record<Status, { at: string; by: string }>>; onHold: boolean; history: HistoryItem[]; responsibleId: string | null; groupId: string | null;
  notes: string | null; createdById: string | null; supplier: Supplier;
  comments: { id: string; content: string; createdAt: string; author: Person }[];
  documents?: Doc[]; documentCount?: number;
  currency?: 'CHF' | 'EUR'; quoteAmount?: number | null; depositAmount?: number | null; depositDue?: string | null; depositPaidAt?: string | null;
  balanceAmount?: number | null; balanceDue?: string | null; balancePaidAt?: string | null;
};
type Data = { entries: Entry[]; people: Person[]; groups: { id: string; title: string }[]; canManageMoney: boolean; canUseBook: boolean; docToken: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysUntil = (due: string, today: string) => Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
const dayFmt = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDay = (ymd: string) => dayFmt.format(new Date(`${ymd}T12:00:00Z`));
const fmtDate = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(iso));
const money = (n: number | null | undefined, cur = 'CHF') =>
  n == null ? '' : new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: cur, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const personName = (p: Person) => displayName(p) || `@${p.pseudo}`;
const errOf = (e: any) => e?.response?.data?.error || t('common.retryError');

// Paiement à faire dans les 3 jours (pas encore payé)
function paymentSoon(e: Entry, today: string) {
  const soon = (amount?: number | null, due?: string | null, paid?: string | null) => amount != null && !!due && !paid && daysUntil(due, today) <= 3;
  return !e.onHold && (soon(e.depositAmount, e.depositDue, e.depositPaidAt) || soon(e.balanceAmount, e.balanceDue, e.balancePaidAt));
}

export function SuppliersTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Status | 'all' | 'on_hold'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try { setData((await api.get(`/plans/${plan.id}/suppliers`)).data); }
    catch { setData(d => d ?? { entries: [], people: [], groups: [], canManageMoney: false, canUseBook: false, docToken: null }); }
  }
  // Rechargé à chaque mise à jour du Plan (temps réel : plan-updated) et au retour dans l'app
  useEffect(() => { load(); }, [plan]);
  useResync(load);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); await load(); return true; }
    catch (e) { setError(errOf(e)); await load(); return false; }
  }

  const today = localDay();
  if (!data) return <div className="flex-1 bg-slate-50" />;
  const { entries, canManageMoney } = data;
  const shown = filter === 'all' ? entries : filter === 'on_hold' ? entries.filter(e => e.onHold) : entries.filter(e => !e.onHold && e.status === filter);
  const pendingQuotes = entries.filter(e => !e.onHold && e.status === 'quote_requested').length;
  const soon = canManageMoney ? entries.filter(e => paymentSoon(e, today)).length : 0;
  const counts = new Map<string, number>([...STATUSES.map(s => [s, entries.filter(e => !e.onHold && e.status === s).length] as [string, number]), ['on_hold', entries.filter(e => e.onHold).length]]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {entries.length > 0 && (
        <p className="text-sm text-slate-600">
          {t('suppliers.summary', { count: entries.length })}
          {pendingQuotes > 0 && <> · {t('suppliers.quotesPending', { count: pendingQuotes })}</>}
          {soon > 0 && <span className="text-amber-700 font-medium"> · {t('suppliers.paymentsSoon', { count: soon })}</span>}
        </p>
      )}

      {data.canUseBook && (
        <button onClick={() => setPicking(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <Plus size={16} />{t('suppliers.add')}
        </button>
      )}

      {entries.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
          {(['all', ...STATUSES, 'on_hold'] as const).filter(s => s === 'all' || counts.get(s)).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium ${filter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>
              {s === 'all' ? t('suppliers.all') : `${s === 'on_hold' ? t('suppliers.onHold') : t(`suppliers.statuses.${s}`)} · ${counts.get(s)}`}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">{data.canUseBook ? t('suppliers.empty') : t('suppliers.emptyNoBook')}</p>
      ) : (
        <div className="space-y-3">
          {shown.map(e => (
            <SupplierCard key={e.id} entry={e} data={data} userId={userId} today={today} open={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)} run={run} />
          ))}
        </div>
      )}

      {picking && (
        <SupplierPicker planId={plan.id} onClose={() => setPicking(false)}
          onAdded={async id => { setPicking(false); await load(); setOpenId(id); }} />
      )}
    </div>
  );
}

function SupplierCard({ entry: e, data, userId, today, open, onToggle, run }: {
  entry: Entry; data: Data; userId: string; today: string; open: boolean; onToggle: () => void;
  run: (a: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { canManageMoney, people, groups } = data;
  const s = e.supplier;
  const responsible = people.find(p => p.id === e.responsibleId);
  const canRemove = e.createdById === userId || canManageMoney;
  const total = e.quoteAmount ?? (e.depositAmount != null || e.balanceAmount != null ? (e.depositAmount ?? 0) + (e.balanceAmount ?? 0) : null);
  const setStatus = (status: Status) => { if (status !== e.status) run(() => api.put(`/plans/suppliers/${e.id}`, { status })); };

  return (
    <div id={`supplier-${e.id}`} className={`rounded-xl border bg-white shadow-sm border-slate-200 ${e.onHold ? 'opacity-75' : ''}`}>
      <button onClick={onToggle} className="w-full flex items-start gap-3 p-3.5 text-left">
        <span className="text-2xl leading-none mt-0.5" aria-hidden>{CATEGORY_EMOJI[s.category] ?? '📇'}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm text-slate-800 break-words">{s.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.onHold ? HOLD_STYLE : STATUS_STYLE[e.status]}`}>{e.onHold ? t('suppliers.onHold') : t(`suppliers.statuses.${e.status}`)}</span>
            <span className="text-xs text-slate-500">{t(`suppliers.categories.${s.category}`)}</span>
            {canManageMoney && total != null && <span className="text-xs font-medium text-slate-700">· {money(total, e.currency)}</span>}
            {canManageMoney && paymentSoon(e, today) && <span className="text-xs font-medium text-amber-700">· 💶</span>}
          </span>
          {/* Mini-frise : l'avancement sans déplier la carte */}
          <MiniSteps status={e.status} onHold={e.onHold} />
          {responsible && <span className="block text-xs text-slate-500 mt-1">{t('suppliers.fields.responsible')} : {personName(responsible)}</span>}
        </span>
        <ChevronDown size={18} className={`flex-shrink-0 mt-1 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-4 border-t border-slate-100 pt-3">
          {/* Coordonnées */}
          <ContactLinks s={s} />

          {/* Où en est-on ? Toucher l'étape où l'on en est, en avant comme en arrière */}
          <Stepper entry={e} canPaid={canManageMoney} onPick={setStatus}
            onHold={hold => run(() => api.put(`/plans/suppliers/${e.id}`, { onHold: hold }))} />

          {/* Responsable et lot */}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">{t('suppliers.fields.responsible')}</span>
              <select value={e.responsibleId ?? ''} onChange={ev => run(() => api.put(`/plans/suppliers/${e.id}`, { responsibleId: ev.target.value || null }))}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                <option value="">{t('suppliers.fields.nobody')}</option>
                {people.map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}
              </select>
            </label>
            {groups.length > 0 && (
              <label className="block">
                <span className="block text-xs font-medium text-slate-500 mb-1">{t('suppliers.fields.group')}</span>
                <select value={e.groupId ?? ''} onChange={ev => run(() => api.put(`/plans/suppliers/${e.id}`, { groupId: ev.target.value || null }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                  <option value="">{t('suppliers.fields.noGroup')}</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </label>
            )}
          </div>

          <NotesField entry={e} run={run} />

          {/* Montants et documents : organisateurs seulement */}
          {canManageMoney ? (
            <>
              <MoneySection entry={e} run={run} />
              <DocsSection entry={e} token={data.docToken} run={run} />
            </>
          ) : (e.documentCount ?? 0) > 0 && (
            <p className="text-xs text-slate-400">{t('suppliers.docs.hidden', { count: e.documentCount })}</p>
          )}

          <CommentsSection entry={e} userId={userId} canManage={canManageMoney} run={run} />

          {canRemove && (
            <button onClick={() => { if (confirm(t('suppliers.removeConfirm', { name: s.name }))) run(() => api.delete(`/plans/suppliers/${e.id}`)); }}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"><Trash2 size={13} />{t('suppliers.remove')}</button>
          )}
        </div>
      )}
    </div>
  );
}

const stepIndex = (s: Status) => FLOW.indexOf(s);

function MiniSteps({ status, onHold }: { status: Status; onHold: boolean }) {
  const cur = stepIndex(status);
  return (
    <span className="flex items-center gap-1 mt-1.5" aria-hidden>
      {FLOW.map((st, i) => (
        <span key={st} className={`h-1.5 w-5 rounded-full ${onHold ? (i <= cur ? 'bg-slate-400' : 'bg-slate-200') : i < cur || (i === cur && status === 'paid') ? 'bg-emerald-500' : i === cur ? 'bg-indigo-600' : 'bg-slate-200'}`} />
      ))}
    </span>
  );
}

// Frise des étapes : passées cochées en vert, actuelle en corail ; « Payé » réservé aux organisateurs. « Mettre de côté »
// garde l'étape, « Reprendre » y ramène. Historique replié.
function Stepper({ entry: e, canPaid, onPick, onHold }: { entry: Entry; canPaid: boolean; onPick: (s: Status) => void; onHold: (hold: boolean) => void }) {
  const [showHistory, setShowHistory] = useState(false);
  const cur = stepIndex(e.status);
  const lockPaid = !canPaid;
  const cameAt = [...(e.history ?? [])].reverse().find(h => h.to === e.status) ?? (e.steps?.[e.status] ? { ...e.steps[e.status]!, to: e.status } : null);
  const label = (st?: Status) => (st ? t(`suppliers.statuses.${st}`) : '');
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('suppliers.where')}</p>
      <ol className={`grid grid-cols-5 gap-1 ${e.onHold ? 'opacity-60' : ''}`}>
        {FLOW.map((st, i) => {
          // Payé = terminé : la dernière étape est cochée en vert
          const finished = e.status === 'paid';
          const done = i < cur || (finished && i === cur), current = i === cur && !finished;
          const locked = lockPaid && (st === 'paid' || e.status === 'paid');
          return (
            <li key={st} className="min-w-0">
              <button type="button" disabled={locked || e.onHold} onClick={() => onPick(st)} aria-current={current ? 'step' : undefined}
                title={locked ? t('suppliers.paidLocked') : undefined}
                className="w-full flex flex-col items-center gap-1 py-1 rounded-lg hover:bg-slate-50 disabled:hover:bg-transparent disabled:cursor-default">
                <span className="relative w-full flex items-center justify-center">
                  {i > 0 && <span className={`absolute right-1/2 left-[-50%] top-1/2 -translate-y-1/2 h-0.5 ${i <= cur ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                  <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 ${current ? 'bg-indigo-600 border-indigo-600 text-white' : done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                    {done ? <Check size={14} strokeWidth={3} /> : locked && !current ? <Lock size={12} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                  </span>
                </span>
                <span className={`text-[11px] leading-tight text-center break-words ${current ? 'font-semibold text-indigo-700' : done ? `text-emerald-700 ${finished && i === cur ? 'font-semibold' : ''}` : 'text-slate-500'}`}>{label(st)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {e.onHold ? <b className="text-slate-600">{t('suppliers.onHold')} · </b> : null}
          {cameAt ? t('suppliers.current', { status: label(e.status), date: fmtDate(cameAt.at), who: cameAt.by }) : label(e.status)}
        </p>
        {e.status !== 'paid' && <button type="button" onClick={() => onHold(!e.onHold)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
          {e.onHold ? <Play size={13} /> : <Pause size={13} />}{e.onHold ? t('suppliers.resume') : t('suppliers.hold')}
        </button>}
      </div>
      {(e.history?.length ?? 0) > 1 && (
        <div>
          <button type="button" onClick={() => setShowHistory(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <HistoryIcon size={12} />{t('suppliers.historyTitle', { count: e.history.length })}
            <ChevronDown size={12} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
              {[...e.history].reverse().map((h, i) => (
                <li key={i}>{h.hold !== undefined
                  ? t(h.hold ? 'suppliers.historyHold' : 'suppliers.historyResume', { date: fmtDate(h.at), who: h.by })
                  : h.from ? t('suppliers.historyMove', { date: fmtDate(h.at), who: h.by, from: label(h.from), to: label(h.to) })
                  : t('suppliers.historyStart', { date: fmtDate(h.at), who: h.by })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Téléphone, email, site : toucher pour appeler ou écrire
export function ContactLinks({ s }: { s: SupplierFields }) {
  if (!s.contactName && !s.phone && !s.email && !s.website && !s.address && !s.notes) return null;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50';
  return (
    <div className="space-y-2">
      {s.contactName && <p className="text-sm text-slate-700">{s.contactName}</p>}
      <div className="flex flex-wrap gap-2">
        {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className={btn}><Phone size={14} />{s.phone}</a>}
        {s.email && <a href={`mailto:${s.email}`} className={btn}><Mail size={14} />{t('suppliers.write')}</a>}
        {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className={btn}><Globe size={14} />{t('suppliers.site')}</a>}
      </div>
      {s.address && <p className="text-xs text-slate-500">{s.address}</p>}
      {s.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">{s.notes}</p>}
    </div>
  );
}

function NotesField({ entry: e, run }: { entry: Entry; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [value, setValue] = useState(e.notes ?? '');
  useEffect(() => { setValue(e.notes ?? ''); }, [e.notes]);
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{t('suppliers.fields.entryNotes')}</span>
      <textarea value={value} onChange={ev => setValue(ev.target.value)} rows={2} maxLength={1000}
        onBlur={() => { if (value.trim() !== (e.notes ?? '')) run(() => api.put(`/plans/suppliers/${e.id}`, { notes: value })); }}
        placeholder={t('suppliers.fields.entryNotesPlaceholder')}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </label>
  );
}

function MoneySection({ entry: e, run }: { entry: Entry; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const cur = e.currency ?? 'CHF';
  const [form, setForm] = useState({ currency: cur, quoteAmount: '', depositAmount: '', depositDue: '', balanceAmount: '', balanceDue: '' });
  const start = () => {
    setForm({
      currency: cur, quoteAmount: e.quoteAmount?.toString() ?? '', depositAmount: e.depositAmount?.toString() ?? '', depositDue: e.depositDue ?? '',
      balanceAmount: e.balanceAmount?.toString() ?? '', balanceDue: e.balanceDue ?? '',
    });
    setEditing(true);
  };
  const none = e.quoteAmount == null && e.depositAmount == null && e.balanceAmount == null;
  const line = (label: string, amount: number | null | undefined, due: string | null | undefined, paidAt: string | null | undefined, key: 'depositPaid' | 'balancePaid' | null) => amount != null && (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0">
        <span className="text-sm text-slate-700">{label} : <b>{money(amount, cur)}</b></span>
        {key && (paidAt
          ? <span className="block text-xs text-emerald-700">{t('suppliers.money.paidOn', { date: fmtDate(paidAt) })}</span>
          : due && <span className="block text-xs text-slate-500">{t('suppliers.money.dueOn', { date: fmtDay(due) })}</span>)}
      </span>
      {key && (
        <button onClick={() => run(() => api.put(`/plans/suppliers/${e.id}`, { [key]: !paidAt }))}
          className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${paidAt ? 'text-slate-500 hover:bg-slate-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
          {paidAt ? t('suppliers.money.unpaid') : t('suppliers.money.markPaid')}
        </button>
      )}
    </div>
  );
  const input = 'w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm';
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('suppliers.money.title')}</p>
        {!editing && <button onClick={start} className="flex items-center gap-1 text-xs text-indigo-600 font-medium"><Pencil size={12} />{t('suppliers.money.edit')}</button>}
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{t('suppliers.money.onlyOrganisers')}</p>
      {!editing ? (
        none ? <p className="text-sm text-slate-500">{t('suppliers.money.none')}</p> : (
          <div className="divide-y divide-slate-200">
            {line(t('suppliers.money.quote'), e.quoteAmount, null, null, null)}
            {line(t('suppliers.money.deposit'), e.depositAmount, e.depositDue, e.depositPaidAt, 'depositPaid')}
            {line(t('suppliers.money.balance'), e.balanceAmount, e.balanceDue, e.balancePaidAt, 'balancePaid')}
          </div>
        )
      ) : (
        <form className="space-y-2.5" onSubmit={async ev => {
          ev.preventDefault();
          if (await run(() => api.put(`/plans/suppliers/${e.id}`, { money: form }))) setEditing(false);
        }}>
          <label className="flex items-center gap-2 text-sm text-slate-700">{t('suppliers.money.currency')}
            <select value={form.currency} onChange={ev => setForm({ ...form, currency: ev.target.value as any })} className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white">
              <option>CHF</option><option>EUR</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">{t('suppliers.money.quote')}
            <input inputMode="decimal" value={form.quoteAmount} onChange={ev => setForm({ ...form, quoteAmount: ev.target.value })} className={input} />
          </label>
          {(['deposit', 'balance'] as const).map(k => (
            <div key={k} className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500">{t(`suppliers.money.${k}`)}
                <input inputMode="decimal" value={(form as any)[`${k}Amount`]} onChange={ev => setForm({ ...form, [`${k}Amount`]: ev.target.value })} className={input} />
              </label>
              <div className="text-xs text-slate-500">{t('suppliers.money.due')}
                <DateTimeField mode="date" value={(form as any)[`${k}Due`]} onChange={v => setForm({ ...form, [`${k}Due`]: v })} clearable />
              </div>
            </div>
          ))}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
            <button type="submit" className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('suppliers.money.save')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function DocsSection({ entry: e, token, run }: { entry: Entry; token: string | null; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const docs = e.documents ?? [];
  async function open(d: Doc) {
    if (!token) return;
    const res = await fetch(`${API_BASE}/suppliers/files/${d.id}?t=${encodeURIComponent(token)}`);
    if (res.ok) await saveFile(await res.blob(), d.name, d.name);
  }
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    await run(() => api.post(`/plans/suppliers/${e.id}/documents`, fd));
    setBusy(false);
  }
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('suppliers.docs.title')}</p>
      <ul className="space-y-1 mb-2">
        {docs.map(d => (
          <li key={d.id} className="flex items-center gap-2">
            <button onClick={() => open(d)} className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-left text-sm text-slate-700 hover:bg-slate-50">
              <FileText size={15} className="flex-shrink-0 text-indigo-500" /><span className="truncate">{d.name}</span>
            </button>
            <button onClick={() => { if (confirm(t('suppliers.docs.deleteConfirm', { name: d.name }))) run(() => api.delete(`/plans/suppliers/documents/${d.id}`)); }}
              aria-label={t('suppliers.docs.delete')} title={t('suppliers.docs.delete')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        <Paperclip size={14} />{t('suppliers.docs.add')}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) upload(f); }} />
      </label>
      <p className="text-[11px] text-slate-400 mt-1">{t('suppliers.docs.hint')}</p>
    </div>
  );
}

function CommentsSection({ entry: e, userId, canManage, run }: { entry: Entry; userId: string; canManage: boolean; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('suppliers.comments.title')}</p>
      <ul className="space-y-1.5 mb-2">
        {e.comments.map(c => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <span className="flex-1 min-w-0"><b className="text-slate-700">{personName(c.author)}</b> <span className="text-slate-600 whitespace-pre-wrap break-words">{c.content}</span>
              <span className="block text-[11px] text-slate-400">{fmtDate(c.createdAt)}</span></span>
            {(c.author.id === userId || canManage) && (
              <button onClick={() => run(() => api.delete(`/plans/suppliers/comments/${c.id}`))} aria-label={t('suppliers.comments.delete')}
                className="w-8 h-8 -my-1 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
            )}
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={async ev => { ev.preventDefault(); if (!draft.trim()) return; if (await run(() => api.post(`/plans/suppliers/${e.id}/comments`, { content: draft }))) setDraft(''); }}>
        <input value={draft} onChange={ev => setDraft(ev.target.value)} maxLength={500} placeholder={t('suppliers.comments.placeholder')}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" disabled={!draft.trim()} aria-label={t('suppliers.comments.placeholder')} className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-40"><Send size={15} /></button>
      </form>
    </div>
  );
}

// Fiche d'un fournisseur (création depuis un Plan, modification dans le carnet)
export function SupplierForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: Partial<SupplierFields>; submitLabel: string; onSubmit: (f: SupplierFields) => Promise<string | null>; onCancel?: () => void;
}) {
  const [f, setF] = useState<SupplierFields>({ name: '', category: 'repas', ...initial } as SupplierFields);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const field = (key: keyof SupplierFields, type = 'text', placeholder?: string) => (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{t(`suppliers.fields.${key}` as any)}</span>
      <input type={type} value={(f[key] as string) ?? ''} onChange={e => setF({ ...f, [key]: e.target.value })} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </label>
  );
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (!f.name.trim()) { setError(t('suppliers.fields.nameRequired')); return; }
      setBusy(true);
      const err = await onSubmit(f);
      setBusy(false);
      if (err) setError(err);
    }}>
      {field('name', 'text', t('suppliers.fields.namePlaceholder'))}
      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">{t('suppliers.fields.category')}</span>
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value as Category })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
          {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {t(`suppliers.categories.${c}`)}</option>)}
        </select>
      </label>
      {field('contactName')}
      <div className="grid sm:grid-cols-2 gap-3">{field('phone', 'tel')}{field('email', 'email')}</div>
      {field('website', 'url')}
      {field('address')}
      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">{t('suppliers.fields.notes')}</span>
        <textarea value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} maxLength={1000} placeholder={t('suppliers.fields.notesPlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>}
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </form>
  );
}

type BookItem = SupplierFields & { id: string; inPlan: boolean; uses: { planTitle: string; eventDate: string | null; status: string }[] };

// « Ajouter un fournisseur » : du carnet du Cercle, ou un nouveau (créé aussi dans le carnet)
function SupplierPicker({ planId, onClose, onAdded }: { planId: string; onClose: () => void; onAdded: (entryId: string) => void }) {
  const [book, setBook] = useState<BookItem[] | null>(null);
  const [mode, setMode] = useState<'book' | 'new'>('book');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/plans/${planId}/suppliers/book`).then(r => { setBook(r.data.suppliers); if (!r.data.suppliers.length) setMode('new'); }).catch(() => { setBook([]); setMode('new'); });
  }, [planId]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = useMemo(() => (book ?? []).filter(b => !q.trim() || norm(`${b.name} ${b.contactName ?? ''}`).includes(norm(q.trim()))), [book, q]);
  async function add(body: any) {
    try { onAdded((await api.post(`/plans/${planId}/suppliers`, body)).data.id); return null; }
    catch (e) { const m = errOf(e); setError(m); return m; }
  }
  return (
    <Modal title={t('suppliers.picker.title')} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1">
          {(['book', 'new'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${mode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
              {m === 'book' ? t('suppliers.picker.fromBook') : t('suppliers.picker.newOne')}
            </button>
          ))}
        </div>
        {mode === 'book' ? (
          !book ? null : book.length === 0 ? <p className="text-sm text-slate-500">{t('suppliers.picker.emptyBook')}</p> : (
            <>
              {book.length > 5 && (
                <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('suppliers.picker.search')} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              )}
              <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
                {list.map(b => (
                  <li key={b.id}>
                    <button disabled={b.inPlan} onClick={() => add({ supplierId: b.id })}
                      className="w-full flex items-start gap-3 p-3 rounded-xl border border-slate-200 text-left hover:border-indigo-300 disabled:opacity-50 disabled:hover:border-slate-200">
                      <span className="text-xl" aria-hidden>{CATEGORY_EMOJI[b.category] ?? '📇'}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">{b.name}</span>
                        <span className="block text-xs text-slate-500">{t(`suppliers.categories.${b.category}`)}{b.contactName ? ` · ${b.contactName}` : ''}</span>
                        {b.inPlan ? <span className="block text-xs text-indigo-600 mt-0.5">{t('suppliers.picker.inPlan')}</span>
                          : b.uses.length > 0 && <span className="block text-xs text-slate-400 mt-0.5">{t('suppliers.picker.usedFor', { list: b.uses.slice(0, 3).map(u => u.planTitle).join(', ') })}</span>}
                      </span>
                      {!b.inPlan && <Plus size={16} className="mt-1 text-indigo-500" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : (
          <>
            <p className="text-xs text-slate-500">{t('suppliers.picker.newHint')}</p>
            <SupplierForm submitLabel={t('suppliers.picker.create')} onSubmit={f => add({ supplier: f })} />
          </>
        )}
        {error && mode === 'book' && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

type BookEntry = SupplierFields & {
  id: string; archived: boolean; canEdit: boolean;
  uses: { planTitle: string; eventDate: string | null; status: string; total?: number | null; currency?: string }[];
};

// Carnet des fournisseurs du Cercle (menu ⋯ de la colonne du Cercle) : fiches, historique, archiver, supprimer
export function SupplierBookModal({ circleId, onClose }: { circleId: string; onClose: () => void }) {
  const [data, setData] = useState<{ canManage: boolean; suppliers: BookEntry[] } | null>(null);
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const load = () => api.get(`/suppliers/circle/${circleId}`).then(r => setData(r.data)).catch(() => setData({ canManage: false, suppliers: [] }));
  useEffect(() => { load(); }, [circleId]);
  async function run(a: () => Promise<unknown>) {
    setError('');
    try { await a(); await load(); return null; } catch (e) { const m = errOf(e); setError(m); return m; }
  }
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const all = data?.suppliers ?? [];
  const list = all.filter(s => (archived || !s.archived) && (!q.trim() || norm(`${s.name} ${s.contactName ?? ''}`).includes(norm(q.trim()))));
  return (
    <Modal title={t('suppliers.book.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{t('suppliers.book.intro')}</p>
        {data && all.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">{t('suppliers.book.empty')}</p>}
        {all.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('suppliers.book.search')} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
            {all.some(s => s.archived) && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600 flex-shrink-0">
                <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} className="accent-indigo-600" />{t('suppliers.book.showArchived')}
              </label>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {list.map(s => (
            <li key={s.id} className={`rounded-xl border border-slate-200 bg-white ${s.archived ? 'opacity-60' : ''}`}>
              <button onClick={() => { setOpenId(openId === s.id ? null : s.id); setEditId(null); }} className="w-full flex items-start gap-3 p-3 text-left">
                <span className="text-xl" aria-hidden>{CATEGORY_EMOJI[s.category] ?? '📇'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{s.name}{s.archived && <span className="ml-2 text-[11px] font-normal text-slate-500">{t('suppliers.book.archived')}</span>}</span>
                  <span className="block text-xs text-slate-500">{t(`suppliers.categories.${s.category}`)}{s.contactName ? ` · ${s.contactName}` : ''}</span>
                </span>
                <ChevronDown size={16} className={`mt-1 text-slate-400 transition-transform ${openId === s.id ? 'rotate-180' : ''}`} />
              </button>
              {openId === s.id && (
                <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-3">
                  {editId === s.id ? (
                    <SupplierForm initial={s} submitLabel={t('suppliers.book.save')} onCancel={() => setEditId(null)}
                      onSubmit={async f => { const err = await run(() => api.put(`/suppliers/${s.id}`, f)); if (!err) setEditId(null); return err; }} />
                  ) : (
                    <>
                      <ContactLinks s={s} />
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('suppliers.book.history')}</p>
                        {s.uses.length === 0 ? <p className="text-xs text-slate-400">{t('suppliers.book.noHistory')}</p> : (
                          <ul className="text-xs text-slate-600 space-y-0.5">
                            {s.uses.map((u, i) => (
                              <li key={i}>{u.planTitle}{u.eventDate ? ` · ${fmtDate(u.eventDate)}` : ''} · {u.status === 'on_hold' ? t('suppliers.onHold') : t(`suppliers.statuses.${u.status as Status}`)}{u.total != null ? ` · ${money(u.total, u.currency)}` : ''}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {s.canEdit && (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setEditId(s.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"><Pencil size={13} />{t('suppliers.book.edit')}</button>
                          <button onClick={() => run(() => api.post(`/suppliers/${s.id}/archive`, { archived: !s.archived }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                            {s.archived ? <RotateCcw size={13} /> : <Archive size={13} />}{s.archived ? t('suppliers.book.unarchive') : t('suppliers.book.archive')}
                          </button>
                          <button onClick={() => { if (confirm(t('suppliers.book.deleteConfirm', { name: s.name }))) run(() => api.delete(`/suppliers/${s.id}`)); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50"><X size={13} />{t('suppliers.book.delete')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
