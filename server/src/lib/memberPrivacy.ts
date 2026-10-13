import prisma from './prisma';
import { ORGANIZER_ROLE } from './circleRoles';

// « Qui voit les participants » d'un Plan (Mode annonce, 2026-10-13) : `all` (défaut) ou `managers` = le créateur du
// Plan et les gestionnaires de son Cercle (créateur et organisateurs). Quand la liste est réservée, l'API ne renvoie
// aux autres que leur propre réponse : ni noms, ni nombre d'inscrits (sauf « X / Y places » si le Plan a une limite),
// ni liste d'attente des autres, ni demandes de suppression des autres, et les sondages deviennent anonymes.
export const MEMBERS_VISIBILITY = ['all', 'managers'] as const;
export type MembersVisibility = typeof MEMBERS_VISIBILITY[number];

export function parseMembersVisibility(v: unknown): MembersVisibility | undefined {
  return typeof v === 'string' && (MEMBERS_VISIBILITY as readonly string[]).includes(v) ? v as MembersVisibility : undefined;
}

// Cercles dont la personne est créatrice ou organisatrice (pour traiter une liste de Plans en une requête)
export async function managedCircleIds(userId: string): Promise<Set<string>> {
  const [created, organized] = await Promise.all([
    prisma.circle.findMany({ where: { creatorId: userId }, select: { id: true } }),
    prisma.circleMember.findMany({ where: { userId, role: ORGANIZER_ROLE }, select: { circleId: true } }),
  ]);
  return new Set([...created.map(c => c.id), ...organized.map(m => m.circleId)]);
}

type PlanLike = { creatorId: string; circleId: string; membersVisibility?: string | null };

export function seesMembers(plan: PlanLike, userId: string, managed: Set<string>): boolean {
  return plan.membersVisibility !== 'managers' || plan.creatorId === userId || managed.has(plan.circleId);
}

export async function canSeeMembers(plan: PlanLike, userId: string): Promise<boolean> {
  if (plan.membersVisibility !== 'managers' || plan.creatorId === userId) return true;
  return (await managedCircleIds(userId)).has(plan.circleId);
}

// Version d'un Plan pour une personne qui ne voit pas les participants
export function maskMembers<T extends Record<string, any>>(plan: T, userId: string): T & { membersHidden: true; participantCount?: number } {
  const members: { userId: string; rsvp: string }[] = plan.members ?? [];
  const occupied = members.filter(m => m.rsvp !== 'out').length;
  return {
    ...plan,
    members: members.filter(m => m.userId === userId),
    // Place sur la liste d'attente : l'ordre est gardé, les autres personnes ne sont pas nommées
    ...(plan.waitlist ? { waitlist: plan.waitlist.map((w: any) => (w.userId === userId ? w : { createdAt: w.createdAt, userId: '' })) } : {}),
    ...(plan.deleteVotes ? { deleteVotes: plan.deleteVotes.filter((v: any) => v.userId === userId) } : {}),
    ...(plan.polls ? { polls: plan.polls.map((p: any) => ({ ...p, anonymous: true, options: p.options?.map((o: any) => ({ ...o, votes: o.votes.map((v: any, i: number) => (v.userId === userId ? v : { ...v, userId: `anon-${i}`, user: undefined })) })) })) } : {}),
    ...(plan._count ? { _count: { ...plan._count } } : {}),
    membersHidden: true as const,
    ...(plan.maxParticipants != null ? { participantCount: occupied } : {}),
  };
}

// Applique le masquage si besoin
export function forViewer<T extends PlanLike & Record<string, any>>(plan: T, userId: string, managed: Set<string>) {
  return seesMembers(plan, userId, managed) ? plan : maskMembers(plan, userId);
}
