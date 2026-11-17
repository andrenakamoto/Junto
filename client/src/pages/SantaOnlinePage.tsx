import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowRight, Check, Copy, Gift, Loader2, Mail, MessageCircle, Plus, Smartphone, Trash2, X } from 'lucide-react';
import { requestNewPlan } from '../lib/newPlanIntent';
import { countStep } from '../lib/funnel';
import api from '../services/api';
import { LogoFull } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { DateTimeField } from '../components/ui/DateTimeField';
import { Garland, Snowfall, SnowGround } from '../components/noel/ChristmasDecor';
import { publicOrigin } from '../lib/siteUrl';
import { useAuth } from '../contexts/AuthContext';
import { intlLocale, t } from '../i18n';

// Secret Santa en ligne, gratuit et sans compte (2026-11-17, serveur : routes/santaOnline.ts). Porte d'entrée vers EvLY :
//  /secret-santa           créer le tirage (prénoms, emails facultatifs, exclusions)
//  /secret-santa?o=<jeton> page de l'organisateur : un lien secret par personne à transmettre (jamais « qui offre à qui »)
//  /secret-santa?p=<jeton> page d'un participant : la personne à qui il offre, ses envies, sa propre liste
// Adresses sur un seul niveau : le site charge ses fichiers par un chemin relatif (./assets, pour les apps), qui ne se
// résout pas depuis /secret-santa/p/… (écran bloqué sur le logo, constaté le 2026-11-17). Les anciens liens sont redirigés.
// Chaque page invite ensuite à découvrir EvLY (chat anonyme, rappels, révélation…).

const errText = (err: any) => err?.response?.data?.error || t('santaOnline.error');
const dayFmt = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

function useTitle() {
  useEffect(() => {
    const before = document.title;
    document.title = t('santaOnline.pageTitle');
    return () => { document.title = before; };
  }, []);
}

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="relative overflow-hidden bg-gradient-to-b from-[#0b1d3a] via-[#3b0d0c] to-[#6b1513] text-white">
        <Snowfall />
        <Garland />
        <SnowGround />
        <div className={`relative mx-auto px-4 pt-10 pb-16 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
          <div className="flex items-center justify-between">
            <Link to="/auth" aria-label="EvLY"><LogoFull iconSize={24} /></Link>
            <LanguagePicker compact loggedIn={!!user} />
          </div>
          <p className="mt-8 inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-rose-100">{t('santaOnline.badge')}</p>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-bold leading-tight">🎁 {t('santaOnline.title')}</h1>
        </div>
      </header>
      <main className={`mx-auto px-4 -mt-6 pb-16 relative space-y-5 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>{children}</main>
    </div>
  );
}

