import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Garland, SantaScene, Snowfall } from '../components/noel/ChristmasDecor';
import { requestNewPlan } from '../lib/newPlanIntent';
import { santaSeason } from '../lib/season';
import { ArrowRight, Banknote, Check, Compass, Dices, EyeOff, Gift, HeartHandshake, Lock, MapPin, Mountain, ShieldCheck, Sparkles, TrainFront, Users } from 'lucide-react';
import { LogoFull } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { countStep } from '../lib/funnel';
import { siteUrl } from '../lib/siteUrl';
import { discoverImageUrl, type DiscoverData, type DiscoverEvent } from '../lib/discover';
import api from '../services/api';
import { currentLang, intlLocale, t } from '../i18n';

// Site d'accueil d'EvLY (2026-11-17, demande de l'utilisateur : « faire un vrai site au lieu de juste un point de connexion »).
// Page / sur le web seulement (App.tsx : les apps ouvrent la connexion, une personne connectée va à ses Plans) ; la connexion
// est sur /auth. Écrans de l'app dessinés et animés (pas de captures), accroche « Fini les 300 messages… », histoire de la
// cafétéria dans « Confiance ». Textes : i18n/<langue>/landing.ts. Visites et clics comptés (lib/funnel.ts : home, funnel_cta_home).

const APP_STORE_URL = 'https://apps.apple.com/app/id6818454100';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ch.evly.app';
const AUDIENCES = [
  { key: 'friends', demo: 'amis', emoji: '🍻' },
  { key: 'family', demo: 'surprise', emoji: '🎂' },
  { key: 'work', demo: 'organisation', emoji: '💼' },
  { key: 'clubs', demo: 'assemblee', emoji: '🏛️' },
  { key: 'pros', demo: 'annonce', emoji: '🎟️' },
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
const PEOPLE = [['Emma', 'in'], ['Noah', 'in'], ['Julie', 'in'], ['Tom', 'maybe'], ['Léa', 'in']] as const;

const signupUrl = '/auth?mode=inscription';

function Section({ id, children, tone = 'white' }: { id?: string; children: ReactNode; tone?: 'white' | 'soft' }) {
  return (
    <section id={id} className={tone === 'soft' ? 'bg-slate-50' : 'bg-white'}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">{children}</div>
    </section>
  );
}

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight text-center max-w-3xl mx-auto">{children}</h2>
);

