import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth as any);
router.use(requireAdmin as any);

const userSelect = {
  id: true, pseudo: true, status: true, isAdmin: true, createdAt: true,
  email: true, emailVerified: true,
  _count: { select: { createdCircles: true } },
};

// List users (filter by ?status=pending|approved|rejected, or all)
router.get('/users', async (req: AuthRequest, res) => {
  const { status } = req.query;
  const users = await prisma.user.findMany({
    where: status ? { status: status as string } : {},
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// Approve a user
router.put('/users/:id/approve', async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'approved' },
    select: userSelect,
  });
  res.json(user);
});

// Reject a user and remove them from all circles and plans
router.put('/users/:id/reject', async (req: AuthRequest, res) => {
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'rejected' },
      select: userSelect,
    }),
    prisma.circleMember.deleteMany({ where: { userId: req.params.id } }),
    prisma.planMember.deleteMany({ where: { userId: req.params.id } }),
  ]);
  res.json(user);
});

// Reset a user's password to "123"
router.put('/users/:id/reset-password', async (req: AuthRequest, res) => {
  try {
    const hashed = await bcrypt.hash('123', 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashed },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete a user permanently
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    // Supprimer les cercles créés par l'utilisateur (cascade vers plans, messages, etc.)
    await prisma.circle.deleteMany({ where: { creatorId: id } });
    // Supprimer les plans créés par l'utilisateur dans d'autres cercles
    await prisma.plan.deleteMany({ where: { creatorId: id } });
    // Supprimer l'utilisateur (cascade vers memberships, votes, etc.)
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[delete user]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Stats summary
router.get('/stats', async (_req, res) => {
  const [pending, approved, rejected] = await Promise.all([
    prisma.user.count({ where: { status: 'pending', isAdmin: false } }),
    prisma.user.count({ where: { status: 'approved', isAdmin: false } }),
    prisma.user.count({ where: { status: 'rejected' } }),
  ]);
  res.json({ pending, approved, rejected });
});

export default router;
