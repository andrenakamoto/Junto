import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Clock, Copy, FileDown, HandHeart, MapPin, Pencil, Pin, Plus, Timer, Trash2, Wrench } from 'lucide-react';
import { Plan, ProgramItem, VolunteerShift } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { hasFeature } from '../../lib/settings';
import { saveFile } from '../../lib/saveFile';
import { useResync } from '../../hooks/useResync';
import { Modal } from '../ui/Modal';
import { intlLocale, t } from '../../i18n';

// Déroulé d'un Plan (fonction « deroule ») : les moments de l'événement dans l'ordre, chacun avec sa durée ; les
// heures sont calculées par le serveur (routes/program.ts). Le soir même : moment en cours mis en évidence,
// « +15 min ». Copier le programme (heures et titres) et feuille de route PDF.

type Person = { id: string; pseudo: string; firstName?: string | null };
type Data = { items: ProgramItem[]; people: Person[]; canManage: boolean };

const timeFmt = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
const hm = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '—');
const personName = (p: Person) => displayName(p) || `@${p.pseudo}`;
const pad = (n: number) => String(n).padStart(2, '0');

export function ProgramTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [shifts, setShifts] = useState<VolunteerShift[]>([]);
  const [form, setForm] = useState<{ item?: ProgramItem; afterId?: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      setData((await api.get(`/plans/${plan.id}/program`)).data);
      if (hasFeature(plan, 'benevoles')) setShifts((await api.get(`/plans/${plan.id}/shifts`)).data.shifts ?? []);
    } catch {
      setData(d => d ?? { items: [], people: [], canManage: false });
    }
  }
  useEffect(() => { load(); }, [plan]);
  useResync(load);
  // Le moment en cours change avec l'heure
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

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

  const live = useMemo(() => {
    if (!data) return null;
    const timed = data.items.filter(i => i.start && i.end);
    const current = timed.find(i => +new Date(i.start!) <= now && now < +new Date(i.end!));
    const next = timed.find(i => +new Date(i.start!) > now);
    return { current, next };
  }, [data, now]);

  if (!data || !live) return <div className="flex-1 bg-slate-50" />;
  const { items, people, canManage } = data;
  const first = items.find(i => i.start);
  const last = [...items].reverse().find(i => i.end);
  // Pendant l'événement, ou dans l'heure qui précède
  const soon = !live.current && live.next && +new Date(live.next.start!) - now < 60 * 60e3 && (!first || +new Date(first.start!) - now < 60 * 60e3);

  // Postes du Planning qui chevauchent un moment
  const shiftsFor = (i: ProgramItem) => {
    if (!i.start || !i.end) return [];
    const a = +new Date(i.start), b = +new Date(i.end);
    return shifts.filter(s => s.needed > 0 && s.startsAt && s.signups.length > 0 && +new Date(s.startsAt) < b && (s.endsAt ? +new Date(s.endsAt) : +new Date(s.startsAt)) > a);
  };

  async function copyProgram() {
    const day = first?.start ? dayFmt.format(new Date(first.start)) : '';
    const lines = items.map(i => `${i.start ? hm(i.start) : '—'}  ${i.title}`);
    const txt = [plan.title, day, '', ...lines].filter((l, k) => k === 2 || l).join('\n');
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function downloadPdf() {
    try {
      const res = await api.get(`/plans/${plan.id}/program/pdf`, { responseType: 'blob' });
      const name = `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - ${t('program.pdfFile')}.pdf`;
      await saveFile(res.data, name, t('program.pdfTitle', { title: plan.title }));
    } catch {
      setError(t('common.retryError'));
    }
  }

  async function addStarter() {
    for (const entry of t('program.starterList').split(';')) {
      const [title, minutes] = entry.split('|');
      if (!(await run(() => api.post(`/plans/${plan.id}/program`, { title, durationMin: Number(minutes) })))) break;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* En ce moment (le soir même) */}
      {(live.current || soon) && (
        <div className="p-3.5 rounded-xl bg-indigo-600 text-white shadow-md">
          {live.current ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{t('program.now')}</p>
              <div className="flex items-start gap-2 mt-0.5">
                <p className="flex-1 min-w-0 text-lg font-bold leading-tight break-words">{live.current.title}</p>
                <button onClick={() => run(() => api.post(`/plans/program/${live.current!.id}/delay`, { minutes: 15, mode: 'extend' }))} title={t('program.extendHint')}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-indigo-700 text-sm font-bold hover:bg-indigo-50"><Timer size={15} />{t('program.extend')}</button>
              </div>
              <p className="text-sm opacity-90 mt-0.5">{t('program.until', { time: hm(live.current.end) })}</p>
              {live.next && <p className="text-sm mt-2 pt-2 border-t border-white/25">{t('program.next', { title: live.next.title, time: hm(live.next.start) })}</p>}
            </>
          ) : (
            <p className="text-sm font-semibold">{t('program.startsIn', { minutes: Math.max(1, Math.round((+new Date(live.next!.start!) - now) / 60000)), title: live.next!.title })}</p>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2.5">
          <p className="text-sm font-semibold text-slate-800">
            {first && last ? t('program.summary', { count: items.length, start: hm(first.start), end: hm(last.end) }) : t('program.noStart')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyProgram} title={t('program.copyHint')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}{copied ? t('program.copied') : t('program.copy')}
            </button>
            <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              <FileDown size={14} />{t('program.pdf')}
            </button>
          </div>
          {copied && <p className="text-[11px] text-slate-500">{t('program.copyHint')}</p>}
        </div>
      )}

      <button onClick={() => setForm({})}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors">
        <Plus size={16} />{t('program.add')}
      </button>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {items.length === 0 && (
        <div className="text-center px-4 py-6 space-y-3">
          <p className="font-semibold text-slate-700">{t('program.emptyTitle')}</p>
          <p className="text-sm text-slate-500">{t('program.emptyText')}</p>
          <button onClick={addStarter} className="px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50">{t('program.starter')}</button>
          <p className="text-xs text-slate-400">{t('program.starterList').split(';').map(e => e.split('|')[0]).join(' · ')}</p>
        </div>
      )}

      {/* Frise : l'heure à gauche, le moment à droite */}
      <ol className="relative">
        {items.map((i, k) => {
          const current = live.current?.id === i.id;
          const past = !!i.end && +new Date(i.end) <= now && !current;
          const open = openId === i.id;
          const team = shiftsFor(i);
          return (
            <li key={i.id} className={`relative flex gap-3 pb-3 ${past && !open ? 'opacity-55' : ''}`}>
              <div className="w-14 flex-shrink-0 text-right pt-2.5">
                <p className={`text-sm font-bold tabular-nums ${current ? 'text-indigo-600' : 'text-slate-800'}`}>{hm(i.start)}</p>
                {i.end && <p className="text-[11px] text-slate-400 tabular-nums">{hm(i.end)}</p>}
              </div>
              <div className="relative flex flex-col items-center pt-3.5">
                <span className={`w-3 h-3 rounded-full border-2 ${current ? 'bg-indigo-600 border-indigo-600 ring-4 ring-indigo-100' : past ? 'bg-slate-300 border-slate-300' : 'bg-white border-indigo-400'}`} />
                {k < items.length - 1 && <span className="flex-1 w-0.5 bg-slate-200 mt-1" />}
              </div>
              <div className={`flex-1 min-w-0 rounded-xl border shadow-sm ${current ? 'bg-white border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-slate-200'}`}>
                <button onClick={() => setOpenId(open ? null : i.id)} className="w-full text-left p-3">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 min-w-0 text-sm font-semibold text-slate-800 break-words">{i.title}</p>
                    {current && <span className="flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">{t('program.now')}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600"><Clock size={10} />{t('program.minutes', { count: i.durationMin })}</span>
                    {i.fixedStart && <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800"><Pin size={10} />{t('program.fixed')}</span>}
                    {i.place && <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700"><MapPin size={10} />{i.place}</span>}
                    {i.assignees.map(a => (
                      <span key={a.userId} className={`text-[11px] px-1.5 py-0.5 rounded-full ${a.userId === userId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{personName(a.user)}</span>
                    ))}
                  </div>
                  {i.tech && <p className="flex items-start gap-1.5 text-xs text-slate-600 mt-1.5"><Wrench size={12} className="flex-shrink-0 mt-0.5 text-slate-400" /><span className="whitespace-pre-wrap break-words">{i.tech}</span></p>}
                  {i.note && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap break-words">{i.note}</p>}
                  {team.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {team.map(s => (
                        <p key={s.id} className="flex items-start gap-1.5 text-xs text-emerald-700"><HandHeart size={12} className="flex-shrink-0 mt-0.5" />
                          <span><span className="font-semibold">{s.title}</span> : {s.signups.map(x => displayName(x.user) || `@${x.user.pseudo}`).join(', ')}</span></p>
                      ))}
                    </div>
                  )}
                </button>
                {open && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-2 border-t border-slate-100">
                    <button disabled={k === 0} onClick={() => run(() => api.post(`/plans/program/${i.id}/move`, { dir: 'up' }))} title={t('program.moveUp')} aria-label={t('program.moveUp')}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button disabled={k === items.length - 1} onClick={() => run(() => api.post(`/plans/program/${i.id}/move`, { dir: 'down' }))} title={t('program.moveDown')} aria-label={t('program.moveDown')}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ArrowDown size={14} /></button>
                    {i.start && (
                      <button onClick={() => run(() => api.post(`/plans/program/${i.id}/delay`, { minutes: 15, mode: current ? 'extend' : 'shift' }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100">
                        <Timer size={13} />{current ? t('program.extend') : t('program.shift')}
                      </button>
                    )}
                    <button onClick={() => setForm({ afterId: i.id })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                      <Plus size={13} />{t('program.addAfter')}
                    </button>
                    <span className="flex-1" />
                    <button onClick={() => setForm({ item: i })} title={t('program.edit')} aria-label={t('program.edit')} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={15} /></button>
                    {(i.createdById === userId || canManage) && (
                      <button onClick={() => { if (confirm(t('program.deleteConfirm', { title: i.title }))) run(() => api.delete(`/plans/program/${i.id}`)); }} title={t('program.delete')} aria-label={t('program.delete')}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {form && (
        <ProgramForm plan={plan} item={form.item} people={people} onCancel={() => setForm(null)}
          onSubmit={async body => {
            const ok = await run(() => form.item ? api.put(`/plans/program/${form.item.id}`, body) : api.post(`/plans/${plan.id}/program`, { ...body, afterId: form.afterId }));
            if (ok) setForm(null);
          }} />
      )}
    </div>
  );
}

const DURATIONS = [5, 10, 15, 30, 45, 60, 90, 120];

function ProgramForm({ plan, item, people, onSubmit, onCancel }: {
  plan: Plan; item?: ProgramItem; people: Person[]; onSubmit: (body: object) => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [duration, setDuration] = useState(String(item?.durationMin ?? 30));
  const [fixed, setFixed] = useState(!!item?.fixedStart);
  const initial = item?.fixedStart ?? item?.start ?? plan.eventDate;
  const [time, setTime] = useState(initial ? (() => { const d = new Date(initial); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; })() : '19:00');
  const [place, setPlace] = useState(item?.place ?? '');
  const [assignees, setAssignees] = useState<string[]>(item?.assignees.map(a => a.userId) ?? []);
  const [tech, setTech] = useState(item?.tech ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

  // Heure fixe : le jour du Plan ; une heure très en avance sur le début (après minuit) passe au lendemain
  function fixedIso() {
    const base = plan.eventDate ? new Date(plan.eventDate) : new Date();
    const [h, m] = time.split(':').map(Number);
    const d = new Date(base); d.setHours(h, m, 0, 0);
    if (plan.eventDate && d.getTime() < base.getTime() - 6 * 3600e3) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setMissing(true); return; }
    setBusy(true);
    await onSubmit({ title, durationMin: Math.max(0, Math.round(Number(duration) || 0)), fixedStart: fixed ? fixedIso() : null, place, tech, note, assigneeIds: assignees });
    setBusy(false);
  }

  return (
    <Modal title={item ? t('program.form.editTitle') : t('program.form.newTitle')} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.title')}</label>
          <input autoFocus value={title} maxLength={120} onChange={e => { setTitle(e.target.value); setMissing(false); }} placeholder={t('program.form.titlePlaceholder')} className={input} />
          {missing && <p className="text-xs text-red-500 mt-1">{t('program.form.titleRequired')}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.duration')}</label>
          <div className="flex flex-wrap items-center gap-1.5">
            <input type="number" min={0} max={1440} value={duration} onChange={e => setDuration(e.target.value)} className={`w-20 ${input}`} />
            {DURATIONS.map(d => (
              <button type="button" key={d} onClick={() => setDuration(String(d))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${duration === String(d) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={fixed} onChange={e => setFixed(e.target.checked)} className="accent-indigo-600" />
            {t('program.form.fixed')}
            {fixed && <input type="time" value={time} onChange={e => setTime(e.target.value)} className="ml-1 px-2 py-1 rounded-lg border border-slate-300 text-sm" />}
          </label>
          <p className="text-[11px] text-slate-400 mt-1">{t('program.form.fixedHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.place')}</label>
          <input value={place} maxLength={100} onChange={e => setPlace(e.target.value)} placeholder={t('program.form.placePlaceholder')} className={input} />
        </div>
        {people.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.assignees')}</label>
            <div className="flex flex-wrap gap-1.5">
              {people.map(p => (
                <button type="button" key={p.id} aria-pressed={assignees.includes(p.id)}
                  onClick={() => setAssignees(a => a.includes(p.id) ? a.filter(x => x !== p.id) : [...a, p.id])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${assignees.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {personName(p)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{t('program.form.assigneesHint')}</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.tech')}</label>
          <textarea rows={2} value={tech} maxLength={1000} onChange={e => setTech(e.target.value)} placeholder={t('program.form.techPlaceholder')} className={`${input} resize-none`} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('program.form.note')}</label>
          <textarea rows={2} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder={t('program.form.notePlaceholder')} className={`${input} resize-none`} />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {item ? t('program.form.save') : t('program.form.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
