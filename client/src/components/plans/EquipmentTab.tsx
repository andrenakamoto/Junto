import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Boxes, CheckCircle2, Clock, Minus, Package, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import api from '../../services/api';
import { Plan } from '../../types';
import { intlLocale, t } from '../../i18n';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useResync } from '../../hooks/useResync';
import { Modal } from '../ui/Modal';
import { DateTimeField } from '../ui/DateTimeField';
import { isoToLocal, localToISO } from './PlanFormParts';
import { EquipmentBookModal } from './EquipmentBookModal';

// Rubrique « Matériel » d'un Plan (fonction « materiel », 2026-11-13) : réserver le matériel de l'inventaire
// (Organisation ou Cercle), le prendre (« Je le prends »), le rendre (« Rendu », état). Serveur : routes/equipment.ts.

export interface Booking {
  id: string; itemId: string; item: { id: string; name: string; category: string; location: string | null };
  quantity: number; startsAt: string; endsAt: string; planId: string | null; planTitle: string; circleId: string; createdById: string | null;
  takenBy: { id: string; pseudo: string; firstName: string | null } | null; takenAt: string | null;
  returnedAt: string | null; returnState: 'ok' | 'damaged' | 'missing' | null; missing: number; returnNote: string | null; late: boolean;
}
interface InventoryItem { id: string; name: string; category: string; quantity: number; location: string | null; status: string; available: number; busyIn: { planTitle: string; quantity: number }[] }
interface Data {
  period: { startsAt: string; endsAt: string };
  hasInventory: boolean; canManageInventory: boolean; canBook: boolean; canManagePlan: boolean;
  bookings: Booking[]; inventory: InventoryItem[];
}

const fmt = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const fmtDay = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(iso));
export const personName = (p: { pseudo: string; firstName: string | null } | null) => (p ? (p.firstName ? `${p.firstName} (@${p.pseudo})` : `@${p.pseudo}`) : '?');
const errorOf = (err: any) => err?.response?.data?.error || t('common.retryError');

