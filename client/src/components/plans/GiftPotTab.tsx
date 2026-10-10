import { useEffect, useState } from 'react';
import { PiggyBank, ThumbsUp, Trash2, ExternalLink, Bell, Lock, Unlock, Settings2, Check, Gift } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { intlLocale, t } from '../../i18n';
import { Trans } from 'react-i18next';

// Cagnotte cadeau commune (serveur : routes/giftPot.ts). Chacun annonce sa participation, paie à
// l'organisateur selon ses indications et le signale ; l'organisateur confirme la réception. Idées de
// cadeau avec votes. Montants individuels : organisateur seulement.

type Person = { id: string; pseudo: string; firstName?: string | null };
interface PotState {
  canManage: boolean; isMember: boolean;
  forWhom: string | null; target: number | null; suggested: number | null; currency: string; payInfo: string | null;
  closed: boolean; chosenIdeaId: string | null;
  total: number; received: number; count: number;
  contributors: Person[];
  myPledge: { amount: number; declaredPaid: boolean; received: boolean } | null;
  pledges: { user: Person; amount: number; declaredPaid: boolean; received: boolean }[] | null;
  notYet: Person[] | null;
  canRemind: boolean;
  ideas: { id: string; text: string; url: string | null; price: number | null; createdBy: Person | null; votes: number; myVote: boolean; canDelete: boolean }[];
}

const nameOf = (p?: Person | null) => (p ? displayName(p) ?? `@${p.pseudo}` : '');
const card = 'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm';
const money = (n: number, currency: string) => `${new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n)} ${currency}`;
const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

