import prisma from './prisma';
import { OrgAction, permissionsOf } from './organisations';

// Droits d'une personne dans une Organisation (rôle dans le Cercle, direction, unités).

export async function orgPermissions(userId: string, organisationId: string, circleId?: string): Promise<Set<string>> {
  const [membership, direction, member, units] = await Promise.all([
    prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId, userId } } }),
    prisma.organisationRole.findFirst({ where: { organisationId, kind: 'direction' }, select: { permissions: true } }),
    circleId ? prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { orgRole: { select: { permissions: true } } } }) : null,
    prisma.circleMember.findMany({ where: { userId, circle: { organisationId, orgKind: 'unit' } }, select: { circle: { select: { orgExtraPermissions: true } } } }),
  ]);
  return permissionsOf({
    rolePermissions: member?.orgRole?.permissions,
    directionPermissions: membership?.isDirection ? direction?.permissions : null,
    unitPermissions: units.map(u => u.circle.orgExtraPermissions),
  });
}

export async function orgAllows(userId: string, organisationId: string, circleId: string, action: OrgAction): Promise<boolean> {
  return (await orgPermissions(userId, organisationId, circleId)).has(action);
}

// Droit dans un Plan : null = règles habituelles (Cercle sans Organisation, ou personne qui n'est pas membre du Cercle du Plan :
// invité extérieur, membre d'un autre Cercle du Plan)
export async function orgPlanAllows(userId: string, circleId: string, action: OrgAction): Promise<boolean | null> {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { organisationId: true } });
  if (!circle?.organisationId) return null;
  const member = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } });
  if (!member) return null;
  return orgAllows(userId, circle.organisationId, circleId, action);
}
