import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { Locale } from './i18n';
import { mail } from './emailText';

// Envoi des emails. Depuis la migration chez Infomaniak : serveur d'envoi Infomaniak (SMTP, en Suisse) dès que
// SMTP_HOST est défini, sinon Resend. Même forme de réponse dans les deux cas ({ data, error }) : le SDK Resend
// ne lève pas d'exception, il renvoie error — toujours vérifier result.error. Les 23 appels gardent
// `resend.emails.send(…)` (nom historique). FROM_EMAIL doit être l'adresse de la boîte SMTP (noreply@evly.ch).
type MailInput = { from: string; to: string | string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] };
type MailResult = { data: { id: string } | null; error: { message: string } | null };
interface Mailer { emails: { send(m: MailInput): Promise<MailResult> } }

function smtpMailer(): Mailer {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, pool: true, maxConnections: 2,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return {
    emails: {
      async send(m) {
        try {
          const info = await transport.sendMail({ from: m.from, to: m.to, subject: m.subject, html: m.html, attachments: m.attachments });
          return { data: { id: info.messageId }, error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
    },
  };
}

export const MAIL_PROVIDER = process.env.SMTP_HOST ? 'smtp' : 'resend';
export const resend: Mailer = process.env.SMTP_HOST
  ? smtpMailer()
  : (new Resend(process.env.RESEND_API_KEY || 'dev-placeholder') as unknown as Mailer);
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
