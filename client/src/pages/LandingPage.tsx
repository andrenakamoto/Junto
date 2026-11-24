import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Garland, SantaScene, Snowfall } from '../components/noel/ChristmasDecor';
import { requestNewPlan } from '../lib/newPlanIntent';
import { santaSeason } from '../lib/season';
import { ArrowRight, Banknote, Check, Compass, Dices, EyeOff, FileDown, Gift, HeartHandshake, Lock, MapPin, Mountain, ShieldCheck, Sparkles, Ticket, TrainFront, Users } from 'lucide-react';
import { LogoFull } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { countStep } from '../lib/funnel';
import { CountUp, FloatingBubbles, InteractivePhone, Magnetic, Reveal, RotatingWords, SideNav, StoryScroll, Tilt, WordReveal } from '../components/landing/LandingFx';
import { siteUrl } from '../lib/siteUrl';
import { discoverImageUrl, type DiscoverData, type DiscoverEvent } from '../lib/discover';
import api from '../services/api';
import { currentLang, intlLocale, t } from '../i18n';

// Site d'accueil d'EvLY (2026-11-17, demande de l'utilisateur : « faire un vrai site au lieu de juste un point de connexion »).
// Page / sur le web seulement (App.tsx : les apps ouvrent la connexion, une personne connectée va à ses Plans) ; la connexion
// est sur /auth. Écrans de l'app dessinés et animés (pas de captures), accroche « Fini les 300 messages… », histoire de la
// cafétéria dans « Confiance ». Textes : i18n/<langue>/landing.ts. Visites et clics comptés (lib/funnel.ts : home, funnel_cta_home).
// 2026-11-21 (demande de l'utilisateur) : accroche « On organise moins. On se voit plus. » avec fin de phrase qui change, téléphone
// qu'on touche, histoire d'un samedi qui défile avec le téléphone collé, avant / après à glisser, « Pour qui ? » qui change la page,
// points de navigation sur le bord et barre de progression, petits effets (components/landing/LandingFx.tsx).

const APP_STORE_URL = 'https://apps.apple.com/app/id6818454100';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ch.evly.app';
const AUDIENCES = [
  { key: 'friends', demo: 'amis', emoji: '🍻', tone: 'from-orange-500 to-rose-500', features: ['rsvp', 'money', 'games'] },
  { key: 'family', demo: 'surprise', emoji: '🎂', tone: 'from-pink-500 to-fuchsia-600', features: ['surprise', 'money', 'travel'] },
  { key: 'work', demo: 'organisation', emoji: '💼', tone: 'from-sky-500 to-indigo-600', features: ['rsvp', 'surprise', 'games'] },
  { key: 'clubs', demo: 'assemblee', emoji: '🏛️', tone: 'from-emerald-500 to-teal-600', features: ['rsvp', 'money', 'travel'] },
  { key: 'pros', demo: 'annonce', emoji: '🎟️', tone: 'from-violet-500 to-purple-700', features: ['rsvp', 'discover', 'travel'] },
] as const;
const FEATURES = [
  { key: 'rsvp', Icon: Users },
  { key: 'surprise', Icon: EyeOff },
  { key: 'money', Icon: Banknote },
  { key: 'travel', Icon: TrainFront },
  { key: 'games', Icon: Dices },
  { key: 'discover', Icon: Compass },
] as const;
const TRUST = [
  { key: 'free', Icon: HeartHandshake },
  { key: 'noads', Icon: ShieldCheck },
  { key: 'data', Icon: Lock },
  { key: 'swiss', Icon: Mountain },
] as const;

const signupUrl = '/auth?mode=inscription';

