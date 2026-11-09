import prisma from './prisma';
import { plansOfCircleWhere } from './planAccess';
import { removeFromGamesInPlans } from './planGames';
import { leaveCircleRoom } from './realtime';
import { promoteFromWaitlist } from './waitlist';

// Retire un membre (pas le créateur) d'un Cercle : Plans qu'il ne voit plus par un autre Cercle, jeux, postes, liste d'attente
export async function detachFromCircle(app: any, circleId: string, userId: string) {
  leaveCircleRoom(app.get('io'), userId, circleId);
  const [circlePlans, otherCircles] = await Promise.all([
    prisma.plan.findMany({ where: plansOfCircleWhere(circleId), select: { id: true, circleId: true, extraCircles: { select: { circleId: true } } } }),
    prisma.circleMember.findMany({ where: { userId, circleId: { not: circleId } }, select: { circleId: true } }),
  ]);
  const stillIn = new Set(otherCircles.map(c => c.circleId));
  const lost = circlePlans.filter(p => ![p.circleId, ...p.extraCircles.map(e => e.circleId)].some(id => id !== circleId && stillIn.has(id))).map(p => p.id);
  const lostPlans = { planId: { in: lost } };
  const heldPlans = (await prisma.planMember.findMany({ where: { userId, rsvp: { not: 'out' }, ...lostPlans }, select: { planId: true } })).map(m => m.planId);
  await removeFromGamesInPlans(lost, userId);
  await prisma.$transaction([
    prisma.circleDeleteVote.deleteMany({ where: { userId, circleId } }),
    prisma.availability.deleteMany({ where: { userId, circleId } }),
    prisma.planMember.deleteMany({ where: { userId, ...lostPlans } }),
    prisma.planWaitlist.deleteMany({ where: { userId, ...lostPlans } }),
    prisma.volunteerSignup.deleteMany({ where: { userId, ...lostPlans } }),
    prisma.circleMember.delete({ where: { userId_circleId: { userId, circleId } } }),
  ]);
  for (const id of heldPlans) promoteFromWaitlist(app.get('io'), id).catch(e => console.error('[waitlist remove]', e));
}
