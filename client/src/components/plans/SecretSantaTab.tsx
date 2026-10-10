import { useEffect, useState } from 'react';
import { Gift, Send, Shuffle, Eye, UserPlus, X, Check, RotateCcw } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { intlLocale, t } from '../../i18n';

// Père Noël secret (serveur : routes/secretSanta.ts). Avant le tirage : liste d'envies, participants,
// exclusions et tirage (organisateur). Après : à qui j'offre (paquet à ouvrir), « cadeau prêt », deux
// conversations anonymes, révélation par l'organisateur à partir du jour de l'échange.

type Person = { id: string; pseudo: string; firstName?: string | null };
type Msg = { id: string; mine: boolean; content: string; createdAt: string };
type WishStatus = 'wish' | 'none' | 'pending';
interface SantaState {
  budget: string | null; drawn: boolean; revealed: boolean; canManage: boolean; canReveal: boolean;
  eventDate: string | null; endDate: string;
  participants: (Person & { wishStatus: WishStatus })[];
  myWish: string;
  myNoWish: boolean;
  exclusions: { id: string; a: Person; b: Person }[];
  me: { receiver: Person; receiverWish: string; receiverWishStatus: WishStatus; giftReady: boolean; withReceiver: Msg[] } | null;
  santa: { withSanta: Msg[] } | null;
  readyCount: number; pairCount: number;
  unpaired: Person[];
  reveal: { giver: Person; receiver: Person }[] | null;
}

const nameOf = (p: Person) => displayName(p) ?? `@${p.pseudo}`;
const fmtDay = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const card = 'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm';

