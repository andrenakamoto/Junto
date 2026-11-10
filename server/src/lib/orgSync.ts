import prisma from './prisma';
import { detachFromCircle } from './circleDetach';
import { hideReservedPlans } from './planAccess';
import { joinCircleRoom } from './realtime';
import { audienceAllows, audienceExcludedIds, AudienceMembership, autoMemberIds, isManagerKind, OrgAction, parseAudience } from './organisations';
import { orgAllows, orgPermissions } from './orgPermissions';

// Organisations : ce qui touche la base. Tout part d'un Cercle dont `organisationId` est renseigné : un Cercle ordinaire
// ne passe par aucune de ces fonctions.

// Recalcule les Cercles automatiques d'une Organisation
export async function syncOrganisation(app: any, organisationId: string) {
  const io = app.get('io');
  const [circles, directors, directionRole, assignments] = await Promise.all([
    prisma.circle.findMany({ where: { organisationId }, select: { id: true, orgKind: true, creatorId: true, orgAutoDirection: true, orgAutoRoleIds: true, orgAutoCircleIds: true } }),
    prisma.organisationMember.findMany({ where: { organisationId, isDirection: true }, select: { userId: true } }),
    prisma.organisationRole.findFirst({ where: { organisationId, kind: 'direction' }, select: { id: true } }),
    prisma.circleMember.findMany({ where: { circle: { organisationId, orgKind: 'team' } }, select: { userId: true, orgRoleId: true, orgRole: { select: { kind: true } } } }),
  ]);
  const autos = circles.filter(c => c.orgKind === 'auto');
  if (!autos.length) return;
  const unitIds = circles.filter(c => c.orgKind === 'unit').map(c => c.id);
  const unitMembers = await prisma.circleMember.findMany({ where: { circleId: { in: unitIds } }, select: { circleId: true, userId: true } });
  const circleMembers = new Map<string, string[]>();
  for (const m of unitMembers) circleMembers.set(m.circleId, [...(circleMembers.get(m.circleId) ?? []), m.userId]);
  const directionIds = directors.map(d => d.userId);
  const facts = { directionIds, assignments: assignments.map(a => ({ userId: a.userId, roleId: a.orgRoleId })), circleMembers };

  for (const auto of autos) {
    const wanted = autoMemberIds({ autoDirection: auto.orgAutoDirection, autoRoleIds: auto.orgAutoRoleIds, autoCircleIds: auto.orgAutoCircleIds }, facts);
    const current = await prisma.circleMember.findMany({ where: { circleId: auto.id }, select: { userId: true, orgIntegrated: true } });
    const present = new Set(current.map(c => c.userId));
    let changed = false;
    for (const userId of wanted) {
      if (present.has(userId)) continue;
      const isDirection = directionIds.includes(userId);
      const assignment = assignments.find(a => a.userId === userId && a.orgRoleId && auto.orgAutoRoleIds.includes(a.orgRoleId));
      const manager = isDirection || isManagerKind(assignment?.orgRole?.kind);
      await prisma.circleMember.create({ data: { userId, circleId: auto.id, role: manager ? 'organizer' : 'member', orgRoleId: isDirection ? directionRole?.id : assignment?.orgRoleId } });
      await hideReservedPlans(userId, auto.id);
      await refreshOrgAudience(userId, organisationId);
      joinCircleRoom(io, userId, auto.id);
      io?.to(`user:${userId}`).emit('circle-updated', { circleId: auto.id });
      changed = true;
    }
    for (const member of current) {
      if (wanted.has(member.userId) || member.orgIntegrated || member.userId === auto.creatorId) continue;
      await detachFromCircle(app, auto.id, member.userId);
      io?.to(`user:${member.userId}`).emit('circle-updated', { circleId: auto.id });
      changed = true;
    }
    if (changed) io?.to(`circle:${auto.id}`).emit('circle-updated', { circleId: auto.id });
  }
}

