import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

export const CURRENT_TERMS_VERSION = 1;

function makeToken(user: { id: string; pseudo: string; isAdmin: boolean }) {
  return jwt.sign(
    { userId: user.id, pseudo: user.pseudo, isAdmin: user.isAdmin },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

function safeUser(user: { id: string; pseudo: string; status: string; isAdmin: boolean; acceptedTermsVersion: number }) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    status: user.status,
    isAdmin: user.isAdmin,
    termsAccepted: user.acceptedTermsVersion >= CURRENT_TERMS_VERSION,
  };
}

// Check if first-time setup is needed (no admin exists yet)
router.get('/needs-setup', async (_req, res) => {
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  res.json({ needsSetup: !admin });
});

// First-time admin setup (only works if no admin exists)
router.post('/setup', async (req, res) => {
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (admin) {
    res.status(409).json({ error: 'Un compte admin existe déjà' });
    return;
  }
  const { pseudo, password } = req.body;
  if (!pseudo || !password) {
    res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { pseudo } });
  if (existing) {
    res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { pseudo, password: hashed, isAdmin: true, status: 'approved' },
  });
  const token = makeToken(user);
  res.json({ token, user: safeUser(user) });
});

// Register — account starts as pending
router.post('/register', async (req, res) => {
  const { pseudo, password } = req.body;
  if (!pseudo || !password) {
    res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    return;
  }
  try {
    const existing = await prisma.user.findUnique({ where: { pseudo } });
    if (existing) {
      res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { pseudo, password: hashed, status: 'pending' },
    });
    res.json({ pending: true, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login — blocks pending and rejected users
router.post('/login', async (req, res) => {
  const { pseudo, password } = req.body;
  if (!pseudo || !password) {
    res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({ where: { pseudo } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
      return;
    }
    if (user.status === 'pending') {
      res.status(403).json({ error: 'pending', message: 'Ton compte est en attente de validation par un admin.' });
      return;
    }
    if (user.status === 'rejected') {
      res.status(403).json({ error: 'rejected', message: 'Ton inscription a été refusée.' });
      return;
    }
    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, pseudo: true, status: true, isAdmin: true, acceptedTermsVersion: true },
  });
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  res.json(safeUser(user));
});

// Accept current terms of use
router.post('/accept-terms', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { acceptedTermsVersion: CURRENT_TERMS_VERSION },
    select: { id: true, pseudo: true, status: true, isAdmin: true, acceptedTermsVersion: true },
  });
  res.json(safeUser(user));
});

export default router;
