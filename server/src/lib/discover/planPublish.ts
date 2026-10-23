import crypto from 'crypto';
import prisma from '../prisma';
import { isCircleManager } from '../circleRoles';
import { isAnnoncePlan } from '../planSource';
import { isPlanEnded } from '../planLifecycle';
import { occupiedCount } from '../waitlist';
import { isCategory, isRegion } from './model';
import { discoverCache } from './sync';

// Publier un Plan dans Découvrir (2026-10-23) : réservé aux comptes autorisés à la main dans le panneau admin
// (User.canPublishDiscover, ou administrateur), créateurs du Plan ou gestionnaires de son Cercle, pour un Plan en
// Mode annonce (liste des participants réservée) avec une date de début. L'annonce (DiscoverEvent.planId) suit le
// Plan : titre, dates et lieu mis à jour à chaque modification, « complet » calculé à la lecture, inscription par le
// lien d'invitation du Plan (réponse avec ou sans compte), supprimée avec le Plan.

export const PLAN_SOURCE_KEY = 'evly-plans';

type PublishablePlan = { id: string; creatorId: string; circleId: string; membersVisibility: string; eventDate: Date | null; endDate: Date };

export async function canPublishPlan(userId: string, plan: { creatorId: string; circleId: string }): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { canPublishDiscover: true, isAdmin: true } });
  if (!user?.canPublishDiscover && !user?.isAdmin) return false;
  return plan.creatorId === userId || await isCircleManager(userId, plan.circleId);
}

// Pourquoi un Plan ne peut pas (encore) être publié (code lu par l'app), ou null
export type PublishBlocker = 'annonce' | 'date' | 'ended';
export function publishBlocker(plan: PublishablePlan): PublishBlocker | null {
  if (!isAnnoncePlan(plan)) return 'annonce';
  if (!plan.eventDate) return 'date';
  if (isPlanEnded(plan.endDate)) return 'ended';
  return null;
}
const BLOCKER_ERRORS: Record<PublishBlocker, string> = {
  annonce: 'Active d’abord le Mode annonce du Plan (Modifier › Fonctions)',
  date: 'Le Plan doit avoir une date de début',
  ended: 'Ce Plan est terminé',
};

function fields(plan: { title: string; location: string | null; eventDate: Date | null; endDate: Date }) {
  const startAt = plan.eventDate ?? plan.endDate;
  return {
    title: plan.title.slice(0, 160), place: plan.location?.slice(0, 120) ?? null, city: null,
    startAt, endAt: plan.endDate, multiDay: plan.endDate.getTime() - startAt.getTime() > 26 * 3600e3,
  };
}

export async function publishPlan(planId: string, region: unknown, category: unknown, userId: string) {
  if (!isRegion(region)) return { error: 'Région invalide' };
  if (!isCategory(category)) return { error: 'Catégorie invalide' };
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return { error: 'Plan introuvable' };
  const blocker = publishBlocker(plan);
  if (blocker) return { error: BLOCKER_ERRORS[blocker] };
  const source = await prisma.discoverSource.findUnique({ where: { key: PLAN_SOURCE_KEY }, select: { id: true } });
  if (!source) return { error: 'Découvrir indisponible' };
  const data = { ...fields(plan), region, category, family: category === 'famille', state: 'published' };
  await prisma.discoverEvent.upsert({
    where: { planId },
    create: { ...data, planId, sourceId: source.id, externalId: planId, createdById: userId },
    update: data,
  });
  discoverCache.clear();
  return { ok: true };
}

export async function unpublishPlan(planId: string) {
  await prisma.discoverEvent.deleteMany({ where: { planId } });
  discoverCache.clear();
}

// Après une modification du Plan : l'annonce suit (ou disparaît si le Plan n'est plus publiable)
export async function refreshPlanDiscover(planId: string) {
  const link = await prisma.discoverEvent.findUnique({ where: { planId }, select: { id: true } });
  if (!link) return;
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || publishBlocker(plan)) { await unpublishPlan(planId); return; }
  await prisma.discoverEvent.update({ where: { id: link.id }, data: fields(plan) });
  discoverCache.clear();
}

// Lecture publique : lien d'inscription (invitation du Plan, créée au besoin) et « complet » en direct
export async function planSignup(planId: string): Promise<{ signupPath: string; full: boolean } | null> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, maxParticipants: true } });
  if (!plan) return null;
  const link = await prisma.planGuestLink.upsert({
    where: { planId }, create: { planId, token: crypto.randomBytes(18).toString('base64url') }, update: {},
  });
  const full = plan.maxParticipants !== null && await occupiedCount(planId) >= plan.maxParticipants;
  return { signupPath: `/invitation?token=${link.token}`, full };
}
