import prisma from './prisma';

// Pastilles « nouveau » sur les onglets d'un Plan et sur sa carte.
// Chaque écriture met à jour la date d'activité de l'onglet concerné (PlanActivity) ;
// chaque participant mémorise quand il a vu chaque onglet (PlanMember.seen). Un onglet est
// « non vu » si son activité est plus récente que la dernière visite. L'auteur d'un ajout
// est marqué comme ayant vu l'onglet : ses propres actions ne lui créent pas de pastille.

export const PLAN_SECTIONS = ['chat', 'infos', 'trajets', 'membres', 'votes', 'depenses', 'benevoles', 'taches', 'deroule', 'idees', 'fournisseurs', 'materiel'] as const;
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

// Date de la visite précédente d'une rubrique (renvoyée par POST /plans/:id/seen, pour la mise en évidence)
export async function previousSeen(planId: string, userId: string, section: PlanSection): Promise<string | null> {
  const m = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId } }, select: { seen: true } });
  return ((m?.seen as Seen) ?? {})[section] ?? null;
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
  const details = await unseenDetails(userId, planIds);
  return new Map([...details].map(([id, d]) => [id, d.sections]));
}

// Idem, avec la date de la dernière activité non vue (cloche : une notification effacée
// réapparaît s'il se passe quelque chose de nouveau après)
export async function unseenDetails(userId: string, planIds: string[]): Promise<Map<string, UnseenDetail>> {
  const result = new Map<string, UnseenDetail>();
  if (planIds.length === 0) return result;
  const [activities, members] = await Promise.all([
    prisma.planActivity.findMany({ where: { planId: { in: planIds } } }),
    prisma.planMember.findMany({ where: { userId, planId: { in: planIds } }, select: { planId: true, seen: true } }),
  ]);
  for (const m of members) {
    const mine = activities.filter(a => a.planId === m.planId);
    const sections = unseenSections(mine, m.seen);
    const dates = mine.filter(a => sections.includes(a.section as PlanSection)).map(a => a.at.getTime());
    result.set(m.planId, { sections, at: dates.length ? new Date(Math.max(...dates)).toISOString() : null, seen: (m.seen as Seen) ?? {} });
  }
  return result;
}

// Dernière visite de chaque rubrique (seenAt) : l'app met en évidence, dans le Plan, ce qui a changé depuis (2026-11-17)
export type UnseenDetail = { sections: PlanSection[]; at: string | null; seen: Seen };

// Cloche (2026-11-17, demande de l'utilisateur : « on ne voit pas grand-chose ») : combien de nouveaux messages, de qui,
// et qui a rejoint ou changé de réponse depuis la dernière visite. Seulement pour les Plans dont ces rubriques sont non vues.
export type UnseenCounts = { chat?: { count: number; from: string[] }; membres?: { count: number; who: string[] } };
export async function unseenCounts(userId: string, details: Map<string, UnseenDetail>): Promise<Map<string, UnseenCounts>> {
  const out = new Map<string, UnseenCounts>();
  const uniq = (list: string[]) => [...new Set(list)].slice(0, 3);
  for (const [planId, d] of details) {
    const c: UnseenCounts = {};
    if (d.sections.includes('chat') && d.seen.chat) {
      const msgs = await prisma.message.findMany({
        where: { planId, createdAt: { gt: new Date(d.seen.chat) }, authorId: { not: userId }, deletedAt: null },
        select: { author: { select: { pseudo: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
      });
      if (msgs.length) c.chat = { count: msgs.length, from: uniq(msgs.map(m => m.author.pseudo)) };
    }
    if (d.sections.includes('membres') && d.seen.membres) {
      const since = new Date(d.seen.membres);
      const members = await prisma.planMember.findMany({
        where: { planId, userId: { not: userId }, OR: [{ joinedAt: { gt: since } }, { rsvpAt: { gt: since } }] },
        select: { user: { select: { pseudo: true } } }, orderBy: { joinedAt: 'desc' }, take: 100,
      });
      if (members.length) c.membres = { count: members.length, who: uniq(members.map(m => m.user.pseudo)) };
    }
    if (c.chat || c.membres) out.set(planId, c);
  }
  return out;
}
