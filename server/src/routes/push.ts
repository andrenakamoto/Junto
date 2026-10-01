import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

// Jetons des notifications push (apps Android / iOS) — voir lib/push.ts
const router = Router();
router.use(requireAuth);

const PLATFORMS = new Set(['android', 'ios']);

function readToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096 ? value : null;
}

// Enregistre l'appareil pour le compte connecté (un appareil passe au dernier compte connecté)
router.post('/token', async (req: AuthRequest, res) => {
  const token = readToken(req.body?.token);
  const platform = String(req.body?.platform ?? '');
  if (!token || !PLATFORMS.has(platform)) return res.status(400).json({ error: 'Jeton invalide' });
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, platform, userId: req.userId! },
    update: { platform, userId: req.userId! },
  });
  res.json({ ok: true });
});

// Déconnexion : l'appareil ne reçoit plus les notifications de ce compte
router.delete('/token', async (req: AuthRequest, res) => {
  const token = readToken(req.body?.token);
  if (!token) return res.status(400).json({ error: 'Jeton invalide' });
  await prisma.pushToken.deleteMany({ where: { token, userId: req.userId! } });
  res.json({ ok: true });
});

export default router;
