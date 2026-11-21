import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Car, Compass, MapPin, Receipt, Sparkles } from 'lucide-react';
import { t } from '../../i18n';

// Effets et navigation du site d'accueil (2026-11-21, demande de l'utilisateur : « plus dynamique, avec des effets, une navigation
// interactive et innovante »). Sans bibliothèque : IntersectionObserver, CSS et un peu de pointeur. Tout se coupe avec
// prefers-reduced-motion (le contenu reste affiché, sans mouvement).

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/** Vrai dès que l'élément arrive à l'écran (une seule fois) */
export function useInView<T extends Element>(margin = '-10% 0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || reducedMotion()) { setSeen(true); return; }
    const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, seen] as const;
}

/** Apparition en glissant vers le haut quand le bloc arrive à l'écran */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${seen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Titre qui apparaît mot par mot */
export function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>('0px');
  return (
    <span ref={ref} className={className}>
      {text.split(' ').map((w, i) => (
        <span key={i} className={`inline-block transition-all duration-500 ease-out ${seen ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-3 blur-[2px]'}`} style={{ transitionDelay: `${i * 90}ms` }}>
          {w}&nbsp;
        </span>
      ))}
    </span>
  );
}

/** Fin de phrase qui change toute seule (« … samedi », « … à l'AG ») */
export function RotatingWords({ words, className = '' }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setI(x => (x + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length]);
  return <span key={i} className={`inline-block animate-[landingIn_.45s_ease-out] ${className}`}>{words[i]}</span>;
}

/** Chiffre qui défile jusqu'à sa valeur quand il arrive à l'écran ; template = texte avec {{n}} */
export function CountUp({ from, to, render, duration = 1400 }: { from: number; to: number; render: (n: number) => string; duration?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [n, setN] = useState(reducedMotion() ? to : from);
  useEffect(() => {
    if (!seen || reducedMotion()) { if (seen) setN(to); return; }
    let raf = 0; const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration), e = 1 - Math.pow(1 - k, 3);
      setN(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, from, to, duration]);
  return <span ref={ref}>{render(n)}</span>;
}

/** Carte qui s'incline légèrement sous la souris (ordinateur seulement) */
export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el || !finePointer() || reducedMotion()) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-3px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <div ref={ref} onMouseMove={move} onMouseLeave={leave} className={`transition-transform duration-200 ease-out will-change-transform ${className}`}>{children}</div>;
}

/** Bouton « aimanté » : il suit un peu le curseur */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el || !finePointer() || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.15}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <span ref={ref} onMouseMove={move} onMouseLeave={leave} className="inline-flex transition-transform duration-200 ease-out">{children}</span>;
}