// À appeler pour toute entrée dans un Cercle : rôle par défaut de l'équipe, rattachement à l'Organisation, Cercles automatiques
export async function afterCircleEntry(app: any, userId: string, circleId: string) {
  try {
    const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { organisationId: true, orgDefaultRoleId: true } });
    if (!circle?.organisationId) return;
    if (circle.orgDefaultRoleId) await prisma.circleMember.updateMany({ where: { userId, circleId, orgRoleId: null }, data: { orgRoleId: circle.orgDefaultRoleId } });
    await prisma.organisationMember.upsert({
      where: { organisationId_userId: { organisationId: circle.organisationId, userId } },
      create: { organisationId: circle.organisationId, userId }, update: {},
    });
    await refreshOrgAudience(userId, circle.organisationId);
    await syncOrganisation(app, circle.organisationId);
  } catch (e) { console.error('[organisation entrée]', e); }
}

// À appeler après un départ ou un retrait : la personne n'a plus forcément sa place dans les Cercles automatiques
export async function afterCircleExit(app: any, circleId: string) {
  try {
    const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { organisationId: true } });
    if (circle?.organisationId) await syncOrganisation(app, circle.organisationId);
  } catch (e) { console.error('[organisation départ]', e); }
}

const toMembership = (m: { userId: string; orgRoleId: string | null; orgRole: { kind: string } | null; circle: { orgKind: string | null } }): AudienceMembership =>
  ({ userId: m.userId, circleKind: m.circle.orgKind, roleId: m.orgRoleId, roleKind: m.orgRole?.kind ?? null });
const membershipSelect = { userId: true, orgRoleId: true, orgRole: { select: { kind: true } }, circle: { select: { orgKind: true } } } as const;

async function audienceMemberships(circleIds: string[]) {
  return (await prisma.circleMember.findMany({ where: { circleId: { in: circleIds } }, select: membershipSelect })).map(toMembership);
}

// Rôle ou Cercles d'une personne changés : ce qu'elle voit parmi les Plans et sondages à rôles visés est recalculé
export async function refreshOrgAudience(userId: string, organisationId: string) {
  const mine = await prisma.circleMember.findMany({ where: { userId, circle: { organisationId } }, select: { circleId: true, ...membershipSelect } });
  const circleIds = mine.map(m => m.circleId);
  if (!circleIds.length) return;
  const inCircles = { OR: [{ circleId: { in: circleIds } }, { extraCircles: { some: { circleId: { in: circleIds } } } }] };
  const concerned = (rows: { circleId: string; extraCircles: { circleId: string }[]; orgRoleIds: string[] }) => {
    const targets = new Set([rows.circleId, ...rows.extraCircles.map(e => e.circleId)]);
    return audienceAllows(mine.filter(m => targets.has(m.circleId)).map(toMembership), rows.orgRoleIds);
  };
  const [plans, polls] = await Promise.all([
    prisma.plan.findMany({ where: { orgRoleIds: { isEmpty: false }, creatorId: { not: userId }, endDate: { gt: new Date(Date.now() - 2 * 24 * 3600e3) }, ...inCircles }, select: { id: true, circleId: true, orgRoleIds: true, extraCircles: { select: { circleId: true } } } }),
    prisma.circlePoll.findMany({ where: { orgRoleIds: { isEmpty: false }, creatorId: { not: userId }, ...inCircles }, select: { id: true, circleId: true, orgRoleIds: true, extraCircles: { select: { circleId: true } } } }),
  ]);
  for (const plan of plans) {
    if (concerned(plan)) await prisma.planExclusion.deleteMany({ where: { planId: plan.id, userId, removed: false } });
    else {
      await prisma.planExclusion.createMany({ data: [{ planId: plan.id, userId }], skipDuplicates: true });
      await prisma.planMember.deleteMany({ where: { planId: plan.id, userId } });
    }
  }
  for (const poll of polls) {
    if (concerned(poll)) await prisma.circlePollExclusion.deleteMany({ where: { pollId: poll.id, userId } });
    else await prisma.circlePollExclusion.createMany({ data: [{ pollId: poll.id, userId }], skipDuplicates: true });
  }
}

// Entrer dans un Cercle sans code, en mode discret (direction)
export async function integrateCircle(app: any, organisationId: string, circleId: string, userId: string) {
  const direction = await prisma.organisationRole.findFirst({ where: { organisationId, kind: 'direction' }, select: { id: true } });
  await prisma.circleMember.create({ data: { userId, circleId, role: 'organizer', orgRoleId: direction?.id, orgIntegrated: true } });
  await prisma.notificationMute.upsert({ where: { userId_circleId: { userId, circleId } }, create: { userId, circleId }, update: {} });
  await hideReservedPlans(userId, circleId);
  await refreshOrgAudience(userId, organisationId);
  const io = app.get('io');
  joinCircleRoom(io, userId, circleId);
  io?.to(`circle:${circleId}`).emit('circle-updated', { circleId });
  await syncOrganisation(app, organisationId);
}

