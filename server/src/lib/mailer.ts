import nodemailer from 'nodemailer';
import type { Locale } from './i18n';
import { mail } from './emailText';

// Envoi des emails par le serveur d'envoi d'Infomaniak (SMTP, en Suisse, boîte noreply@evly.ch, variables SMTP_*
// dans /etc/evly/app.env). Sans SMTP_HOST (développement local) : aucun email n'est envoyé, l'appel renvoie une
// erreur journalisée. Réponse { data, error } comme l'ancien SDK Resend : toujours vérifier result.error. Les appels
// gardent le nom historique `resend.emails.send(…)`. FROM_EMAIL doit être l'adresse de la boîte SMTP.
type MailInput = { from: string; to: string | string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[]; headers?: Record<string, string> };

// Éditeur, en bas de chaque email (identité et adresse de contact : LCD art. 3 al. 1 let. s, nLPD art. 19 ; 2026-11-24)
export const LEGAL_LINE = 'EvLY · André Martins · Genève (Suisse) · <a href="mailto:info@evly.ch" style="color:#94a3b8">info@evly.ch</a>';
const LEGAL_HTML = `<p style="font-family:sans-serif;max-width:520px;margin:18px auto 0;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center">${LEGAL_LINE}</p>`;
export function withLegalLine(html: string): string {
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${LEGAL_HTML}</body>`) : `${html}${LEGAL_HTML}`;
}
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
          const info = await transport.sendMail({ from: m.from, to: m.to, subject: m.subject, html: withLegalLine(m.html), attachments: m.attachments, headers: m.headers });
          return { data: { id: info.messageId }, error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
    },
  };
}

const noMailer: Mailer = {
  emails: { async send(m) { return { data: null, error: { message: `SMTP non configuré : email « ${m.subject} » non envoyé` } }; } },
};

export const MAIL_PROVIDER = process.env.SMTP_HOST ? 'smtp' : 'aucun';
export const resend: Mailer = process.env.SMTP_HOST ? smtpMailer() : noMailer;
export const FROM_EMAIL = process.env.FROM_EMAIL || 'EvLY <noreply@estelle.app>';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Pied de page des emails de notification (pas des emails de compte) : comment les couper.
// Le lien ouvre directement la fenêtre « Notifications » de l'app (CircleSidebar).
// kind : 'notification' (cas général, avec le mode silencieux par Plan / Cercle), 'simple' (sans la
// cloche : mentions, que le mode silencieux ne coupe pas ; invitation et admission dans un Cercle),
// 'digest' (résumé hebdomadaire). Texte dans la langue du destinataire (src/i18n/emails).
// unsubscribeUrl : lien de désinscription en un clic (lib/unsubscribe.ts), pour les résumés envoyés sans action de la personne.
export function notificationFooter(kind: 'notification' | 'simple' | 'digest' = 'notification', locale: Locale = 'fr', unsubscribeUrl?: string): string {
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
              ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#64748b;font-weight:600">${m.t('common.unsubscribe')}</a> · ` : ''}<a href="${APP_URL}/dashboard?reglages=notifications" style="color:#94a3b8">${m.t('common.manageNotifications')}</a>
            </p>`;
}
