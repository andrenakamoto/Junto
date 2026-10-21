import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { availabilityExpiry, parseAvailability, shouldNotify } from '../lib/availability';
import { notifyUser } from '../lib/push';

// « Dispo » (lib/availability.ts) : qui est libre maintenant ou ce soir dans un Cercle
const router = Router();
router.use(requireAuth);

const userSelect = { id: true, pseudo: true, firstName: true } as const;

// Cercle où la fonction est utilisable par cette personne (membre, Cercle non personnel, « Dispo » activée)
async function usableCircle(userId: string, circleId: string) {
  const circle = await prisma.circle.findFirst({
    where: { id: circleId, members: { some: { userId } } },
    select: { id: true, name: true, isPersonal: true, availabilityEnabled: true, availabilityThreshold: true },
  });
  if (!circle) return { error: 404 as const };
  if (circle.isPersonal || !circle.availabilityEnabled) return { error: 409 as const, circle };
  return { circle };
}

// Dispos encore valables d'un Cercle, seulement des membres actuels, sans les personnes que je masque
export async function activeAvailabilities(circleId: string, viewerId: string) {
  const now = new Date();
  const [rows, blocks] = await Promise.all([
    prisma.availability.findMany({
      where: { circleId, expiresAt: { gt: now }, user: { memberships: { some: { circleId } } } },
      orderBy: { createdAt: 'asc' },
      select: { slot: true, tags: true, note: true, createdAt: true, expiresAt: true, user: { select: userSelect } },
    }),
    prisma.userBlock.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
  ]);
  const hidden = new Set(blocks.map(b => b.blockedId));
  return rows.filter(r => !hidden.has(r.user.id));
}

function emitCircle(req: AuthRequest, circleId: string) {
  req.app.get('io')?.to(`circle:${circleId}`).emit('circle-updated', { circleId });
}

// GET /api/availability/circles/:id — { enabled, threshold, entries }
router.get('/circles/:id', async (req: AuthRequest, res) => {
  const found = await usableCircle(req.userId!, req.params.id);
  if (found.error === 404) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  const circle = found.circle!;
  const enabled = !circle.isPersonal && circle.availabilityEnabled;
  const entries = enabled ? await activeAvailabilities(circle.id, req.userId!) : [];
  res.json({ enabled, threshold: circle.availabilityThreshold, entries });
});

// PUT /api/availability/circles/:id { slot, tags, note } — je suis dispo (remplace ma dispo précédente)
router.put('/circles/:id', async (req: AuthRequest, res) => {
  const found = await usableCircle(req.userId!, req.params.id);
  if (found.error === 404) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (found.error === 409) { res.status(409).json({ error: 'La fonction « Dispo » est désactivée dans ce Cercle' }); return; }
  const circle = found.circle!;
  const input = parseAvailability(req.body);
  if (!input) { res.status(400).json({ error: 'Disponibilité invalide' }); return; }

  const now = new Date();
  const previous = await prisma.availability.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: circle.id } },
    select: { slot: true, expiresAt: true },
  });
  const data = { slot: input.slot, tags: input.tags, note: input.note, expiresAt: availabilityExpiry(input.slot, now), createdAt: now };
  await prisma.availability.upsert({
    where: { userId_circleId: { userId: req.userId!, circleId: circle.id } },
    create: { ...data, userId: req.userId!, circleId: circle.id },
    update: data,
  });
  res.json({ ok: true, expiresAt: data.expiresAt });
  emitCircle(req, circle.id);

  // Les autres membres sont prévenus (app + push, jamais d'email), sauf réglage coupé ou Cercle en silence
  if (!shouldNotify(previous, input.slot, now)) return;
  const members = await prisma.circleMember.findMany({
    where: { circleId: circle.id, userId: { not: req.userId! }, user: { isLight: false, availabilityPush: true } },
    select: { userId: true },
  });
  for (const m of members) {
    notifyUser(req.app.get('io'), m.userId, {
      type: 'availability', circleId: circle.id, circleName: circle.name, from: req.pseudo, actorId: req.userId!, status: input.slot,
    });
  }
});

// DELETE /api/availability/circles/:id — plus dispo
router.delete('/circles/:id', async (req: AuthRequest, res) => {
  await prisma.availability.deleteMany({ where: { userId: req.userId!, circleId: req.params.id } });
  res.json({ ok: true });
  emitCircle(req, req.params.id);
});

export default router;
