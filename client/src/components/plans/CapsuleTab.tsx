import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ImagePlus, Lock, Mic, Square, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { useBackClose } from '../../lib/backClose';
import { useResync } from '../../hooks/useResync';
import { displayName } from '../../lib/names';
import { DateTimeField } from '../ui/DateTimeField';
import { Modal } from '../ui/Modal';
import { SavePhotoButton } from '../chat/SavePhotoButton';

// Capsule temporelle (serveur : routes/capsules.ts, lib/capsule.ts). Rubrique d'un Plan (fonction à activer `capsule`) et
// fenêtre ouverte depuis la colonne du Cercle (la capsule survit au Plan). Chacun dépose un mot, une photo ou un message
// vocal ; personne ne voit ceux des autres avant l'ouverture, faite en diaporama pour tout le groupe.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
type Person = { id: string; pseudo: string; firstName?: string | null };
type Deposit = { id: string; kind: 'text' | 'photo' | 'voice'; text: string | null; hasFile: boolean; seconds: number | null; createdAt: string; author: Person; mine: boolean };
export interface Capsule {
  id: string; title: string; circleId: string; planId: string | null; openAt: string; depositUntil: string; expiresAt: string;
  stage: 'open_for_deposits' | 'sealed' | 'opened'; depositCount: number; contributorCount: number; canManage: boolean; canDeposit: boolean;
  deposits: Deposit[]; mediaToken: string;
}
export interface CapsuleSummary { id: string; title: string; openAt: string; depositUntil: string; stage: Capsule['stage']; depositCount: number; expiresAt: string }

const fmt = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date(iso));
const fileUrl = (c: Capsule, d: Deposit) => `${API_BASE}/capsules/files/${d.id}?t=${encodeURIComponent(c.mediaToken)}`;
const errorOf = (e: any) => e?.response?.data?.error || t('common.retryError');
const addYear = (iso: string) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + 1); return d.toISOString(); };

// Boîte dessinée : fermée (cadenas), ouverte (couvercle soulevé)
function Box({ open, size = 96 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="drop-shadow-md">
      <rect x="14" y="44" width="72" height="46" rx="6" fill="#ea5a2b" />
      <rect x="14" y="44" width="72" height="10" fill="#c2410c" />
      <rect x="45" y="44" width="10" height="46" fill="#fdba74" />
      <g style={{ transformOrigin: '14px 40px', transform: open ? 'rotate(-28deg)' : 'none', transition: 'transform .6s' }}>
        <rect x="10" y="30" width="80" height="16" rx="5" fill="#f97316" />
        <rect x="45" y="30" width="10" height="16" fill="#fed7aa" />
      </g>
      {!open && <g><rect x="42" y="58" width="16" height="14" rx="3" fill="#0f172a" /><path d="M45 58v-4a5 5 0 0 1 10 0v4" stroke="#0f172a" strokeWidth="3" fill="none" /></g>}
      {open && ['✨', '💛', '📸'].map((e, i) => <text key={i} x={30 + i * 18} y={22 - (i % 2) * 8} fontSize="14">{e}</text>)}
    </svg>
  );
}