export function SecretSantaTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<SantaState | null>(null);
  const [error, setError] = useState('');
  const openedKey = `evly_santa_opened_${plan.id}_${userId}`;
  const [opened, setOpened] = useState(() => { try { return localStorage.getItem(openedKey) === '1'; } catch { return false; } });

  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/santa`)).data); }
    catch (err: any) { setError(err.response?.data?.error || t('games.loadError')); }
  }
  // Rechargé à chaque mise à jour du Plan (temps réel : plan-updated)
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); await load(); return true; }
    catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); return false; }
  }

  if (!s) return <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-400">{error}</div>;
  const isParticipant = s.participants.some(p => p.id === userId);
  const iAmUnpaired = s.drawn && isParticipant && !s.me;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      {/* En-tête */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-600 to-indigo-600 text-white">
        <p className="text-lg font-bold flex items-center gap-2"><Gift size={20} /> {t('games.santa.title')}</p>
        <p className="text-sm text-white/85 mt-1">
          {t('games.santa.intro')}
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
          {s.eventDate && <span className="px-2.5 py-1 rounded-full bg-white/20">{t('games.santa.exchange', { date: fmtDay(s.eventDate) })}</span>}
          <BudgetChip s={s} onSave={budget => run(() => api.put(`/plans/${plan.id}/santa`, { budget }))} />
          {s.drawn && <span className="px-2.5 py-1 rounded-full bg-white/20">{t('games.santa.ready', { count: s.readyCount, total: s.pairCount })}</span>}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Révélation */}
      {s.reveal && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">{t('games.santa.whoGaveWho')}</p>
          <ul className="space-y-1.5">
            {s.reveal.map(r => (
              <li key={r.giver.id} className="text-sm text-slate-700 flex items-center gap-2">
                <span className="font-medium">{nameOf(r.giver)}</span><span className="text-slate-400">→</span><span>{nameOf(r.receiver)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* À qui j'offre */}
      {s.me && !s.reveal && (
        opened ? (
          <div className={card}>
            <p className="text-sm text-slate-500">{t('games.santa.youGiveTo')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">🎁 {nameOf(s.me.receiver)}</p>
            <p className="text-xs text-slate-400">{t('games.santa.secret')}</p>
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">{t('games.santa.wishList')}</p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">
                {s.me.receiverWishStatus === 'wish' ? s.me.receiverWish
                  : s.me.receiverWishStatus === 'none' ? t('games.santa.noWish', { name: nameOf(s.me.receiver) })
                  : t('games.santa.pendingWish', { name: nameOf(s.me.receiver) })}
              </p>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={s.me.giftReady} onChange={e => run(() => api.put(`/plans/${plan.id}/santa/ready`, { ready: e.target.checked }))} className="accent-indigo-600 w-4 h-4" />
              {t('games.santa.giftReady')}
            </label>
          </div>
        ) : (
          <button
            onClick={() => { setOpened(true); try { localStorage.setItem(openedKey, '1'); } catch { /* indisponible */ } }}
            className="w-full p-6 rounded-2xl bg-white border-2 border-dashed border-rose-300 text-center hover:bg-rose-50 transition-colors"
          >
            <span className="block text-5xl">🎁</span>
            <span className="block mt-2 font-semibold text-slate-800">{t('games.santa.openGift')}</span>
            <span className="block text-xs text-slate-400 mt-1">{t('games.santa.noOneLooking')}</span>
          </button>
        )
      )}

      {/* Conversations anonymes */}
      {s.me && opened && (
        <Thread
          kind="give"
          title={t('games.santa.giveTitle', { name: nameOf(s.me.receiver) })}
          role={t('games.santa.giveRole')}
          hint={t('games.santa.giveHint', { name: nameOf(s.me.receiver) })}
          placeholder={t('games.santa.givePlaceholder', { name: nameOf(s.me.receiver) })}
          messages={s.me.withReceiver} otherLabel={nameOf(s.me.receiver)} readOnly={!!s.reveal}
          onSend={content => run(() => api.post(`/plans/${plan.id}/santa/messages`, { to: 'receiver', content }))}
        />
      )}
      {s.santa && (
        <Thread
          kind="receive"
          title={t('games.santa.receiveTitle')}
          role={t('games.santa.receiveRole')}
          hint={t('games.santa.receiveHint')}
          placeholder={t('games.santa.receivePlaceholder')}
          messages={s.santa.withSanta} otherLabel={t('games.santa.yourSanta')} readOnly={!!s.reveal}
          onSend={content => run(() => api.post(`/plans/${plan.id}/santa/messages`, { to: 'santa', content }))}
        />
      )}

      {iAmUnpaired && <p className={`${card} text-sm text-slate-600`}>{t('games.santa.unpaired')}</p>}
      {s.drawn && !isParticipant && !s.reveal && <p className={`${card} text-sm text-slate-600`}>{t('games.santa.notIn')}</p>}

      {/* Ma liste d'envies */}
      {isParticipant && !s.reveal && <WishCard initial={s.myWish} noWish={s.myNoWish} onSave={body => run(() => api.put(`/plans/${plan.id}/santa/wish`, body))} />}
      {!isParticipant && !s.drawn && (
        <p className={`${card} text-sm text-slate-600`}>{t('games.santa.answerToJoin')}</p>
      )}

      {/* Participants */}
      {!s.reveal && (
        <div className={card}>
          <p className="font-semibold text-slate-800 text-sm mb-2">{t('games.santa.participants', { count: s.participants.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.participants.map(p => (
              <span key={p.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                {nameOf(p)}{p.wishStatus === 'wish' ? <span className="text-emerald-600">{t('games.santa.hasWish')}</span> : p.wishStatus === 'none' ? <span className="text-slate-500">{t('games.santa.noWishTag')}</span> : <span className="text-amber-600">{t('games.santa.pendingTag')}</span>}
              </span>
            ))}
          </div>
          {!s.drawn && <p className="text-xs text-slate-400 mt-2">{t('games.santa.participantsHint')}</p>}
        </div>
      )}

      {/* Organisateur */}
      {s.canManage && !s.reveal && (
        <ManagerPanel s={s} planId={plan.id} run={run} />
      )}
    </div>
  );
}

function BudgetChip({ s, onSave }: { s: SantaState; onSave: (b: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(s.budget ?? '');
  if (edit) return (
    <span className="flex items-center gap-1">
      <input autoFocus value={v} onChange={e => setV(e.target.value)} maxLength={40} placeholder={t('games.santa.budgetPlaceholder')} className="px-2 py-1 rounded-full text-xs text-slate-800 w-28" />
      <button onClick={() => { onSave(v); setEdit(false); }} className="p-1 rounded-full bg-white/25" aria-label={t('games.santa.saveBudget')}><Check size={12} /></button>
    </span>
  );
  if (!s.budget && !s.canManage) return null;
  return (
    <button disabled={!s.canManage || s.revealed} onClick={() => { setV(s.budget ?? ''); setEdit(true); }} className="px-2.5 py-1 rounded-full bg-white/20 disabled:cursor-default">
      {t('games.santa.budget', { budget: s.budget || t('games.santa.toDefine') })}
    </button>
  );
}

function WishCard({ initial, noWish, onSave }: { initial: string; noWish: boolean; onSave: (b: { text?: string; noWish?: boolean }) => Promise<boolean> }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => setText(initial), [initial]);
  const answered = !!initial.trim() || noWish;
  return (
    <div className={`p-4 rounded-2xl bg-white border shadow-sm ${answered ? 'border-slate-200' : 'border-amber-300'}`}>
      <p className="font-semibold text-slate-800 text-sm">{t('games.santa.myWishes')}</p>
      {!answered && (
        <p className="mt-1 mb-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
          {t('games.santa.fillWishes')}
        </p>
      )}
      {noWish ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t('games.santa.youHaveNoWish')}</p>
          <button onClick={() => onSave({ text: '' , noWish: false })} className="flex-shrink-0 text-xs font-medium text-indigo-600">{t('games.santa.writeWishes')}</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-2">{t('games.santa.wishHint')}</p>
          <textarea value={text} onChange={e => { setText(e.target.value); setSaved(false); }} rows={4} maxLength={1000}
            placeholder={t('games.santa.wishPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <button onClick={() => onSave({ noWish: true })} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2">
              {t('games.santa.iHaveNoWish')}
            </button>
            <span className="flex items-center gap-2">
              {saved && <span className="text-xs text-emerald-600">{t('games.santa.saved')}</span>}
              <button onClick={async () => { if (await onSave({ text })) setSaved(true); }} disabled={!text.trim() || text === initial}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{t('games.santa.saveWishes')}</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Deux conversations qu'il ne faut pas confondre : « give » (rouge, 🎁, la personne que je gâte)
// et « receive » (vert, 🎅, la personne qui me gâte). Couleur, icône, titre et rôle différents.
const THEMES = {
  give: { icon: '🎁', box: 'border-rose-300 bg-rose-50/60', badge: 'bg-rose-600', bubble: 'bg-rose-600', ring: 'focus:ring-rose-500', button: 'bg-rose-600' },
  receive: { icon: '🎅', box: 'border-emerald-300 bg-emerald-50/60', badge: 'bg-emerald-600', bubble: 'bg-emerald-600', ring: 'focus:ring-emerald-500', button: 'bg-emerald-600' },
};

function Thread({ kind, title, role, hint, placeholder, messages, otherLabel, readOnly, onSend }: {
  kind: 'give' | 'receive'; title: string; role: string; hint: string; placeholder: string;
  messages: Msg[]; otherLabel: string; readOnly: boolean; onSend: (c: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const th = THEMES[kind];
  return (
    <div className={`p-4 rounded-2xl border-2 shadow-sm ${th.box}`}>
      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide text-white ${th.badge}`}>{role}</span>
      <p className="font-bold text-slate-900 mt-1.5 flex items-center gap-1.5"><span className="text-xl">{th.icon}</span>{title}</p>
      <p className="text-xs text-slate-500 mb-3">{hint}</p>
      <div className="space-y-2">
        {messages.length === 0 && <p className="text-xs text-slate-400 italic">{t('games.santa.noMessage')}</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.mine ? `${th.bubble} text-white rounded-br-md` : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}>
              {!m.mine && <span className="block text-[11px] font-semibold opacity-70 mb-0.5">{otherLabel}</span>}
              {m.content}
            </div>
          </div>
        ))}
      </div>
      {!readOnly && (
        <form className="flex gap-2 mt-3" onSubmit={async e => { e.preventDefault(); if (text.trim() && await onSend(text.trim())) setText(''); }}>
          <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder={placeholder}
            className={`flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 ${th.ring}`} />
          <button type="submit" disabled={!text.trim()} aria-label={t('common.send')} className={`p-2.5 rounded-xl text-white disabled:opacity-40 ${th.button}`}><Send size={16} /></button>
        </form>
      )}
    </div>
  );
}

