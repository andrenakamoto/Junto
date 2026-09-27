import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { emitRidesUpdated, notifyRide } from '../lib/rides';
import { FEATURE_DISABLED_ERROR } from '../lib/settings';

const router = Router();
router.use(requireAuth as any);

const MAX_SEATS = 8;

const rideInclude = {
  driver: { select: { id: true, pseudo: true } },
  passengers: {
    include: { user: { select: { id: true, pseudo: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

type Membership =
  | { error: string; status: number }
  | { plan: { id: string; title: string; circleId: string } };

// Vérifie que l'utilisateur est membre du Plan ; `active` exige en plus qu'il ne soit pas « Absent(e) »
async function getMembership(planId: string, userId: string, active: boolean): Promise<Membership> {
  const member = await prisma.planMember.findUnique({
    where: { userId_planId: { userId, planId } },
    include: { plan: { select: { id: true, title: true, circleId: true, disabledFeatures: true } } },
  });
  if (!member) return { error: 'Tu dois rejoindre ce Plan pour accéder au covoiturage', status: 403 };
  if (active && member.plan.disabledFeatures.includes('trajets')) return { error: FEATURE_DISABLED_ERROR, status: 403 };
  if (active && member.rsvp === 'out') {
    return { error: 'Tu es indiqué(e) absent(e) à ce Plan', status: 403 };
  }
  return { plan: member.plan };
}

function parseRideInput(body: any) {
  const departure = typeof body.departure === 'string' ? body.departure.trim() : '';
  if (!departure || departure.length > 100) return { error: 'Lieu de départ requis (100 caractères max)' } as const;
  const seats = Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    return { error: `Nombre de places invalide (1 à ${MAX_SEATS})` } as const;
  }
  let departureAt: Date | null = null;
  if (body.departureAt) {
    departureAt = new Date(body.departureAt);
    if (isNaN(departureAt.getTime())) return { error: 'Heure de départ invalide' } as const;
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null;
  return { data: { departure, seats, departureAt, note } } as const;
}

// GET /api/rides/plan/:planId — trajets + demandes de place du Plan
router.get('/plan/:planId', async (req: AuthRequest, res) => {
  try {
    const access = await getMembership(req.params.planId, req.userId!, false);
    if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }

    const [rides, requests] = await Promise.all([
      prisma.ride.findMany({
        where: { planId: req.params.planId },
        include: rideInclude,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.rideRequest.findMany({
        where: { planId: req.params.planId },
        include: { user: { select: { id: true, pseudo: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    res.json({ rides, requests });
  } catch (e) {
    console.error('[rides list]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rides/plan/:planId — proposer un trajet (un seul par conducteur et par Plan)
router.post('/plan/:planId', async (req: AuthRequest, res) => {
  try {
    const planId = req.params.planId;
    const userId = req.userId!;
    const access = await getMembership(planId, userId, true);
    if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }

    const input = parseRideInput(req.body);
    if ('error' in input) { res.status(400).json({ error: input.error }); return; }

    const existing = await prisma.ride.findUnique({ where: { planId_driverId: { planId, driverId: userId } } });
    if (existing) { res.status(409).json({ error: 'Tu proposes déjà un trajet pour ce Plan' }); return; }

    // Un conducteur n'est ni passager ni en recherche de place
    const [, , ride] = await prisma.$transaction([
      prisma.ridePassenger.deleteMany({ where: { planId, userId } }),
      prisma.rideRequest.deleteMany({ where: { planId, userId } }),
      prisma.ride.create({ data: { ...input.data, planId, driverId: userId }, include: rideInclude }),
    ]);

    emitRidesUpdated(req.app.get('io'), planId);
    res.json(ride);
  } catch (e) {
    console.error('[ride create]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rides/plan/:planId/request — « Je cherche une place » (crée ou met à jour)
router.post('/plan/:planId/request', async (req: AuthRequest, res) => {
  try {
    const planId = req.params.planId;
    const userId = req.userId!;
    const access = await getMembership(planId, userId, true);
    if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }

    const fromLocation = typeof req.body.fromLocation === 'string' ? req.body.fromLocation.trim() : '';
    if (!fromLocation || fromLocation.length > 100) {
      res.status(400).json({ error: 'Indique d\'où tu pars (100 caractères max)' }); return;
    }

    const [isDriver, isPassenger] = await Promise.all([
      prisma.ride.findUnique({ where: { planId_driverId: { planId, driverId: userId } } }),
      prisma.ridePassenger.findUnique({ where: { planId_userId: { planId, userId } } }),
    ]);
    if (isDriver) { res.status(409).json({ error: 'Tu proposes déjà un trajet pour ce Plan' }); return; }
    if (isPassenger) { res.status(409).json({ error: 'Tu as déjà une place dans un trajet' }); return; }

    const request = await prisma.rideRequest.upsert({
      where: { planId_userId: { planId, userId } },
      create: { planId, userId, fromLocation },
      update: { fromLocation },
    });

    emitRidesUpdated(req.app.get('io'), planId);
    res.json(request);
  } catch (e) {
    console.error('[ride request]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/rides/plan/:planId/request — retirer sa demande
router.delete('/plan/:planId/request', async (req: AuthRequest, res) => {
  try {
    await prisma.rideRequest.deleteMany({ where: { planId: req.params.planId, userId: req.userId! } });
    emitRidesUpdated(req.app.get('io'), req.params.planId);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ride request delete]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/rides/:rideId — modifier son trajet (conducteur uniquement)
router.put('/:rideId', async (req: AuthRequest, res) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.rideId },
      include: { _count: { select: { passengers: true } } },
    });
    if (!ride) { res.status(404).json({ error: 'Trajet introuvable' }); return; }
    if (ride.driverId !== req.userId) { res.status(403).json({ error: 'Réservé au conducteur' }); return; }

    const input = parseRideInput(req.body);
    if ('error' in input) { res.status(400).json({ error: input.error }); return; }
    if (input.data.seats < ride._count.passengers) {
      res.status(400).json({ error: `${ride._count.passengers} passager(s) sont déjà inscrits, il faut au moins autant de places` });
      return;
    }

    const updated = await prisma.ride.update({ where: { id: ride.id }, data: input.data, include: rideInclude });
    emitRidesUpdated(req.app.get('io'), ride.planId);
    res.json(updated);
  } catch (e) {
    console.error('[ride update]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/rides/:rideId — annuler son trajet (conducteur uniquement), prévient les passagers
router.delete('/:rideId', async (req: AuthRequest, res) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.rideId },
      include: {
        passengers: { select: { userId: true } },
        plan: { select: { id: true, title: true, circleId: true } },
      },
    });
    if (!ride) { res.status(404).json({ error: 'Trajet introuvable' }); return; }
    if (ride.driverId !== req.userId) { res.status(403).json({ error: 'Réservé au conducteur' }); return; }

    await prisma.ride.delete({ where: { id: ride.id } });

    const io = req.app.get('io');
    for (const p of ride.passengers) {
      notifyRide(io, p.userId, ride.plan, req.pseudo!, `@${req.pseudo} a annulé son trajet depuis ${ride.departure}`);
    }
    emitRidesUpdated(io, ride.planId);
    res.json({ deleted: true });
  } catch (e) {
    console.error('[ride delete]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rides/:rideId/join — « Je monte » (bascule automatiquement depuis un autre trajet)
router.post('/:rideId/join', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.rideId } });
    if (!ride) { res.status(404).json({ error: 'Trajet introuvable' }); return; }
    if (ride.driverId === userId) { res.status(400).json({ error: 'Tu es le conducteur de ce trajet' }); return; }

    const access = await getMembership(ride.planId, userId, true);
    if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }

    const isDriver = await prisma.ride.findUnique({ where: { planId_driverId: { planId: ride.planId, driverId: userId } } });
    if (isDriver) {
      res.status(409).json({ error: 'Tu proposes déjà ton propre trajet pour ce Plan' }); return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const already = await tx.ridePassenger.findUnique({ where: { rideId_userId: { rideId: ride.id, userId } } });
      if (already) return { ok: true as const, previousDriverId: null };

      const taken = await tx.ridePassenger.count({ where: { rideId: ride.id } });
      if (taken >= ride.seats) return { ok: false as const };

      const previous = await tx.ridePassenger.findUnique({
        where: { planId_userId: { planId: ride.planId, userId } },
        include: { ride: { select: { driverId: true } } },
      });
      if (previous) {
        await tx.ridePassenger.delete({ where: { rideId_userId: { rideId: previous.rideId, userId } } });
      }
      await tx.ridePassenger.create({ data: { rideId: ride.id, userId, planId: ride.planId } });
      await tx.rideRequest.deleteMany({ where: { planId: ride.planId, userId } });
      return { ok: true as const, previousDriverId: previous?.ride.driverId ?? null };
    });

    if (!result.ok) { res.status(409).json({ error: 'Ce trajet est complet' }); return; }

    const io = req.app.get('io');
    notifyRide(io, ride.driverId, access.plan, req.pseudo!, `@${req.pseudo} monte dans ta voiture`);
    if (result.previousDriverId) {
      notifyRide(io, result.previousDriverId, access.plan, req.pseudo!, `@${req.pseudo} a changé de trajet : une place se libère`);
    }
    emitRidesUpdated(io, ride.planId);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ride join]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/rides/:rideId/join — « Je descends »
router.delete('/:rideId/join', async (req: AuthRequest, res) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.rideId },
      include: { plan: { select: { id: true, title: true, circleId: true } } },
    });
    if (!ride) { res.status(404).json({ error: 'Trajet introuvable' }); return; }

    const { count } = await prisma.ridePassenger.deleteMany({ where: { rideId: ride.id, userId: req.userId! } });
    if (count > 0) {
      const io = req.app.get('io');
      notifyRide(io, ride.driverId, ride.plan, req.pseudo!, `@${req.pseudo} descend : une place se libère`);
      emitRidesUpdated(io, ride.planId);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[ride leave]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
