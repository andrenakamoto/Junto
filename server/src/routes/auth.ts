import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { parseNotificationChannel } from '../lib/notificationPrefs';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { loginLimiter, registerLimiter, emailActionLimiter } from '../middleware/rateLimit';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { deleteUserAccount } from '../lib/accountDeletion';
import { sendPasswordReset } from '../lib/passwordReset';
import { validatePseudo, isPseudoTaken } from '../lib/pseudo';
import { absorbLightUser, readLightUser } from '../lib/lightGuest';
import { cancelEmailChange, confirmEmailChange, requestEmailChange, resendEmailChange } from '../lib/emailChange';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const CURRENT_TERMS_VERSION = 3;

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
  weeklyDigestEnabled?: boolean; firstName?: string | null; lastName?: string | null;
  password?: string | null; pendingEmail?: string | null; notificationChannel?: string;
  blocking?: { blockedId: string }[];
}) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    // Indique seulement si un mot de passe existe (comptes Google : non) ; le hash ne sort jamais
    hasPassword: !!user.password,
    status: user.status,
    isAdmin: user.isAdmin,
    termsAccepted: user.acceptedTermsVersion >= CURRENT_TERMS_VERSION,
    email: user.email ?? null,
    emailVerified: user.emailVerified ?? false,
    // Nouvelle adresse en attente de confirmation (changement d'email)
    pendingEmail: user.pendingEmail ?? null,
    weeklyDigestEnabled: user.weeklyDigestEnabled ?? true,
    notificationChannel: user.notificationChannel ?? 'both',
    // Personnes masquées (lib/moderation.ts) : leurs messages sont cachés côté client
    ...(user.blocking && { blockedUserIds: user.blocking.map(b => b.blockedId) }),
  };
}

// Prénom obligatoire (1 à 50 caractères), nom facultatif (50 max)
function parseNames(body: any): { firstName: string; lastName: string | null } | { error: string } {
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
  if (!firstName) return { error: 'Le prénom est obligatoire' };
  if (firstName.length > 50 || lastName.length > 50) return { error: 'Prénom et nom : 50 caractères maximum' };
  return { firstName, lastName: lastName || null };
}

