import { useEffect, useRef, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n';

const DAY_MS = 24 * 3600 * 1000;

// Étiquette « ⏳ Jusqu'au 9 oct. à 19:00 » sous la date du Plan (remplace la phrase « Ce plan
// disparaît le… ») ; le détail s'affiche au toucher. Orange dans les dernières 24 heures.
export function ExpiryChip({ endDate, onRecap }: { endDate: string; /** Récapitulatif PDF (créateur, organisateurs) */ onRecap?: () => void }) {
  const [open, setOpen] = useState(false);
  // Position de la bulle (fixe, recadrée dans l'écran : l'étiquette est souvent au bord droit)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const { t } = useTranslation();
  const BUBBLE_W = 256;

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(16, Math.min(r.left, window.innerWidth - BUBBLE_W - 16)), top: r.bottom + 6 });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const hide = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  const end = new Date(endDate);
  const left = end.getTime() - Date.now();
  const soon = left < DAY_MS;
  const label = soon
    ? t('plan.expiry.deletedIn', { time: left < 3600e3 ? t('plan.expiry.minutes', { n: Math.max(1, Math.round(left / 60e3)) }) : t('plan.expiry.hours', { n: Math.round(left / 3600e3) }) })
    : t('plan.expiry.until', { date: new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(end), time: new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(end) });
  const full = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(end);

  return (
    <span ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={t('plan.expiry.title')}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm md:text-xs font-medium transition-colors ${
          soon ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        <Hourglass size={13} /> {label}
      </button>
      {open && pos && (
        <span role="tooltip" style={{ left: pos.left, top: pos.top, width: BUBBLE_W }} className="fixed z-50 p-3 rounded-xl bg-slate-800 text-white text-xs leading-relaxed shadow-xl">
          <Trans i18nKey="plan.expiry.bubble" values={{ date: full }} components={{ b: <strong /> }} />
          {soon && t('plan.expiry.downloadPhotos')}
          {onRecap && (
            <button type="button" onClick={() => { setOpen(false); onRecap(); }} className="block mt-2 font-semibold text-orange-300 underline underline-offset-2">
              {t('plan.expiry.recap')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
