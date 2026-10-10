import { Sparkles } from 'lucide-react';
import { exitDemo, isDemo } from '../../lib/demo';
import { useTranslation } from 'react-i18next';

// Bandeau de la démo sans compte : rien n'est enregistré, et le chemin vers un vrai compte
export function DemoBanner() {
  const { t } = useTranslation();
  if (!isDemo()) return null;
  return (
    <div className="flex-shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-3 py-2 bg-indigo-600 text-white text-xs sm:text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Sparkles size={15} /> {t('ui.demo.banner')}
      </span>
      <span className="flex items-center gap-2">
        <button onClick={() => exitDemo('/auth?mode=inscription')} className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50">
          {t('ui.demo.createAccount')}
        </button>
        <button onClick={() => exitDemo('/auth')} className="px-2 py-1 rounded-lg text-indigo-100 hover:text-white underline underline-offset-2">
          {t('ui.demo.quit')}
        </button>
      </span>
    </div>
  );
}
