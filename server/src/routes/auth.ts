import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const CURRENT_TERMS_VERSION = 1;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Estelle <noreply@estelle.app>';

function makeToken(user: { id: string; pseudo: string; isAdmin: boolean }) {
  return jwt.sign(
    { userId: user.id, pseudo: user.pseudo, isAdmin: user.isAdmin },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

function safeUser(user: {
  id: string; pseudo: string; status: string; isAdmin: boolean;
  acceptedTermsVersion: number; email?: string | null; emailVerified?: boolean;
}) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    status: user.status,
    isAdmin: user.isAdmin,
    termsAccepted: user.acceptedTermsVersion >= CURRENT_TERMS_VERSION,
    email: user.email ?? null,
    emailVerified: user.emailVerified ?? false,
  };
}

async function sendVerificationEmail(email: string, pseudo: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Confirme ton adresse email — Estelle',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bienvenue sur Estelle, ${pseudo} 👋</h2>
        <p>Clique sur le bouton ci-dessous pour confirmer ton adresse email.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmer mon email
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 24h.</p>
      </div>`,
  });
}

async function sendPasswordResetEmail(email: string, pseudo: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Réinitialisation de ton mot de passe — Estelle',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Bonjour ${pseudo}, tu as demandé à réinitialiser ton mot de passe.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 1h. Si tu n'as pas fait cette demande, ignore cet email.</p>
      </div>`,
  });
}

// ─── Setup admin ─────────────────────────────────────────────────────────────

router.get('/needs-setup', async (_req, res) => {
  try {
    const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
    res.json({ needsSetup: !admin });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
    if (admin) { res.status(409).json({ error: 'Un compte admin existe déjà' }); return; }
    const { pseudo, password } = req.body;
    if (!pseudo || !password) { res.status(400).json({ error: 'Pseudo et mot de passe requis' }); return; }
    const existing = await prisma.user.findUnique({ where: { pseudo } });
    if (existing) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { pseudo, password: hashed, isAdmin: true, status: 'approved' },
    });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Inscription email ────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { pseudo, password, email } = req.body;

  // Ancien flow (pseudo+password sans email) — maintenu pour compatibilité setup admin
  if (!email) {
    if (!pseudo || !password) { res.status(400).json({ error: 'Pseudo et mot de passe requis' }); return; }
    try {
      const existing = await prisma.user.findUnique({ where: { pseudo } });
      if (existing) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({ data: { pseudo, password: hashed, status: 'pending' } });
      res.json({ pending: true, user: safeUser(user) });
    } catch { res.status(500).json({ error: 'Erreur serveur' }); }
    return;
  }

  // Nouveau flow email
  if (!pseudo || !password || !email) {
    res.status(400).json({ error: 'Pseudo, email et mot de passe requis' }); return;
  }
  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) { res.status(400).json({ error: 'Email invalide' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' }); return; }

  try {
    const [existingPseudo, existingEmail] = await Promise.all([
      prisma.user.findUnique({ where: { pseudo } }),
      prisma.user.findUnique({ where: { email: emailLower } }),
    ]);
    if (existingPseudo) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
    if (existingEmail) { res.status(409).json({ error: 'Cet email est déjà utilisé' }); return; }

    const hashed = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        pseudo, email: emailLower, password: hashed,
        status: 'approved', emailVerified: false,
        emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires,
      },
    });

    await sendVerificationEmail(emailLower, pseudo, verifyToken);
    res.json({ pendingVerification: true, user: safeUser(user) });
  } catch (e) {
    console.error('[register]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Vérification email ───────────────────────────────────────────────────────

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: 'Token manquant' }); return; }
  try {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token, emailVerifyExpires: { gt: new Date() } },
    });
    if (!user) { res.status(400).json({ error: 'Lien invalide ou expiré' }); return; }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });
    res.json({ token: makeToken(user), user: safeUser({ ...user, emailVerified: true }) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email requis' }); return; }
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.emailVerified) { res.json({ ok: true }); return; } // silencieux
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires },
    });
    await sendVerificationEmail(user.email!, user.pseudo, verifyToken);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Connexion ────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { pseudo, password, email } = req.body;

  try {
    let user;
    if (email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    } else if (pseudo) {
      user = await prisma.user.findUnique({ where: { pseudo } });
    }

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Identifiants incorrects' }); return;
    }
    if (user.email && !user.emailVerified) {
      res.status(403).json({ error: 'email_unverified', message: 'Vérifie ton email avant de te connecter.' }); return;
    }
    if (user.status === 'pending') {
      res.status(403).json({ error: 'pending', message: 'Ton compte est en attente de validation.' }); return;
    }
    if (user.status === 'rejected') {
      res.status(403).json({ error: 'rejected', message: 'Ton inscription a été refusée.' }); return;
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) { res.status(400).json({ error: 'Token Google manquant' }); return; }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      res.status(400).json({ error: 'Token Google invalide' }); return;
    }

    const googleEmail = payload.email.toLowerCase();
    const googleName = payload.name || payload.email.split('@')[0];

    // Chercher par googleId ou email existant
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: googleEmail }] },
    });

    if (user) {
      // Rattacher googleId si l'utilisateur existait avec cet email
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, emailVerified: true },
        });
      }
    } else {
      // Créer un pseudo unique basé sur le nom Google
      let pseudo = googleName.replace(/\s+/g, '').slice(0, 20);
      const taken = await prisma.user.findUnique({ where: { pseudo } });
      if (taken) pseudo = pseudo + Math.floor(Math.random() * 9000 + 1000);

      user = await prisma.user.create({
        data: {
          pseudo, email: googleEmail, googleId: payload.sub,
          emailVerified: true, status: 'approved',
        },
      });
    }

    if (user.status === 'rejected') {
      res.status(403).json({ error: 'rejected', message: 'Ton compte a été refusé.' }); return;
    }

    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error('[google auth]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion Google' });
  }
});

// ─── Reset mot de passe ───────────────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email requis' }); return; }
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: token, resetPasswordExpires: expires },
      });
      await sendPasswordResetEmail(user.email!, user.pseudo, token);
    }
    res.json({ ok: true }); // toujours ok (évite l'énumération d'emails)
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) { res.status(400).json({ error: 'Champs requis' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' }); return; }
  try {
    const user = await prisma.user.findFirst({
      where: { resetPasswordToken: token, resetPasswordExpires: { gt: new Date() } },
    });
    if (!user) { res.status(400).json({ error: 'Lien invalide ou expiré' }); return; }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetPasswordToken: null, resetPasswordExpires: null },
    });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Routes authentifiées ─────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, pseudo: true, status: true, isAdmin: true, acceptedTermsVersion: true, email: true, emailVerified: true },
  });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  res.json(safeUser(user));
});

router.put('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ error: 'Champs requis' }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      res.status(401).json({ error: 'Mot de passe actuel incorrect' }); return;
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter/mettre à jour l'email (migration anciens utilisateurs)
router.put('/add-email', requireAuth, async (req: AuthRequest, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email requis' }); return; }
  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) { res.status(400).json({ error: 'Email invalide' }); return; }
  try {
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing && existing.id !== req.userId) {
      res.status(409).json({ error: 'Cet email est déjà utilisé' }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: req.userId },
      data: { email: emailLower, emailVerified: false, emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires },
    });
    await sendVerificationEmail(emailLower, user.pseudo, verifyToken);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/accept-terms', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { acceptedTermsVersion: CURRENT_TERMS_VERSION },
    select: { id: true, pseudo: true, status: true, isAdmin: true, acceptedTermsVersion: true, email: true, emailVerified: true },
  });
  res.json(safeUser(user));
});

export default router;
