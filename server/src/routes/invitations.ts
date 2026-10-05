import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { getPlanAccess } from '../lib/planAccess';
import { ensureInviteToken } from '../lib/express';
import { escapeHtml } from '../lib/escapeHtml';

// Invitations par email ou SMS. Le serveur fabrique lui-même le lien et le texte : il ne fait jamais
// confiance au contenu envoyé par le client (sinon, n'importe quel compte pourrait envoyer depuis
// noreply@evly.ch un email avec le lien de son choix — hameçonnage). L'expéditeur doit être membre
// du Cercle (ou du Plan pour un lien d'invité), et le nombre d'envois est limité.
const router = Router();
router.use(requireAuth as any);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const twilioConfigured =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER;

// 20 invitations par jour et par compte (email et SMS confondus)
const inviteLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `invite:${req.userId}`,
  message: { error: 'Tu as envoyé beaucoup d’invitations aujourd’hui. Partage plutôt le lien ou le QR code.' },
});

type Invite = { link: string; circleName: string | null; planTitle: string | null; code: string | null; guest: boolean };

// Ce que la personne a le droit d'envoyer : { planId?, circleId?, guest? } — ou, pour les apps déjà
// installées (avant le 2026-10-05), { circleCode, joinLink } dont on ne garde que les identifiants.
async function resolveInvite(req: AuthRequest): Promise<Invite | { error: string; status: number }> {
  const body = req.body ?? {};
  let planId: string | undefined = typeof body.planId === 'string' ? body.planId : undefined;
  let circleId: string | undefined = typeof body.circleId === 'string' ? body.circleId : undefined;
  let guest = body.guest === true;
  if (!planId && !circleId && typeof body.joinLink === 'string') {
    try {
      const u = new URL(body.joinLink);
      const token = u.searchParams.get('token');
      if (token) {
        const gl = await prisma.planGuestLink.findUnique({ where: { token }, select: { planId: true } });
        if (gl) { planId = gl.planId; guest = true; }
      } else if (u.searchParams.get('planId')) planId = u.searchParams.get('planId')!;
    } catch { /* lien illisible : ignoré */ }
  }
  if (!circleId && typeof body.circleCode === 'string') {
    const c = await prisma.circle.findUnique({ where: { code: body.circleCode.trim().toUpperCase() }, select: { id: true } });
    circleId = c?.id;
  }

  let plan: { id: string; title: string; circleId: string } | null = null;
  if (planId) {
    const access = await getPlanAccess(req.userId!, planId);
    if (!access?.canView) return { error: 'Plan introuvable', status: 404 };
    if (guest && !access.isPlanMember) return { error: 'Rejoins le Plan pour inviter quelqu’un', status: 403 };
    plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true } });
    if (!plan) return { error: 'Plan introuvable', status: 404 };
    circleId = plan.circleId;
  }
  if (guest && plan) {
    const token = await ensureInviteToken(plan.id);
    return { link: `${APP_URL}/invitation?token=${token}`, circleName: null, planTitle: plan.title, code: null, guest: true };
  }
  if (!circleId) return { error: 'Cercle introuvable', status: 404 };
  const member = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId: req.userId!, circleId } } });
  if (!member) return { error: 'Accès refusé', status: 403 };
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true, code: true } });
  if (!circle) return { error: 'Cercle introuvable', status: 404 };
  const link = `${APP_URL}/rejoindre?code=${circle.code}${plan ? `&planId=${plan.id}&plan=${encodeURIComponent(plan.title)}` : ''}`;
  return { link, circleName: circle.name, planTitle: plan?.title ?? null, code: circle.code, guest: false };
}

// Returns whether Twilio is available
router.get('/status', (_req, res) => {
  res.json({ twilioEnabled: twilioConfigured });
});

// Invitation par SMS (texte fabriqué ici)
router.post('/sms', inviteLimiter, async (req: AuthRequest, res) => {
  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
  if (!/^\+?[0-9 ]{8,20}$/.test(to)) { res.status(400).json({ error: 'Numéro invalide' }); return; }
  if (!twilioConfigured) { res.status(503).json({ error: 'twilio_not_configured' }); return; }
  const inv = await resolveInvite(req);
  if ('error' in inv) { res.status(inv.status).json({ error: inv.error }); return; }
  const message = inv.guest
    ? `${req.pseudo} t'invite au Plan "${inv.planTitle}" sur EvLY : ${inv.link}`
    : inv.planTitle
    ? `${req.pseudo} t'invite au Plan "${inv.planTitle}" (Cercle "${inv.circleName}") sur EvLY : ${inv.link}`
    : `${req.pseudo} t'invite dans le Cercle "${inv.circleName}" sur EvLY : ${inv.link}`;
  try {
    const twilio = await import('twilio');
    const client = twilio.default(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER!, to: to.replace(/ /g, '') });
    res.json({ success: true });
  } catch (err) {
    console.error('[invite sms]', err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du SMS' });
  }
});

// Invitation par email (sujet, texte et lien fabriqués ici, texte échappé)
router.post('/email', inviteLimiter, async (req: AuthRequest, res) => {
  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
  if (!to || !EMAIL_REGEX.test(to) || to.length > 200) { res.status(400).json({ error: 'Email invalide' }); return; }
  const inv = await resolveInvite(req);
  if ('error' in inv) { res.status(inv.status).json({ error: inv.error }); return; }

  const who = escapeHtml(req.pseudo ?? '');
  const subject = inv.planTitle
    ? `${req.pseudo} t'invite au Plan "${inv.planTitle}" sur EvLY`
    : `${req.pseudo} t'invite dans le Cercle "${inv.circleName}" sur EvLY`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>${who} t'invite sur EvLY 🎉</h2>
      ${inv.guest
        ? `<p>Tu es invité(e) au Plan <strong>"${escapeHtml(inv.planTitle!)}"</strong>. Ouvre le lien pour voir le Plan et répondre, même sans compte.</p>`
        : inv.planTitle
        ? `<p>Tu es invité(e) au Plan <strong>"${escapeHtml(inv.planTitle)}"</strong>. Rejoins d'abord le Cercle <strong>"${escapeHtml(inv.circleName!)}"</strong> pour y accéder.</p>`
        : `<p>Tu es invité(e) à rejoindre le Cercle <strong>"${escapeHtml(inv.circleName!)}"</strong>.</p>`}
      <a href="${inv.link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        ${inv.guest ? 'Voir le Plan' : 'Rejoindre'}
      </a>
      ${inv.code ? `<p style="color:#888;font-size:12px;margin-top:24px">Code d'accès du Cercle : <strong>${inv.code}</strong> (déjà inclus dans le lien ci-dessus).</p>` : ''}
    </div>`;

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (result.error) {
      console.error('[invite email]', result.error);
      res.status(502).json({ error: 'Erreur lors de l\'envoi de l\'email' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[invite email]', err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
  }
});

export default router;
