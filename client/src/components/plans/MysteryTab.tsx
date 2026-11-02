import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Lock, MapPin, Plus, Sparkles, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { useBackClose } from '../../lib/backClose';
import { useResync } from '../../hooks/useResync';
import { DateTimeField } from '../ui/DateTimeField';
import { Avatar } from '../ui/Avatar';
import { displayName } from '../../lib/names';
import type { Plan } from '../../types';

// Plan mystère (serveur : routes/mystery.ts, lib/mystery.ts). Les invités ne voient que le titre et le lieu publics du Plan,
// les indices déjà dévoilés et l'heure du prochain ; l'organisation et les complices voient tout et préparent le mystère.

type Person = { id: string; pseudo: string; firstName?: string | null };
interface Mystery {
  revealed: boolean; revealAt: string; revealedAt: string | null; canManage: boolean; insider: boolean; accomplice: boolean;
  clues: { id: string; text: string; revealedAt: string }[]; clueCount: number; nextClueAt: string | null;
  myGuess: string | null; guessCount: number;
  realTitle?: string; realLocation?: string; guesses?: { text: string; user: Person }[];
  accompliceIds?: string[]; allClues?: { id: string; text: string; revealAt: string; revealedAt: string | null }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmt = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const errorOf = (e: any) => e?.response?.data?.error || t('common.retryError');
const seenKey = (planId: string) => `evly_mystery_seen_${planId}`;

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}

function Countdown({ to }: { to: string }) {
  const now = useNow();
  let s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const u = (n: number, k: 'd' | 'h' | 'm') => `${n} ${t(`mystery.units.${k}`)}`;
  return <span className="tabular-nums font-bold">{d > 0 ? `${u(d, 'd')} ${u(h, 'h')}` : h > 0 ? `${u(h, 'h')} ${u(m, 'm')}` : `${m}:${pad(s)}`}</span>;
}

// Écran plein du dévoilement, montré une fois par appareil
function RevealScreen({ m, onClose }: { m: Mystery; onClose: () => void }) {
  useBackClose(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center gap-5 p-6 text-center overflow-y-auto"
      style={{ paddingTop: 'calc(var(--sa-top, 0px) + 24px)', paddingBottom: 'calc(var(--sa-bottom, 0px) + 24px)' }}>
      <p className="text-6xl" style={{ animation: 'evlyMysteryPop .6s ease-out' }}>🎉</p>
      <p className="text-lg text-white/70">{t('mystery.reveal.title')}</p>
      <p className="text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif', animation: 'evlyMysteryIn .8s ease-out' }}>{m.realTitle}</p>
      <p className="flex items-center gap-1.5 text-white/90"><MapPin size={16} />{m.realLocation}</p>
      {(m.guesses?.length ?? 0) > 0 && (
        <div className="w-full max-w-sm bg-white/10 rounded-2xl p-4 text-left space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{t('mystery.reveal.guesses')}</p>
          {m.guesses!.map((g, i) => <p key={i} className="text-sm"><span className="text-white/60">{displayName(g.user) ?? `@${g.user.pseudo}`} :</span> {g.text}</p>)}
        </div>
      )}
      <button onClick={onClose} className="px-8 py-3 rounded-full bg-indigo-600 font-semibold">{t('mystery.reveal.ok')}</button>
      <style>{'@keyframes evlyMysteryPop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } } @keyframes evlyMysteryIn { from { opacity: 0; transform: translateY(16px); filter: blur(6px) } to { opacity: 1; transform: none; filter: none } }'}</style>
    </div>,
    document.body,
  );
}

type ClueDraft = { id?: string; text: string; at: string; revealedAt?: string | null };

