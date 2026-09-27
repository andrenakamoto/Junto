import crypto from 'crypto';
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
  const intro = requestedByAdmin
    ? "l'administrateur d'EvLY t'envoie un lien pour choisir un nouveau mot de passe."
    : 'tu as demandé à réinitialiser ton mot de passe.';
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: 'Réinitialisation de ton mot de passe — EvLY',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Bonjour ${user.pseudo}, ${intro}</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 1h. Si tu n'as pas fait cette demande, ignore cet email.</p>
      </div>`,
  });
  if (result.error) {
    console.error('[password reset email]', user.email, result.error);
    return false;
  }
  return true;
}
