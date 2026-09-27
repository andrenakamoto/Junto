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
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, circleId: true, creatorId: true },
  });
  if (!plan) return null;

  const [circleMember, planMember, exclusion] = await Promise.all([
    prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId: plan.circleId } } }),
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
      { members: { some: { userId } } },
    ],
  };
}

// Ids, parmi `userIds`, des personnes qui ne sont pas membres du Cercle (invités externes)
export async function guestIdsAmong(circleId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const inCircle = await prisma.circleMember.findMany({
    where: { circleId, userId: { in: userIds } },
    select: { userId: true },
  });
  const circleIds = new Set(inCircle.map(m => m.userId));
  return new Set(userIds.filter(id => !circleIds.has(id)));
}

// Valide une liste d'exclusions (Plan surprise) : uniquement des membres du Cercle,
// jamais le créateur (retiré silencieusement). Renvoie les ids dédoublonnés.
export async function validateExclusions(
  circleId: string,
  creatorId: string,
  raw: unknown,
): Promise<{ ids: string[] } | { error: string }> {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw) || raw.some(x => typeof x !== 'string')) {
    return { error: 'Liste des personnes exclues invalide' };
  }
  const ids = [...new Set(raw as string[])].filter(id => id !== creatorId);
  if (ids.length === 0) return { ids };
  const inCircle = await prisma.circleMember.count({ where: { circleId, userId: { in: ids } } });
  if (inCircle !== ids.length) return { error: 'On ne peut exclure que des membres du Cercle' };
  return { ids };
}
