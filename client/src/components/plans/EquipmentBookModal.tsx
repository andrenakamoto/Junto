import { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, ChevronDown, ChevronRight, MapPin, Package, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { Modal } from '../ui/Modal';
import { useResync } from '../../hooks/useResync';
import type { Booking } from './EquipmentTab';
import { ReturnModal, personName } from './EquipmentTab';

// Inventaire du matériel (2026-11-13) : celui de l'Organisation du Cercle, sinon du Cercle. Où est chaque objet
// (au rangement ou chez qui), prochaines réservations, historique. L'organisation ajoute, modifie, archive ;
// elle peut aussi enregistrer un retour (tournée de récupération). Serveur : GET /api/equipment/circle/:circleId.

const CATEGORIES = ['sono', 'lumiere', 'mobilier', 'cuisine', 'tentes', 'sport', 'deco', 'informatique', 'outils', 'autre'] as const;
interface Item {
  id: string; name: string; category: string; quantity: number; location: string | null; notes: string | null; status: 'ok' | 'repair' | 'out';
  archived: boolean; out: Booking[]; upcoming: Booking[]; history: Booking[];
}
const fmtDay = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const errorOf = (err: any) => err?.response?.data?.error || t('common.retryError');

export function EquipmentBookModal({ circleId, onClose, initialFilter = 'all' }: { circleId: string; onClose: () => void; initialFilter?: 'all' | 'out' }) {
  const [data, setData] = useState<{ canManage: boolean; scope: 'organisation' | 'circle'; items: Item[] } | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'out'>(initialFilter);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Item> | null>(null);
  const [returning, setReturning] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    try { setData((await api.get(`/equipment/circle/${circleId}`)).data); setError(''); }
    catch (err) { setError(errorOf(err)); }
  }, [circleId]);
  useEffect(() => { load(); }, [load]);
  useResync(load);

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(errorOf(err)); }
  }

  const items = (data?.items ?? [])
    .filter(i => showArchived || !i.archived)
    .filter(i => filter === 'all' || i.out.length > 0)
    .filter(i => !q.trim() || norm(`${i.name} ${i.location ?? ''} ${t(`equipment.categories.${i.category}` as any)}`).includes(norm(q.trim())));
  const groups = CATEGORIES.map(c => ({ c, list: items.filter(i => i.category === c) })).filter(g => g.list.length);
  const title = data?.scope === 'organisation' ? t('equipment.inventory.titleOrg') : t('equipment.inventory.title');

  return (
    <Modal title={title} onClose={onClose} wide>
      {!data ? <p className="text-sm text-slate-400">{error || '…'}</p> : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{data.scope === 'organisation' ? t('equipment.inventory.helpOrg') : t('equipment.inventory.help')}{!data.canManage ? ` ${t('equipment.inventory.readOnly')}` : ''}</p>
          <div className="flex flex-wrap items-center gap-2">
            {data.canManage && (
              <button onClick={() => setForm({ category: 'autre', quantity: 1, status: 'ok' })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"><Plus size={15} />{t('equipment.inventory.add')}</button>
            )}
            {(['all', 'out'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${filter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                {f === 'all' ? t('equipment.inventory.filterAll') : t('equipment.inventory.filterOut')}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="accent-indigo-600" />{t('equipment.inventory.showArchived')}
            </label>
          </div>
          {(data.items.length > 6) && (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white">
              <Search size={15} className="text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('equipment.search')} className="flex-1 text-sm outline-none" />
            </label>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {data.items.length === 0 ? <p className="text-sm text-slate-500 py-2">{t('equipment.inventory.empty')}</p>
            : groups.length === 0 ? <p className="text-sm text-slate-500 py-2">{t('equipment.inventory.noMatch')}</p> : groups.map(g => (
            <section key={g.c}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{t(`equipment.categories.${g.c}` as any)}</h3>
              <div className="space-y-1.5">
                {g.list.map(i => {
                  const isOpen = open === i.id;
                  const outQty = i.out.reduce((n, b) => n + b.quantity, 0);
                  const late = i.out.some(b => b.late);
                  return (
                    <div key={i.id} className={`rounded-xl border bg-white ${late ? 'border-red-200' : 'border-slate-200'} ${i.archived ? 'opacity-60' : ''}`}>
                      <button onClick={() => setOpen(isOpen ? null : i.id)} className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left">
                        <Package size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-800">{i.name} <span className="text-slate-400 font-normal">· {t('equipment.inventory.total', { count: i.quantity })}</span></span>
                          <span className="block text-xs text-slate-500">
                            {outQty > 0
                              ? i.out.map(b => t('equipment.inventory.outWith', { count: b.quantity, who: personName(b.takenBy), plan: b.planTitle }) + (b.late ? ` (${t('equipment.inventory.late')})` : '')).join(' · ')
                              : <span className="inline-flex items-center gap-1"><MapPin size={11} />{i.location || t('equipment.inventory.here')}</span>}
                          </span>
                        </span>
                        {i.status !== 'ok' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">{t(`equipment.inventory.statuses.${i.status}` as any)}</span>}
                        {i.archived && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">{t('equipment.inventory.archived')}</span>}
                        {isOpen ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 pl-9 space-y-2.5 text-xs text-slate-600">
                          {i.location && <p className="flex items-center gap-1"><MapPin size={12} />{i.location}</p>}
                          {i.notes && <p className="whitespace-pre-wrap">{i.notes}</p>}
                          {i.out.map(b => (
                            <div key={b.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${b.late ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-800'}`}>
                              <span className="flex-1">{t('equipment.inventory.outWith', { count: b.quantity, who: personName(b.takenBy), plan: b.planTitle })} · {fmtDay(b.endsAt)}</span>
                              {data.canManage && <button onClick={() => setReturning(b)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white font-semibold"><CheckCircle2 size={12} />{t('equipment.give')}</button>}
                            </div>
                          ))}
                          {i.upcoming.length > 0 && (
                            <div>
                              <p className="font-semibold text-slate-700 mb-0.5">{t('equipment.inventory.upcoming')}</p>
                              {i.upcoming.map(b => <p key={b.id}>{fmtDay(b.startsAt)} · {b.quantity} × « {b.planTitle} »</p>)}
                            </div>
                          )}
                          {i.history.length > 0 && (
                            <div>
                              <p className="font-semibold text-slate-700 mb-0.5">{t('equipment.inventory.history')}</p>
                              {i.history.map(b => (
                                <p key={b.id}>{fmtDay(b.returnedAt!)} · {b.quantity} × « {b.planTitle} » · {personName(b.takenBy)}{b.returnState && b.returnState !== 'ok' ? ` · ${t(`equipment.returnStates.${b.returnState}` as any, { count: b.missing })}` : ''}</p>
                              ))}
                            </div>
                          )}
                          {data.canManage && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button onClick={() => setForm(i)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold"><Pencil size={12} />{t('equipment.edit')}</button>
                              <button onClick={() => act(() => api.put(`/equipment/items/${i.id}`, { archived: !i.archived, circleId }))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                                {i.archived ? <><RotateCcw size={12} />{t('equipment.inventory.unarchive')}</> : <><Archive size={12} />{t('equipment.inventory.archive')}</>}
                              </button>
                              <button onClick={() => { if (confirm(t('equipment.inventory.confirmDelete'))) act(() => api.delete(`/equipment/items/${i.id}`, { data: { circleId } })); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 font-semibold"><Trash2 size={12} />{t('equipment.inventory.delete')}</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {form && <ItemForm circleId={circleId} item={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      {returning && <ReturnModal booking={returning} onClose={() => setReturning(null)} onDone={() => { setReturning(null); load(); }} />}
    </Modal>
  );
}

function ItemForm({ circleId, item, onClose, onSaved }: { circleId: string; item: Partial<Item>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item.name ?? '');
  const [category, setCategory] = useState(item.category ?? 'autre');
  const [quantity, setQuantity] = useState(String(item.quantity ?? 1));
  const [location, setLocation] = useState(item.location ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [status, setStatus] = useState(item.status ?? 'ok');
  const [error, setError] = useState('');
  const field = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm';
  async function save() {
    if (!name.trim()) { setError(t('equipment.inventory.namePlaceholder')); return; }
    const body = { name, category, quantity: Number(quantity), location, notes, status, circleId };
    try {
      if (item.id) await api.put(`/equipment/items/${item.id}`, body);
      else await api.post(`/equipment/circle/${circleId}/items`, body);
      onSaved();
    } catch (err) { setError(errorOf(err)); }
  }
  return (
    <Modal title={item.id ? item.name ?? '' : t('equipment.inventory.add')} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.name')}</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder={t('equipment.inventory.namePlaceholder')} className={field} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.category')}</span>
            <select value={category} onChange={e => setCategory(e.target.value)} className={field}>
              {CATEGORIES.map(c => <option key={c} value={c}>{t(`equipment.categories.${c}` as any)}</option>)}
            </select></label>
          <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.quantity')}</span>
            <input type="number" min={1} max={9999} value={quantity} onChange={e => setQuantity(e.target.value)} className={field} /></label>
        </div>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.location')}</span>
          <input value={location} onChange={e => setLocation(e.target.value)} maxLength={120} placeholder={t('equipment.inventory.locationPlaceholder')} className={field} /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.notes')}</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2} placeholder={t('equipment.inventory.notesPlaceholder')} className={field} /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1">{t('equipment.inventory.status')}</span>
          <select value={status} onChange={e => setStatus(e.target.value as Item['status'])} className={field}>
            {(['ok', 'repair', 'out'] as const).map(s => <option key={s} value={s}>{t(`equipment.inventory.statuses.${s}` as any)}</option>)}
          </select></label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={save} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('equipment.save')}</button>
      </div>
    </Modal>
  );
}
