import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X, RotateCcw, Users } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { currentLang, intlLocale, t } from '../../i18n';
import { Trans } from 'react-i18next';

// « Qui s'y colle ? » (serveur : routes/wheel.ts), dans l'onglet Votes. Le serveur tire le résultat et fixe
// l'heure de départ ; chaque téléphone anime la roue pour qu'elle s'arrête au même instant sur le même nom.
// La roue s'ouvre sur tous les téléphones qui regardent le Plan (événement « wheel-spin », PlanDetail).

type P = { id: string; name: string };
export type WheelSpin = { id: string; winner: P; candidates: P[]; excluded: P[]; skipped: P[]; spunBy: P | null; startAt: number; durationMs: number };
export type Wheel = {
  id: string; question: string; noRepeat: boolean; canDelete: boolean;
  participants: (P & { excluded: boolean; alreadyDrawn: boolean })[];
  candidates: P[]; spins: WheelSpin[];
};
export type WheelsResponse = { serverNow: number; wheels: Wheel[] };

const COLORS = ['#ea5a2b', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#6366f1', '#84cc16'];
const fmtTime = (ms: number) => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

// Demander l'ouverture de la roue (PlanDetail l'affiche, quel que soit l'onglet)
// auto : ouverture par le temps réel (une seule fois par tirage) ; sinon demandée par la personne
export function openWheelSpin(planId: string, spinId: string, replay = false, auto = false) {
  window.dispatchEvent(new CustomEvent('evly-wheel', { detail: { planId, spinId, replay, auto } }));
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

// Rotation finale : le centre de la part du gagnant sous le repère (en haut), après plusieurs tours
function finalRotation(spin: WheelSpin) {
  const n = spin.candidates.length;
  const a = 360 / n;
  const i = Math.max(0, spin.candidates.findIndex(c => c.id === spin.winner.id));
  const jitter = ((hash(spin.id) % 1000) / 1000 - 0.5) * a * 0.6;
  return 360 * 6 - (i + 0.5) * a + jitter;
}

function WheelSvg({ candidates, rotation }: { candidates: P[]; rotation: number }) {
  const n = Math.max(candidates.length, 1);
  const a = 360 / n;
  const r = 150;
  const pt = (deg: number, rad = r) => { const a2 = ((deg - 90) * Math.PI) / 180; return [160 + rad * Math.cos(a2), 160 + rad * Math.sin(a2)]; };
  return (
    <svg viewBox="0 0 320 320" className="w-full h-full">
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '160px 160px' }}>
        {candidates.map((c, i) => {
          const [x1, y1] = pt(i * a); const [x2, y2] = pt((i + 1) * a);
          const [tx, ty] = pt((i + 0.5) * a, r * 0.62);
          const path = n === 1 ? `M 160 160 m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0` : `M160,160 L${x1},${y1} A${r},${r} 0 ${a > 180 ? 1 : 0} 1 ${x2},${y2} Z`;
          return (
            <g key={c.id}>
              <path d={path} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} />
              <text x={tx} y={ty} fill="#fff" fontSize={n > 8 ? 11 : 14} fontWeight={700} textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${(i + 0.5) * a}, ${tx}, ${ty})`}>{c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name}</text>
            </g>
          );
        })}
      </g>
      <circle cx={160} cy={160} r={18} fill="#0f172a" stroke="#fff" strokeWidth={4} />
      <path d="M160,4 L148,28 L172,28 Z" fill="#0f172a" stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

// La roue en plein écran : attend l'heure de départ commune, tourne, s'arrête sur le résultat
export function WheelOverlay({ question, spin, serverOffset, replay, onClose }: { question: string; spin: WheelSpin; serverOffset: number; replay: boolean; onClose: () => void }) {
  const start = useRef(replay ? Date.now() + 800 : spin.startAt - serverOffset);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const elapsed = now - start.current;
  const p = Math.min(1, Math.max(0, elapsed / spin.durationMs));
  const ease = 1 - Math.pow(1 - p, 3);
  const rotation = finalRotation(spin) * ease;
  const done = p >= 1;
  const countdown = elapsed < 0 ? Math.ceil(-elapsed / 1000) : 0;
  useEffect(() => { if (done && !replay) (navigator as any).vibrate?.(200); }, [done, replay]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-white" style={{ paddingTop: 'var(--sa-top)', paddingBottom: 'var(--sa-bottom)' }}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10" style={{ marginTop: 'var(--sa-top)' }} aria-label={t('common.close')}><X size={20} /></button>
      <p className="text-sm uppercase tracking-widest text-white/60">{t('votes.wheel.title')}</p>
      <p className="text-xl font-bold text-center mt-1 mb-6">{question}</p>
      <div className="w-full max-w-xs aspect-square"><WheelSvg candidates={spin.candidates} rotation={rotation} /></div>
      <div className="h-24 flex flex-col items-center justify-center mt-6">
        {countdown > 0 ? <p className="text-4xl font-black">{countdown}</p>
          : done ? (
            <>
              <p className="text-3xl font-black text-center">🎉 {spin.winner.name} !</p>
              <button onClick={onClose} className="mt-3 px-5 py-2 rounded-xl bg-white text-slate-900 font-semibold">{t('common.ok')}</button>
            </>
          ) : <p className="text-white/70">{t('votes.wheel.spinning')}</p>}
      </div>
    </div>
  );
}

function ExcludedNote({ spin }: { spin: WheelSpin }) {
  return (
    <>
      {spin.excluded.length > 0 && <p className="text-xs text-slate-500 mt-1">{t('votes.wheel.excluded', { count: spin.excluded.length, names: spin.excluded.map(p => p.name).join(', ') })}</p>}
      {spin.skipped.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{t('votes.wheel.skipped', { count: spin.skipped.length, names: spin.skipped.map(p => p.name).join(', ') })}</p>}
    </>
  );
}

function PeoplePicker({ people, excluded, onChange }: { people: P[]; excluded: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {people.map(p => (
        <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" className="accent-indigo-600" checked={!excluded.includes(p.id)} onChange={e => onChange(e.target.checked ? excluded.filter(x => x !== p.id) : [...excluded, p.id])} />
          <span className={`truncate ${excluded.includes(p.id) ? 'line-through text-slate-400' : ''}`}>{p.name}</span>
        </label>
      ))}
    </div>
  );
}

export function WheelCreateForm({ plan, onDone, onCancel }: { plan: Plan; onDone: () => void; onCancel: () => void }) {
  const people = useMemo(() => plan.members.filter(m => m.rsvp !== 'out').map(m => ({ id: m.userId, name: displayName(m.user) ?? m.user.pseudo }))
    .sort((a, b) => a.name.localeCompare(b.name, currentLang())), [plan.members]);
  const [question, setQuestion] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [noRepeat, setNoRepeat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    if (!question.trim()) { setError(t('votes.wheel.needQuestion')); return; }
    setBusy(true); setError('');
    try { await api.post(`/plans/${plan.id}/wheels`, { question: question.trim(), excludedUserIds: excluded, noRepeat }); onDone(); }
    catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); setBusy(false); }
  }
  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-slate-800 text-sm">🎡 {t('votes.wheel.title')}</p>
      <input autoFocus value={question} onChange={e => setQuestion(e.target.value)} maxLength={120} placeholder={t('votes.wheel.questionPlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <div>
        <p className="text-sm text-slate-600 mb-1">{t('votes.wheel.onWheelPick')}</p>
        <PeoplePicker people={people} excluded={excluded} onChange={setExcluded} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input type="checkbox" checked={noRepeat} onChange={e => setNoRepeat(e.target.checked)} className="accent-indigo-600" />
        {t('votes.wheel.noRepeat')}
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{t('votes.wheel.create')}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-600">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

export function WheelCard({ wheel, plan, serverOffset, onChanged }: { wheel: Wheel; plan: Plan; serverOffset: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const last = wheel.spins[wheel.spins.length - 1];
  // Pendant que la roue tourne, le résultat reste caché (pas de spoiler derrière l'animation)
  const endsIn = last ? last.startAt + last.durationMs - (Date.now() + serverOffset) : 0;
  const [, rerender] = useState(0);
  useEffect(() => {
    if (endsIn <= 0) return;
    const timer = window.setTimeout(() => rerender(x => x + 1), endsIn + 100);
    return () => window.clearTimeout(timer);
  }, [endsIn > 0, last?.id]);
  const spinning = endsIn > 0;
  const excluded = wheel.participants.filter(p => p.excluded);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); onChanged(); } catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
  }
  async function spin() {
    setError('');
    try {
      const { data } = await api.post(`/plans/wheels/${wheel.id}/spin`);
      openWheelSpin(plan.id, data.id);
      onChanged();
    } catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold text-slate-800 text-sm">🎡 {wheel.question}</p>
        {wheel.canDelete && <button onClick={() => { if (confirm(t('votes.wheel.deleteConfirm'))) run(() => api.delete(`/plans/wheels/${wheel.id}`)); }} className="text-slate-300 hover:text-red-500" aria-label={t('votes.wheel.delete')}><Trash2 size={14} /></button>}
      </div>

      {spinning && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <p className="flex-1 text-sm text-amber-900">🎡 {t('votes.wheel.spinning')}</p>
          <button onClick={() => openWheelSpin(plan.id, last.id)} className="text-xs text-amber-800 underline">{t('votes.wheel.watch')}</button>
        </div>
      )}
      {last && !spinning && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-amber-900"><Trans i18nKey="votes.wheel.chose" values={{ name: last.winner.name }} components={{ b: <strong className="text-base" /> }} /></p>
            <button onClick={() => openWheelSpin(plan.id, last.id, true)} className="text-xs text-amber-800 underline flex items-center gap-1"><RotateCcw size={12} /> {t('votes.wheel.replay')}</button>
          </div>
          <ExcludedNote spin={last} />
          {wheel.spins.length > 1 && (
            <p className="text-xs text-slate-400 mt-1.5">{t('votes.wheel.previous', { list: wheel.spins.slice(0, -1).reverse().map(s => `${s.winner.name} · ${fmtTime(s.startAt)}`).join(' — ') })}</p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3 flex items-start gap-1.5">
        <Users size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          {t('votes.wheel.onWheel', { names: wheel.candidates.length ? wheel.candidates.map(c => c.name).join(', ') : t('votes.wheel.nobody') })}
          {excluded.length > 0 && <> · <span className="text-slate-400">{t('votes.wheel.removed', { count: excluded.length, names: excluded.map(p => p.name).join(', ') })}</span></>}
        </span>
      </p>
      {editing ? (
        <div className="mt-2 space-y-2">
          <PeoplePicker people={wheel.participants} excluded={excluded.map(p => p.id)} onChange={ids => run(() => api.put(`/plans/wheels/${wheel.id}`, { excludedUserIds: ids }))} />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-2">
            <input type="checkbox" checked={wheel.noRepeat} onChange={e => run(() => api.put(`/plans/wheels/${wheel.id}`, { noRepeat: e.target.checked }))} className="accent-indigo-600" />
            {t('votes.wheel.noRepeat')}
          </label>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-2">{t('common.close')}</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-1 text-xs text-indigo-600 font-medium">{t('votes.wheel.editPeople')}</button>
      )}

      <button onClick={spin} disabled={!wheel.candidates.length} className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold disabled:opacity-40">
        🎡 {last ? t('votes.wheel.spinAgain') : t('votes.wheel.spin')}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

// Monté dans PlanDetail : ouvre la roue quand quelqu'un la lance (« wheel-spin ») ou pour la revoir
export function WheelSpinHost({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState<{ question: string; spin: WheelSpin; offset: number; replay: boolean } | null>(null);
  const shown = useRef(new Set<string>());
  useEffect(() => {
    async function show(spinId: string, replay: boolean, auto: boolean) {
      if (auto && shown.current.has(spinId)) return;
      try {
        const { data } = await api.get<WheelsResponse>(`/plans/${plan.id}/wheels`);
        const offset = data.serverNow - Date.now();
        for (const w of data.wheels) {
          const spin = w.spins.find(s => s.id === spinId);
          if (!spin) continue;
          // Tirage déjà terminé depuis longtemps (ouverture tardive) : pas d'animation automatique
          if (!replay && spin.startAt + spin.durationMs < data.serverNow - 2000) return;
          shown.current.add(spinId);
          setOpen({ question: w.question, spin, offset, replay });
        }
      } catch { /* rien */ }
    }
    const onWindow = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.planId === plan.id) show(d.spinId, !!d.replay, !!d.auto); };
    window.addEventListener('evly-wheel', onWindow);
    return () => window.removeEventListener('evly-wheel', onWindow);
  }, [plan.id]);
  if (!open) return null;
  return <WheelOverlay question={open.question} spin={open.spin} serverOffset={open.offset} replay={open.replay} onClose={() => setOpen(null)} />;
}
