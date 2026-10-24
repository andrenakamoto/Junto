import prisma from './prisma';

export interface PlanAccess {
  plan: { id: string; circleId: string; creatorId: string };
  isCircleMember: boolean;
  isPlanMember: boolean;
  isExcluded: boolean;
  // Membre du Cercle (non exclu) ou invité externe du Plan
  canView: boolean;
  // Membre du Plan sans être membre du Cercle : n'a accès qu'à ce Plan
  isGuest: boolean;
}

// Source unique de vérité pour l'accès à un Plan. Un exclu (Plan surprise) n'y a
// jamais accès, même s'il est membre du Cercle ; les routes doivent alors répondre
// comme si le Plan n'existait pas (404), pour ne pas trahir la surprise.
export async function getPlanAccess(userId: string, planId: string): Promise<PlanAccess | null> {
  const found = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, circleId: true, creatorId: true, extraCircles: { select: { circleId: true } } },
  });
  if (!found) return null;
  const { extraCircles, ...plan } = found;

  // Plan pour plusieurs Cercles : membre de l'un de ses Cercles
  const [circleMember, planMember, exclusion] = await Promise.all([
    prisma.circleMember.findFirst({ where: { userId, circleId: { in: [plan.circleId, ...extraCircles.map(c => c.circleId)] } }, select: { userId: true } }),
    prisma.planMember.findUnique({ where: { userId_planId: { userId, planId } } }),
    prisma.planExclusion.findUnique({ where: { planId_userId: { planId, userId } } }),
  ]);
  const isCircleMember = !!circleMember;
  const isPlanMember = !!planMember;
  const isExcluded = !!exclusion;
  return {
    plan,
    isCircleMember,
    isPlanMember,
    isExcluded,
    canView: !isExcluded && (isCircleMember || isPlanMember),
    isGuest: isPlanMember && !isCircleMember,
  };
}

// Filtre Prisma des Plans visibles par un utilisateur (Cercles + invitations, moins les surprises)
export function visiblePlansWhere(userId: string) {
  return {
    exclusions: { none: { userId } },
    OR: [
      { circle: { members: { some: { userId } } } },
      { extraCircles: { some: { circle: { members: { some: { userId } } } } } },
      { members: { some: { userId } } },
    ],
  };
}

// Plans d'un Cercle : ceux créés dedans et les Plans pour plusieurs Cercles qui l'incluent
export function plansOfCircleWhere(circleId: string) {
  return { OR: [{ circleId }, { extraCircles: { some: { circleId } } }] };
}

// Tous les Cercles d'un Plan (le sien d'abord, puis ceux d'un Plan pour plusieurs Cercles)
export async function planCircleIds(plan: { id: string; circleId: string }): Promise<string[]> {
  const extra = await prisma.planCircle.findMany({ where: { planId: plan.id }, select: { circleId: true } });
  return [plan.circleId, ...extra.map(e => e.circleId)];
}

// Ids, parmi `userIds`, des personnes qui ne sont membres d'aucun des Cercles (invités externes)
export async function guestIdsAmong(circleIds: string | string[], userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const inCircle = await prisma.circleMember.findMany({
    where: { circleId: { in: Array.isArray(circleIds) ? circleIds : [circleIds] }, userId: { in: userIds } },
    select: { userId: true },
  });
  const members = new Set(inCircle.map(m => m.userId));
  return new Set(userIds.filter(id => !members.has(id)));
}

// Valide une liste d'exclusions (Plan surprise) : uniquement des membres du Cercle,
// jamais le créateur (retiré silencieusement). Renvoie les ids dédoublonnés.
export async function validateExclusions(
  circleIds: string | string[],
  creatorId: string,
  raw: unknown,
): Promise<{ ids: string[] } | { error: string }> {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw) || raw.some(x => typeof x !== 'string')) {
    return { error: 'Liste des personnes exclues invalide' };
  }
  const ids = [...new Set(raw as string[])].filter(id => id !== creatorId);
  if (ids.length === 0) return { ids };
  const members = await prisma.circleMember.findMany({
    where: { circleId: { in: Array.isArray(circleIds) ? circleIds : [circleIds] }, userId: { in: ids } },
    select: { userId: true }, distinct: ['userId'],
  });
  if (members.length !== ids.length) return { error: 'On ne peut exclure que des membres du Cercle' };
  return { ids };
}

// ─── « Cacher à… » / « Réservé à… » (2026-10-24) ──────────────────────────────────────────────────────────────
// Les deux modes reposent sur les mêmes exclusions (PlanExclusion), donc sur toutes les règles d'accès ci-dessus.
// « Réservé à… » : l'app envoie les personnes autorisées, le serveur exclut tous les autres membres du ou des
// Cercles, et chaque personne qui rejoint un de ces Cercles ensuite (hideReservedPlans).
export type PlanVisibility = 'hidden' | 'reserved';
export const parseVisibility = (v: unknown): PlanVisibility | undefined => (v === 'hidden' || v === 'reserved' ? v : undefined);

export async function reservedExclusions(
  circleIds: string[],
  creatorId: string,
  raw: unknown,
): Promise<{ ids: string[] } | { error: string }> {
  if (!Array.isArray(raw) || raw.some(x => typeof x !== 'string')) return { error: 'Liste des personnes invalide' };
  const allowed = new Set(raw as string[]);
  const members = await prisma.circleMember.findMany({
    where: { circleId: { in: circleIds } },
    select: { userId: true }, distinct: ['userId'],
  });
  return { ids: members.map(m => m.userId).filter(id => id !== creatorId && !allowed.has(id)) };
}

// Exclusions selon le mode choisi (création et modification d'un Plan)
export async function exclusionsFor(
  circleIds: string[],
  creatorId: string,
  input: { visibility?: unknown; allowedUserIds?: unknown; excludedUserIds?: unknown },
): Promise<{ ids: string[]; visibility: PlanVisibility } | { error: string }> {
  const visibility = parseVisibility(input.visibility) ?? 'hidden';
  const r = visibility === 'reserved'
    ? (input.allowedUserIds !== undefined ? await reservedExclusions(circleIds, creatorId, input.allowedUserIds) : await validateExclusions(circleIds, creatorId, input.excludedUserIds))
    : await validateExclusions(circleIds, creatorId, input.excludedUserIds);
  return 'error' in r ? r : { ids: r.ids, visibility };
}

// Une personne qui rejoint un Cercle ne voit pas ses Plans « Réservé à… » (sauf si elle y participe déjà, comme invitée)
export async function hideReservedPlans(userId: string, circleId: string) {
  const plans = await prisma.plan.findMany({
    where: {
      visibility: 'reserved', creatorId: { not: userId }, endDate: { gt: new Date(Date.now() - 2 * 24 * 3600e3) },
      OR: [{ circleId }, { extraCircles: { some: { circleId } } }],
      members: { none: { userId } },
    },
    select: { id: true },
  });
  if (plans.length) await prisma.planExclusion.createMany({ data: plans.map(p => ({ planId: p.id, userId })), skipDuplicates: true });
}

// « Réservé à… » : la liste des personnes exclues (souvent tout le Cercle) n'est envoyée qu'au créateur du Plan
export function hideReservedList<T extends { visibility?: string | null; creatorId: string; exclusions?: unknown }>(plan: T, viewerId: string): T {
  return plan && plan.visibility === 'reserved' && plan.creatorId !== viewerId && Array.isArray(plan.exclusions) ? { ...plan, exclusions: [] } : plan;
}
