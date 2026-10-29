import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, BellRing, Briefcase, Gift, Heart, Home, ListChecks, PartyPopper, Shuffle, Users, VenetianMask, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LogoFull } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { countStep } from '../lib/funnel';
import { requestNewPlan } from '../lib/newPlanIntent';
import { currentLang, t } from '../i18n';

// Page de campagne « Père Noël secret » (/pere-noel, publique). « Organiser » mémorise l'intention sur l'appareil
// (lib/newPlanIntent.ts) puis envoie vers l'inscription ou le tableau de bord, qui ouvre la création du Plan « Père Noël
// secret » (Plan spécifique), même après la validation de l'email. Visites et clics comptés (lib/funnel.ts) ; la provenance
// (?src=instagram…) est gardée par lib/source.ts.

const APP_STORE_URL = 'https://apps.apple.com/app/id6818454100';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ch.evly.app';

const STEPS = ['s1', 's2', 's3'] as const;
const FEATURES = [
  { key: 'draw', Icon: Shuffle },
  { key: 'wishes', Icon: ListChecks },
  { key: 'messages', Icon: VenetianMask },
  { key: 'budget', Icon: Wallet },
  { key: 'reminders', Icon: BellRing },
  { key: 'reveal', Icon: PartyPopper },
] as const;
const AUDIENCES = [
  { key: 'work', Icon: Briefcase },
  { key: 'family', Icon: Home },
  { key: 'friends', Icon: Heart },
  { key: 'clubs', Icon: Users },
] as const;
const FAQ = ['1', '2', '3', '4'] as const;

// Flocons de la bannière : positions fixes (pas d'aléatoire au rendu)
const FLAKES = [[6, 14, 3], [18, 62, 2], [27, 30, 4], [39, 78, 2], [48, 10, 3], [57, 50, 2], [66, 24, 4], [74, 70, 3], [83, 38, 2], [92, 16, 3], [12, 86, 2], [88, 84, 3]];

export function SantaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    countStep('pere_noel', 'visit');
    const before = document.title;
    document.title = t('noel.pageTitle');
    return () => { document.title = before; };
  }, []);

  function start(existing = false) {
    countStep('funnel_cta_santa', 'click');
    requestNewPlan('pere_noel');
    navigate(user ? '/dashboard' : existing ? '/auth?redirect=/dashboard' : '/auth?mode=inscription&redirect=/dashboard');
  }

  const cta = (big = false) => (
    <button onClick={() => start()}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition-colors ${big ? 'px-7 py-4 text-base' : 'px-6 py-3.5 text-sm sm:text-base'}`}>
      <Gift size={big ? 20 : 18} />{user ? t('noel.ctaLogged') : t('noel.cta')}<ArrowRight size={18} />
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Bannière */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3b0d0c] via-[#5c1513] to-slate-950 text-white">
        {FLAKES.map(([x, y, r], i) => (
          <span key={i} aria-hidden className="absolute rounded-full bg-white/25" style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2 }} />
        ))}
        <div className="relative max-w-5xl mx-auto px-4 pt-4 pb-14 sm:pb-20">
          <div className="flex items-center justify-between">
            <Link to="/auth" aria-label="EvLY"><LogoFull iconSize={26} /></Link>
            <LanguagePicker compact loggedIn={!!user} />
          </div>
          <div className="mt-10 sm:mt-16 max-w-2xl">
            <p className="inline-block text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-rose-100">{t('noel.badge')}</p>
            <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              <span aria-hidden>🎅 </span>{t('noel.title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-rose-50/85 leading-relaxed">{t('noel.subtitle')}</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
              {cta(true)}
              <Link to="/demo?voir=pere-noel" className="inline-flex items-center justify-center px-5 py-3.5 rounded-2xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10">{t('noel.demo')}</Link>
            </div>
            {!user && (
              <button onClick={() => start(true)} className="mt-3 text-sm text-rose-100/80 underline underline-offset-4 hover:text-white">{t('noel.login')}</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* Comment ça marche */}
        <section className="-mt-8 sm:-mt-10 relative">
          <div className="grid sm:grid-cols-3 gap-3">
            {STEPS.map((s, i) => (
              <div key={s} className="bg-white rounded-2xl border border-slate-200 shadow-md p-5">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">{i + 1}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{t(`noel.steps.${s}.title`)}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(`noel.steps.${s}.text`)}</p>
              </div>
            ))}
          </div>
          <h2 className="sr-only">{t('noel.stepsTitle')}</h2>
        </section>

        {/* Fonctions */}
        <section className="mt-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>{t('noel.featuresTitle')}</h2>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ key, Icon }) => (
              <div key={key} className="flex gap-3 bg-white rounded-2xl border border-slate-200 p-4">
                <span className="w-10 h-10 flex-shrink-0 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center"><Icon size={20} /></span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{t(`noel.features.${key}.title`)}</h3>
                  <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">{t(`noel.features.${key}.text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pour qui */}
        <section className="mt-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>{t('noel.forTitle')}</h2>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {AUDIENCES.map(({ key, Icon }) => (
              <div key={key} className="flex items-center gap-2.5 bg-white rounded-2xl border border-slate-200 px-4 py-3.5">
                <Icon size={18} className="text-indigo-600 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-800">{t(`noel.for.${key}`)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Questions */}
        <section className="mt-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>{t('noel.faqTitle')}</h2>
          <div className="mt-5 space-y-2">
            {FAQ.map(n => (
              <details key={n} className="group bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold text-slate-900">
                  {t(`noel.faq.q${n}`)}<span className="text-indigo-600 text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t(`noel.faq.a${n}`)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Dernier appel */}
        <section className="mt-14 mb-10 rounded-3xl bg-gradient-to-br from-[#5c1513] to-slate-950 text-white p-6 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>{t('noel.bottomTitle')}</h2>
          <p className="mt-2 text-rose-50/85">{t('noel.bottomText')}</p>
          <div className="mt-6">{cta()}</div>
          {!Capacitor.isNativePlatform() && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                <img src={`/badges/app-store-${currentLang()}.svg`} alt={t('auth.page.appStore')} className="h-11 w-auto" />
              </a>
              <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer">
                <img src={`/badges/google-play-${currentLang()}.png`} alt={t('auth.page.googlePlay')} className="h-[52px] w-auto" />
              </a>
            </div>
          )}
        </section>
      </main>

      <footer className="pb-8 text-center text-xs text-slate-400 space-x-3">
        <Link to="/confidentialite" className="hover:text-slate-600">{t('auth.page.privacy')}</Link>
        <span>·</span>
        <a href="https://www.evly.ch" className="hover:text-slate-600">evly.ch</a>
      </footer>
    </div>
  );
}