export function GiftPotTab({ plan }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<PotState | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/pot`)).data); }
    catch (err: any) { setError(err.response?.data?.error || t('games.loadError')); }
  }
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); await load(); return true; }
    catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); return false; }
  }

  if (!s) return <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-400">{error}</div>;
  const progress = s.target ? Math.min(100, (s.total / s.target) * 100) : null;
  const chosen = s.ideas.find(i => i.id === s.chosenIdeaId);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white">
        <p className="text-lg font-bold flex items-center gap-2"><PiggyBank size={20} /> {s.forWhom ? t('games.pot.titleFor', { name: s.forWhom }) : t('games.pot.title')}</p>
        <p className="text-3xl font-bold mt-2">{money(s.total, s.currency)}</p>
        <p className="text-sm text-white/85">
          {t('games.pot.participants', { count: s.count })}{s.target ? t('games.pot.target', { amount: money(s.target, s.currency) }) : ''}{s.closed ? t('games.pot.closedTag') : ''}
        </p>
        {progress !== null && (
          <div className="mt-2 h-2 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} /></div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {chosen && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-2">
          <Gift size={16} /> <Trans i18nKey="games.pot.chosen" values={{ text: chosen.text }} components={{ b: <strong /> }} />
        </div>
      )}

      <MyPledge s={s} planId={plan.id} run={run} />

      {s.payInfo && (
        <div className={card}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('games.pot.howToPay')}</p>
          <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{s.payInfo}</p>
        </div>
      )}

      <Ideas s={s} planId={plan.id} run={run} />

      {s.contributors.length > 0 && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-1">{t('games.pot.contributors')}</p>
          <p className="text-sm text-slate-600">{s.contributors.map(nameOf).join(', ')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('games.pot.amountsPrivate')}</p>
        </div>
      )}

      {s.canManage && <ManagerPanel s={s} planId={plan.id} run={run} />}
    </div>
  );
}

function MyPledge({ s, planId, run }: { s: PotState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [amount, setAmount] = useState(s.myPledge?.amount?.toString() ?? s.suggested?.toString() ?? '');
  const [editing, setEditing] = useState(false);
  if (!s.isMember) return <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">{t('games.pot.joinPlan')}</p>;

  if (s.myPledge && !editing) {
    return (
      <div className={card}>
        <p className="text-sm text-slate-500">{t('games.pot.yourPledge')}</p>
        <p className="text-2xl font-bold text-slate-900">{money(s.myPledge.amount, s.currency)}</p>
        {s.myPledge.received ? (
          <p className="mt-2 text-sm text-emerald-700 font-medium flex items-center gap-1.5"><Check size={16} /> {t('games.pot.receivedThanks')}</p>
        ) : (
          <>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={s.myPledge.declaredPaid} onChange={e => run(() => api.put(`/plans/${planId}/pot/pledge/paid`, { paid: e.target.checked }))} className="accent-indigo-600 w-4 h-4" />
              {t('games.pot.paid')}
            </label>
            {!s.closed && (
              <div className="flex gap-3 mt-2 text-sm">
                <button onClick={() => { setAmount(s.myPledge!.amount.toString()); setEditing(true); }} className="text-indigo-600 font-medium hover:underline">{t('common.edit')}</button>
                <button onClick={() => { if (confirm(t('games.pot.removeConfirm'))) run(() => api.delete(`/plans/${planId}/pot/pledge`)); }} className="text-slate-500 hover:text-red-600">{t('games.pot.remove')}</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  if (s.closed) return <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">{t('games.pot.closed')}</p>;

  return (
    <form
      onSubmit={async e => { e.preventDefault(); if (await run(() => api.put(`/plans/${planId}/pot/pledge`, { amount }))) setEditing(false); }}
      className={card}
    >
      <p className="font-semibold text-slate-800">{s.myPledge ? t('games.pot.editPledge') : t('games.pot.iParticipate')}</p>
      {s.suggested && !s.myPledge && <p className="text-xs text-slate-500 mt-0.5">{t('games.pot.suggested', { amount: money(s.suggested, s.currency) })}</p>}
      <div className="flex gap-2 mt-2">
        <div className="relative flex-1">
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="20" required className={`${input} pr-12`} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{s.currency}</span>
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">{t('common.ok')}</button>
        {editing && <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm">{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

function Ideas({ s, planId, run }: { s: PotState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState(''); const [url, setUrl] = useState(''); const [price, setPrice] = useState('');
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-slate-800">{t('games.pot.ideas')}</p>
        {s.isMember && !adding && <button onClick={() => setAdding(true)} className="text-sm text-indigo-600 font-medium hover:underline">{t('games.pot.propose')}</button>}
      </div>
      {adding && (
        <form onSubmit={async e => { e.preventDefault(); if (await run(() => api.post(`/plans/${planId}/pot/ideas`, { text, url, price }))) { setAdding(false); setText(''); setUrl(''); setPrice(''); } }}
          className="space-y-2 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <input value={text} onChange={e => setText(e.target.value)} maxLength={150} required autoFocus placeholder={t('games.pot.ideaPlaceholder')} className={input} />
          <div className="flex gap-2">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder={t('games.pot.linkPlaceholder')} className={input} />
            <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder={t('games.pot.pricePlaceholder', { currency: s.currency })} className={`${input} !w-28`} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">{t('common.cancel')}</button>
            <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">{t('common.add')}</button>
          </div>
        </form>
      )}
      {!s.ideas.length && !adding && <p className="text-sm text-slate-400">{t('games.pot.noIdea')}</p>}
      <ul className="space-y-2">
        {s.ideas.map(i => (
          <li key={i.id} className={`p-3 rounded-xl border ${i.id === s.chosenIdeaId ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 break-words">{i.id === s.chosenIdeaId && '🎁 '}{i.text}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                  {i.price != null && <span>{money(i.price, s.currency)}</span>}
                  {i.createdBy && <span>{t('games.pot.by', { name: nameOf(i.createdBy) })}</span>}
                  {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-0.5 hover:underline">{t('games.pot.see')} <ExternalLink size={11} /></a>}
                </p>
              </div>
              <button disabled={!s.isMember} onClick={() => run(() => api.post(`/plans/${planId}/pot/ideas/${i.id}/vote`))}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold ${i.myVote ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <ThumbsUp size={14} /> {i.votes}
              </button>
            </div>
            {(s.canManage || i.canDelete) && (
              <div className="flex gap-3 mt-2 text-xs">
                {s.canManage && (
                  <button onClick={() => run(() => api.put(`/plans/${planId}/pot`, { chosenIdeaId: i.id === s.chosenIdeaId ? null : i.id }))} className="text-amber-700 font-medium hover:underline">
                    {i.id === s.chosenIdeaId ? t('games.pot.unchoose') : t('games.pot.choose')}
                  </button>
                )}
                {i.canDelete && <button onClick={() => { if (confirm(t('games.pot.deleteIdea'))) run(() => api.delete(`/plans/${planId}/pot/ideas/${i.id}`)); }} className="text-slate-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> {t('common.delete')}</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManagerPanel({ s, planId, run }: { s: PotState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [settings, setSettings] = useState(!s.forWhom && !s.payInfo && !s.count);
  const [f, setF] = useState({ forWhom: s.forWhom ?? '', target: s.target?.toString() ?? '', suggested: s.suggested?.toString() ?? '', currency: s.currency, payInfo: s.payInfo ?? '' });
  const [sent, setSent] = useState<number | null>(null);

  return (
    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{t('games.organization')}</p>
        {!settings && <button onClick={() => setSettings(true)} className="text-xs text-indigo-600 font-medium flex items-center gap-1 hover:underline"><Settings2 size={13} /> {t('games.pot.settings')}</button>}
      </div>

      {settings && (
        <form onSubmit={async e => { e.preventDefault(); if (await run(() => api.put(`/plans/${planId}/pot`, f))) setSettings(false); }} className="space-y-2">
          <label className="block text-sm text-slate-700">{t('games.pot.forWhom')}
            <input value={f.forWhom} onChange={e => setF({ ...f, forWhom: e.target.value })} maxLength={60} placeholder={t('games.pot.forWhomPlaceholder')} className={`${input} mt-1`} />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 text-sm text-slate-700">{t('games.pot.goal')}
              <input value={f.target} onChange={e => setF({ ...f, target: e.target.value })} inputMode="decimal" placeholder={t('games.pot.optionalPlaceholder')} className={`${input} mt-1`} />
            </label>
            <label className="flex-1 text-sm text-slate-700">{t('games.pot.suggestedLabel')}
              <input value={f.suggested} onChange={e => setF({ ...f, suggested: e.target.value })} inputMode="decimal" placeholder={t('games.pot.optionalPlaceholder')} className={`${input} mt-1`} />
            </label>
            <label className="w-20 text-sm text-slate-700">{t('games.pot.currency')}
              <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} className={`${input} mt-1`}><option>CHF</option><option>EUR</option></select>
            </label>
          </div>
          <label className="block text-sm text-slate-700">{t('games.pot.payInfo')}
            <textarea value={f.payInfo} onChange={e => setF({ ...f, payInfo: e.target.value })} maxLength={300} rows={2} placeholder={t('games.pot.payInfoPlaceholder')} className={`${input} mt-1 resize-none`} />
          </label>
          <p className="text-xs text-slate-400">{t('games.pot.settingsHint')}</p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSettings(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">{t('common.close')}</button>
            <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">{t('common.save')}</button>
          </div>
        </form>
      )}

      {s.pledges && s.pledges.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-1">{t('games.pot.pledges', { received: money(s.received, s.currency), total: money(s.total, s.currency) })}</p>
          <ul className="divide-y divide-slate-100">
            {s.pledges.map(p => (
              <li key={p.user.id} className="py-2 flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate text-slate-700">{nameOf(p.user)}</span>
                <span className="font-semibold text-slate-800 tabular-nums">{money(p.amount, s.currency)}</span>
                {p.declaredPaid && !p.received && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t('games.pot.saysPaid')}</span>}
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={p.received} onChange={e => run(() => api.put(`/plans/${planId}/pot/pledges/${p.user.id}`, { received: e.target.checked }))} className="accent-emerald-600 w-4 h-4" />
                  {t('games.pot.received')}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.notYet && s.notYet.length > 0 && (
        <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">{t('games.pot.notYet')}</span> {s.notYet.map(nameOf).join(', ')}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!s.closed && (
          <button disabled={!s.canRemind} onClick={async () => { try { const { data } = await api.post(`/plans/${planId}/pot/remind`); setSent(data.sent); } catch { /* erreur affichée au rechargement */ } run(async () => {}); }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-40">
            <Bell size={15} /> {t('games.pot.remind')}
          </button>
        )}
        <button onClick={() => { if (confirm(s.closed ? t('games.pot.reopenConfirm') : t('games.pot.closeConfirm'))) run(() => api.post(`/plans/${planId}/pot/close`, { closed: !s.closed })); }}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 flex items-center gap-1.5 hover:bg-slate-50">
          {s.closed ? <><Unlock size={15} /> {t('games.pot.reopen')}</> : <><Lock size={15} /> {t('games.pot.close')}</>}
        </button>
      </div>
      {sent !== null && <p className="text-xs text-emerald-700">{t('games.pot.reminded', { count: sent })}</p>}
      {!s.canRemind && !s.closed && sent === null && <p className="text-xs text-slate-400">{t('games.pot.remindLimit')}</p>}
    </div>
  );
}