export interface ResolvedAudience { primaryId: string; extraIds: string[]; roleIds: string[]; excludedIds: string[] }

// « Pour qui ? » : vérifie le choix et prépare la création. Cercle principal = un Cercle visé dont la personne est membre.
export async function resolveAudience(app: any, userId: string, organisationId: string, raw: unknown, action: OrgAction): Promise<ResolvedAudience | { status: number; error: string }> {
  const parsed = parseAudience(raw);
  if (!parsed) return { status: 400, error: 'Choisis au moins un Cercle' };
  const circles = await prisma.circle.findMany({ where: { id: { in: parsed.circleIds }, organisationId }, select: { id: true } });
  if (circles.length !== parsed.circleIds.length) return { status: 400, error: 'Choisis au moins un Cercle' };
  const roles = await prisma.organisationRole.findMany({ where: { id: { in: parsed.roleIds }, organisationId, kind: { not: 'direction' } }, select: { id: true } });
  if (roles.length !== parsed.roleIds.length) return { status: 400, error: 'Rôle invalide' };
  if (parsed.circleIds.length > 1) {
    for (const circleId of parsed.circleIds) {
      if (!(await orgAllows(userId, organisationId, circleId, 'publish_multi'))) return { status: 403, error: 'Tu ne peux pas publier pour tous ces Cercles' };
    }
  }
  const mine = await prisma.circleMember.findMany({ where: { userId, circleId: { in: parsed.circleIds } }, select: { circleId: true } });
  const inCircle = new Set(mine.map(m => m.circleId));
  let primaryId = parsed.circleIds.find(id => inCircle.has(id));
  if (!primaryId) {
    if (!(await orgPermissions(userId, organisationId)).has('integrate_all')) return { status: 403, error: 'Tu dois être membre d’au moins un des Cercles choisis' };
    primaryId = parsed.circleIds[0];
  }
  if (!(await orgAllows(userId, organisationId, primaryId, action))) return { status: 403, error: 'Tu ne peux pas publier pour tous ces Cercles' };
  if (!inCircle.has(primaryId)) await integrateCircle(app, organisationId, primaryId, userId);
  return {
    primaryId, extraIds: parsed.circleIds.filter(id => id !== primaryId), roleIds: parsed.roleIds,
    excludedIds: audienceExcludedIds(await audienceMemberships(parsed.circleIds), parsed.roleIds, userId),
  };
}

// Nombre de personnes qui recevront (sans compter la personne qui publie)
export async function audienceCount(userId: string, raw: unknown): Promise<number> {
  const parsed = parseAudience(raw);
  if (!parsed) return 0;
  const memberships = await audienceMemberships(parsed.circleIds);
  const excluded = new Set(audienceExcludedIds(memberships, parsed.roleIds, userId));
  return new Set(memberships.map(m => m.userId).filter(id => id !== userId && !excluded.has(id))).size;
}

// Rôle choisi en acceptant une demande. null : rôle prévu pour l'équipe. Un rôle de responsable se donne seulement avec le droit de gérer les membres.
export async function roleForAcceptance(userId: string, circleId: string, raw: unknown): Promise<{ id: string; kind: string } | null | 'refused'> {
  if (typeof raw !== 'string') return null;
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { organisationId: true, orgKind: true } });
  if (!circle?.organisationId || circle.orgKind !== 'team') return null;
  const role = await prisma.organisationRole.findFirst({ where: { id: raw, organisationId: circle.organisationId, kind: { not: 'direction' } }, select: { id: true, kind: true } });
  if (!role) return 'refused';
  if (role.kind === 'member') return role;
  const me = await prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId: circle.organisationId, userId } }, select: { isAdmin: true } });
  return me?.isAdmin || await orgAllows(userId, circle.organisationId, circleId, 'manage_members') ? role : 'refused';
}
