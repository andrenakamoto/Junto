import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Copy, HelpCircle, Loader2, MapPin, MessageSquare, Car, Image, Bell, Share2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';
import { TermsModal } from '../components/ui/TermsModal';
import { getLightToken, setLightToken } from '../lib/lightGuest';
import { publicOrigin } from '../lib/siteUrl';
import { countStep } from '../lib/funnel';
import { DateTimeField } from '../components/ui/DateTimeField';
import { intlLocale, t } from '../i18n';
import { Trans } from 'react-i18next';
import { LanguagePicker } from '../components/ui/LanguagePicker';

// « Organiser une sortie » (/organiser, serveur : routes/express.ts) : un Plan en 30 secondes,
// même sans compte, puis un lien à partager. Les amis répondent sans rien installer
// (/invitation). Sans compte, l'organisateur suit les réponses sur cet appareil (jeton
// d'invité léger) ; en créant son compte, il garde ses Plans (même jeton, lib/lightGuest.ts).

type Rsvp = 'in' | 'maybe' | 'out';
interface ExpressPlan {
  id: string;
  title: string;
  eventDate: string | null;
  location: string | null;
  inviteToken: string | null;
  answers: { name: string; rsvp: Rsvp }[];
}

const RSVP_STYLE: Record<Rsvp, { label: string; icon: typeof Check; className: string }> = {
  in: { label: t('auth.organize.rsvpIn'), icon: Check, className: 'text-emerald-300' },
  maybe: { label: t('auth.organize.rsvpMaybe'), icon: HelpCircle, className: 'text-amber-300' },
  out: { label: t('auth.organize.rsvpOut'), icon: X, className: 'text-slate-400' },
};

const dateFmt = (iso: string | null) => iso
  ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : '';

const inviteUrl = (token: string) => `${publicOrigin()}/invitation?token=${token}`;

