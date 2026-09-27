import prisma from './prisma';

// Rôles dans un Cercle (CircleMember.role) :
//   'admin'     → le créateur (Circle.creatorId fait foi)
//   'organizer' → organisateur nommé par le créateur : mêmes droits que lui sur le Cercle
//                 (paramètres, couleur, admissions, création réservée), sauf nommer/retirer
//                 des organisateurs et supprimer le Cercle. Aucun droit sur les Plans des autres.
//   'member'    → membre
export const ORGANIZER_ROLE = 'organizer';

export async function isCircleManager(userId: string, circleId: string): Promise<boolean> {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { creatorId: true } });
  if (!circle) return false;
  if (circle.creatorId === userId) return true;
  const m = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { role: true } });
  return m?.role === ORGANIZER_ROLE;
}

// Successeur quand le créateur part : organisateur le plus ancien, sinon membre le plus ancien
export async function nextCircleCreator(circleId: string, leavingUserId: string) {
  return (await prisma.circleMember.findFirst({
    where: { circleId, userId: { not: leavingUserId }, role: ORGANIZER_ROLE },
    orderBy: { joinedAt: 'asc' },
  })) ?? prisma.circleMember.findFirst({
    where: { circleId, userId: { not: leavingUserId } },
    orderBy: { joinedAt: 'asc' },
  });
}
