import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, PartyPopper, Check, Gift } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { lightTokenField } from '../lib/lightGuest';
import { sourceField } from '../lib/source';
import { MiniGarland, Snowfall, TreeScene } from '../components/noel/ChristmasDecor';
import { requestNewPlan } from '../lib/newPlanIntent';
import { LogoIcon } from '../components/ui/Logo';
import { GoogleWebButton } from '../components/ui/GoogleWebButton';
import { siteUrl } from '../lib/siteUrl';
import { countStep } from '../lib/funnel';
import { t, currentLang } from '../i18n';

// Fiche de l'app iPhone (id App Store Connect de ch.evly.app)
// De novembre au 25 décembre (et dès fin octobre, pour lancer la campagne)
const santaSeason = (d = new Date()) => (d.getMonth() === 9 && d.getDate() >= 25) || d.getMonth() === 10 || (d.getMonth() === 11 && d.getDate() <= 25);

const APP_STORE_URL = 'https://apps.apple.com/app/id6818454100';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ch.evly.app';
import { LanguagePicker } from '../components/ui/LanguagePicker';

type Mode = 'login' | 'register';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// Connexion Google dans les apps : nécessite un client OAuth iOS (VITE_GOOGLE_IOS_CLIENT_ID) et,
// pour Android, l'empreinte SHA-1 de la clé de signature déclarée dans la console Google Cloud.
// Tant que VITE_GOOGLE_NATIVE n'est pas à « 1 », le bouton est masqué dans les apps.
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '';
const NATIVE_GOOGLE_ENABLED = Capacitor.isNativePlatform() && import.meta.env.VITE_GOOGLE_NATIVE === '1' && !!GOOGLE_CLIENT_ID;

