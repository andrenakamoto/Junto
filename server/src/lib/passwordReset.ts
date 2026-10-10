import crypto from 'crypto';
import { userLocale } from './i18n';
import { mail } from './emailText';
import prisma from './prisma';
import { resend, FROM_EMAIL, APP_URL } from './mailer';

// Crée un lien de réinitialisation (valable 1 h) et l'envoie par email.
// Utilisé par « mot de passe oublié » et par l'admin (qui ne fixe plus de mot de passe lui-même).
// Renvoie false si l'email n'a pas pu partir (le SDK Resend ne lève pas d'exception).
export async function sendPasswordReset(user: { id: string; pseudo: string; email: string }, requestedByAdmin = false): Promise<boolean> {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const link = `${APP_URL}/reset-password?token=${token}`;
  const m = mail(await userLocale(user.id));
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: m.s('reset.subject'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>${m.t('reset.title')}</h2>
        <p>${m.t(requestedByAdmin ? 'reset.byAdmin' : 'reset.byUser', { name: user.pseudo })}</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          ${m.t('reset.button')}
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">${m.t('reset.expires')}</p>
      </div>`,
  });
  if (result.error) {
    console.error('[password reset email]', user.email, result.error);
    return false;
  }
  return true;
}
