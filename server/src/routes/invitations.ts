import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth as any);

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

export default router;
