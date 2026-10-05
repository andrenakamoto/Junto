import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';

// Mode silencieux (lib/mutes.ts) : liste et réglage, par Plan ou par Cercle
const router = Router();
router.use(requireAuth);

// GET /api/mutes — ce que la personne a mis en silence (avec les noms, pour la fenêtre Notifications)
router.get('/', async (req: AuthRequest, res) => {
  const rows = await prisma.notificationMute.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { id: true, title: true } }, circle: { select: { id: true, name: true } } },
  });
  res.json({
    plans: rows.filter(r => r.plan).map(r => ({ id: r.plan!.id, title: r.plan!.title })),
    circles: rows.filter(r => r.circle).map(r => ({ id: r.circle!.id, name: r.circle!.name })),
  });
});

// PUT /api/mutes { planId | circleId, muted }
router.put('/', async (req: AuthRequest, res) => {
  const { planId, circleId, muted } = req.body ?? {};
  const userId = req.userId!;
  if ((!planId) === (!circleId) || typeof muted !== 'boolean') { res.status(400).json({ error: 'Requête invalide' }); return; }
  if (planId) {
    const access = await getPlanAccess(userId, String(planId));
    if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  } else {
    const member = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId: String(circleId) } } });
    if (!member) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  }
  const where = planId ? { userId, planId: String(planId) } : { userId, circleId: String(circleId) };
  if (muted) {
    const exists = await prisma.notificationMute.findFirst({ where });
    if (!exists) await prisma.notificationMute.create({ data: where });
  } else {
    await prisma.notificationMute.deleteMany({ where });
  }
  res.json({ ok: true, muted });
});

export default router;