// Enregistreur de message vocal (2 minutes au plus)
function VoiceRecorder({ onDone }: { onDone: (blob: Blob, seconds: number) => void }) {
  const [rec, setRec] = useState<number | null>(null);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const stopAll = () => { if (timer.current) window.clearInterval(timer.current); stream.current?.getTracks().forEach(tr => tr.stop()); stream.current = null; };
  useEffect(() => () => { recorder.current?.state === 'recording' && recorder.current.stop(); stopAll(); }, []);
  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError(t('capsule.deposit.noRecorder')); return; }
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setError(t('capsule.deposit.allowMic')); return; }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(mt => MediaRecorder.isTypeSupported?.(mt));
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = []; const at = Date.now();
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => { stopAll(); setRec(null); const s = Math.round((Date.now() - at) / 1000); if (s >= 1 && chunks.length) onDone(new Blob(chunks, { type: (r.mimeType || type || 'audio/webm').split(';')[0] }), s); };
    recorder.current = r; r.start(); setRec(0);
    timer.current = window.setInterval(() => { const s = Math.round((Date.now() - at) / 1000); setRec(s); if (s >= 120) r.stop(); }, 500);
  }
  return (
    <div className="space-y-2">
      {rec === null
        ? <button onClick={start} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-700 font-semibold"><Mic size={18} /> {t('capsule.deposit.record')}</button>
        : <button onClick={() => recorder.current?.stop()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-semibold animate-pulse"><Square size={16} /> {t('capsule.deposit.recording', { s: rec })} · {t('capsule.deposit.stop')}</button>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DepositForm({ capsule, onDone }: { capsule: Capsule; onDone: () => void }) {
  const [kind, setKind] = useState<'text' | 'photo' | 'voice'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ blob: Blob; name: string; preview?: string; seconds?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function send() {
    setError('');
    if (kind === 'text' && !text.trim()) { setError(t('capsule.deposit.textRequired')); return; }
    if (kind !== 'text' && !file) { setError(kind === 'photo' ? t('capsule.deposit.choosePhoto') : t('capsule.deposit.voiceRequired')); return; }
    const form = new FormData();
    form.append('kind', kind);
    if (text.trim()) form.append('text', text.trim());
    if (file) { form.append('file', file.blob, file.name); if (file.seconds) form.append('seconds', String(file.seconds)); }
    setBusy(true);
    try {
      await api.post(`/capsules/${capsule.id}/deposits`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setText(''); setFile(null); setSent(true); window.setTimeout(() => setSent(false), 2500); onDone();
    } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  }
  const tabCls = (k: string) => `flex-1 py-2 rounded-lg text-sm font-semibold ${kind === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-slate-800">{t('capsule.deposit.title')}</p>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(['text', 'photo', 'voice'] as const).map(k => <button key={k} onClick={() => { setKind(k); setFile(null); setError(''); }} className={tabCls(k)}>{t(`capsule.deposit.${k}` as any)}</button>)}
      </div>
      {kind === 'photo' && (file?.preview
        ? <div className="relative"><img src={file.preview} alt="" className="w-full max-h-72 object-contain rounded-xl bg-slate-100" /><button onClick={() => setFile(null)} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white" aria-label={t('capsule.remove')}><X size={16} /></button></div>
        : <button onClick={() => input.current?.click()} className="w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-700 font-semibold"><ImagePlus size={20} /> {t('capsule.deposit.choosePhoto')}</button>)}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile({ blob: f, name: f.name || 'photo.jpg', preview: URL.createObjectURL(f) }); }} />
      {kind === 'voice' && (file
        ? <div className="flex items-center gap-2"><audio controls src={URL.createObjectURL(file.blob)} className="flex-1" /><button onClick={() => setFile(null)} className="text-xs text-slate-500 underline">{t('capsule.deposit.retry')}</button></div>
        : <VoiceRecorder onDone={(blob, seconds) => setFile({ blob, name: `capsule-${seconds}s.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, seconds })} />)}
      <textarea value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={kind === 'text' ? 5 : 2}
        placeholder={kind === 'text' ? t('capsule.deposit.textPlaceholder') : t('capsule.deposit.caption')}
        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={send} disabled={busy} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{sent ? t('capsule.deposit.sent') : <><Lock size={16} /> {t('capsule.deposit.send')}</>}</button>
      <p className="text-[11px] text-slate-400 text-center">{t('capsule.deposit.secret')}</p>
    </div>
  );
}

