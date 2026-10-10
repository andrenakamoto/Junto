import type { Request, Response, NextFunction } from 'express';
import { ERRORS_1 } from '../i18n/errors1';
import { ERRORS_2 } from '../i18n/errors2';
import { NOTIFICATIONS } from '../i18n/notifications';
import prisma from './prisma';

// Langues d'EvLY : français (langue d'origine, qui fait foi), allemand, italien, anglais.
// User.locale = langue choisie (null = pas encore choisie : on prend celle de la requête, puis le français).
export const LOCALES = ['fr', 'de', 'it', 'en'] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export function parseLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(code) ? code as Locale : null;
}

// En-tête Accept-Language (« de-CH,de;q=0.9,en;q=0.8 ») → première langue connue
export function localeFromHeader(header: string | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const found = parseLocale(part.split(';')[0]);
    if (found) return found;
  }
  return null;
}

// ─── Messages de l'API et des notifications ─────────────────────────────────
// Les routes écrivent leurs messages en français ; ils sont traduits au dernier moment :
// erreurs d'après la langue envoyée par l'app (Accept-Language), notifications d'après la
// langue du destinataire (lib/push.ts). Un message absent des tables reste en français :
// tout nouveau message s'ajoute dans src/i18n/ (errors*.ts, notifications.ts).

const ERRORS: Record<string, [string, string, string]> = { ...ERRORS_1, ...ERRORS_2, ...NOTIFICATIONS };
const COLUMN: Record<Exclude<Locale, 'fr'>, 0 | 1 | 2> = { de: 0, it: 1, en: 2 };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Messages avec parties variables : « {0} caractères maximum » → /^(.*?) caractères maximum$/.
// Les plus précis d'abord (« Titre : {0} caractères maximum » avant « {0} caractères maximum »).
const PATTERNS = Object.keys(ERRORS).filter(k => /\{\d\}/.test(k))
  .sort((a, b) => b.replace(/\{\d\}/g, '').length - a.replace(/\{\d\}/g, '').length).map(k => ({
  key: k,
  regex: new RegExp('^' + escapeRegex(k).replace(/\\\{(\d)\\\}/g, '(.*?)') + '$'),
  order: [...k.matchAll(/\{(\d)\}/g)].map(m => Number(m[1])),
}));

export function translateMessage(message: string, locale: Locale): string {
  if (locale === 'fr') return message;
  const exact = ERRORS[message];
  if (exact) return exact[COLUMN[locale]];
  for (const p of PATTERNS) {
    const m = p.regex.exec(message);
    if (!m) continue;
    // Les parties variables peuvent elles-mêmes être des textes connus (« championnat », un résultat de vote…)
    const values: string[] = [];
    p.order.forEach((n, i) => { values[n] = m[i + 1] ? translateMessage(m[i + 1], locale) : m[i + 1]; });
    return ERRORS[p.key][COLUMN[locale]].replace(/\{(\d)\}/g, (_, n) => values[Number(n)] ?? '');
  }
  return message;
}

export function requestLocale(req: Request): Locale {
  return localeFromHeader(req.headers['accept-language']) ?? DEFAULT_LOCALE;
}

export function translateErrors(req: Request, res: Response, next: NextFunction) {
  const locale = requestLocale(req);
  if (locale === 'fr') return next();
  const json = res.json.bind(res);
  res.json = (body: any) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (typeof body.error === 'string') body = { ...body, error: translateMessage(body.error, locale) };
      if (typeof body.message === 'string') body = { ...body, message: translateMessage(body.message, locale) };
    }
    return json(body);
  };
  next();
}

// Langue d'une personne (notifications, emails) : gardée en mémoire 10 minutes
const localeCache = new Map<string, { locale: Locale; at: number }>();
export async function userLocale(userId: string): Promise<Locale> {
  const hit = localeCache.get(userId);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.locale;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const locale = parseLocale(user?.locale) ?? DEFAULT_LOCALE;
  localeCache.set(userId, { locale, at: Date.now() });
  return locale;
}
export function forgetUserLocale(userId: string) {
  localeCache.delete(userId);
}
