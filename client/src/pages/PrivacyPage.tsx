import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoIcon } from '../components/ui/Logo';
import { currentLang, t, type Lang } from '../i18n';
import type { PrivacyText } from './privacy/parts';
import fr from './privacy/fr';
import de from './privacy/de';
import it from './privacy/it';
import en from './privacy/en';

// Politique de confidentialité (nLPD). Page publique : doit être lisible avant l'inscription.
// Une version par langue (privacy/*.tsx), la française fait foi. Toute mise à jour : dans les 4 langues.
const TEXTS: Record<Lang, PrivacyText> = { fr, de, it, en };

export function PrivacyPage() {
  const T = TEXTS[currentLang()] ?? fr;
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/auth" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} /> {t('common.back')}
          </Link>
          <LogoIcon size={32} light />
        </div>

        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">{T.title}</h1>
            <p className="text-slate-500 mt-1">{T.version}</p>
            {T.translationNote && <p className="text-xs text-amber-700 mt-1">{T.translationNote}</p>}
          </header>
          {T.body}
        </article>
      </div>
    </div>
  );
}