function lightHeaders() {
  const t = getLightToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function OrganizePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [firstName, setFirstName] = useState('');
  const [knownName, setKnownName] = useState<string | null>(null);
  const [plans, setPlans] = useState<ExpressPlan[]>([]);
  const [created, setCreated] = useState<{ planId: string; inviteToken: string; title: string; eventDate: string; location: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Organisateur sans compte : ses sorties et les réponses, rafraîchies toutes les 15 s
  useEffect(() => {
    if (loading || user) return;
    let stop = false;
    const load = () => {
      if (!getLightToken() || document.hidden) return;
      api.get('/express/mine', { headers: lightHeaders() })
        .then(res => { if (!stop) { setPlans(res.data.plans); setKnownName(res.data.firstName); } })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { stop = true; window.clearInterval(timer); };
  }, [loading, user, created]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) return;
    setSending(true);
    setError('');
    try {
      const eventDate = new Date(when).toISOString();
      const { data } = await api.post('/express', { title, eventDate, location: where, firstName }, user ? {} : { headers: lightHeaders() });
      if (data.lightToken) setLightToken(data.lightToken);
      setCreated({ planId: data.planId, inviteToken: data.inviteToken, title: title.trim(), eventDate, location: where.trim() || null });
      setTitle(''); setWhen(''); setWhere('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.retryError'));
    } finally {
      setSending(false);
    }
  }

  function shareText(p: { title: string; eventDate: string | null; location: string | null; inviteToken: string }) {
    const date = dateFmt(p.eventDate);
    return t('auth.organize.shareText', { title: p.title, date: date.charAt(0).toUpperCase() + date.slice(1), location: p.location ? `\n📍 ${p.location}` : '', url: inviteUrl(p.inviteToken) });
  }

  function shared(planId: string) {
    countStep('funnel_express_shared', planId);
  }

  async function copy(p: { title: string; eventDate: string | null; location: string | null; inviteToken: string; planId: string }) {
    try {
      await navigator.clipboard.writeText(shareText(p));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      shared(p.planId);
    } catch { /* presse-papiers indisponible */ }
  }

  async function nativeShare(p: { title: string; eventDate: string | null; location: string | null; inviteToken: string; planId: string }) {
    try {
      await navigator.share({ title: p.title, text: shareText(p) });
      shared(p.planId);
    } catch { /* partage annulé */ }
  }

  if (loading) return null;
  const needName = !user && !knownName;
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const createdFull = created;
  const liveAnswers = created ? plans.find(p => p.id === created.planId)?.answers ?? [] : [];
  const others = plans.filter(p => p.id !== created?.planId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-start sm:items-center justify-center p-4 relative">
      <div className="absolute top-3 right-3 text-slate-300" style={{ marginTop: 'var(--sa-top, 0px)' }}>
        <LanguagePicker compact loggedIn={!!user} />
      </div>
      <div className="w-full max-w-md py-6 space-y-5">
        <div className="text-center">
          <div className="flex justify-center mb-3"><LogoIcon size={56} /></div>
          <h1 className="text-2xl font-black text-white">{createdFull ? t('auth.organize.ready') : t('auth.organize.title')}</h1>
          {!createdFull && <p className="text-slate-400 text-sm mt-1">{t('auth.organize.subtitle')}</p>}
        </div>

        {createdFull && (
          <Card>
            <div className="space-y-1">
              <p className="text-white font-bold">{createdFull.title}</p>
              <p className="text-sm text-indigo-200 flex items-center gap-2 first-letter:uppercase"><CalendarDays size={14} className="text-indigo-400" /><span className="first-letter:uppercase">{dateFmt(createdFull.eventDate)}</span></p>
              {createdFull.location && <p className="text-sm text-slate-300 flex items-center gap-2"><MapPin size={14} className="text-indigo-400" />{createdFull.location}</p>}
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText(createdFull))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => shared(createdFull.planId)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:brightness-95 text-white font-semibold rounded-xl text-sm"
            >
              <MessageSquare size={16} /> {t('auth.organize.whatsapp')}
            </a>
            <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button onClick={() => copy(createdFull)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm hover:bg-slate-700/40">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('auth.organize.copied') : t('auth.organize.copy')}
              </button>
              {/* Partage natif du téléphone (absent de la plupart des navigateurs d'ordinateur) */}
              {canShare && (
                <button onClick={() => nativeShare(createdFull)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm hover:bg-slate-700/40">
                  <Share2 size={15} /> {t('auth.organize.share')}
                </button>
              )}
            </div>
            {user ? (
              <button onClick={() => navigate(`/dashboard?planId=${createdFull.planId}`)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm">
                {t('auth.organize.openPlan')} <ArrowRight size={16} />
              </button>
            ) : (
              <Answers answers={liveAnswers} />
            )}
            <button onClick={() => setCreated(null)} className="w-full text-xs text-slate-400 hover:text-slate-200">{t('auth.organize.another')}</button>
          </Card>
        )}

        {!createdFull && (
          <Card>
            <form onSubmit={create} className="space-y-3">
              <Field label={t('auth.organize.what')}>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required autoFocus placeholder={t('auth.organize.whatPlaceholder')} className={inputClass} />
              </Field>
              <Field label={t('auth.organize.when')}>
                <DateTimeField value={when} onChange={setWhen} required dark />
              </Field>
              <Field label={t('auth.organize.where')}>
                <input value={where} onChange={e => setWhere(e.target.value)} maxLength={200} placeholder={t('auth.organize.wherePlaceholder')} className={inputClass} />
              </Field>
              {needName && (
                <Field label={t('auth.organize.firstName')}>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={30} required autoComplete="given-name" placeholder={t('auth.organize.firstNamePlaceholder')} className={inputClass} />
                </Field>
              )}
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t('auth.organize.create')}
              </button>
              {!user && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <Trans i18nKey="auth.organize.noAccount" components={{
                    terms: <button type="button" onClick={() => setShowTerms(true)} className="underline hover:text-slate-300" />,
                    privacy: <Link to="/confidentialite" className="underline hover:text-slate-300" />,
                  }} />
                </p>
              )}
            </form>
          </Card>
        )}

        {!user && others.length > 0 && (
          <Card>
            <p className="text-white font-semibold text-sm">{t('auth.organize.yourOutings')}</p>
            <div className="space-y-3">
              {others.map(p => (
                <div key={p.id} className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-3 space-y-2">
                  <div>
                    <p className="text-white text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-slate-400 first-letter:uppercase">{dateFmt(p.eventDate)}</p>
                  </div>
                  <Answers answers={p.answers} compact />
                  {p.inviteToken && (
                    <button onClick={() => setCreated({ planId: p.id, inviteToken: p.inviteToken!, title: p.title, eventDate: p.eventDate ?? '', location: p.location })} className="text-xs text-indigo-300 hover:text-indigo-200 font-medium">
                      {t('auth.organize.shareAgain')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!user && (plans.length > 0 || createdFull) && (
          <Card>
            <p className="text-white font-semibold text-sm">{t('auth.organize.keepControl')}</p>
            <ul className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Bell size={14} className="text-indigo-400" /> {t('auth.organize.notifications')}</li>
              <li className="flex items-center gap-2"><MessageSquare size={14} className="text-indigo-400" /> {t('auth.organize.chat')}</li>
              <li className="flex items-center gap-2"><Car size={14} className="text-indigo-400" /> {t('auth.organize.rides')}</li>
              <li className="flex items-center gap-2"><Image size={14} className="text-indigo-400" /> {t('auth.organize.photos')}</li>
            </ul>
            <button
              onClick={() => navigate(`/auth?${new URLSearchParams({ mode: 'inscription', redirect: '/dashboard', ...(knownName || firstName ? { prenom: knownName || firstName } : {}) })}`)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm"
            >
              {t('auth.guest.createAccount')} <ArrowRight size={16} />
            </button>
            <p className="text-center text-xs text-slate-500">
              {t('auth.organize.kept')}{' '}
              <button onClick={() => navigate('/auth?redirect=/dashboard')} className="text-slate-300 hover:text-white underline">{t('auth.guest.haveAccount')}</button>
            </p>
          </Card>
        )}

        {user && (
          <p className="text-center text-sm text-slate-400">
            <Link to="/dashboard" className="text-indigo-300 hover:text-indigo-200 font-medium">{t('auth.organize.backToCircles')}</Link>
          </p>
        )}
      </div>
      {showTerms && <TermsModal readOnly onClose={() => setShowTerms(false)} />}
    </div>
  );
}

const inputClass = 'w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Answers({ answers, compact }: { answers: { name: string; rsvp: Rsvp }[]; compact?: boolean }) {
  if (answers.length === 0) {
    return <p className="text-xs text-slate-400">{compact ? t('auth.organize.noAnswerYet') : t('auth.organize.answersHere')}</p>;
  }
  const going = answers.filter(a => a.rsvp === 'in').length;
  return (
    <div className="space-y-1.5">
      {!compact && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('auth.organize.answers', { count: going })}</p>}
      <ul className="space-y-1">
        {answers.map((a, i) => {
          const s = RSVP_STYLE[a.rsvp];
          const Icon = s.icon;
          return (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Icon size={14} className={s.className} />
              <span className="text-slate-200">{a.name}</span>
              <span className={`text-xs ${s.className}`}>— {s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-slate-700/50 space-y-4">{children}</div>;
}
