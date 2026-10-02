import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { blockedUserIds, createReport, findReportTarget, REPORT_REASON_MAX } from '../lib/moderation';

// Signaler un message / masquer une personne — voir lib/moderation.ts
const router = Router();
router.use(requireAuth as any);

// POST /api/moderation/reports { kind: 'plan' | 'poll', messageId, reason? }
router.post('/reports', async (req: AuthRequest, res) => {
  try {
    const target = await findReportTarget(req.body?.kind, req.body?.messageId, req.userId!);
    if (!target) { res.status(404).json({ error: 'Message introuvable' }); return; }
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, REPORT_REASON_MAX) : null;
    await createReport(target, req.userId!, reason);
    res.json({ ok: true });
  } catch (e) {
    console.error('[report]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

async function blockList(userId: string) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blocked: { select: { id: true, pseudo: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(r => r.blocked);
}

// GET /api/moderation/blocks — personnes que j'ai masquées
router.get('/blocks', async (req: AuthRequest, res) => {
  res.json(await blockList(req.userId!));
});

// POST /api/moderation/blocks { userId } — masquer (uniquement quelqu'un qu'on côtoie : Cercle ou Plan commun)
router.post('/blocks', async (req: AuthRequest, res) => {
  const blockedId = req.body?.userId;
  if (typeof blockedId !== 'string' || blockedId === req.userId) { res.status(400).json({ error: 'Personne invalide' }); return; }
  const shared = await prisma.user.findFirst({
    where: {
      id: blockedId,
      OR: [
        { memberships: { some: { circle: { members: { some: { userId: req.userId! } } } } } },
        { planMemberships: { some: { plan: { members: { some: { userId: req.userId! } } } } } },
      ],
    },
    select: { id: true },
  });
  if (!shared) { res.status(404).json({ error: 'Personne introuvable' }); return; }
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: req.userId!, blockedId } },
    create: { blockerId: req.userId!, blockedId },
    update: {},
  });
  res.json({ blockedUserIds: await blockedUserIds(req.userId!) });
});

// DELETE /api/moderation/blocks/:userId — ne plus masquer
router.delete('/blocks/:userId', async (req: AuthRequest, res) => {
  await prisma.userBlock.deleteMany({ where: { blockerId: req.userId!, blockedId: req.params.userId } });
  res.json({ blockedUserIds: await blockedUserIds(req.userId!) });
});

export default router;
