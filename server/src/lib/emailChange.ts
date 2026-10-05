import crypto from 'crypto';
import { escapeHtml } from './escapeHtml';
import prisma from './prisma';
import { resend, FROM_EMAIL, APP_URL } from './mailer';

// Changement d'adresse email. La nouvelle adresse n'est prise en compte qu'une fois
// confirmée par le lien qu'elle reçoit (24 h) ; l'ancienne reste active jusque-là
// et est prévenue après le changement. Sert au profil comme au panneau admin.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 24 * 60 * 60 * 1000;

type Target = { id: string; pseudo: string; firstName?: string | null; email: string | null };
type Result = { ok: true } | { ok: false; status: number; error: string };

export function normalizeEmail(v: unknown): string | null {
  const email = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

async function sendConfirmation(to: string, name: string, token: string, byAdmin: boolean): Promise<boolean> {
  const link = `${APP_URL}/confirmer-email?token=${token}`;
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Confirme ta nouvelle adresse email — EvLY',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bonjour ${escapeHtml(name)} 👋</h2>
        <p>${byAdmin ? "L'administrateur d'EvLY a demandé" : 'Tu as demandé'} à utiliser cette adresse pour ton compte EvLY. Clique sur le bouton pour confirmer.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmer ma nouvelle adresse
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 24 h. Si tu n'es pas à l'origine de cette demande, ignore cet email : rien ne changera.</p>
      </div>`,
  }).catch(e => ({ data: null, error: e }));
  if (r.error) { console.error('[email change confirmation]', to, r.error); return false; }
  return true;
}

export async function requestEmailChange(user: Target, rawEmail: unknown, byAdmin = false): Promise<Result> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, status: 400, error: 'Adresse email invalide' };
  if (email === user.email) return { ok: false, status: 400, error: "C'est déjà l'adresse de ce compte" };
  const taken = await prisma.user.findFirst({ where: { email, id: { not: user.id } }, select: { id: true } });
  if (taken) return { ok: false, status: 409, error: 'Cette adresse est déjà utilisée par un autre compte' };

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingEmail: email, pendingEmailToken: token, pendingEmailExpires: new Date(Date.now() + DAY) },
  });
  const sent = await sendConfirmation(email, user.firstName || user.pseudo, token, byAdmin);
  if (!sent) {
    // Pas de changement « en attente » si personne n'a reçu de lien
    await cancelEmailChange(user.id);
    return { ok: false, status: 502, error: "L'email de confirmation n'a pas pu être envoyé. Réessaie plus tard." };
  }
  return { ok: true };
}

// Renvoie le lien vers l'adresse en attente (nouveau lien, nouvelle échéance de 24 h)
export async function resendEmailChange(userId: string): Promise<Result> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, pseudo: true, firstName: true, email: true, pendingEmail: true } });
  if (!user?.pendingEmail) return { ok: false, status: 400, error: 'Aucun changement en attente' };
  return requestEmailChange(user, user.pendingEmail);
}

export async function cancelEmailChange(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { pendingEmail: null, pendingEmailToken: null, pendingEmailExpires: null } });
}

export async function confirmEmailChange(token: unknown): Promise<Result & { email?: string }> {
  if (typeof token !== 'string' || !token) return { ok: false, status: 400, error: 'Lien invalide' };
  const user = await prisma.user.findUnique({ where: { pendingEmailToken: token } });
  if (!user?.pendingEmail || !user.pendingEmailExpires || user.pendingEmailExpires < new Date()) {
    return { ok: false, status: 400, error: 'Lien invalide ou expiré. Recommence le changement depuis « Mon profil ».' };
  }
  const newEmail = user.pendingEmail;
  // L'adresse a pu être prise entre-temps par une inscription
  const taken = await prisma.user.findFirst({ where: { email: newEmail, id: { not: user.id } }, select: { id: true } });
  if (taken) {
    await cancelEmailChange(user.id);
    return { ok: false, status: 409, error: 'Cette adresse est désormais utilisée par un autre compte' };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: newEmail, emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null,
      pendingEmail: null, pendingEmailToken: null, pendingEmailExpires: null,
    },
  });

  // Prévenir l'ancienne adresse : protection classique en cas de compte piraté
  if (user.email && user.emailVerified) {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: 'Ton adresse email EvLY a été modifiée',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Bonjour ${escapeHtml(user.firstName || user.pseudo)}</h2>
          <p>L'adresse email de ton compte EvLY (@${escapeHtml(user.pseudo)}) a été remplacée par <strong>${newEmail}</strong>. Les prochains emails d'EvLY seront envoyés à cette nouvelle adresse.</p>
          <p><strong>Ce n'était pas toi ?</strong> Écris-nous tout de suite à <a href="mailto:info@evly.ch">info@evly.ch</a>.</p>
        </div>`,
    }).catch(e => ({ data: null, error: e }));
    if (r.error) console.error('[email change notice]', user.email, r.error);
  }
  return { ok: true, email: newEmail };
}