export function EquipmentTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [returning, setReturning] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [inventory, setInventory] = useState(false);
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData((await api.get(`/plans/${plan.id}/equipment`)).data); }
    catch (err) { setError(errorOf(err)); }
  }, [plan.id]);
  useEffect(() => { load(); }, [load]);
  useResync(load);
  useSocketEvent<{ planId: string }>('plan-updated', p => { if (p.planId === plan.id) load(); });

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError('');
    try { await fn(); await load(); } catch (err) { setError(errorOf(err)); } finally { setBusy(null); }
  }

  if (!data) return <div className="flex-1 bg-slate-50" />;
  const canEdit = (b: Booking) => data.canManagePlan || data.canManageInventory || b.createdById === userId;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <p className="text-sm text-slate-600">{t('equipment.intro')}</p>
      {!data.hasInventory ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3">{t('equipment.personal')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.canBook && data.inventory.length > 0 && (
            <button onClick={() => { setWarning(''); setAdding(true); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
              <Plus size={16} />{t('equipment.add')}
            </button>
          )}
          <button onClick={() => setInventory(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Boxes size={16} className="text-slate-500" />{t('equipment.openInventory')}
          </button>
        </div>
      )}
      {data.hasInventory && data.inventory.length === 0 && (
        <p className="text-sm text-slate-500">{data.canManageInventory ? t('equipment.noInventoryManager') : t('equipment.noInventory')}</p>
      )}
      {warning && <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{warning}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {data.bookings.length === 0 ? (data.hasInventory && data.inventory.length > 0 && <p className="text-sm text-slate-400 italic">{t('equipment.empty')}</p>) : (
        <div className="space-y-2">
          {data.bookings.map(b => {
            const status = b.returnedAt ? 'returned' : b.late ? 'late' : b.takenAt ? 'out' : 'planned';
            const badge = { planned: 'bg-slate-100 text-slate-600', out: 'bg-sky-100 text-sky-700', returned: 'bg-emerald-100 text-emerald-700', late: 'bg-red-100 text-red-700' }[status];
            return (
              <div key={b.id} className={`rounded-xl border bg-white p-3 shadow-sm ${status === 'late' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <Package size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 break-words">{b.quantity > 1 ? `${b.quantity} × ` : ''}{b.item.name}</p>
                    <p className="text-xs text-slate-500">
                      {t(`equipment.categories.${b.item.category}` as any)}{b.item.location ? ` · ${b.item.location}` : ''}
                    </p>
                    {!b.returnedAt && <p className="text-xs text-slate-600 mt-0.5">{t('equipment.datesLine', { from: fmt(b.startsAt), to: fmt(b.endsAt) })}</p>}
                    {b.takenAt && !b.returnedAt && <p className="text-xs text-slate-600 mt-1">{t('equipment.outBy', { who: personName(b.takenBy), date: fmtDay(b.takenAt) })}</p>}
                    {b.returnedAt && (
                      <p className="text-xs text-slate-600 mt-1">
                        {t('equipment.returnedOn', { date: fmtDay(b.returnedAt) })}{b.returnState ? ` · ${t(`equipment.returnStates.${b.returnState}` as any, { count: b.missing })}` : ''}
                        {b.returnNote ? ` · « ${b.returnNote} »` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>{t(`equipment.status.${status}` as any)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 pl-8">
                  {!b.returnedAt && !b.takenAt && data.canBook && (
                    <button disabled={busy === b.id} onClick={() => act(b.id, () => api.post(`/equipment/bookings/${b.id}/take`))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50"><ArrowRightLeft size={13} />{t('equipment.take')}</button>
                  )}
                  {!b.returnedAt && (b.takenAt || data.canBook) && (
                    <button disabled={busy === b.id} onClick={() => setReturning(b)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={13} />{t('equipment.give')}</button>
                  )}
                  {b.returnedAt && (canEdit(b) || b.takenBy?.id === userId) && (
                    <button disabled={busy === b.id} onClick={() => act(b.id, () => api.post(`/equipment/bookings/${b.id}/undo-return`))}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><Undo2 size={13} />{t('equipment.undo')}</button>
                  )}
                  <span className="flex-1" />
                  {!b.takenAt && !b.returnedAt && canEdit(b) && (
                    <>
                      <button onClick={() => setEditing(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title={t('equipment.edit')} aria-label={t('equipment.edit')}><Pencil size={15} /></button>
                      <button disabled={busy === b.id} onClick={() => { if (confirm(t('equipment.confirmRemove'))) act(b.id, () => api.delete(`/plans/equipment/${b.id}`)); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title={t('equipment.remove')} aria-label={t('equipment.remove')}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && <BookModal plan={plan} data={data} onClose={() => setAdding(false)} onBooked={w => { setAdding(false); setWarning(w); load(); }} />}
      {editing && <EditBookingModal booking={editing} max={data.inventory.find(i => i.id === editing.itemId)?.quantity ?? editing.quantity} onClose={() => setEditing(null)}
        onSaved={short => { setEditing(null); setWarning(short > 0 ? t('equipment.shortBy', { count: short }) : ''); load(); }} />}
      {returning && <ReturnModal booking={returning} onClose={() => setReturning(null)} onDone={() => { setReturning(null); load(); }} />}
      {inventory && <EquipmentBookModal circleId={plan.circleId} onClose={() => { setInventory(false); load(); }} />}
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const btn = 'w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:border-indigo-400 disabled:opacity-30';
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={btn} disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="−"><Minus size={14} /></button>
      <input type="number" min={1} max={max} value={value} onChange={e => onChange(Math.max(1, Math.min(max, Number(e.target.value) || 1)))}
        className="w-16 text-center px-2 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold" />
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="+"><Plus size={14} /></button>
    </span>
  );
}

function PeriodFields({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
      <DateTimeField className="min-w-0" label={t('equipment.from')} value={start} onChange={onStart} />
      <DateTimeField className="min-w-0" label={t('equipment.to')} value={end} onChange={onEnd} />
    </div>
  );
}

// Réserver (2026-11-14) : les dates de prise et de retour d'abord, valables pour tout le matériel coché ; chaque objet peut avoir
// les siennes (« Autres dates pour cet objet »). Les disponibilités sont recalculées pour les dates choisies.
interface Pick { quantity: number; own: boolean; start: string; end: string }
function BookModal({ plan, data, onClose, onBooked }: { plan: Plan; data: Data; onClose: () => void; onBooked: (warning: string) => void }) {
  // Dates proposées : celles de la dernière réservation du Plan (souvent les mêmes), sinon celles du Plan
  const last = data.bookings.filter(b => !b.returnedAt).slice(-1)[0];
  const [start, setStart] = useState(isoToLocal(last?.startsAt ?? data.period.startsAt));
  const [end, setEnd] = useState(isoToLocal(last?.endsAt ?? data.period.endsAt));
  const [inventory, setInventory] = useState(data.inventory);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const datesOk = !!start && !!end && localToISO(end) > localToISO(start);

  // Disponibilités sur les dates choisies
  useEffect(() => {
    if (!datesOk) return;
    const id = setTimeout(() => {
      api.get(`/plans/${plan.id}/equipment`, { params: { from: localToISO(start), to: localToISO(end) } })
        .then(r => setInventory(r.data.inventory)).catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [plan.id, start, end, datesOk]);

  const list = inventory.filter(i => !q.trim() || norm(`${i.name} ${t(`equipment.categories.${i.category}` as any)}`).includes(norm(q.trim())));
  const chosen = Object.entries(picks);
  const toggle = (i: InventoryItem) => setPicks(p => {
    const next = { ...p };
    if (next[i.id]) delete next[i.id];
    else next[i.id] = { quantity: Math.max(1, Math.min(i.available || 1, i.quantity)), own: false, start, end };
    return next;
  });
  const update = (id: string, patch: Partial<Pick>) => setPicks(p => ({ ...p, [id]: { ...p[id], ...patch } }));

  async function submit() {
    if (!chosen.length) { setError(t('equipment.selectNone')); return; }
    if (!datesOk) { setError(t('common.retryError')); return; }
    setSending(true); setError('');
    try {
      const { data: r } = await api.post(`/plans/${plan.id}/equipment/batch`, {
        startsAt: localToISO(start), endsAt: localToISO(end),
        items: chosen.map(([itemId, x]) => ({ itemId, quantity: x.quantity, ...(x.own ? { startsAt: localToISO(x.start), endsAt: localToISO(x.end) } : {}) })),
      });
      const short: { name: string; shortBy: number }[] = r.short ?? [];
      onBooked(short.length ? t('equipment.shortList', { list: short.map(x => `${x.name} (${x.shortBy})`).join(', ') }) : '');
    } catch (err) { setError(errorOf(err)); } finally { setSending(false); }
  }

  return (
    <Modal title={t('equipment.add')} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('equipment.period')}</p>
          <PeriodFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
          <p className="text-xs text-slate-500">{t('equipment.datesHint')}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('equipment.choose')}</p>
          {inventory.length > 6 && (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white">
              <Search size={15} className="text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('equipment.search')} className="flex-1 text-sm outline-none" />
            </label>
          )}
          <div className="space-y-1.5">
            {list.map(i => {
              const p = picks[i.id];
              const usable = i.status === 'ok';
              return (
                <div key={i.id} className={`rounded-xl border bg-white ${p ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'} ${usable ? '' : 'opacity-50'}`}>
                  <label className={`flex items-start gap-2.5 px-3 py-2.5 ${usable ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={!!p} disabled={!usable} onChange={() => toggle(i)} className="mt-1 accent-indigo-600 w-4 h-4" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">{i.name}</span>
                        <span className={`text-xs font-semibold flex-shrink-0 ${i.available === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {!usable ? t(`equipment.inventory.statuses.${i.status}` as any) : i.available === 0 ? t('equipment.availableNone') : t('equipment.available', { count: i.available, total: i.quantity })}
                        </span>
                      </span>
                      <span className="block text-xs text-slate-500">{t(`equipment.categories.${i.category}` as any)}{i.location ? ` · ${i.location}` : ''}</span>
                      {i.busyIn.length > 0 && <span className="block text-[11px] text-amber-700 mt-0.5">{t('equipment.busyIn', { list: i.busyIn.map(b => `${b.planTitle} (${b.quantity})`).join(', ') })}</span>}
                    </span>
                  </label>
                  {p && (
                    <div className="px-3 pb-3 pl-9 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-600">{t('equipment.quantity')}</span>
                        <Stepper value={p.quantity} max={i.quantity} onChange={n => update(i.id, { quantity: n })} />
                      </div>
                      {!p.own && p.quantity > i.available && (
                        <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{t('equipment.shortBy', { count: p.quantity - i.available })}</p>
                      )}
                      <button type="button" onClick={() => update(i.id, { own: !p.own, start: p.own ? p.start : start, end: p.own ? p.end : end })} className="text-xs font-semibold text-indigo-600 hover:underline">
                        {p.own ? t('equipment.sameDates') : t('equipment.otherDates')}
                      </button>
                      {p.own && <PeriodFields start={p.start} end={p.end} onStart={v => update(i.id, { start: v })} onEnd={v => update(i.id, { end: v })} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">{t('equipment.cancel')}</button>
          <button onClick={submit} disabled={sending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
            {chosen.length ? t('equipment.bookCount', { count: chosen.length }) : t('equipment.book')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditBookingModal({ booking, max, onClose, onSaved }: { booking: Booking; max: number; onClose: () => void; onSaved: (shortBy: number) => void }) {
  const [quantity, setQuantity] = useState(booking.quantity);
  const [start, setStart] = useState(isoToLocal(booking.startsAt));
  const [end, setEnd] = useState(isoToLocal(booking.endsAt));
  const [error, setError] = useState('');
  async function save() {
    setError('');
    try {
      const { data } = await api.put(`/plans/equipment/${booking.id}`, { quantity, startsAt: localToISO(start), endsAt: localToISO(end) });
      onSaved(data.shortBy ?? 0);
    } catch (err) { setError(errorOf(err)); }
  }
  return (
    <Modal title={booking.item.name} onClose={onClose}>
      <div className="space-y-4">
        <div><p className="text-sm font-medium text-slate-700 mb-1.5">{t('equipment.quantity')}</p><Stepper value={quantity} max={max} onChange={setQuantity} /></div>
        <div><p className="text-sm font-medium text-slate-700 mb-1.5">{t('equipment.period')}</p><PeriodFields start={start} end={end} onStart={setStart} onEnd={setEnd} /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={save} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('equipment.save')}</button>
      </div>
    </Modal>
  );
}

export function ReturnModal({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [state, setState] = useState<'ok' | 'damaged' | 'missing'>('ok');
  const [missing, setMissing] = useState(1);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setSending(true); setError('');
    try { await api.post(`/equipment/bookings/${booking.id}/return`, { state, missing, note }); onDone(); }
    catch (err) { setError(errorOf(err)); } finally { setSending(false); }
  }
  return (
    <Modal title={t('equipment.returnTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">{booking.quantity > 1 ? `${booking.quantity} × ` : ''}{booking.item.name}</p>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-slate-700 mb-1.5">{t('equipment.returnState')}</legend>
          {(['ok', 'damaged', 'missing'] as const).map(s => (
            <label key={s} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${state === s ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
              <input type="radio" name="return-state" checked={state === s} onChange={() => setState(s)} className="accent-indigo-600" />
              <span className="text-sm text-slate-800">{t(`equipment.states.${s}` as any)}</span>
            </label>
          ))}
        </fieldset>
        {state === 'damaged' && <p className="text-xs text-slate-500">{t('equipment.damagedHint')}</p>}
        {state === 'missing' && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">{t('equipment.missingCount')}</p>
            <Stepper value={missing} max={booking.quantity} onChange={setMissing} />
            <p className="text-xs text-slate-500 mt-1.5">{t('equipment.missingHint')}</p>
          </div>
        )}
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.note')}</span>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={t('equipment.notePlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={submit} disabled={sending} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"><Clock size={15} className="hidden" />{t('equipment.confirmReturn')}</button>
      </div>
    </Modal>
  );
}