function DepositCard({ capsule, d, onRemove, big }: { capsule: Capsule; d: Deposit; onRemove?: () => void; big?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 ${big ? 'p-5' : 'p-3'} space-y-2`}>
      {d.kind === 'photo' && d.hasFile && <img src={fileUrl(capsule, d)} alt="" className={`w-full ${big ? 'max-h-[55vh]' : 'max-h-56'} object-contain rounded-xl bg-slate-100`} />}
      {d.kind === 'voice' && d.hasFile && <audio controls preload="none" src={fileUrl(capsule, d)} className="w-full" />}
      {d.text && <p className={`whitespace-pre-line text-slate-800 ${big ? 'text-lg' : 'text-sm'}`}>{d.text}</p>}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="flex-1">{big ? t('capsule.open.from', { name: displayName(d.author) ?? `@${d.author.pseudo}` }) : new Date(d.createdAt).toLocaleDateString(intlLocale())}</span>
        {big && d.kind === 'photo' && d.hasFile && <SavePhotoButton key="save" url={fileUrl(capsule, d)} filename={`capsule-${d.id}.jpg`} />}
        {onRemove && <button onClick={onRemove} className="flex items-center gap-1 hover:text-red-600"><Trash2 size={12} /> {t('capsule.remove')}</button>}
      </div>
    </div>
  );
}

// Ouverture : la boîte s'ouvre, puis les souvenirs défilent un par un
function CapsuleOpening({ capsule, onClose, onReunion }: { capsule: Capsule; onClose: () => void; onReunion?: (title: string) => void }) {
  useBackClose(onClose);
  const [i, setI] = useState(-1);
  const list = capsule.deposits;
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setI(x => Math.min(list.length, x + 1)); if (e.key === 'ArrowLeft') setI(x => Math.max(-1, x - 1)); if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [list.length]);
  // Portail sur body : ouverte depuis la fenêtre du Cercle, elle doit couvrir toute la page
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-indigo-950 text-white flex flex-col" style={{ paddingTop: 'var(--sa-top, 0px)', paddingBottom: 'var(--sa-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold truncate">{capsule.title}</p>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label={t('capsule.open.close')}><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 flex items-center justify-center">
        {i < 0 ? (
          <button onClick={() => setI(0)} className="flex flex-col items-center gap-4 text-center">
            <div className="animate-bounce"><Box size={150} /></div>
            <p className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{t('capsule.count', { count: list.length })}</p>
            <span className="px-6 py-3 rounded-full bg-indigo-600 font-semibold">{t('capsule.open.button')}</span>
          </button>
        ) : i < list.length ? (
          <div key={list[i].id} className="w-full max-w-lg text-slate-900" style={{ animation: 'evlyCapsuleIn .45s ease-out' }}>
            <p className="text-center text-white/60 text-sm mb-2">{i + 1} / {list.length}</p>
            <DepositCard capsule={capsule} d={list[i]} big />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <Box open size={130} />
            <p className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{list.length ? t('capsule.open.end', { title: capsule.title }) : t('capsule.open.empty')}</p>
            <p className="text-sm text-white/70 max-w-xs">{t('capsule.keep', { date: fmt(capsule.expiresAt) })}</p>
            {onReunion && <button onClick={() => onReunion(t('capsule.open.reunionTitle', { title: capsule.title }))} className="px-6 py-3 rounded-full bg-indigo-600 font-semibold">{t('capsule.open.reunion')}</button>}
          </div>
        )}
      </div>
      {i >= 0 && (
        <div className="flex gap-2 px-4 py-4">
          <button onClick={() => setI(x => x - 1)} className="flex-1 py-3 rounded-xl bg-white/10 font-semibold flex items-center justify-center gap-1"><ChevronLeft size={18} /> {t('capsule.open.prev')}</button>
          {i < list.length && <button onClick={() => setI(x => x + 1)} className="flex-1 py-3 rounded-xl bg-indigo-600 font-semibold flex items-center justify-center gap-1">{t('capsule.open.next')} <ChevronRight size={18} /></button>}
        </div>
      )}
      <style>{'@keyframes evlyCapsuleIn { from { opacity: 0; transform: translateY(30px) scale(.96) } to { opacity: 1; transform: none } }'}</style>
    </div>,
    document.body,
  );
}

// La capsule elle-même (rubrique du Plan comme fenêtre du Cercle)
export function CapsuleView({ capsule, onChanged, onReunion }: { capsule: Capsule; onChanged: () => void; onReunion?: (title: string) => void }) {
  const [opening, setOpening] = useState(false);
  const [editDate, setEditDate] = useState(false);
  const [date, setDate] = useState(capsule.openAt.slice(0, 16));
  const [error, setError] = useState('');
  const status = capsule.stage === 'open_for_deposits' ? t('capsule.status.open', { date: fmt(capsule.depositUntil) })
    : capsule.stage === 'sealed' ? t('capsule.status.sealed', { date: fmt(capsule.openAt) }) : t('capsule.status.opened', { date: fmt(capsule.expiresAt) });
  async function act(fn: () => Promise<unknown>) { setError(''); try { await fn(); onChanged(); } catch (e) { setError(errorOf(e)); } }
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 flex items-center gap-4">
        <Box open={capsule.stage === 'opened'} size={84} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-lg leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{capsule.title}</p>
          <p className="text-sm text-slate-700 mt-1">{status}</p>
          <p className="text-xs text-slate-500 mt-1">{t('capsule.count', { count: capsule.depositCount })}{capsule.contributorCount > 0 && ` · ${t('capsule.contributors', { count: capsule.contributorCount })}`}</p>
          {capsule.stage !== 'opened' && <p className="text-xs text-slate-500">{t('capsule.opensOn', { date: fmt(capsule.openAt) })}</p>}
        </div>
      </div>
      {capsule.stage === 'open_for_deposits' && <p className="text-xs text-slate-500 px-1">{t('capsule.sealAuto')}</p>}
      {capsule.stage === 'opened' && <button onClick={() => setOpening(true)} className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-lg">🎁 {t('capsule.open.button')}</button>}
      {capsule.canDeposit && <DepositForm capsule={capsule} onDone={onChanged} />}
      {capsule.stage !== 'opened' && capsule.deposits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('capsule.mine')}</p>
          {capsule.deposits.map(d => <DepositCard key={d.id} capsule={capsule} d={d} onRemove={capsule.canDeposit ? () => { if (confirm(t('capsule.removeConfirm'))) act(() => api.delete(`/capsules/deposits/${d.id}`)); } : undefined} />)}
        </div>
      )}
      {capsule.canManage && capsule.stage === 'open_for_deposits' && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          {editDate ? (
            <div className="space-y-2">
              <DateTimeField value={date} onChange={setDate} />
              <button onClick={() => act(async () => { await api.put(`/capsules/${capsule.id}`, { openAt: new Date(date).toISOString() }); setEditDate(false); })} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{t('capsule.manage.save')}</button>
            </div>
          ) : <button onClick={() => setEditDate(true)} className="text-sm text-indigo-600 font-semibold">{t('capsule.manage.changeDate')}</button>}
          <button onClick={() => { if (confirm(t('capsule.manage.sealConfirm'))) act(() => api.post(`/capsules/${capsule.id}/seal`)); }} className="block text-sm text-indigo-600 font-semibold">🔒 {t('capsule.manage.sealNow')}</button>
          <button onClick={() => { if (confirm(t('capsule.manage.deleteConfirm'))) act(() => api.delete(`/capsules/${capsule.id}`)); }} className="block text-sm text-red-600">{t('capsule.manage.delete')}</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {opening && <CapsuleOpening capsule={capsule} onClose={() => setOpening(false)} onReunion={onReunion ? title => { setOpening(false); onReunion(title); } : undefined} />}
    </div>
  );
}

// Rubrique « Capsule » d'un Plan
export function CapsuleTab({ planId }: { planId: string }) {
  const [data, setData] = useState<{ capsule: Capsule | null; canCreate: boolean; depositUntil?: string; oneYear?: string; notInvited?: boolean } | null>(null);
  const [choice, setChoice] = useState<'year' | 'date'>('year');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/capsules/plan/${planId}`).then(r => setData(r.data)).catch(e => setError(errorOf(e)));
  useEffect(() => { load(); }, [planId]);
  useResync(load);
  async function create() {
    setError('');
    if (!data?.depositUntil) return;
    if (choice === 'date' && !date) { setError(t('capsule.create.dateRequired')); return; }
    const openAt = choice === 'date' ? new Date(date) : new Date(data.oneYear ?? addYear(data.depositUntil));
    setBusy(true);
    try { await api.post(`/capsules/plan/${planId}`, { openAt: openAt.toISOString() }); await load(); } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  }
  const pill = (on: boolean) => `px-3 py-2 rounded-full border text-sm font-medium ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`;
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
      <div className="max-w-xl mx-auto space-y-4">
        {!data ? (error ? <p className="text-sm text-red-600">{error}</p> : null) : data.capsule ? (
          <CapsuleView capsule={data.capsule} onChanged={load} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <Box size={110} />
              <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>{t('capsule.title')}</p>
              <p className="text-sm text-slate-600 max-w-md">{t('capsule.intro')}</p>
            </div>
            {data.canCreate ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('capsule.create.openIn')}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setChoice('year')} className={pill(choice === 'year')}>{t('capsule.create.oneYear')}</button>
                  <button onClick={() => setChoice('date')} className={pill(choice === 'date')}>{t('capsule.create.date')}</button>
                </div>
                {choice === 'year' && data.oneYear && <p className="text-sm text-slate-700">{t('capsule.create.oneYearOn', { date: fmt(data.oneYear) })}</p>}
                {choice === 'date' && <>
                  <DateTimeField value={date} onChange={setDate} />
                  {data.depositUntil && <p className="text-xs text-slate-500">{t('capsule.create.dateHint', { date: fmt(addYear(data.depositUntil)) })}</p>}
                </>}
                {data.depositUntil && <p className="text-xs text-slate-500">{t('capsule.create.depositsUntil', { date: fmt(data.depositUntil) })}</p>}
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button onClick={create} disabled={busy} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{t('capsule.create.button')}</button>
              </div>
            ) : <p className="text-sm text-slate-500 text-center">{data.notInvited ? t('capsule.create.notInvited') : t('capsule.create.onlyCreator')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// Capsules d'un Cercle (colonne du Cercle) : elles survivent aux Plans
export function CircleCapsules({ circleId, onReunion }: { circleId: string; onReunion: (title: string) => void }) {
  const [list, setList] = useState<CapsuleSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    let alive = true;
    api.get(`/capsules/circle/${circleId}`).then(r => { if (alive) setList(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [circleId]);
  // Lien d'une notification : /dashboard?circleId=…&capsule=<id> (DashboardPage ouvre le Cercle, on ouvre la capsule)
  useEffect(() => {
    const q = params.get('capsule');
    if (!q) return;
    setOpenId(q);
    setParams(prev => { prev.delete('capsule'); return prev; }, { replace: true });
  }, [params]);
  useResync(() => api.get(`/capsules/circle/${circleId}`).then(r => setList(r.data)).catch(() => {}));
  const loadOne = (id: string) => api.get(`/capsules/${id}`).then(r => setCapsule(r.data)).catch(() => setOpenId(null));
  useEffect(() => { if (openId) loadOne(openId); else setCapsule(null); }, [openId]);
  if (!list.length && !openId) return null;
  return (
    <div className="space-y-2">
      {list.length > 0 && <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">⏳ {t('capsule.circle.section')}</p>}
      {list.map(c => (
        <button key={c.id} onClick={() => setOpenId(c.id)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border shadow-sm text-left ${c.stage === 'opened' ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
          <Box open={c.stage === 'opened'} size={40} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-800 truncate">{c.title}</span>
            <span className={`block text-xs ${c.stage === 'opened' ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
              {c.stage === 'opened' ? t('capsule.circle.opened') : c.stage === 'sealed' ? t('capsule.circle.sealed', { date: fmt(c.openAt) }) : t('capsule.circle.depositing', { date: fmt(c.depositUntil) })}
            </span>
          </span>
        </button>
      ))}
      {openId && capsule && (
        <Modal title={t('capsule.title')} onClose={() => setOpenId(null)} wide>
          <CapsuleView capsule={capsule} onChanged={() => { loadOne(capsule.id); api.get(`/capsules/circle/${circleId}`).then(r => setList(r.data)).catch(() => {}); }}
            onReunion={title => { setOpenId(null); onReunion(title); }} />
        </Modal>
      )}
    </div>
  );
}
