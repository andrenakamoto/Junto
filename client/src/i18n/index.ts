import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr';
import de from './de';
import it from './it';
import en from './en';

// Langues d'EvLY (serveur : lib/i18n.ts). Le français est la langue d'origine : les textes s'écrivent
// d'abord dans i18n/fr/, puis dans les trois autres langues (même structure, vérifiée par TypeScript).
// Langue : choix enregistré sur l'appareil, sinon celle du compte (synchronisée par AuthContext), sinon celle
// du téléphone / navigateur, sinon le français. Changer de langue recharge l'app (formats de dates compris).

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
] as const;
export type Lang = typeof LANGUAGES[number]['code'];
const CODES = LANGUAGES.map(l => l.code) as string[];
const STORAGE_KEY = 'evly_lang';

export function asLang(value: unknown): Lang | null {
  if (typeof value !== 'string') return null;
  const code = value.slice(0, 2).toLowerCase();
  return CODES.includes(code) ? code as Lang : null;
}

function storedLang(): Lang | null {
  try { return asLang(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function detectLang(): Lang {
  const stored = storedLang();
  if (stored) return stored;
  const browser = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const l of browser) { const found = asLang(l); if (found) return found; }
  return 'fr';
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, de: { translation: de }, it: { translation: it }, en: { translation: en } },
  lng: detectLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

export function currentLang(): Lang {
  return asLang(i18n.language) ?? 'fr';
}

// Format suisse des dates et des nombres dans chaque langue (anglais : format britannique)
export function intlLocale(lang: Lang = currentLang()): string {
  return { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' }[lang];
}

// Choix explicite de la personne : retenu sur l'appareil, puis rechargement de l'app
export function setLanguage(lang: Lang, reload = true) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* rien */ }
  if (lang === currentLang()) return;
  if (reload) window.location.reload();
  else { i18n.changeLanguage(lang); document.documentElement.lang = lang; }
}

// Le choix déjà fait sur cet appareil (sinon : la langue du compte s'applique)
export function hasStoredLang() {
  return storedLang() !== null;
}

export const t = i18n.t.bind(i18n);
export default i18n;
