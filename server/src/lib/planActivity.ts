import prisma from './prisma';

// Pastilles « nouveau » sur les onglets d'un Plan et sur sa carte.
// Chaque écriture met à jour la date d'activité de l'onglet concerné (PlanActivity) ;
// chaque participant mémorise quand il a vu chaque onglet (PlanMember.seen). Un onglet est
// « non vu » si son activité est plus récente que la dernière visite. L'auteur d'un ajout
// est marqué comme ayant vu l'onglet : ses propres actions ne lui créent pas de pastille.

export const PLAN_SECTIONS = ['chat', 'infos', 'trajets', 'membres', 'votes', 'depenses'] as const;
export type PlanSection = typeof PLAN_SECTIONS[number];

type Seen = Partial<Record<PlanSection, string>>;

export function isPlanSection(v: unknown): v is PlanSection {
  return typeof v === 'string' && (PLAN_SECTIONS as readonly string[]).includes(v);
}

async function setSeen(planId: string, userId: string, sections: readonly PlanSection[], at: Date) {
  const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId } }, select: { seen: true } });
  if (!member) return;
  const seen = { ...((member.seen as Seen) ?? {}) };
  for (const s of sections) seen[s] = at.toISOString();
  await prisma.planMember.update({ where: { userId_planId: { userId, planId } }, data: { seen } });
}

// Activité dans un onglet (appelé après une écriture réussie)
export async function touchPlanSection(planId: string, section: PlanSection, actorId?: string) {
  const at = new Date();
  try {
    await prisma.planActivity.upsert({
      where: { planId_section: { planId, section } },
      create: { planId, section, at },
      update: { at },
    });
    if (actorId) await setSeen(planId, actorId, [section], at);
  } catch (e) {
    // Plan supprimé entre-temps : sans importance
  }
}

export async function markSectionSeen(planId: string, userId: string, section: PlanSection) {
  await setSeen(planId, userId, [section], new Date());
}

// Nouveau participant : tout ce qui existe déjà est considéré comme vu
export async function markAllSeen(planId: string, userId: string) {
  await setSeen(planId, userId, PLAN_SECTIONS, new Date());
}

export function unseenSections(activities: { section: string; at: Date }[], seen: unknown): PlanSection[] {
  const s = (seen ?? {}) as Seen;
  return activities
    .filter(a => isPlanSection(a.section) && (!s[a.section as PlanSection] || new Date(s[a.section as PlanSection]!) < a.at))
    .map(a => a.section as PlanSection);
}

// Onglets non vus de chaque Plan pour un utilisateur (Plans dont il est participant)
export async function unseenByPlan(userId: string, planIds: string[]): Promise<Map<string, PlanSection[]>> {
  const result = new Map<string, PlanSection[]>();
  if (planIds.length === 0) return result;
  const [activities, members] = await Promise.all([
    prisma.planActivity.findMany({ where: { planId: { in: planIds } } }),
    prisma.planMember.findMany({ where: { userId, planId: { in: planIds } }, select: { planId: true, seen: true } }),
  ]);
  for (const m of members) {
    result.set(m.planId, unseenSections(activities.filter(a => a.planId === m.planId), m.seen));
  }
  return result;
}