// Téléphone dessiné : la carte d'un Plan où les réponses arrivent une à une (boucle)
function PhoneMock() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setStep(PEOPLE.length + 1); return; }
    const id = setInterval(() => setStep(s => (s >= PEOPLE.length + 3 ? 0 : s + 1)), 900);
    return () => clearInterval(id);
  }, []);
  const shown = Math.min(step, PEOPLE.length);
  const ins = PEOPLE.slice(0, shown).filter(([, r]) => r === 'in').length + (step > PEOPLE.length ? 1 : 0);
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px] rounded-[44px] border-[10px] border-slate-800 bg-slate-100 shadow-2xl shadow-black/40 overflow-hidden">
      <div className="h-6 bg-slate-800 flex justify-center"><span className="w-24 h-4 rounded-b-2xl bg-slate-900" /></div>
      <div className="p-3 space-y-2.5 min-h-[470px]">
        <div className="rounded-2xl bg-white shadow-md p-4">
          <p className="font-serif text-xl font-bold text-slate-900">{t('landing.mock.title')}</p>
          <p className="mt-1 inline-block rounded-lg bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1">{t('landing.mock.when')}</p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{t('landing.mock.where')}</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
            <span className={`rounded-lg py-2 border-2 transition-colors ${step > PEOPLE.length ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-emerald-600 text-emerald-700'}`}>{t('landing.mock.in')}</span>
            <span className="rounded-lg py-2 border-2 border-amber-400 text-amber-700">{t('landing.mock.maybe')}</span>
            <span className="rounded-lg py-2 border-2 border-slate-200 text-slate-500">{t('landing.mock.out')}</span>
          </div>
          <p className="mt-3 text-xs font-bold text-slate-600">{t('landing.mock.count', { n: ins })}</p>
        </div>
        {PEOPLE.slice(0, shown).map(([name, r]) => (
          <div key={name} className="flex items-center gap-2.5 rounded-xl bg-white shadow-sm px-3 py-2 animate-[landingIn_.35s_ease-out]">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">{name[0]}</span>
            <span className="flex-1 text-sm font-semibold text-slate-800">{name}</span>
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${r === 'in' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {r === 'in' ? t('landing.mock.in') : t('landing.mock.maybe')}
            </span>
          </div>
        ))}
        {step > PEOPLE.length && (
          <div className="rounded-xl bg-white shadow-sm px-3 py-2 text-xs text-slate-700 animate-[landingIn_.35s_ease-out]">{t('landing.mock.bring')}</div>
        )}
      </div>
    </div>
  );
}

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
          // Langue de la page (2026-11-17) : Eventfrog garde la langue de l'organisateur ; hors allemand, on écarte les annonces
          // visiblement en allemand et on montre d'abord les agendas publics (Ville de Genève…), puis les partenaires
          const german = /\b(und|der|die|das|mit|für|frei|wählbar|Genf|Führung|Konzert|Ausstellung)\b|[äöüß]/i;
          const english = /\b(the|and|with|free|tickets|drinks|night|good|vibes|party|live)\b/i;
          const partner = new Set(r.data.sources.filter(x => x.type === 'partner').map(x => x.id));
          const lang = currentLang();
          const pool = [...r.data.events]
            .filter(e => lang === 'de' || !german.test(`${e.title} ${e.place ?? ''}`))
            .filter(e => lang === 'en' || !english.test(e.title))
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
  const stores = (
    <div className="flex flex-wrap items-center gap-3">
      <a href={APP_STORE_URL} target="_blank" rel="noopener" className="hover:opacity-85"><img src={`/badges/app-store-${currentLang()}.svg`} alt="App Store" className="h-11 w-auto" /></a>
      <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener" className="hover:opacity-85"><img src={`/badges/google-play-${currentLang()}.png`} alt="Google Play" className="h-[52px] w-auto" /></a>
    </div>
  );
  const current = AUDIENCES.find(a => a.key === audience)!;

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <style>{`@keyframes landingIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

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
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#7c2d12_0%,rgba(15,23,42,0)_55%)] bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <p className="inline-block text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/15 text-orange-100">{t('landing.hero.kicker')}</p>
            <h1 className="mt-5 font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]">{t('landing.hero.title')}</h1>
            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">{t('landing.hero.text')}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {signupButton(true)}
              <Link to="/demo" className="inline-flex items-center justify-center px-6 py-4 rounded-2xl border border-white/25 text-base font-semibold text-white hover:bg-white/10">{t('landing.hero.demo')}</Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-400"><Check size={16} className="text-emerald-400" />{t('landing.hero.guests')}</p>
            <div className="mt-6">{stores}</div>
          </div>
          <PhoneMock />
        </div>
      </section>

      {santaSeason() && <SantaHighlight />}

      {/* Avant / après */}
      <Section tone="soft">
        <H2>{t('landing.compare.title')}</H2>
        <div className="mt-10 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <div className="rounded-3xl bg-[#111318] text-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-slate-400">💬 {t('landing.compare.beforeTitle')}</p>
            <div className="mt-4 space-y-2">
              {(['before1', 'before2', 'before3', 'before4'] as const).map((k, i) => (
                <p key={k} className={`max-w-[80%] rounded-2xl bg-[#262a33] px-4 py-2 text-sm ${i % 2 ? 'ml-auto' : ''}`}>{t(`landing.compare.${k}`)}</p>
              ))}
            </div>
            <p className="mt-5 inline-block rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold">{t('landing.compare.unread')}</p>
          </div>
          <div className="rounded-3xl bg-white border-2 border-indigo-500 p-5 shadow-lg">
            <p className="text-sm font-semibold text-indigo-700">✨ {t('landing.compare.afterTitle')}</p>
            <p className="mt-3 font-serif text-2xl font-bold text-slate-900">{t('landing.mock.title')}</p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              {(['after1', 'after2', 'after3', 'after4'] as const).map(k => <li key={k}>{t(`landing.compare.${k}`)}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      {/* Pour qui ? */}
      <Section>
        <H2>{t('landing.audiences.title')}</H2>
        <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist">
          {AUDIENCES.map(a => (
            <button key={a.key} role="tab" aria-selected={audience === a.key} onClick={() => setAudience(a.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${audience === a.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
              {a.emoji} {t(`landing.audiences.${a.key}.tab`)}
            </button>
          ))}
        </div>
        <div className="mt-8 max-w-2xl mx-auto rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-8">
          <ul className="space-y-3">
            {(['p1', 'p2', 'p3'] as const).map(k => (
              <li key={k} className="flex gap-3 text-slate-800"><Check size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />{t(`landing.audiences.${current.key}.${k}`)}</li>
            ))}
          </ul>
          <a href={`/demo?voir=${current.demo}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
            <Sparkles size={16} />{t('landing.audiences.seeExample')}<ArrowRight size={16} />
          </a>
        </div>
      </Section>

      {/* Fonctions phares */}
      <Section tone="soft">
        <H2>{t('landing.features.title')}</H2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ key, Icon }) => (
            <div key={key} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon size={22} /></span>
              <h3 className="mt-3 font-bold text-slate-900">{t(`landing.features.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(`landing.features.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Découvrir en direct */}
      <Section>
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
      <section className="bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-center max-w-3xl mx-auto">{t('landing.trust.title')}</h2>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST.map(({ key, Icon }) => (
              <div key={key} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <Icon size={24} className="text-orange-400" />
                <p className="mt-3 font-bold">{t(`landing.trust.${key}.title`)}</p>
                <p className="mt-1 text-sm text-slate-300">{t(`landing.trust.${key}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Questions fréquentes */}
      <Section tone="soft">
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
          <div className="mt-8 flex justify-center">{signupButton(true)}</div>
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
