import type { Server } from 'socket.io';
import prisma from './prisma';

type PlanInfo = { id: string; title: string; circleId: string };

export function emitRidesUpdated(io: Server | undefined, planId: string) {
  io?.to(`plan:${planId}`).emit('rides-updated', { planId });
}

export function notifyRide(io: Server | undefined, userId: string, plan: PlanInfo, from: string, preview: string) {
  io?.to(`user:${userId}`).emit('notification', {
    type: 'ride',
    planId: plan.id,
    planTitle: plan.title,
    circleId: plan.circleId,
    from,
    preview,
  });
}

// Retire un membre de tout le covoiturage d'un Plan : son trajet (s'il conduit),
// sa place (s'il est passager) et sa demande. Utilisé quand il passe « Absent(e) ».
export async function removeUserFromRides(io: Server | undefined, planId: string, userId: string, pseudo: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true } });
  if (!plan) return;

  let changed = false;

  const ownRide = await prisma.ride.findUnique({
    where: { planId_driverId: { planId, driverId: userId } },
    include: { passengers: { select: { userId: true } } },
  });
  if (ownRide) {
    await prisma.ride.delete({ where: { id: ownRide.id } });
    for (const p of ownRide.passengers) {
      notifyRide(io, p.userId, plan, pseudo, `@${pseudo} ne vient plus : son trajet est annulé`);
    }
    changed = true;
  }

  const seat = await prisma.ridePassenger.findUnique({
    where: { planId_userId: { planId, userId } },
    include: { ride: { select: { driverId: true } } },
  });
  if (seat) {
    await prisma.ridePassenger.delete({ where: { rideId_userId: { rideId: seat.rideId, userId } } });
    notifyRide(io, seat.ride.driverId, plan, pseudo, `@${pseudo} ne vient plus : une place se libère`);
    changed = true;
  }

  const { count } = await prisma.rideRequest.deleteMany({ where: { planId, userId } });
  if (count > 0) changed = true;

  if (changed) emitRidesUpdated(io, planId);
}
