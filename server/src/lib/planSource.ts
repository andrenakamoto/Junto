import crypto from 'crypto';
import prisma from './prisma';
import { getPlanAccess, planCircleIds } from './planAccess';
import { isPlanEnded } from './planLifecycle';

// « Y aller avec un Cercle » : depuis un Plan en Mode annonce (soirée, gala, spectacle…), un membre crée un
// Plan dans un de ses Cercles pour y aller avec ses amis. Les deux Plans restent séparés : l'événement garde
// ses inscriptions et sa liste réservée ; le Plan des amis montre une carte « Événement » (titre, date, lieu,
// lien d'inscription) sans rien du Cercle d'origine.

type SourceLike = { membersVisibility: string; allowCirclePlans: boolean; endDate: Date };

// Mode annonce côté serveur : la liste des participants est réservée (lib/memberPrivacy.ts)
export const isAnnoncePlan = (plan: { membersVisibility: string }) => plan.membersVisibility === 'managers';

// L'événement peut-il être proposé à d'autres Cercles ? (Mode annonce, autorisé par l'organisateur, pas terminé)
export function canProposeToCircles(plan: SourceLike, now = new Date()): boolean {
  return isAnnoncePlan(plan) && plan.allowCirclePlans && !isPlanEnded(plan.endDate, now);
}

// Réglage « Les membres peuvent y aller avec un Cercle » : booléen, absent = inchangé
export function parseAllowCirclePlans(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

export const SOURCE_NOT_ALLOWED = 'Cet événement ne peut pas être proposé à un autre Cercle';
export const SOURCE_SAME_CIRCLE = 'Ce Cercle voit déjà cet événement';

// Vérifie, à la création d'un Plan, l'événement d'origine choisi avec « Y aller avec un Cercle »
export async function checkSourcePlan(userId: string, sourcePlanId: unknown, targetCircleId: string):
  Promise<{ sourcePlanId: string; sourceTitle: string } | { error: string } | null> {
  if (sourcePlanId === undefined || sourcePlanId === null || sourcePlanId === '') return null;
  if (typeof sourcePlanId !== 'string') return { error: SOURCE_NOT_ALLOWED };
  const access = await getPlanAccess(userId, sourcePlanId);
  if (!access?.canView) return { error: SOURCE_NOT_ALLOWED };
  const source = await prisma.plan.findUnique({
    where: { id: sourcePlanId },
    select: { id: true, circleId: true, title: true, membersVisibility: true, allowCirclePlans: true, endDate: true },
  });
  if (!source || !canProposeToCircles(source)) return { error: SOURCE_NOT_ALLOWED };
  if ((await planCircleIds(source)).includes(targetCircleId)) return { error: SOURCE_SAME_CIRCLE };
  return { sourcePlanId: source.id, sourceTitle: source.title };
}

export interface SourceCard {
  /** L'événement a été supprimé (annulé, ou effacé après sa fin) */
  gone: boolean;
  title: string;
  eventDate?: string | null;
  endDate?: string;
  location?: string | null;
  ended?: boolean;
  /** Jeton du lien d'invitation de l'événement (/invitation?token=…), si l'organisateur autorise encore le partage */
  token?: string | null;
}

// Carte « Événement » d'un Plan créé avec « Y aller avec un Cercle » : rien du Cercle d'origine ni de ses
// participants, seulement ce que montre déjà un lien d'invitation
export async function sourceCardFor(plan: { sourcePlanId: string | null; sourceTitle: string | null }): Promise<SourceCard | undefined> {
  if (!plan.sourcePlanId) return plan.sourceTitle ? { gone: true, title: plan.sourceTitle } : undefined;
  const source = await prisma.plan.findUnique({
    where: { id: plan.sourcePlanId },
    select: { id: true, title: true, eventDate: true, endDate: true, location: true, membersVisibility: true, allowCirclePlans: true },
  });
  if (!source) return { gone: true, title: plan.sourceTitle ?? '' };
  const ended = isPlanEnded(source.endDate);
  let token: string | null = null;
  if (!ended && isAnnoncePlan(source) && source.allowCirclePlans) {
    const link = await prisma.planGuestLink.upsert({
      where: { planId: source.id },
      create: { planId: source.id, token: crypto.randomBytes(18).toString('base64url') },
      update: {},
    });
    token = link.token;
  }
  return {
    gone: false,
    title: source.title,
    eventDate: source.eventDate?.toISOString() ?? null,
    endDate: source.endDate.toISOString(),
    location: source.location,
    ended,
    token,
  };
}