function Section({ id, children, tone = 'white' }: { id?: string; children: ReactNode; tone?: 'white' | 'soft' }) {
  return (
    <section id={id} className={`scroll-mt-16 ${tone === 'soft' ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">{children}</div>
    </section>
  );
}

const H2 = ({ children }: { children: ReactNode }) => (
  <Reveal><h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight text-center max-w-3xl mx-auto">{children}</h2></Reveal>
);

// Quelques vraies sorties autour de Genève (Découvrir), chargées quand la section arrive à l'écran
function LiveOutings() {
  const ref = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<DiscoverEvent[] | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      api.get<DiscoverData>('/discover', { params: { lat: 46.2, lon: 6.14, radius: 10, days: 7, v: 5 } })
        .then(r => {
          // Un seul événement par titre et par catégorie, pour montrer de la variété
          // Les agendas publics (Ville de Genève…) d'abord, puis les partenaires ; aucune annonce écartée pour sa langue
          // (essayé puis retiré le 2026-11-17 à la demande de l'utilisateur)
          const partner = new Set(r.data.sources.filter(x => x.type === 'partner').map(x => x.id));
          const pool = [...r.data.events]
            .sort((a, b) => Number(partner.has(a.sourceId)) - Number(partner.has(b.sourceId)));
          const picked: DiscoverEvent[] = [];
          for (const e of pool) {
            if (picked.length >= 4) break;
            if (!e.imageKey || e.multiDay || picked.some(p => p.title === e.title || p.category === e.category)) continue;
            picked.push(e);
          }
          setEvents(picked);
        })
        .catch(() => setEvents([]));
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const day = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  return (
    <div ref={ref} className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 min-h-[40px]">
      {(events ?? []).map(e => (
        <Link key={e.id} to="/sorties" className="group rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <img src={discoverImageUrl(e.imageKey!)} alt="" loading="lazy" className="w-full aspect-[2/1] object-cover" />
          <div className="p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">{day(e.startAt)}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-indigo-700">{e.title}</p>
            {e.place && <p className="mt-0.5 text-xs text-slate-500 truncate">{e.place}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

// Secret Santa mis en avant pendant la saison (2026-11-17, demande de l'utilisateur) : tout se fait dans l'app (même parcours
// que la page /pere-noel : l'intention survit à l'inscription et ouvre la création du Plan « Père Noël secret »)
function SantaHighlight() {
  const navigate = useNavigate();
  function organize() {
    countStep('funnel_cta_santa');
    requestNewPlan('pere_noel');
    navigate('/auth?mode=inscription&redirect=/dashboard');
  }
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1d3a] via-[#3b0d0c] to-[#6b1513] text-white">
      <Snowfall />
      <Garland />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
        <div>
          <p className="inline-block text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-rose-100">{t('landing.santa.badge')}</p>
          <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-bold leading-tight">{t('landing.santa.title')}</h2>
          <p className="mt-4 text-rose-50/85 leading-relaxed max-w-xl">{t('landing.santa.text')}</p>
          <ul className="mt-5 grid sm:grid-cols-2 gap-2 text-sm text-rose-50">
            {(['p1', 'p2', 'p3', 'p4'] as const).map(k => <li key={k} className="flex gap-2"><Check size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />{t(`landing.santa.${k}`)}</li>)}
          </ul>
          <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <button onClick={organize} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-red-600 text-white font-semibold px-6 py-3.5 shadow-lg shadow-black/30 hover:bg-red-500">
              <Gift size={18} />{t('landing.santa.cta')}<ArrowRight size={18} />
            </button>
            <Link to="/pere-noel" className="inline-flex items-center justify-center whitespace-nowrap px-5 py-3.5 rounded-2xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10">{t('landing.santa.more')}</Link>
            <a href="/demo?voir=pere-noel" className="inline-flex items-center justify-center whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-rose-100 underline underline-offset-4 hover:text-white">{t('landing.santa.example')}</a>
          </div>
        </div>
        <SantaScene className="hidden lg:block w-full max-w-[320px] mx-auto drop-shadow-2xl" />
      </div>
    </section>
  );
}

export function LandingPage() {
  const [audience, setAudience] = useState<typeof AUDIENCES[number]['key']>('friends');
  const navSections = useMemo(() => (['accueil', 'comment', 'en-bref', 'pour-qui', 'fonctions', 'sorties', 'confiance', 'questions'] as const)
    .map((id, i) => ({ id, label: t(`landing.fx.nav.${(['hero', 'story', 'compare', 'audiences', 'features', 'discover', 'trust', 'faq'] as const)[i]}`) })), []);

  useEffect(() => {
    countStep('home', 'visit');
    const before = document.title;
    document.title = t('landing.pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    const beforeMeta = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', t('landing.metaDescription'));
    return () => { document.title = before; if (meta && beforeMeta !== null) meta.setAttribute('content', beforeMeta); };
  }, []);

  const signupButton = (big = false) => (
    <Link to={signupUrl} onClick={() => countStep('funnel_cta_home')}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition-colors ${big ? 'px-7 py-4 text-base' : 'px-6 py-3.5 text-sm sm:text-base'}`}>
      {t('landing.hero.cta')}<ArrowRight size={18} />
    </Link>
  );
  const magneticSignup = (big = false) => <Magnetic>{signupButton(big)}</Magnetic>;
  const stores = (
    <div className="flex flex-wrap items-center gap-3">
      <a href={APP_STORE_URL} target="_blank" rel="noopener" className="hover:opacity-85"><img src={`/badges/app-store-${currentLang()}.svg`} alt="App Store" className="h-11 w-auto" /></a>
      <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener" className="hover:opacity-85"><img src={`/badges/google-play-${currentLang()}.png`} alt="Google Play" className="h-[52px] w-auto" /></a>
    </div>
  );
  const current = AUDIENCES.find(a => a.key === audience)!;

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <style>{`@keyframes landingIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes landingFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }
        @keyframes landingPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,.5) } 50% { box-shadow: 0 0 0 8px rgba(5,150,105,0) } }
        @keyframes landingConfetti { from { opacity: 1; transform: translate(0,0) rotate(0) } to { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--r)) } }
        html { scroll-behavior: smooth } @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }`}</style>
      <SideNav sections={navSections} />

      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link to="/" aria-label="EvLY" className="flex items-center gap-3">
            <LogoFull iconSize={26} />
            <span className="hidden sm:block text-[10px] font-extrabold tracking-[0.2em] text-orange-400 leading-tight">EVENTS LINKED<br />TO YOU</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 ml-6 text-sm font-medium text-slate-300">
            <Link to="/sorties" className="hover:text-white">{t('landing.nav.discover')}</Link>
            <Link to="/demo" className="hover:text-white">{t('landing.nav.demo')}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-white"><LanguagePicker compact /></div>
            <Link to="/auth" className="text-sm font-semibold text-slate-200 hover:text-white px-2 py-2">{t('landing.nav.login')}</Link>
            <Link to={signupUrl} onClick={() => countStep('funnel_cta_home')} className="hidden sm:inline-flex rounded-xl bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-500">{t('landing.nav.signup')}</Link>
          </div>
        </div>
      </header>

      {/* Accroche */}
      <section id="accueil" className="scroll-mt-16 relative overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#7c2d12_0%,rgba(15,23,42,0)_55%)] bg-[#0f172a] text-white">
        <FloatingBubbles />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="text-center">
            <p className="inline-block text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-orange-100">{t('landing.hero.kicker')}</p>
            <h1 className="mt-5 font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]"><WordReveal text={t('landing.hero.title')} /></h1>
            {/* Fin de phrase toujours sur sa propre ligne (2026-11-21) : sinon les fins longues passaient à la ligne et le texte sautait */}
            <p className="mt-5 text-lg sm:text-xl text-slate-200 leading-snug">
              {t('landing.fx.rotPrefix')}
              <span className="block mt-1 h-[1.3em] text-2xl sm:text-3xl whitespace-nowrap">
                <RotatingWords className="font-bold text-orange-400" words={(['rot1', 'rot2', 'rot3', 'rot4', 'rot5'] as const).map(k => t(`landing.fx.${k}`))} />
              </span>
            </p>
            <p className="mt-4 text-base text-slate-300 leading-relaxed max-w-xl mx-auto">{t('landing.hero.text')}</p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              {magneticSignup(true)}
              <Link to="/demo" className="inline-flex items-center justify-center px-6 py-4 rounded-2xl border border-white/25 text-base font-semibold text-white hover:bg-white/10">{t('landing.hero.demo')}</Link>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-400"><Check size={16} className="text-emerald-400" />{t('landing.hero.guests')}</p>
            <div className="mt-6 flex justify-center">{stores}</div>
          </div>
          <InteractivePhone />
        </div>
      </section>

      {santaSeason() && <SantaHighlight />}

      {/* Histoire d'un samedi : le téléphone reste en place et son écran suit la lecture */}
      <section id="comment" className="scroll-mt-16 bg-gradient-to-b from-white to-slate-50 pt-16 sm:pt-20 pb-8">
        <Reveal className="text-center px-4">
          <p className="text-sm font-bold uppercase tracking-wider text-orange-600">{t('landing.fx.storyKicker')}</p>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-slate-900">{t('landing.fx.storyTitle')}</h2>
        </Reveal>
        <div className="mt-6"><StoryScroll /></div>
      </section>

      {/* « En bref » d'un Plan (2026-11-21, demande de l'utilisateur : remplace « La même soirée… », redondant avec l'histoire) :
          vraie capture de la démo (Raclette chez Tom), une par langue dans public/landing/en-bref-<langue>.png */}
      <Section id="en-bref" tone="soft">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-5xl mx-auto">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-600">{t('landing.fx.briefKicker')}</p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{t('landing.fx.briefTitle')}</h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">{t('landing.fx.briefText')}</p>
            <ul className="mt-6 space-y-3">
              {(['briefP1', 'briefP2', 'briefP3', 'briefP4'] as const).map(k => (
                <li key={k} className="flex gap-3 text-slate-800"><Check size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />{t(`landing.fx.${k}`)}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={150}>
            <Tilt className="max-w-[448px] mx-auto">
              <img src={`/landing/en-bref-${currentLang()}.png`} alt={t('landing.fx.briefAlt')} width={448} height={540} loading="lazy"
                className="w-full h-auto rounded-[28px] shadow-2xl shadow-orange-900/25" />
            </Tilt>
          </Reveal>
        </div>
      </Section>

      {/* Pour qui ? : le choix change l'exemple et les fonctions mises en avant plus bas */}
      <Section id="pour-qui">
        <H2>{t('landing.audiences.title')}</H2>
        <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist">
          {AUDIENCES.map(a => (
            <button key={a.key} role="tab" aria-selected={audience === a.key} onClick={() => setAudience(a.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${audience === a.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
              {a.emoji} {t(`landing.audiences.${a.key}.tab`)}
            </button>
          ))}
        </div>
        <div key={current.key} className="mt-8 max-w-4xl mx-auto grid md:grid-cols-[1.2fr_1fr] gap-6 items-center animate-[landingIn_.45s_ease-out]">
          <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-8">
            <ul className="space-y-3">
              {(['p1', 'p2', 'p3'] as const).map((k, i) => (
                <li key={k} className="flex gap-3 text-slate-800 animate-[landingIn_.4s_ease-out_both]" style={{ animationDelay: `${120 + i * 120}ms` }}>
                  <Check size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />{t(`landing.audiences.${current.key}.${k}`)}
                </li>
              ))}
            </ul>
            <a href={`/demo?voir=${current.demo}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
              <Sparkles size={16} />{t('landing.audiences.seeExample')}<ArrowRight size={16} />
            </a>
          </div>
          <Tilt>
            <div className="rounded-3xl overflow-hidden shadow-xl bg-white border border-slate-200">
              <div className={`bg-gradient-to-br ${current.tone} p-6 text-white`}>
                <span className="text-5xl">{current.emoji}</span>
                <p className="mt-3 font-serif text-2xl font-bold leading-tight">{t(`landing.fx.plans.${current.key}.title`)}</p>
                <p className="mt-1 text-sm font-semibold text-white/85">{t(`landing.fx.plans.${current.key}.when`)}</p>
              </div>
              <div className="p-4 grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
                <span className="rounded-lg py-2 bg-emerald-600 text-white">{t('landing.mock.in')}</span>
                <span className="rounded-lg py-2 border-2 border-amber-400 text-amber-700">{t('landing.mock.maybe')}</span>
                <span className="rounded-lg py-2 border-2 border-slate-200 text-slate-500">{t('landing.mock.out')}</span>
              </div>
            </div>
          </Tilt>
        </div>
      </Section>

      {/* Fonctions phares : celles du public choisi plus haut d'abord, marquées « Pour toi » */}
      <Section id="fonctions" tone="soft">
        <H2>{t('landing.features.title')}</H2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...FEATURES].sort((a, b) => Number(!(current.features as readonly string[]).includes(a.key)) - Number(!(current.features as readonly string[]).includes(b.key))).map(({ key, Icon }, i) => {
            const mine = (current.features as readonly string[]).includes(key);
            return (
              <Reveal key={`${current.key}-${key}`} delay={i * 70}>
                <Tilt className="h-full">
                  <div className={`relative h-full rounded-2xl bg-white p-5 shadow-sm transition-colors ${mine ? 'border-2 border-indigo-400 shadow-indigo-100' : 'border border-slate-200'}`}>
                    {mine && <span className="absolute top-3 right-3 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">{t('landing.fx.featured')}</span>}
                    <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon size={22} /></span>
                    <h3 className="mt-3 font-bold text-slate-900">{t(`landing.features.${key}.title`)}</h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(`landing.features.${key}.text`)}</p>
                  </div>
                </Tilt>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Découvrir en direct */}
      <Section id="sorties">
        <H2>{t('landing.discover.title')}</H2>
        <p className="mt-4 text-center text-slate-600 max-w-2xl mx-auto">{t('landing.discover.text')}</p>
        <LiveOutings />
        <div className="mt-8 text-center">
          <Link to="/sorties" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50">
            <Compass size={18} />{t('landing.discover.button')}<ArrowRight size={16} />
          </Link>
        </div>
      </Section>

      {/* Confiance et histoire */}
      <section id="confiance" className="scroll-mt-16 bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <Reveal><h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-center max-w-3xl mx-auto">{t('landing.trust.title')}</h2></Reveal>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST.map(({ key, Icon }, i) => (
              <Reveal key={key} delay={i * 90}><div className="h-full rounded-2xl bg-white/5 border border-white/10 p-5">
                <Icon size={24} className="text-orange-400" />
                {/* Chiffre qui défile : jusqu'à 0 (pub, CHF, données vendues) ou 100 % (Suisse) */}
                <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-orange-300">
                  <CountUp from={key === 'swiss' ? 0 : 100} to={key === 'swiss' ? 100 : 0} render={n => t(`landing.fx.big.${key}`, { n })} />
                </p>
                <p className="mt-2 font-bold">{t(`landing.trust.${key}.title`)}</p>
                <p className="mt-1 text-sm text-slate-300">{t(`landing.trust.${key}.text`)}</p>
              </div></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Brochures PDF (2026-11-17, demande de l'utilisateur) : associations et professionnels, téléchargements comptés (/brochure, /brochure-pro) */}
      <Section>
        <H2>{t('landing.brochures.title')}</H2>
        <p className="mt-4 text-center text-slate-600 max-w-2xl mx-auto">{t('landing.brochures.text')}</p>
        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {([['assoc', '/brochure', Users], ['pro', '/brochure-pro', Ticket]] as const).map(([key, href, Icon]) => (
            <a key={key} href={siteUrl(href)} target="_blank" rel="noopener"
              className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-shadow">
              <span className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><Icon size={24} /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-slate-900">{t(`landing.brochures.${key}.title`)}</span>
                <span className="mt-1 block text-sm text-slate-600 leading-relaxed">{t(`landing.brochures.${key}.text`)}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 group-hover:text-indigo-800">
                  <FileDown size={16} />{t('landing.brochures.download')}
                </span>
              </span>
            </a>
          ))}
        </div>
      </Section>

      {/* Questions fréquentes */}
      <Section id="questions" tone="soft">
        <H2>{t('landing.faq.title')}</H2>
        <div className="mt-8 max-w-3xl mx-auto divide-y divide-slate-200 rounded-2xl bg-white border border-slate-200">
          {(['1', '2', '3', '4', '5', '6'] as const).map(n => (
            <details key={n} className="group p-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold text-slate-900">
                {t(`landing.faq.q${n}`)}<span className="text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t(`landing.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Dernier appel */}
      <section className="bg-[radial-gradient(circle_at_50%_100%,#7c2d12_0%,rgba(15,23,42,0)_60%)] bg-[#0f172a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">{t('landing.final.title')}</h2>
          <p className="mt-4 text-slate-300">{t('landing.final.text')}</p>
          <div className="mt-8 flex justify-center">{magneticSignup(true)}</div>
          <div className="mt-6 flex justify-center">{stores}</div>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="bg-[#0b1220] text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="space-y-2">
            <LogoFull iconSize={22} />
            <p className="text-xs">{t('landing.footer.made')}</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/sorties" className="hover:text-white">{t('landing.nav.discover')}</Link>
            <Link to="/demo" className="hover:text-white">{t('landing.nav.demo')}</Link>
            <a href={siteUrl('/brochure')} target="_blank" rel="noopener" className="hover:text-white">{t('landing.footer.brochure')}</a>
            <a href={siteUrl('/brochure-pro')} target="_blank" rel="noopener" className="hover:text-white">{t('landing.footer.brochurePro')}</a>
            <Link to="/confidentialite" className="hover:text-white">{t('landing.footer.privacy')}</Link>
            <Link to="/mentions-legales" className="hover:text-white">{t('legal.notice.title')}</Link>
            <Link to="/supprimer-mon-compte" className="hover:text-white">{t('landing.footer.deleteAccount')}</Link>
            <Link to="/securite-enfants" className="hover:text-white">{t('landing.footer.childSafety')}</Link>
            <a href="mailto:info@evly.ch" className="hover:text-white">{t('landing.footer.contact')}</a>
          </nav>
          <div className="sm:hidden"><LanguagePicker compact /></div>
        </div>
      </footer>
    </div>
  );
}