// Préparer ou modifier le mystère (organisation)
function SetupForm({ plan, m, onSaved, onCancel }: { plan: Plan; m: Mystery | null; onSaved: (v: any) => void; onCancel?: () => void }) {
  const start = plan.eventDate ?? plan.endDate;
  const defaultReveal = toLocal(new Date(new Date(start).getTime() - 3600e3).toISOString());
  const [realTitle, setRealTitle] = useState(m?.realTitle ?? '');
  const [realPlace, setRealPlace] = useState(m?.realLocation ?? '');
  const [revealAt, setRevealAt] = useState(m ? toLocal(m.revealAt) : defaultReveal);
  const [clues, setClues] = useState<ClueDraft[]>(m?.allClues?.map(c => ({ id: c.id, text: c.text, at: toLocal(c.revealAt), revealedAt: c.revealedAt })) ?? []);
  const [accomplices, setAccomplices] = useState<string[]>(m?.accompliceIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const others = (plan.members ?? []).filter(pm => pm.userId !== plan.creatorId && pm.rsvp !== 'out' && !pm.user.pseudo.endsWith('.invite'));

  function starter() {
    const reveal = new Date(revealAt).getTime();
    const list = t('mystery.starterList', { returnObjects: true }) as unknown as string[];
    const times = [Math.min(Date.now() + 10 * 60e3, reveal), reveal - 24 * 3600e3, reveal - 3600e3];
    setClues(list.map((text, i) => ({ text, at: toLocal(new Date(Math.max(Date.now() + 5 * 60e3, Math.min(times[i] ?? reveal, reveal))).toISOString()) })));
  }

  async function save() {
    setError('');
    if (!realTitle.trim() || !realPlace.trim()) { setError(t('mystery.setup.required')); return; }
    if (clues.some(c => !c.text.trim())) { setError(t('mystery.setup.clueRequired')); return; }
    setBusy(true);
    try {
      const { data } = await api.put(`/plans/${plan.id}/mystery`, {
        realTitle: realTitle.trim(), realLocation: realPlace.trim(), revealAt: new Date(revealAt).toISOString(),
        clues: clues.map(c => ({ id: c.id, text: c.text.trim(), revealAt: new Date(c.at).toISOString() })), accompliceIds: accomplices,
      });
      onSaved(data);
    } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div>
        <p className="font-semibold text-slate-900">🤫 {t('mystery.setup.title')}</p>
        <p className="text-xs text-slate-500 mt-1">{t('mystery.setup.intro', { title: plan.title, place: plan.location ?? '' })}</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">{t('mystery.setup.realTitle')}
        <input value={realTitle} onChange={e => setRealTitle(e.target.value)} maxLength={100} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900" />
      </label>
      <label className="block text-sm font-medium text-slate-700">{t('mystery.setup.realPlace')}
        <input value={realPlace} onChange={e => setRealPlace(e.target.value)} maxLength={200} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900" />
      </label>
      <div>
        <p className="text-sm font-medium text-slate-700 mb-1">{t('mystery.setup.revealAt')}</p>
        <DateTimeField value={revealAt} onChange={setRevealAt} />
        <p className="text-xs text-slate-500 mt-1">{t('mystery.setup.revealHint')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">{t('mystery.setup.clues')}</p>
        <p className="text-xs text-slate-500">{t('mystery.setup.cluesHint')}</p>
        {clues.map((c, i) => (
          <div key={i} className={`rounded-xl border p-2.5 space-y-2 ${c.revealedAt ? 'bg-slate-50 border-slate-200' : 'border-slate-200'}`}>
            <div className="flex gap-2">
              <input value={c.text} disabled={!!c.revealedAt} onChange={e => setClues(clues.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} maxLength={200}
                placeholder={t('mystery.setup.clueText')} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 disabled:bg-slate-100" />
              {!c.revealedAt && <button onClick={() => setClues(clues.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-600" aria-label="×"><Trash2 size={16} /></button>}
            </div>
            {c.revealedAt ? <p className="text-xs text-emerald-700">✓ {t('mystery.insider.revealed')} {t('mystery.insider.at', { date: fmt(c.revealedAt) })}</p>
              : <div className="flex items-center gap-2 text-xs text-slate-500"><span className="flex-shrink-0">{t('mystery.setup.clueAt')}</span><DateTimeField value={c.at} onChange={v => setClues(clues.map((x, j) => j === i ? { ...x, at: v } : x))} /></div>}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {clues.length < 8 && <button onClick={() => setClues([...clues, { text: '', at: revealAt }])} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 text-sm font-medium"><Plus size={14} />{t('mystery.setup.addClue')}</button>}
          {clues.length === 0 && <button onClick={starter} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 text-sm"><Sparkles size={14} />{t('mystery.setup.starter')}</button>}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">{t('mystery.setup.accomplices')}</p>
        <p className="text-xs text-slate-500">{t('mystery.setup.accomplicesHint')}</p>
        {others.length === 0 ? <p className="text-xs text-slate-400">{t('mystery.setup.noParticipants')}</p> : (
          <div className="flex flex-wrap gap-1.5">
            {others.map(pm => { const on = accomplices.includes(pm.userId); return (
              <button key={pm.userId} onClick={() => setAccomplices(on ? accomplices.filter(x => x !== pm.userId) : [...accomplices, pm.userId])}
                className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border text-sm ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Avatar pseudo={pm.user.pseudo} size="sm" />{displayName(pm.user) ?? `@${pm.user.pseudo}`}
              </button>); })}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {onCancel && <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">{t('common.cancel')}</button>}
        <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{t('mystery.setup.save')}</button>
      </div>
    </div>
  );
}

export function MysteryTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [data, setData] = useState<{ mystery: Mystery | null; canManage: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [guess, setGuess] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const load = () => api.get(`/plans/${plan.id}/mystery`).then(r => setData(r.data)).catch(e => setError(errorOf(e)));
  useEffect(() => { load(); }, [plan]);
  useResync(load);
  const m = data?.mystery ?? null;
  useEffect(() => { setGuess(m?.myGuess ?? ''); }, [m?.myGuess]);
  // Dévoilement : l'écran plein une fois par appareil (pas pour l'organisation, qui connaît déjà la destination)
  useEffect(() => {
    if (!m?.revealed || m.canManage) return;
    try { if (!localStorage.getItem(seenKey(plan.id))) { setShowReveal(true); localStorage.setItem(seenKey(plan.id), '1'); } } catch { /* stockage indisponible */ }
  }, [m?.revealed]);

  async function act(fn: () => Promise<any>) {
    setError(''); setBusy(true);
    try { const r = await fn(); if (r?.data && 'mystery' in r.data) setData(r.data); else await load(); } catch (e) { setError(errorOf(e)); } finally { setBusy(false); }
  }
  const me = plan.members?.find(pm => pm.userId === userId);
  const canBet = !!me && me.rsvp !== 'out';
  const nextAt = m && !m.revealed ? [m.nextClueAt, m.revealAt].filter(Boolean).sort()[0] : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
      <div className="max-w-xl mx-auto space-y-4">
        {!data ? (error ? <p className="text-sm text-red-600">{error}</p> : null)
        : !m ? (
          data.canManage ? <SetupForm plan={plan} m={null} onSaved={setData} />
            : <div className="text-center py-10"><p className="text-6xl animate-pulse">❓</p><p className="text-sm text-slate-500 mt-3">{t('mystery.guest.notReady')}</p></div>
        ) : editing ? (
          <SetupForm plan={plan} m={m} onSaved={v => { setData(v); setEditing(false); }} onCancel={() => setEditing(false)} />
        ) : (
          <>
            {/* En-tête : le mystère, ou la destination une fois dévoilée */}
            {m.revealed ? (
              <button onClick={() => setShowReveal(true)} className="w-full text-left bg-gradient-to-br from-indigo-600 to-orange-500 text-white rounded-2xl p-5 shadow-md">
                <p className="text-sm text-white/80">🎉 {t('mystery.reveal.title')}</p>
                <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Fraunces, serif' }}>{m.realTitle}</p>
                <p className="flex items-center gap-1.5 text-sm mt-1 text-white/90"><MapPin size={14} />{m.realLocation}</p>
              </button>
            ) : m.insider ? (
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-2">
                <p className="text-xs text-white/60">{m.canManage ? t('mystery.insider.organizer') : t('mystery.insider.accomplice')}</p>
                <p className="text-xs uppercase tracking-wide text-white/50">{t('mystery.insider.secret')}</p>
                <p className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{m.realTitle}</p>
                <p className="flex items-center gap-1.5 text-sm text-white/90"><MapPin size={14} />{m.realLocation}</p>
                <p className="text-sm text-white/80 pt-1">{t('mystery.guest.revealIn')} <Countdown to={m.revealAt} /></p>
              </div>
            ) : (
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md text-center space-y-2">
                <p className="text-7xl" style={{ animation: 'evlyMysteryFloat 2.4s ease-in-out infinite' }}>❓</p>
                <p className="text-lg font-semibold">{t('mystery.guest.teaser')}</p>
                {nextAt && <p className="text-sm text-white/80">{nextAt === m.revealAt ? t('mystery.guest.revealIn') : t('mystery.guest.nextClue')} <Countdown to={nextAt} /></p>}
                <style>{'@keyframes evlyMysteryFloat { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-8px) rotate(6deg) } }'}</style>
              </div>
            )}

            {/* Indices dévoilés (invités), ou tous les indices prévus (organisation) */}
            {m.insider && !m.revealed ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('mystery.insider.planned')}</p>
                {(m.allClues ?? []).length === 0 && <p className="text-sm text-slate-400">—</p>}
                {(m.allClues ?? []).map(c => (
                  <div key={c.id} className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    {c.revealedAt ? <Eye size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /> : <Lock size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">{c.text}</p>
                      <p className="text-xs text-slate-400">{c.revealedAt ? `${t('mystery.insider.revealed')} ${t('mystery.insider.at', { date: fmt(c.revealedAt) })}` : fmt(c.revealAt)}</p>
                    </div>
                    {!c.revealedAt && m.canManage && <button disabled={busy} onClick={() => act(() => api.post(`/plans/${plan.id}/mystery/clues/${c.id}/reveal`))} className="text-xs text-indigo-600 font-semibold flex-shrink-0">{t('mystery.insider.revealNow')}</button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">🔍 {t('mystery.guest.clues')} ({m.clues.length}/{m.clueCount})</p>
                {m.clues.length === 0 && <p className="text-sm text-slate-400 px-1">{t('mystery.guest.noClue')}</p>}
                {m.clues.map((c, i) => (
                  <div key={c.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 flex gap-3" style={{ animation: `evlyMysteryFlip .5s ease-out ${i * 0.05}s both` }}>
                    <span className="w-7 h-7 flex-shrink-0 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                    <div><p className="text-slate-800">{c.text}</p><p className="text-xs text-slate-400 mt-0.5">{fmt(c.revealedAt)}</p></div>
                  </div>
                ))}
                <style>{'@keyframes evlyMysteryFlip { from { opacity: 0; transform: perspective(600px) rotateX(70deg) } to { opacity: 1; transform: none } }'}</style>
              </div>
            )}

            {/* Paris */}
            {!m.insider && !m.revealed && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                <p className="font-semibold text-slate-800">🎲 {t('mystery.guest.bet')}</p>
                {canBet ? (
                  <>
                    <input value={guess} onChange={e => setGuess(e.target.value)} maxLength={150} placeholder={t('mystery.guest.betPlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900" />
                    <div className="flex items-center gap-2">
                      <button disabled={busy || !guess.trim() || guess.trim() === m.myGuess} onClick={() => act(() => api.put(`/plans/${plan.id}/mystery/guess`, { text: guess.trim() }))}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{m.myGuess && guess.trim() === m.myGuess ? `✓ ${t('mystery.guest.betSaved')}` : t('mystery.guest.betSave')}</button>
                      {m.myGuess && <button disabled={busy} onClick={() => act(() => api.delete(`/plans/${plan.id}/mystery/guess`))} className="text-sm text-slate-500 underline">{t('mystery.guest.betRemove')}</button>}
                      <span className="ml-auto text-xs text-slate-400">{t('mystery.guest.count', { count: m.guessCount })}</span>
                    </div>
                    <p className="text-xs text-slate-400">{t('mystery.guest.betHint')}</p>
                  </>
                ) : <p className="text-sm text-slate-500">{t('mystery.guest.joinToBet')}</p>}
              </div>
            )}
            {(m.insider || m.revealed) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
                <p className="font-semibold text-slate-800">🎲 {m.revealed ? t('mystery.reveal.guesses') : t('mystery.insider.guesses')} ({m.guesses?.length ?? 0})</p>
                {(m.guesses?.length ?? 0) === 0 && <p className="text-sm text-slate-400">{m.revealed ? t('mystery.reveal.none') : t('mystery.insider.noGuess')}</p>}
                {m.guesses?.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm"><Avatar pseudo={g.user.pseudo} size="sm" /><span className="text-slate-500">{displayName(g.user) ?? `@${g.user.pseudo}`}</span><span className="text-slate-800">{g.text}</span></div>
                ))}
              </div>
            )}

            {m.canManage && !m.revealed && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold">{t('mystery.insider.edit')}</button>
                <button disabled={busy} onClick={() => { if (confirm(t('mystery.insider.revealAllConfirm'))) act(() => api.post(`/plans/${plan.id}/mystery/reveal`)); }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">🎉 {t('mystery.insider.revealAll')}</button>
                <button disabled={busy} onClick={() => { if (confirm(t('mystery.setup.cancelConfirm'))) act(() => api.delete(`/plans/${plan.id}/mystery`)); }} className="px-4 py-2 text-sm text-red-600">{t('mystery.setup.cancel')}</button>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </>
        )}
      </div>
      {showReveal && m?.revealed && <RevealScreen m={m} onClose={() => setShowReveal(false)} />}
    </div>
  );
}
