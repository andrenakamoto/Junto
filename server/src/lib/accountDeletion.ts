import prisma from './prisma';

// Supprime un compte sans pénaliser les autres membres :
// - ses Cercles passent au membre le plus ancien (supprimés s'il était seul) ;
// - ses Plans passent au participant le plus ancien, de préférence membre du
//   Cercle plutôt qu'invité externe (supprimés s'il était seul) ;
// - le reste (messages, votes, trajets, dépenses payées, adhésions…) part en
//   cascade avec l'utilisateur. Les photos (Attachment) restent dans les Plans.
// Circle.creator et Plan.creator n'ont pas de onDelete : sans ces transferts,
// la suppression de l'utilisateur échouerait sur la contrainte de clé étrangère.
export async function deleteUserAccount(userId: string) {
  const circles = await prisma.circle.findMany({ where: { creatorId: userId }, select: { id: true } });
  for (const { id: circleId } of circles) {
    const next = await prisma.circleMember.findFirst({
      where: { circleId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
    });
    if (!next) {
      await prisma.circle.delete({ where: { id: circleId } });
      continue;
    }
    await prisma.$transaction([
      prisma.circle.update({ where: { id: circleId }, data: { creatorId: next.userId } }),
      prisma.circleMember.update({
        where: { userId_circleId: { userId: next.userId, circleId } },
        data: { role: 'admin' },
      }),
    ]);
  }

  const plans = await prisma.plan.findMany({ where: { creatorId: userId }, select: { id: true, circleId: true } });
  for (const plan of plans) {
    const others = await prisma.planMember.findMany({
      where: { planId: plan.id, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
      select: { userId: true },
    });
    if (others.length === 0) {
      await prisma.plan.delete({ where: { id: plan.id } });
      continue;
    }
    const inCircle = await prisma.circleMember.findMany({
      where: { circleId: plan.circleId, userId: { in: others.map(o => o.userId) } },
      select: { userId: true },
    });
    const circleIds = new Set(inCircle.map(m => m.userId));
    const heir = others.find(o => circleIds.has(o.userId)) ?? others[0];
    await prisma.plan.update({ where: { id: plan.id }, data: { creatorId: heir.userId } });
  }

  await prisma.user.delete({ where: { id: userId } });
}