/** Bulles qui flottent en fond (accroche) */
export function FloatingBubbles() {
  const B = [[8, 18, 54, 0], [82, 12, 38, 1.5], [70, 70, 64, 3], [14, 76, 44, 2], [46, 8, 28, 4], [92, 46, 30, 2.5]];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden hidden sm:block">
      {B.map(([x, y, s, d], i) => (
        <span key={i} className="absolute rounded-[40%_40%_40%_10%] bg-white/[0.06] border border-white/10 motion-safe:animate-[landingFloat_9s_ease-in-out_infinite]"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s * 0.7, animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

/** Pluie de confettis (une fois, à l'endroit du composant) */
function Confetti({ burst }: { burst: number }) {
  if (!burst || reducedMotion()) return null;
  const colors = ['#ea5a2b', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#facc15'];
  return (
    <div key={burst} aria-hidden className="pointer-events-none absolute inset-0 overflow-visible z-20">
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2, d = 70 + (i * 37) % 70;
        const style = { left: '50%', top: '40%', background: colors[i % colors.length], '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 40}px`, '--r': `${(i * 67) % 360}deg` } as CSSProperties;
        return <span key={i} className="absolute w-2 h-3 rounded-sm animate-[landingConfetti_1s_ease-out_forwards]" style={style} />;
      })}
    </div>
  );
}

const PEOPLE = [['Emma', 'in'], ['Noah', 'in'], ['Julie', 'in'], ['Tom', 'maybe'], ['Léa', 'in']] as const;

/** Téléphone de l'accroche : les réponses arrivent, puis c'est au visiteur de toucher « Je suis in » */
export function InteractivePhone() {
  const [step, setStep] = useState(0);
  const [joined, setJoined] = useState(false);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (reducedMotion()) { setStep(PEOPLE.length); return; }
    if (step >= PEOPLE.length) return;
    const id = setTimeout(() => setStep(s => s + 1), step === 0 ? 900 : 750);
    return () => clearTimeout(id);
  }, [step]);
  const shown = PEOPLE.slice(0, step);
  const ins = shown.filter(([, r]) => r === 'in').length + (joined ? 1 : 0);
  const waiting = step >= PEOPLE.length && !joined;
  const join = () => { if (joined) return; setJoined(true); setBurst(b => b + 1); };
  const reset = () => { setJoined(false); setStep(0); };
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div className="relative rounded-[44px] border-[10px] border-slate-800 bg-slate-100 shadow-2xl shadow-black/40 overflow-hidden">
        <div className="h-6 bg-slate-800 flex justify-center"><span className="w-24 h-4 rounded-b-2xl bg-slate-900" /></div>
        <div className="p-3 space-y-2 min-h-[490px]">
          <div className="rounded-2xl bg-white shadow-md p-4">
            <p className="font-serif text-xl font-bold text-slate-900">{t('landing.mock.title')}</p>
            <p className="mt-1 inline-block rounded-lg bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1">{t('landing.mock.when')}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{t('landing.mock.where')}</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
              <button onClick={join} aria-pressed={joined}
                className={`relative rounded-lg py-2 border-2 transition-all ${joined ? 'bg-emerald-600 border-emerald-600 text-white scale-105' : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'} ${waiting ? 'animate-[landingPulse_1.4s_ease-in-out_infinite]' : ''}`}>
                {t('landing.mock.in')}
              </button>
              <span className="rounded-lg py-2 border-2 border-amber-400 text-amber-700">{t('landing.mock.maybe')}</span>
              <span className="rounded-lg py-2 border-2 border-slate-200 text-slate-500">{t('landing.mock.out')}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-600">{t('landing.mock.count', { n: ins })}</p>
          </div>
          {joined && (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 ring-2 ring-emerald-400 px-3 py-2 animate-[landingIn_.35s_ease-out]">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">★</span>
              <span className="flex-1 text-sm font-bold text-emerald-800">{t('landing.fx.you')}</span>
              <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-emerald-600 text-white">{t('landing.mock.in')}</span>
            </div>
          )}
          {shown.map(([name, r]) => (
            <div key={name} className="flex items-center gap-2.5 rounded-xl bg-white shadow-sm px-3 py-2 animate-[landingIn_.35s_ease-out]">
              <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">{name[0]}</span>
              <span className="flex-1 text-sm font-semibold text-slate-800">{name}</span>
              <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${r === 'in' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {r === 'in' ? t('landing.mock.in') : t('landing.mock.maybe')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Confetti burst={burst} />
      {/* Bulle d'invitation à toucher, puis message de bienvenue */}
      <div className="mt-4 h-10 text-center">
        {waiting && <p className="inline-block rounded-full bg-white text-slate-900 text-sm font-bold px-4 py-2 shadow-lg animate-[landingIn_.4s_ease-out]">👆 {t('landing.fx.tapHint')}</p>}
        {joined && (
          <p className="inline-flex items-center gap-3 rounded-full bg-emerald-600 text-white text-sm font-bold px-4 py-2 shadow-lg animate-[landingIn_.4s_ease-out]">
            {t('landing.fx.welcome')}
            <button onClick={reset} className="text-xs font-semibold underline underline-offset-2 text-emerald-100 hover:text-white">{t('landing.fx.again')}</button>
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Histoire d'un samedi
const STEPS = ['s1', 's2', 's3', 's4', 's5'] as const;

function StoryScreen({ step }: { step: number }) {
  const card = (compact = false) => (
    <div className={`rounded-2xl bg-white shadow-md ${compact ? 'p-3' : 'p-4'}`}>
      {!compact && <p className="inline-block rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 mb-2">{t('landing.fx.created')}</p>}
      <p className={`font-serif font-bold text-slate-900 ${compact ? 'text-base' : 'text-xl'}`}>{t('landing.mock.title')}</p>
      <p className="mt-1 inline-block rounded-lg bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1">{t('landing.mock.when')}</p>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{t('landing.mock.where')}</p>
    </div>
  );
  if (step === 0) return (
    <div key="s0" className="absolute inset-0 bg-[#111318] p-3 pt-8">
      <div className="space-y-1.5">
        {(['before1', 'before2', 'before3', 'before4', 'before2', 'before1'] as const).map((k, i) => (
          <p key={i} className={`max-w-[78%] rounded-2xl bg-[#262a33] text-slate-100 px-3 py-1.5 text-xs animate-[landingIn_.35s_ease-out_both] ${i % 2 ? 'ml-auto' : ''}`} style={{ animationDelay: `${i * 180}ms` }}>
            {t(`landing.compare.${k}`)}
          </p>
        ))}
      </div>
      <p className="absolute left-1/2 -translate-x-1/2 bottom-8 whitespace-nowrap rounded-full bg-red-600 text-white text-sm font-bold px-4 py-1.5 shadow-lg">
        <CountUp from={0} to={143} duration={1200} render={n => t('landing.compare.unread').replace(/\d+/, String(n))} />
      </p>
    </div>
  );
  return (
    <div key={`s${step}`} className="absolute inset-0 bg-slate-100 p-3 pt-7 space-y-2 animate-[landingIn_.45s_ease-out]">
      {step === 1 && card()}
      {step === 2 && (<>
        {card(true)}
        {PEOPLE.map(([name, r], i) => (
          <div key={name} className="flex items-center gap-2 rounded-xl bg-white shadow-sm px-3 py-1.5 animate-[landingIn_.35s_ease-out_both]" style={{ animationDelay: `${150 + i * 160}ms` }}>
            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">{name[0]}</span>
            <span className="flex-1 text-sm font-semibold text-slate-800">{name}</span>
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${r === 'in' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>{r === 'in' ? t('landing.mock.in') : t('landing.mock.maybe')}</span>
          </div>
        ))}
      </>)}
      {step === 3 && (<>
        {card(true)}
        <div className="rounded-2xl bg-white shadow-sm p-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('landing.fx.bringTitle')}</p>
          {(['bring1', 'bring2', 'bring3'] as const).map((k, i) => (
            <p key={k} className={`mt-1.5 text-sm animate-[landingIn_.35s_ease-out_both] ${i === 2 ? 'text-slate-400' : 'text-slate-800'}`} style={{ animationDelay: `${150 + i * 160}ms` }}>{t(`landing.fx.${k}`)}</p>
          ))}
        </div>
        <p className="flex items-center gap-2 rounded-2xl bg-white shadow-sm p-3 text-sm text-slate-800 animate-[landingIn_.35s_ease-out_both]" style={{ animationDelay: '700ms' }}><Car size={16} className="text-indigo-600" />{t('landing.fx.car')}</p>
        <p className="flex items-center gap-2 rounded-2xl bg-white shadow-sm p-3 text-sm text-slate-800 animate-[landingIn_.35s_ease-out_both]" style={{ animationDelay: '900ms' }}><Receipt size={16} className="text-indigo-600" />{t('landing.fx.expenses')}</p>
      </>)}
      {step === 4 && (<>
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Compass size={16} className="text-indigo-600" />{t('landing.fx.nearYou')}</p>
        {(['idea1', 'idea2', 'idea3'] as const).map((k, i) => (
          <div key={k} className="rounded-2xl bg-white shadow-sm p-3 animate-[landingIn_.35s_ease-out_both]" style={{ animationDelay: `${i * 170}ms` }}>
            <p className="text-sm font-semibold text-slate-900">{t(`landing.fx.${k}`)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{['2 km', '4 km', '11 km'][i]}</p>
          </div>
        ))}
        <p className="mt-1 rounded-xl bg-indigo-600 text-white text-center text-sm font-bold py-2.5 animate-[landingIn_.35s_ease-out_both]" style={{ animationDelay: '600ms' }}><Sparkles size={14} className="inline mr-1" />{t('landing.fx.goCircle')}</p>
      </>)}
    </div>
  );
}

/** Section « Comment ça marche » : le téléphone reste en place et son écran change à chaque étape du défilement */
export function StoryScroll() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    // On suit les cartes de texte : au milieu de l'écran sur grand écran ; sur téléphone, dans le bas de l'écran (sous le téléphone collé)
    const wide = window.matchMedia?.('(min-width: 1024px)').matches;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
    }, { rootMargin: wide ? '-45% 0px -45% 0px' : '-60% 0px -25% 0px' });
    refs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-x-12">
      {/* Téléphone collé : en haut sur téléphone, à droite sur grand écran */}
      <div className="lg:order-2 sticky top-16 lg:top-28 z-10 -mx-4 px-4 pt-2 lg:mx-0 lg:px-0 lg:pt-0 h-[316px] sm:h-[376px] lg:h-[560px] flex justify-center pointer-events-none bg-gradient-to-b from-slate-50 via-slate-50 to-slate-50/0 lg:bg-none">
        <div className="relative origin-top scale-[0.56] sm:scale-[0.68] lg:scale-100 w-[300px] h-[540px] rounded-[44px] border-[10px] border-slate-800 bg-slate-100 shadow-2xl shadow-black/30 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 flex justify-center z-10"><span className="w-24 h-4 rounded-b-2xl bg-slate-900" /></div>
          <StoryScreen step={active} />
          {/* Avancement : un point par étape */}
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
            {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'}`} />)}
          </div>
        </div>
      </div>
      <div className="lg:order-1">
        {STEPS.map((k, i) => (
          <div key={k} className="min-h-[62vh] lg:min-h-[80vh] flex items-end lg:items-center pb-6 lg:pb-0">
            <div ref={el => { refs.current[i] = el; }} data-step={i} className={`w-full rounded-3xl bg-white/95 lg:bg-transparent shadow-lg lg:shadow-none border border-slate-200 lg:border-0 p-5 lg:p-0 transition-all duration-500 ${active === i ? 'opacity-100 translate-y-0' : 'opacity-40 lg:opacity-30 lg:translate-y-2'}`}>
              <p className="text-sm font-bold text-indigo-600">{i + 1} / {STEPS.length}</p>
              <h3 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-slate-900">{t(`landing.fx.${k}.title`)}</h3>
              <p className="mt-3 text-slate-600 leading-relaxed text-base sm:text-lg max-w-md">{t(`landing.fx.${k}.text`)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Navigation de côté
export interface NavSection { id: string; label: string }

/** Points sur le bord (section en cours) et barre de progression sous l'en-tête */
export function SideNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: '-40% 0px -55% 0px' }) : null;
    sections.forEach(s => { const el = document.getElementById(s.id); if (el && io) io.observe(el); });
    return () => { window.removeEventListener('scroll', onScroll); io?.disconnect(); };
  }, [sections]);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  return (
    <>
      <div aria-hidden className="fixed top-16 inset-x-0 h-1 z-40 pointer-events-none">
        <div className="h-full bg-gradient-to-r from-orange-500 to-indigo-600 origin-left" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <nav aria-label="Sections" className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-3">
        {sections.map(s => (
          <button key={s.id} onClick={() => go(s.id)} aria-current={active === s.id} className="group relative flex items-center justify-end">
            <span className="absolute right-6 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs font-semibold px-2.5 py-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 transition-all">{s.label}</span>
            <span className={`block rounded-full transition-all ${active === s.id ? 'w-3 h-3 bg-indigo-600 ring-4 ring-indigo-600/20' : 'w-2.5 h-2.5 bg-slate-400/70 group-hover:bg-indigo-400'}`} />
          </button>
        ))}
      </nav>
    </>
  );
}
