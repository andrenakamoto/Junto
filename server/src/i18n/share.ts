// Aperçu des liens d'invitation (balises og:* et image), dans la langue du créateur du Plan
import type { Locale } from '../lib/i18n';

export const SHARE_TEXTS: Record<Locale, {
  ogLocale: string; title: string; participants_one: string; participants_other: string;
  description: string; badge: string; proposedBy: string; cta: string;
}> = {
  fr: { ogLocale: 'fr_CH', title: '{title} — invitation EvLY', participants_one: '{count} participant', participants_other: '{count} participants', description: '{parts} — Réponds en un clic, sans créer de compte.', badge: 'INVITATION', proposedBy: 'proposé par {name}', cta: 'Réponds en un clic →' },
  de: { ogLocale: 'de_CH', title: '{title} — Einladung EvLY', participants_one: '{count} Teilnehmer/in', participants_other: '{count} Teilnehmende', description: '{parts} — Antworte mit einem Klick, ohne Konto.', badge: 'EINLADUNG', proposedBy: 'vorgeschlagen von {name}', cta: 'Mit einem Klick antworten →' },
  it: { ogLocale: 'it_CH', title: '{title} — invito EvLY', participants_one: '{count} partecipante', participants_other: '{count} partecipanti', description: '{parts} — Rispondi con un clic, senza creare un account.', badge: 'INVITO', proposedBy: 'proposto da {name}', cta: 'Rispondi con un clic →' },
  en: { ogLocale: 'en_GB', title: '{title} — EvLY invitation', participants_one: '{count} participant', participants_other: '{count} participants', description: '{parts} — Reply in one click, no account needed.', badge: 'INVITATION', proposedBy: 'suggested by {name}', cta: 'Reply in one click →' },
};