// Encart vers EvLY, sur les trois pages
function EvlyCta({ own = false }: { own?: boolean }) {
  const { user } = useAuth();
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
      <h2 className="font-bold text-lg text-slate-900">{t('santaOnline.cta.title')}</h2>
      <p className="text-sm text-slate-600">{t('santaOnline.cta.text')}</p>
      <div className="flex flex-wrap gap-2">
        <Link to={user ? '/dashboard' : '/auth?mode=inscription'}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-indigo-500">
          {user ? t('santaOnline.cta.discover') : t('santaOnline.cta.create')}<ArrowRight size={16} />
        </Link>
        <Link to="/pere-noel" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 text-sm font-semibold px-4 py-2.5 text-slate-700 hover:bg-slate-50">
          {t('santaOnline.cta.discover')}
        </Link>
        {own && (
          <Link to="/secret-santa" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 text-sm font-semibold px-4 py-2.5 text-slate-700 hover:bg-slate-50">
            <Gift size={15} />{t('santaOnline.cta.own')}
          </Link>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────── Création du tirage
function SantaOnlineCreatePage() {
  useTitle();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Dans l'app : même parcours que la page /pere-noel (l'intention survit à l'inscription et à la validation de l'email)
  function inApp() {
    countStep('funnel_cta_santa', 'click');
    requestNewPlan('pere_noel');
    navigate(user ? '/dashboard' : '/auth?mode=inscription&redirect=/dashboard');
  }
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState([{ name: '', email: '' }, { name: '', email: '' }, { name: '', email: '' }]);
  const [exclusions, setExclusions] = useState<[number, number][]>([]);
  const [sendEmails, setSendEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const named = people.map((p, i) => ({ ...p, i })).filter(p => p.name.trim());
  const hasEmail = people.some(p => p.email.trim());

  const setPerson = (i: number, patch: Partial<{ name: string; email: string }>) => setPeople(prev => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  function removePerson(i: number) {
    setPeople(prev => prev.filter((_, j) => j !== i));
    setExclusions(prev => prev.filter(([a, b]) => a !== i && b !== i).map(([a, b]) => [a > i ? a - 1 : a, b > i ? b - 1 : b] as [number, number]));
  }

  async function submit() {
    setError('');
    if (named.length < 3) { setError(t('santaOnline.form.needMore')); return; }
    setBusy(true);
    try {
      // Les indices des exclusions suivent les lignes remplies (le serveur ignore les prénoms vides)
      const index = new Map(named.map((p, k) => [p.i, k]));
      const { data } = await api.post('/santa-online', {
        title, budget, exchangeDate: date ? `${date.slice(0, 10)}T12:00:00` : '',
        people: named.map(p => ({ name: p.name, email: p.email })),
        exclusions: exclusions.filter(([a, b]) => index.has(a) && index.has(b)).map(([a, b]) => [index.get(a), index.get(b)]),
        sendEmails: sendEmails && hasEmail,
      });
      navigate(`/secret-santa?o=${data.adminToken}`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
  return (
    <Shell>
      {/* Deux façons de faire (2026-11-17, demande de l'utilisateur) : dans l'app EvLY (messages avec son Père Noël secret…)
          ou ici, sans compte, en gardant bien le lien de la page de l'organisateur */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="font-bold text-lg text-slate-900">{t('santaOnline.choice.title')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-indigo-500 bg-indigo-50/50 p-4 flex flex-col gap-2">
            <p className="flex items-center gap-2 font-bold text-slate-900"><Smartphone size={18} className="text-indigo-600" />{t('santaOnline.choice.appTitle')}
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide rounded-full bg-indigo-600 text-white px-2 py-0.5">{t('santaOnline.choice.appBadge')}</span></p>
            <ul className="text-sm text-slate-700 space-y-1">
              {(['p1', 'p2', 'p3', 'p4'] as const).map(k => <li key={k} className="flex gap-1.5"><Check size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />{t(`santaOnline.choice.${k}`)}</li>)}
            </ul>
            <button onClick={inApp} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-indigo-500">
              {user ? t('santaOnline.choice.appButtonLogged') : t('santaOnline.choice.appButton')}<ArrowRight size={16} />
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 flex flex-col gap-2">
            <p className="flex items-center gap-2 font-bold text-slate-900"><Gift size={18} className="text-red-600" />{t('santaOnline.choice.webTitle')}</p>
            <p className="text-sm text-slate-700">{t('santaOnline.choice.webText')}</p>
            <p className="flex gap-1.5 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
              <AlertTriangle size={14} className="mt-px flex-shrink-0" />{t('santaOnline.choice.webWarn')}</p>
            <button onClick={() => document.getElementById('santa-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-sm font-semibold px-4 py-2.5 text-slate-800 hover:bg-slate-50">
              {t('santaOnline.choice.webButton')}<ArrowDown size={16} />
            </button>
          </div>
        </div>
      </section>

      <section id="santa-form" className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4 scroll-mt-4">
        <h2 className="font-bold text-lg text-slate-900">{t('santaOnline.choice.webTitle')}</h2>
        <p className="text-sm text-slate-600">{t('santaOnline.subtitle')}</p>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-800">{t('santaOnline.form.title')}</span>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder={t('santaOnline.form.titlePh')} className={input} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-800">{t('santaOnline.form.date')}</span>
            <DateTimeField value={date} onChange={setDate} mode="date" clearable />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-800">{t('santaOnline.form.budget')}</span>
            <input value={budget} onChange={e => setBudget(e.target.value)} maxLength={40} placeholder={t('santaOnline.form.budgetPh')} className={input} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{t('santaOnline.form.people')} <span className="text-slate-400 font-medium">{named.length}</span></p>
          <p className="text-xs text-slate-500">{t('santaOnline.form.peopleHint')}</p>
          {people.map((p, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={p.name} onChange={e => setPerson(i, { name: e.target.value })} maxLength={40}
                placeholder={i === 0 ? `${t('santaOnline.form.namePh')} (${t('santaOnline.form.you')})` : t('santaOnline.form.namePh')} className={`${input} flex-1 min-w-0`} />
              <input value={p.email} onChange={e => setPerson(i, { email: e.target.value })} type="email" inputMode="email"
                placeholder={t('santaOnline.form.emailPh')} className={`${input} flex-1 min-w-0`} />
              <button onClick={() => removePerson(i)} disabled={people.length <= 3} aria-label={t('santaOnline.form.remove')}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 flex-shrink-0"><X size={16} /></button>
            </div>
          ))}
          {people.length < 40 && (
            <button onClick={() => setPeople(prev => [...prev, { name: '', email: '' }])} className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
              <Plus size={16} />{t('santaOnline.form.add')}
            </button>
          )}
        </div>

        {named.length >= 2 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{t('santaOnline.form.exclusions')}</p>
            <p className="text-xs text-slate-500">{t('santaOnline.form.exclusionsHint')}</p>
            {exclusions.map(([a, b], k) => (
              <div key={k} className="flex gap-2 items-center">
                {[a, b].map((v, side) => (
                  <select key={side} value={v} onChange={e => setExclusions(prev => prev.map((x, j) => j === k ? (side === 0 ? [Number(e.target.value), x[1]] : [x[0], Number(e.target.value)]) as [number, number] : x))}
                    className={`${input} flex-1 min-w-0`}>
                    <option value={-1}>{t('santaOnline.form.choose')}</option>
                    {named.map(p => <option key={p.i} value={p.i}>{p.name}</option>)}
                  </select>
                ))}
                <button onClick={() => setExclusions(prev => prev.filter((_, j) => j !== k))} aria-label={t('santaOnline.form.remove')}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><X size={16} /></button>
              </div>
            ))}
            <button onClick={() => setExclusions(prev => [...prev, [-1, -1]])} className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
              <Plus size={16} />{t('santaOnline.form.addExclusion')}
            </button>
          </div>
        )}

        {hasEmail && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={sendEmails} onChange={e => setSendEmails(e.target.checked)} className="mt-0.5" />{t('santaOnline.form.sendEmails')}
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={submit} disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-600 text-white font-bold py-3.5 hover:bg-red-500 disabled:opacity-60">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}{busy ? t('santaOnline.form.submitting') : t('santaOnline.form.submit')}
        </button>
        <p className="text-xs text-slate-400">{t('santaOnline.form.privacy')} <Link to="/confidentialite" className="underline">{t('santaOnline.form.privacyLink')}</Link></p>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="font-bold text-lg text-slate-900">{t('santaOnline.how.title')}</h2>
        <ol className="space-y-2 text-sm text-slate-700">
          {(['s1', 's2', 's3'] as const).map((s, i) => (
            <li key={s} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>{t(`santaOnline.how.${s}`)}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="font-bold text-lg text-slate-900">{t('santaOnline.faq.title')}</h2>
        {(['1', '2', '3', '4'] as const).map(n => (
          <details key={n} className="group border-t border-slate-100 pt-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t(`santaOnline.faq.q${n}`)}</summary>
            <p className="mt-1 text-sm text-slate-600">{t(`santaOnline.faq.a${n}`)}</p>
          </details>
        ))}
      </section>
      <EvlyCta />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────── Page de l'organisateur
interface AdminView {
  title: string; budget: string | null; exchangeDate: string | null; expiresAt: string;
  people: { id: string; name: string; hasEmail: boolean; token: string; opened: boolean; wishes: boolean; emailSentAt: string | null }[];
}

// /secret-santa : création, page de l'organisateur (?o=) ou d'un participant (?p=)
export function SantaOnlinePage() {
  const [params] = useSearchParams();
  const o = params.get('o'), p = params.get('p');
  if (o) return <SantaOnlineAdminPage token={o} />;
  if (p) return <SantaOnlineParticipantPage token={p} />;
  return <SantaOnlineCreatePage />;
}

// Anciennes adresses /secret-santa/o/:token et /p/:token (liens déjà envoyés), dans l'app
export function SantaOnlineLegacyRedirect({ kind }: { kind: 'o' | 'p' }) {
  const { token } = useParams();
  return <Navigate to={`/secret-santa?${kind}=${token ?? ''}`} replace />;
}

function SantaOnlineAdminPage({ token }: { token: string }) {
  useTitle();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminView | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get<AdminView>(`/santa-online/o/${token}`).then(r => setData(r.data)).catch(err => setError(err?.response?.status === 404 ? t('santaOnline.notFound') : errText(err)));
  useEffect(() => { load(); }, [token]);

  const linkOf = (tok: string) => `${publicOrigin()}/secret-santa?p=${tok}`;
  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* presse-papiers refusé */ }
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
  }
  async function email(personId?: string) {
    setBusy(true);
    try {
      const { data: r } = await api.post(`/santa-online/o/${token}/email`, personId ? { personId } : {});
      setNotice(t('santaOnline.admin.sentCount', { count: r.sent }));
      load();
    } catch (err) { setNotice(errText(err)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(t('santaOnline.admin.delConfirm'))) return;
    await api.delete(`/santa-online/o/${token}`).catch(() => {});
    navigate('/secret-santa');
  }

  if (error) return <Shell><p className="rounded-2xl bg-white border border-slate-200 p-5 text-sm text-slate-600">{error}</p><EvlyCta own /></Shell>;
  if (!data) return <Shell><div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div></Shell>;
  const waiting = data.people.some(p => p.hasEmail && !p.emailSentAt);
  return (
    <Shell wide>
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="font-bold text-xl text-slate-900">{t('santaOnline.admin.title')}</h2>
        <p className="text-sm text-slate-700"><strong>{data.title}</strong>{data.exchangeDate ? ` · ${dayFmt(data.exchangeDate)}` : ''}{data.budget ? ` · ${data.budget}` : ''}</p>
        <p className="text-sm text-slate-600">{t('santaOnline.admin.intro')}</p>
        <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">{t('santaOnline.admin.keep')}</p>
        <button onClick={() => copy(window.location.href, 'page')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
          {copied === 'page' ? <Check size={15} /> : <Copy size={15} />}{copied === 'page' ? t('santaOnline.admin.copied') : t('santaOnline.admin.copyPage')}
        </button>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
        {data.people.map((p, i) => {
          const link = linkOf(p.token);
          const message = t('santaOnline.admin.share', { name: p.name, title: data.title, link });
          return (
            <div key={p.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">{p.name}</span>
                {i === 0 && <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">{t('santaOnline.admin.you')}</span>}
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${p.opened ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.opened ? `✓ ${t('santaOnline.admin.opened')}` : t('santaOnline.admin.notOpened')}
                </span>
                {p.wishes && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700">🎁 {t('santaOnline.admin.wishes')}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(i === 0 ? link : message, p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  {copied === p.id ? <Check size={14} /> : <Copy size={14} />}{copied === p.id ? t('santaOnline.admin.copied') : t('santaOnline.admin.copy')}
                </button>
                {i === 0 ? (
                  <a href={link} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"><Gift size={14} />{t('santaOnline.p.reveal')}</a>
                ) : (
                  <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"><MessageCircle size={14} />{t('santaOnline.admin.whatsapp')}</a>
                )}
                {p.hasEmail && i !== 0 && (
                  <button onClick={() => email(p.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <Mail size={14} />{p.emailSentAt ? `✓ ${t('santaOnline.admin.emailSent')}` : t('santaOnline.admin.email')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {waiting && (
        <button onClick={() => email()} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-500 disabled:opacity-60">
          <Mail size={17} />{t('santaOnline.admin.sendAll')}
        </button>
      )}
      {notice && <p className="text-sm text-slate-600 text-center">{notice}</p>}
      <EvlyCta />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{t('santaOnline.admin.expires', { date: dayFmt(data.expiresAt) })}</span>
        <button onClick={remove} className="inline-flex items-center gap-1 hover:text-red-600"><Trash2 size={13} />{t('santaOnline.admin.del')}</button>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────── Page d'un participant
interface ParticipantView {
  title: string; budget: string | null; exchangeDate: string | null; count: number;
  me: { name: string; wishes: string; noWish: boolean };
  receiver: { name: string; wishes: string; noWish: boolean } | null;
}

function SantaOnlineParticipantPage({ token }: { token: string }) {
  useTitle();
  const [data, setData] = useState<ParticipantView | null>(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [wishes, setWishes] = useState('');
  const [noWish, setNoWish] = useState(false);
  const [saved, setSaved] = useState(false);
  const seenKey = `evly_santa_online_seen_${token}`;

  useEffect(() => {
    api.get<ParticipantView>(`/santa-online/p/${token}`).then(r => {
      setData(r.data); setWishes(r.data.me.wishes); setNoWish(r.data.me.noWish);
      try { if (localStorage.getItem(seenKey)) setRevealed(true); } catch { /* stockage indisponible */ }
    }).catch(err => setError(err?.response?.status === 404 ? t('santaOnline.notFound') : errText(err)));
  }, [token]);

  function reveal() {
    setRevealed(true);
    try { localStorage.setItem(seenKey, '1'); } catch { /* stockage indisponible */ }
  }
  async function save() {
    await api.put(`/santa-online/p/${token}/wishes`, { wishes, noWish: noWish && !wishes.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (error) return <Shell><p className="rounded-2xl bg-white border border-slate-200 p-5 text-sm text-slate-600">{error}</p><EvlyCta own /></Shell>;
  if (!data) return <Shell><div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div></Shell>;
  return (
    <Shell>
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center space-y-3">
        <p className="text-sm text-slate-500">{data.title}</p>
        <h2 className="font-bold text-2xl text-slate-900">{t('santaOnline.p.hello', { name: data.me.name })}</h2>
        {!revealed ? (
          <button onClick={reveal} className="mx-auto flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-red-600 to-red-700 text-white px-10 py-8 shadow-lg shadow-red-900/30 hover:scale-[1.02] transition-transform">
            <span className="text-5xl">🎁</span>
            <span className="font-bold">{t('santaOnline.p.reveal')}</span>
          </button>
        ) : data.receiver && (
          <div className="space-y-1">
            <p className="text-sm text-slate-600">{t('santaOnline.p.giftTo')}</p>
            <p className="font-serif text-4xl font-bold text-red-600">{data.receiver.name} 🎁</p>
          </div>
        )}
        <div className="text-sm text-slate-600 space-y-0.5">
          {data.budget && <p>💰 {t('santaOnline.p.budget', { budget: data.budget })}</p>}
          {data.exchangeDate && <p>📅 {t('santaOnline.p.date', { date: dayFmt(data.exchangeDate) })}</p>}
        </div>
      </section>

      {revealed && data.receiver && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-2">
          <h3 className="font-semibold text-slate-900">{t('santaOnline.p.theirWishes')}</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {data.receiver.wishes || (data.receiver.noWish ? t('santaOnline.p.theyNoWish') : t('santaOnline.p.noWishYet'))}
          </p>
        </section>
      )}

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-2">
        <h3 className="font-semibold text-slate-900">{t('santaOnline.p.myWishes')}</h3>
        <p className="text-xs text-slate-500">{t('santaOnline.p.myWishesHint')}</p>
        <textarea value={wishes} onChange={e => { setWishes(e.target.value); if (e.target.value.trim()) setNoWish(false); }} maxLength={1000} rows={3}
          placeholder={t('santaOnline.p.wishesPh')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={noWish} disabled={!!wishes.trim()} onChange={e => setNoWish(e.target.checked)} />{t('santaOnline.p.noWish')}
        </label>
        <button onClick={save} className="rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-500">
          {saved ? t('santaOnline.p.saved') : t('santaOnline.p.save')}
        </button>
        <p className="text-xs text-slate-400">{t('santaOnline.p.keep')}</p>
      </section>
      <EvlyCta own />
    </Shell>
  );
}