async function sendVerificationEmail(email: string, pseudo: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Confirme ton adresse email — EvLY',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bienvenue sur EvLY, ${pseudo} 👋</h2>
        <p>Clique sur le bouton ci-dessous pour confirmer ton adresse email.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmer mon email
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ce lien expire dans 24h.</p>
      </div>`,
  });
}

// Connexion depuis un appareil où l'on avait répondu à des Plans sans compte : ces réponses
// passent sur le compte (lib/lightGuest.ts). Un échec ne doit pas empêcher la connexion.
async function transferLightAnswers(lightToken: unknown, userId: string) {
  try {
    await absorbLightUser(lightToken, userId);
  } catch (e) {
    console.error('[light transfer]', e);
  }
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

router.post('/setup', registerLimiter, async (req, res) => {
  try {
    const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
    if (admin) { res.status(409).json({ error: 'Un compte admin existe déjà' }); return; }
    const { pseudo, password } = req.body;
    if (!pseudo || !password) { res.status(400).json({ error: 'Pseudo et mot de passe requis' }); return; }
    const pseudoError = validatePseudo(pseudo);
    if (pseudoError) { res.status(400).json({ error: pseudoError }); return; }
    if (await isPseudoTaken(pseudo)) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
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

router.post('/register', registerLimiter, async (req, res) => {
  const { pseudo, password, email } = req.body;

  // Ancien flow (pseudo+password sans email) — maintenu pour compatibilité setup admin
  if (!email) {
    if (!pseudo || !password) { res.status(400).json({ error: 'Pseudo et mot de passe requis' }); return; }
    const pseudoError = validatePseudo(pseudo);
    if (pseudoError) { res.status(400).json({ error: pseudoError }); return; }
    try {
      if (await isPseudoTaken(pseudo)) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
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
  const names = parseNames(req.body);
  if ('error' in names) { res.status(400).json({ error: names.error }); return; }
  const pseudoError = validatePseudo(pseudo);
  if (pseudoError) { res.status(400).json({ error: pseudoError }); return; }
  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) { res.status(400).json({ error: 'Email invalide' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' }); return; }

  try {
    const [pseudoTaken, existingEmail] = await Promise.all([
      isPseudoTaken(pseudo),
      prisma.user.findUnique({ where: { email: emailLower } }),
    ]);
    if (pseudoTaken) { res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return; }
    if (existingEmail) { res.status(409).json({ error: 'Cet email est déjà utilisé' }); return; }

    const hashed = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const data = {
      pseudo, email: emailLower, password: hashed,
      firstName: names.firstName, lastName: names.lastName,
      status: 'approved', emailVerified: false,
      emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires,
    };

    // Inscription depuis un appareil où l'on avait répondu sans compte : le même compte
    // devient un compte normal (il garde ses réponses), à la validation de l'email
    const light = await readLightUser(req.body.lightToken);
    const user = light
      ? await prisma.user.update({ where: { id: light.id }, data })
      : await prisma.user.create({ data });

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
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null, isLight: false },
    });
    res.json({ token: makeToken(user), user: safeUser({ ...user, emailVerified: true }) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/resend-verification', emailActionLimiter, async (req, res) => {
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

router.post('/login', loginLimiter, async (req, res) => {
  const { pseudo, password, email } = req.body;

  try {
    let user;
    if (email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    } else if (pseudo) {
      // Pseudo insensible à la casse (« Andre » ou « andre ») ; l'unicité l'est aussi
      // (isPseudoTaken), donc au plus un compte correspond
      user = await prisma.user.findFirst({ where: { pseudo: { equals: String(pseudo).trim(), mode: 'insensitive' } } });
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
    await transferLightAnswers(req.body.lightToken, user.id);
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.post('/google', loginLimiter, async (req, res) => {
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
      // Compte créé avant l'ajout du prénom : on le complète depuis Google
      if (!user.firstName && payload.given_name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { firstName: payload.given_name.slice(0, 50), lastName: user.lastName ?? payload.family_name?.slice(0, 50) ?? null },
        });
      }
    } else {
      // Créer un pseudo unique basé sur le nom Google
      let pseudo = googleName.replace(/\s+/g, '').slice(0, 20);
      if (await isPseudoTaken(pseudo)) pseudo = pseudo + Math.floor(Math.random() * 9000 + 1000);

      user = await prisma.user.create({
        data: {
          pseudo, email: googleEmail, googleId: payload.sub,
          firstName: payload.given_name?.slice(0, 50) ?? null,
          lastName: payload.family_name?.slice(0, 50) ?? null,
          emailVerified: true, status: 'approved',
        },
      });
    }

    if (user.status === 'rejected') {
      res.status(403).json({ error: 'rejected', message: 'Ton compte a été refusé.' }); return;
    }

    await transferLightAnswers(req.body.lightToken, user.id);
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error('[google auth]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion Google' });
  }
});

// ─── Reset mot de passe ───────────────────────────────────────────────────────

router.post('/forgot-password', emailActionLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email requis' }); return; }
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user?.email) {
      await sendPasswordReset({ id: user.id, pseudo: user.pseudo, email: user.email });
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

const meSelect = {
  id: true, pseudo: true, status: true, isAdmin: true, acceptedTermsVersion: true,
  email: true, emailVerified: true, weeklyDigestEnabled: true, notificationChannel: true,
  blocking: { select: { blockedId: true } },
  firstName: true, lastName: true, password: true, pendingEmail: true,
};

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: meSelect });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  res.json(safeUser(user));
});

// Modifier son prénom et son nom
router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  const names = parseNames(req.body);
  if ('error' in names) { res.status(400).json({ error: names.error }); return; }
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { firstName: names.firstName, lastName: names.lastName },
      select: meSelect,
    });
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer son propre compte (mot de passe requis, ou « SUPPRIMER » pour un compte Google)
router.post('/delete-account', loginLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }

    if (user.password) {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || !(await bcrypt.compare(password, user.password))) {
        res.status(400).json({ error: 'Mot de passe incorrect' }); return;
      }
    } else if (req.body?.confirmation !== 'SUPPRIMER') {
      res.status(400).json({ error: 'Tape SUPPRIMER pour confirmer' }); return;
    }

    // Sans admin, /setup redeviendrait ouvert à n'importe qui
    if (user.isAdmin) {
      const otherAdmins = await prisma.user.count({ where: { isAdmin: true, id: { not: user.id } } });
      if (otherAdmins === 0) {
        res.status(400).json({ error: "Tu es le seul administrateur d'EvLY : ce compte ne peut pas être supprimé." }); return;
      }
    }

    await deleteUserAccount(user.id);
    res.json({ deleted: true });

    if (user.email && user.emailVerified) {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Ton compte EvLY a été supprimé',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Au revoir ${user.firstName || user.pseudo}</h2>
            <p>Ton compte EvLY et tes données personnelles ont bien été supprimés. Les Cercles et Plans que tu avais créés ont été confiés à d'autres membres.</p>
            <p style="color:#888;font-size:12px;margin-top:24px">Tu peux recréer un compte à tout moment sur evly.ch.</p>
          </div>`,
      });
      if (result.error) console.error('[delete account email]', user.email, result.error);
    }
  } catch (e) {
    console.error('[delete account]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

router.put('/notification-settings', requireAuth, async (req: AuthRequest, res) => {
  // Chaque champ est facultatif : on ne modifie que ceux envoyés
  const { weeklyDigestEnabled } = req.body;
  const notificationChannel = req.body.notificationChannel === undefined ? undefined : parseNotificationChannel(req.body.notificationChannel);
  if ((weeklyDigestEnabled !== undefined && typeof weeklyDigestEnabled !== 'boolean') || notificationChannel === null
    || (weeklyDigestEnabled === undefined && notificationChannel === undefined)) {
    res.status(400).json({ error: 'Champ invalide' }); return;
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { weeklyDigestEnabled, notificationChannel },
    select: meSelect,
  });
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
    // Remplacer une adresse déjà vérifiée passe par /change-email (mot de passe + confirmation)
    if (user.email && user.emailVerified) {
      res.status(409).json({ error: 'Pour changer ton adresse, utilise « Changer mon email » dans ton profil' }); return;
    }

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

// Changer son adresse email : mot de passe requis (sauf compte Google, sans mot de passe),
// puis confirmation par le lien envoyé à la nouvelle adresse — lib/emailChange.ts
router.post('/change-email', emailActionLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
    if (user.password) {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || !(await bcrypt.compare(password, user.password))) {
        res.status(400).json({ error: 'Mot de passe incorrect' }); return;
      }
    }
    const result = await requestEmailChange(user, req.body?.email);
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: meSelect });
    res.json(safeUser(fresh!));
  } catch (e) {
    console.error('[change email]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/change-email/resend', emailActionLimiter, requireAuth, async (req: AuthRequest, res) => {
  const result = await resendEmailChange(req.userId!);
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  res.json({ ok: true });
});

router.delete('/change-email', requireAuth, async (req: AuthRequest, res) => {
  await cancelEmailChange(req.userId!);
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: meSelect });
  res.json(safeUser(user!));
});

// Clic sur le lien reçu à la nouvelle adresse (pas besoin d'être connecté)
router.post('/confirm-email-change', emailActionLimiter, async (req, res) => {
  try {
    const result = await confirmEmailChange(req.body?.token);
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true, email: result.email });
  } catch (e) {
    console.error('[confirm email change]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/accept-terms', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { acceptedTermsVersion: CURRENT_TERMS_VERSION },
    select: meSelect,
  });
  res.json(safeUser(user));
});

export default router;