function ManagerPanel({ s, planId, run }: { s: SantaState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const pairs = s.exclusions.map(e => [e.a.id, e.b.id]);
  const saveExclusions = (list: string[][]) => run(() => api.put(`/plans/${planId}/santa`, { exclusions: list }));
  const fmtEnd = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(s.endDate));
  return (
    <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-4">
      <p className="font-semibold text-slate-800 text-sm">{t('games.organization')}</p>

      {!s.drawn && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-700">{t('games.santa.exclusions')}</p>
            <p className="text-xs text-slate-400 mb-2">{t('games.santa.exclusionsHint')}</p>
            {s.exclusions.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm text-slate-700 py-1">
                <span>{nameOf(e.a)} ✕ {nameOf(e.b)}</span>
                <button onClick={() => saveExclusions(pairs.filter(p => !(p[0] === e.a.id && p[1] === e.b.id)))} aria-label={t('votes.match.remove')} className="p-1 text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 mt-1">
              {[[a, setA], [b, setB]].map(([v, set], i) => (
                <select key={i} value={v as string} onChange={e => (set as (x: string) => void)(e.target.value)} className="flex-1 min-w-[8rem] px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white">
                  <option value="">{t('games.santa.pick')}</option>
                  {s.participants.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                </select>
              ))}
              <button disabled={!a || !b || a === b} onClick={async () => { if (await saveExclusions([...pairs, [a, b]])) { setA(''); setB(''); } }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 disabled:opacity-40">{t('common.add')}</button>
            </div>
          </div>
          <button
            disabled={s.participants.length < 3}
            onClick={() => {
              const pending = s.participants.filter(p => p.wishStatus === 'pending').map(nameOf);
              const warn = pending.length ? t('games.santa.pendingWarn', { count: pending.length, names: pending.join(', ') }) : '';
              if (confirm(t('games.santa.drawConfirm', { count: s.participants.length, warn }))) run(() => api.post(`/plans/${planId}/santa/draw`));
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40"
          >
            <Shuffle size={16} /> {t('games.santa.draw')}
          </button>
          {s.participants.length < 3 && <p className="text-xs text-slate-400 -mt-2">{t('games.santa.needThree')}</p>}
        </>
      )}

      {s.drawn && (
        <>
          {s.unpaired.length > 0 && (
            <div>
              <p className="text-sm text-slate-700">{t('games.santa.lateArrivals', { names: s.unpaired.map(nameOf).join(', ') })}</p>
              <button onClick={() => run(() => api.post(`/plans/${planId}/santa/add`))} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-medium text-slate-700">
                <UserPlus size={14} /> {t('games.santa.addToDraw')}
              </button>
            </div>
          )}
          <div>
            <button
              disabled={!s.canReveal}
              onClick={() => { if (confirm(t('games.santa.revealConfirm'))) run(() => api.post(`/plans/${planId}/santa/reveal`)); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40"
            >
              <Eye size={16} /> {t('games.santa.reveal')}
            </button>
            <p className="text-xs text-slate-400 mt-1.5">
              {s.eventDate ? t('games.santa.revealHint', { date: fmtDay(s.eventDate), end: fmtEnd }) : ''}
            </p>
          </div>
          <button
            onClick={() => { if (confirm(t('games.santa.redrawConfirm'))) run(() => api.post(`/plans/${planId}/santa/reset`)); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600"
          >
            <RotateCcw size={13} /> {t('games.santa.redraw')}
          </button>
        </>
      )}
    </div>
  );
}