export function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Retour après connexion (ex. lien d'invitation) — chemin interne uniquement, pas d'URL externe
  const redirectParam = searchParams.get('redirect');
  // Chemin interne uniquement : « / » suivi d'autre chose que « / » ou « \ » (« /\site.com » vaut « //site.com »)
  const afterLogin = redirectParam && /^\/(?![/\\])/.test(redirectParam) && !/[\\\s]/.test(redirectParam)
    ? redirectParam
    : '/dashboard';
  // ?mode=inscription (lien depuis la fiche de présentation) ouvre directement l'inscription
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'inscription' ? 'register' : 'login');

  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  // Prénom déjà donné en répondant à une invitation sans compte (GuestInvitePage)
  const [firstName, setFirstName] = useState(searchParams.get('prenom') ?? '');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/auth/needs-setup').then(res => {
      if (res.data.needsSetup) navigate('/setup');
    });
    // Plugin natif uniquement : sur le web, voir GoogleWebButton (Google Identity Services).
    // Le jeton est émis pour le client web (webClientId / iOSServerClientId) : le serveur
    // le vérifie comme celui du site.
    if (NATIVE_GOOGLE_ENABLED) {
      SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_CLIENT_ID,
          iOSClientId: GOOGLE_IOS_CLIENT_ID,
          iOSServerClientId: GOOGLE_CLIENT_ID,
          mode: 'online',
        },
      }).catch(() => {});
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { pseudo, email, password, firstName, lastName, ...lightTokenField(), ...sourceField() });
        setSuccess(t('auth.page.created'));
        setEmail('');
        setPseudo('');
        setFirstName('');
        setLastName('');
        setPassword('');
        setMode('login');
      } else {
        // Accepte email ou pseudo (les anciens comptes n'ont pas d'email)
        const isEmail = email.includes('@');
        const { data } = await api.post('/auth/login', { ...(isEmail ? { email, password } : { pseudo: email, password }), ...lightTokenField() });
        login(data.token, data.user);
        navigate(afterLogin, { replace: true });
      }
    } catch (err: any) {
      const code = err.response?.data?.error;
      if (code === 'email_unverified') {
        setError(t('auth.page.unverified'));
      } else if (code === 'pending') {
        setError(t('auth.page.pending'));
      } else if (code === 'rejected') {
        setError(t('auth.page.rejected'));
      } else {
        setError(err.response?.data?.error || t('auth.page.error'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
      const idToken = res.provider === 'google' && 'idToken' in res.result ? res.result.idToken : null;
      if (!idToken) throw new Error('Pas de jeton Google');
      const { data } = await api.post('/auth/google', { idToken, ...lightTokenField(), ...sourceField() });
      login(data.token, data.user);
      navigate(afterLogin, { replace: true });
    } catch (err: any) {
      if (err?.error !== 'popup_closed_by_user' && err?.message !== 'User cancelled.') {
        setError(t('auth.page.googleCancelled'));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setGoogleLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/google', { idToken, ...lightTokenField(), ...sourceField() });
      login(data.token, data.user);
      navigate(afterLogin, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || t('auth.page.googleFailed'));
    } finally {
      setGoogleLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setSuccess('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative">
      {/* Langue, avant même de se connecter */}
      <div className="absolute top-3 right-3 text-slate-300" style={{ marginTop: 'var(--sa-top, 0px)' }}>
        <LanguagePicker compact />
      </div>
      {/* Campagne de Noël : sur grand écran, le panneau du Père Noël secret à droite de la connexion */}
      <div className="flex items-center justify-center gap-12 xl:gap-20 w-full">
      <div className="w-full max-w-sm">
        {/* En-tête épuré : la connexion d'abord, le reste sous le formulaire */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <LogoIcon size={56} />
          </div>
          <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">Events Linked to You</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-700/50">
          {/* Onglets */}
          <div className="flex rounded-xl bg-slate-900/80 p-1 mb-6">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? t('auth.page.login') : t('auth.page.register')}
              </button>
            ))}
          </div>

          {/* Messages */}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Bouton Google : plugin natif sur mobile, Google Identity Services sur le web */}
          {!Capacitor.isNativePlatform() ? (
            GOOGLE_CLIENT_ID && (
              <>
                <GoogleWebButton
                  clientId={GOOGLE_CLIENT_ID}
                  text={mode === 'login' ? 'continue_with' : 'signup_with'}
                  onCredential={handleGoogleCredential}
                  onError={setError}
                />
                {googleLoading && (
                  <p className="flex items-center justify-center gap-2 text-xs text-slate-400 -mt-2 mb-4">
                    <Loader2 size={13} className="animate-spin" /> {t('auth.page.connecting')}
                  </p>
                )}
              </>
            )
          ) : NATIVE_GOOGLE_ENABLED && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-semibold rounded-xl transition-colors text-sm mb-4 shadow-sm"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            )}
            {mode === 'login' ? t('auth.page.continueGoogle') : t('auth.page.signupGoogle')}
          </button>
          )}

          {(!Capacitor.isNativePlatform() ? !!GOOGLE_CLIENT_ID : NATIVE_GOOGLE_ENABLED) && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500 font-medium">{t('auth.page.or')}</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
          )}

          {/* Formulaire email */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('auth.page.firstName')}</label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder={t('auth.page.firstNamePlaceholder')}
                    required
                    maxLength={50}
                    autoComplete="given-name"
                    className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t('auth.page.lastName')} <span className="normal-case tracking-normal font-normal text-slate-500">{t('auth.page.lastNameHint')}</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder={t('auth.page.lastNamePlaceholder')}
                    maxLength={50}
                    autoComplete="family-name"
                    className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('auth.page.pseudo')}</label>
                <input
                  type="text"
                  value={pseudo}
                  onChange={e => setPseudo(e.target.value)}
                  placeholder={t('auth.page.pseudoPlaceholder')}
                  required
                  pattern="[a-zA-Z0-9_]{2,24}"
                  title={t('auth.page.pseudoRule')}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {mode === 'login' ? t('auth.page.emailOrPseudo') : t('auth.page.email')}
              </label>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={mode === 'login' ? t('auth.page.loginPlaceholder') : t('auth.emailPlaceholder')}
                required
                autoFocus={mode === 'login' && !Capacitor.isNativePlatform()}
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('auth.page.password')}</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {t('auth.page.forgot')}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  className="w-full px-4 py-3 pr-11 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-slate-500 mt-1.5">{t('auth.page.minLength')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('common.loading') : mode === 'login' ? t('auth.page.submitLogin') : t('auth.page.submitRegister')}
            </button>
          </form>
        </div>

        {/* Email de confirmation : à l'inscription, ou après une connexion refusée faute de confirmation */}
        {(mode === 'register' || error === t('auth.page.unverified')) && (
          <p className="text-center text-xs text-slate-500 mt-4">
            {t('auth.page.noEmail')}{' '}
            <button
              onClick={() => navigate('/resend-verification')}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              {t('auth.page.resend')}
            </button>
          </p>
        )}
        {/* Nouveaux visiteurs : Plan express (/organiser) ou démo sans compte (/demo) */}
        <div className="mt-8">
          <p className="text-center text-sm text-slate-400 mb-3">{t('auth.page.newHere')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/organiser"
              onClick={() => countStep('funnel_cta_express')}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-indigo-400/60 bg-indigo-600/15 text-indigo-100 hover:bg-indigo-600/25 font-semibold text-sm transition-colors"
            >
              <PartyPopper size={16} className="text-indigo-300" />
              {t('auth.page.organize')}
            </Link>
            <Link
              to="/demo"
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700/40 font-semibold text-sm transition-colors"
            >
              {t('auth.page.demo')}
              <ArrowRight size={15} />
            </Link>
          </div>
          {/* Campagne de Noël (/pere-noel), téléphone et tablette : une carte sous le formulaire (sur grand écran : panneau à droite) */}
          {santaSeason() && (
            <Link to="/pere-noel" className="lg:hidden mt-3 flex items-center gap-3 pl-2 pr-3 py-2 rounded-2xl border border-rose-400/30 bg-gradient-to-br from-[#0b1d3a] via-[#3b0d0c] to-[#6b1513] hover:border-rose-300/60 transition-colors">
              <TreeScene className="w-16 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-white font-semibold text-sm leading-snug">{t('noel.authBanner')}</span>
                <span className="block text-rose-100/80 text-xs mt-0.5">{t('noel.authBannerSub')}</span>
              </span>
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold">{t('noel.authBannerCta')} <ArrowRight size={13} /></span>
            </Link>
          )}
        </div>

        {/* Les apps (pas dans les apps elles-mêmes) : badges officiels d'Apple et de Google dans la langue de la page */}
        {!Capacitor.isNativePlatform() && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={APP_STORE_URL} target="_blank" rel="noopener" className="inline-block transition-opacity hover:opacity-85">
              <img src={`/badges/app-store-${currentLang()}.svg`} alt={t('auth.page.appStore')} className="h-11 w-auto" />
            </a>
            <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener" className="inline-block transition-opacity hover:opacity-85">
              <img src={`/badges/google-play-${currentLang()}.png`} alt={t('auth.page.googlePlay')} className="h-[52px] w-auto" />
            </a>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-10 leading-relaxed">
          <a href={siteUrl('/decouvrir.html')} target="_blank" rel="noopener" className="hover:text-slate-300 underline underline-offset-2">{t('auth.page.discover')}</a>
          {' · '}
          <a href={siteUrl('/brochure')} target="_blank" rel="noopener" className="hover:text-slate-300 underline underline-offset-2">{t('auth.page.brochure')}</a>
          {' · '}
          <a href={siteUrl('/brochure-pro')} target="_blank" rel="noopener" className="hover:text-slate-300 underline underline-offset-2">{t('auth.page.brochurePro')}</a>
          {' · '}
          <a href={siteUrl('/confidentialite')} className="hover:text-slate-300 underline underline-offset-2">{t('auth.page.privacy')}</a>
          <br />info@evly.ch
        </p>
      </div>
      {santaSeason() && <SantaPanel onOrganize={() => {
        countStep('funnel_cta_santa');
        requestNewPlan('pere_noel');
        switchMode('register');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />}
      </div>
    </div>
  );
}

// Campagne de Noël, grand écran : à droite de la connexion. « Organiser » ouvre l'inscription et mémorise l'intention
// (lib/newPlanIntent.ts) : après l'inscription, le tableau de bord ouvre la création du Père Noël secret.
function SantaPanel({ onOrganize }: { onOrganize: () => void }) {
  return (
    <aside className="hidden lg:flex flex-col relative overflow-hidden w-[440px] flex-shrink-0 rounded-3xl border border-rose-400/20 bg-gradient-to-b from-[#0b1d3a] via-[#3b0d0c] to-[#6b1513] text-white shadow-2xl shadow-black/40">
      <Snowfall count={16} />
      <MiniGarland count={15} />
      <div className="relative px-8 pt-4 pb-8">
        <TreeScene className="w-40 mx-auto drop-shadow-2xl" />
        <p className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-rose-100">{t('noel.badge')}</p>
        <h2 className="mt-3 text-3xl font-bold leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{t('noel.title')}</h2>
        <ul className="mt-4 space-y-2.5">
          {(['draw', 'wishes', 'messages'] as const).map(k => (
            <li key={k} className="flex gap-2.5 text-sm">
              <Check size={16} className="flex-shrink-0 mt-0.5 text-amber-300" />
              <span><b className="text-white">{t(`noel.features.${k}.title`)}</b> <span className="text-rose-50/80">· {t(`noel.features.${k}.text`)}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2.5">
          <button onClick={onOrganize} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-900/30 transition-colors">
            <Gift size={18} />{t('noel.cta')}<ArrowRight size={16} />
          </button>
          <Link to="/demo?voir=pere-noel" className="inline-flex items-center justify-center px-5 py-3 rounded-2xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10">{t('noel.demo')}</Link>
        </div>
      </div>
    </aside>
  );
}
