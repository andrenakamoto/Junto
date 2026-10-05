import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY || 'dev-placeholder');
export const FROM_EMAIL = process.env.FROM_EMAIL || 'EvLY <noreply@estelle.app>';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Pied de page des emails de notification (pas des emails de compte) : comment les couper.
// Le lien ouvre directement la fenêtre « Notifications » de l'app (CircleSidebar).
// Où se trouve le menu des réglages dans EvLY (site et apps)
const MENU = 'dans EvLY, touche le menu <b>☰</b> en bas de la liste de tes Cercles (à côté de ton pseudo), puis <b>« Notifications »</b>';

// kind : 'notification' (cas général, avec le mode silencieux par Plan / Cercle), 'simple' (sans la
// cloche : mentions, que le mode silencieux ne coupe pas ; invitation et admission dans un Cercle),
// 'digest' (résumé hebdomadaire)
export function notificationFooter(kind: 'notification' | 'simple' | 'digest' = 'notification'): string {
  const text = kind === 'digest'
    ? `Pour ne plus recevoir ce résumé : ${MENU}, et désactive « Résumé hebdomadaire ».`
    : kind === 'simple'
    ? `Pour ne plus recevoir ces emails : ${MENU}, et choisis « Notifications push » (seulement sur ton téléphone, avec l'app EvLY).`
    : `Pour ne plus recevoir ces emails : ${MENU}, et choisis « Notifications push » (seulement sur ton téléphone, avec l'app EvLY).<br>`
      + `Pour un seul Plan ou un seul Cercle, touche la cloche 🔔 (mode silencieux) : sur la carte du Plan, à côté de ta réponse, ou en haut de la liste des Plans du Cercle.`;
  return `
            <p style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5">
              ${text}<br>
              <a href="${APP_URL}/dashboard?reglages=notifications" style="color:#94a3b8">Gérer mes notifications</a>
            </p>`;
}
