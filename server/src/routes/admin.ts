import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth as any);
router.use(requireAdmin as any);

const userSelect = { id: true, pseudo: true, status: true, isAdmin: true, createdAt: true };

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

// Reject a user
router.put('/users/:id/reject', async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'rejected' },
    select: userSelect,
  });
  res.json(user);
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
