import { Resend } from 'resend';
import type { Locale } from './i18n';
import { mail } from './emailText';

export const resend = new Resend(process.env.RESEND_API_KEY || 'dev-placeholder');
export const FROM_EMAIL = process.env.FROM_EMAIL || 'EvLY <noreply@estelle.app>';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Pied de page des emails de notification (pas des emails de compte) : comment les couper.
// Le lien ouvre directement la fenêtre « Notifications » de l'app (CircleSidebar).
// kind : 'notification' (cas général, avec le mode silencieux par Plan / Cercle), 'simple' (sans la
// cloche : mentions, que le mode silencieux ne coupe pas ; invitation et admission dans un Cercle),
// 'digest' (résumé hebdomadaire). Texte dans la langue du destinataire (src/i18n/emails).
export function notificationFooter(kind: 'notification' | 'simple' | 'digest' = 'notification', locale: Locale = 'fr'): string {
  const m = mail(locale);
  const menu = { html: m.t('footer.menu') };
  const text = kind === 'digest'
    ? m.t('footer.digest', { menu })
    : kind === 'simple'
    ? m.t('footer.simple', { menu })
    : `${m.t('footer.simple', { menu })}<br>${m.t('footer.mute')}`;
  return `
            <p style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5">
              ${text}<br>
              <a href="${APP_URL}/dashboard?reglages=notifications" style="color:#94a3b8">${m.t('common.manageNotifications')}</a>
            </p>`;
}
