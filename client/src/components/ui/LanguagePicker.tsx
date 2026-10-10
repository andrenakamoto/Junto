import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { LANGUAGES, Lang, currentLang, setLanguage } from '../../i18n';
import { isDemo } from '../../lib/demo';

// Choix de la langue. Connecté : enregistrée sur le compte (emails et notifications dans cette langue).
// L'app se recharge dans la nouvelle langue.
export function LanguagePicker({ loggedIn = false, compact = false }: { loggedIn?: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  async function change(lang: Lang) {
    if (loggedIn && !isDemo()) await api.put('/auth/locale', { locale: lang }).catch(() => {});
    setLanguage(lang);
  }
  return (
    <label className={`inline-flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      <Globe size={compact ? 14 : 16} className="opacity-70" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select value={currentLang()} onChange={e => change(e.target.value as Lang)} aria-label={t('common.language')}
        className={`bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer ${compact ? 'py-0 pr-6' : 'py-1 pr-7'}`}>
        {LANGUAGES.map(l => <option key={l.code} value={l.code} className="text-slate-900">{l.label}</option>)}
      </select>
    </label>
  );
}
