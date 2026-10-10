import { escapeHtml } from './escapeHtml';
import type { Locale } from './i18n';
import fr, { type EmailDict } from '../i18n/emails/fr';
import de from '../i18n/emails/de';
import it from '../i18n/emails/it';
import en from '../i18n/emails/en';

// Textes des emails dans la langue du destinataire (src/i18n/emails/*.ts).
// mail(locale).t('reminder.title', { name }) : valeurs échappées pour le HTML ;
// .s(…) pour un sujet (texte brut) ; .raw(…) pour insérer du HTML déjà construit.

const DICTS: Record<Locale, EmailDict> = { fr, de, it, en };

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
type Base<K> = K extends `${infer B}_one` ? B : K extends `${infer B}_other` ? B : K;
export type EmailKey = Base<Paths<EmailDict>>;
type Value = string | number | { html: string };

const INTL: Record<Locale, string> = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' };
export const intlLocale = (locale: Locale) => INTL[locale];

function lookup(dict: EmailDict, key: string, count?: number, locale?: Locale): string {
  const parts = key.split('.');
  const leaf = parts.pop()!;
  let node: any = dict;
  for (const p of parts) node = node?.[p];
  if (count !== undefined && node?.[`${leaf}_one`] !== undefined) {
    const form = new Intl.PluralRules(INTL[locale ?? 'fr']).select(count) === 'one' ? 'one' : 'other';
    return node[`${leaf}_${form}`];
  }
  return node?.[leaf] ?? key;
}

function fill(text: string, vars: Record<string, Value>, escape: boolean): string {
  return text.replace(/\{(\w+)\}/g, (m, name) => {
    const v = vars[name];
    if (v === undefined || v === null) return m;
    if (typeof v === 'object') return v.html;
    return escape ? escapeHtml(String(v)) : String(v);
  });
}

export function mail(locale: Locale) {
  const dict = DICTS[locale] ?? fr;
  return {
    locale,
    intl: INTL[locale],
    /** Texte HTML : les valeurs sont échappées */
    t: (key: EmailKey, vars: Record<string, Value> = {}) => fill(lookup(dict, key, typeof vars.count === 'number' ? vars.count : undefined, locale), vars, true),
    /** Sujet (texte brut) */
    s: (key: EmailKey, vars: Record<string, Value> = {}) => fill(lookup(dict, key, typeof vars.count === 'number' ? vars.count : undefined, locale), vars, false),
  };
}
