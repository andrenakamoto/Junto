import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { resend, FROM_EMAIL } from '../lib/mailer';

const router = Router();
router.use(requireAuth as any);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const twilioConfigured =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER;

// Returns whether Twilio is available
router.get('/status', (_req, res) => {
  res.json({ twilioEnabled: twilioConfigured });
});

// Send an SMS invitation
router.post('/sms', async (req: AuthRequest, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    res.status(400).json({ error: 'Numéro et message requis' });
    return;
  }

  if (!twilioConfigured) {
    res.status(503).json({ error: 'twilio_not_configured' });
    return;
  }

  try {
    // Dynamic import to avoid crash when package is present but creds are wrong
    const twilio = await import('twilio');
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER!,
      to,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi du SMS' });
  }
});

// Send an email invitation
router.post('/email', async (req: AuthRequest, res) => {
  const { to, circleName, circleCode, planTitle, joinLink } = req.body;
  if (!to || !EMAIL_REGEX.test(to)) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }
  if (!circleName || !circleCode || !joinLink) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }

  const subject = planTitle
    ? `${req.pseudo} t'invite au Plan "${planTitle}" sur EvLY`
    : `${req.pseudo} t'invite dans le Cercle "${circleName}" sur EvLY`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>${req.pseudo} t'invite sur EvLY 🎉</h2>
      ${planTitle
        ? `<p>Tu es invité(e) au Plan <strong>"${planTitle}"</strong>. Rejoins d'abord le Cercle <strong>"${circleName}"</strong> pour y accéder.</p>`
        : `<p>Tu es invité(e) à rejoindre le Cercle <strong>"${circleName}"</strong>.</p>`}
      <a href="${joinLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Rejoindre
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Code d'accès du Cercle : <strong>${circleCode}</strong> (déjà inclus dans le lien ci-dessus).
      </p>
    </div>`;

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (result.error) {
      res.status(502).json({ error: result.error.message || 'Erreur lors de l\'envoi de l\'email' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi de l\'email' });
  }
});

export default router;
