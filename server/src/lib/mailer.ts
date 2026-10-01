import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY || 'dev-placeholder');
export const FROM_EMAIL = process.env.FROM_EMAIL || 'EvLY <noreply@estelle.app>';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Pied de page des emails de notification (pas des emails de compte) : comment les couper.
// Le lien ouvre directement la fenêtre « Notifications » de l'app (CircleSidebar).
export function notificationFooter(kind: 'notification' | 'digest' = 'notification'): string {
  const text = kind === 'digest'
    ? 'Tu peux désactiver ce résumé hebdomadaire dans les paramètres de l\'application : menu ☰ → Notifications.'
    : 'Tu peux désactiver ces emails dans les paramètres de l\'application (menu ☰ → Notifications), en choisissant de recevoir tes notifications sur ton téléphone avec l\'app EvLY.';
  return `
            <p style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5">
              ${text}<br>
              <a href="${APP_URL}/dashboard?reglages=notifications" style="color:#94a3b8">Gérer mes notifications</a>
            </p>`;
}
