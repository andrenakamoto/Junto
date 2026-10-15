import { NextFunction, Request, Response } from 'express';
import prisma from './prisma';
import type { WriteTarget } from './realtime';

// Fin d'un Plan (2026-10-15) : à sa date de fin, un Plan passe « Terminé » et reste visible PLAN_GRACE_MS en lecture
// seule (photos, comptes, PV, récapitulatif à récupérer) ; il est supprimé ensuite (deleteExpiredPlans). Seule
// exception : repousser la date de fin (PUT /plans/:id), ce qui le rend de nouveau actif — une assemblée qui déborde.
// Les personnes qui avaient répondu « Je suis in » sont prévenues DELETION_NOTICE_MS avant la suppression.

export const PLAN_GRACE_MS = 24 * 3600 * 1000;
export const DELETION_NOTICE_MS = 4 * 3600 * 1000;
export const PLAN_ENDED_ERROR = 'Ce Plan est terminé : il est en lecture seule jusqu’à sa suppression';

export const isPlanEnded = (endDate: Date, now = new Date()) => endDate.getTime() <= now.getTime();
export const planDeletionAt = (endDate: Date) => new Date(endDate.getTime() + PLAN_GRACE_MS);
// Plans encore affichés : pas terminés depuis plus de 24 h
export const visibleSince = (now = new Date()) => new Date(now.getTime() - PLAN_GRACE_MS);

export async function planEnded(planId: string | undefined | null): Promise<boolean> {
  if (!planId) return false;
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { endDate: true } });
  return !!plan && isPlanEnded(plan.endDate);
}

// Middleware des routeurs plans / attachments : refuse les écritures sur un Plan terminé. La cible est trouvée
// comme pour le temps réel (resolve), ou lue dans l'adresse (fromPath) pour les routes que le temps réel ignore.
export function lockEndedPlans(resolve: (req: Request) => Promise<WriteTarget>, opts: {
  allow?: (method: string, segs: string[]) => boolean;
  fromPath?: (segs: string[]) => string | undefined;
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') return next();
    try {
      const segs = req.path.split('/').filter(Boolean);
      if (opts.allow?.(req.method, segs)) return next();
      const target = await resolve(req).catch(() => null);
      const planId = target?.planId ?? opts.fromPath?.(segs);
      if (await planEnded(planId)) { res.status(409).json({ error: PLAN_ENDED_ERROR }); return; }
    } catch { /* en cas de doute, la route décide */ }
    next();
  };
}

// Routeur des Plans : écritures encore permises sur un Plan terminé (modifier pour repousser la fin, supprimer, voter
// la suppression, marquer « vu ») ; le quiz se lit dans l'adresse (/:id/quiz…)
export const planRouterLock = {
  allow: (method: string, segs: string[]) => (segs.length === 1 && (method === 'PUT' || method === 'DELETE')) || segs[1] === 'vote-delete' || segs[1] === 'seen',
  fromPath: (segs: string[]) => (segs[1] === 'quiz' || segs[1] === 'transit' ? segs[0] : undefined),
};

// Notification 4 h avant la suppression aux « Je suis in » (toutes les 15 minutes, gated comme les autres crons)
export async function sendDeletionNotices(io: any, notify: (io: any, userId: string, n: any) => void) {
  const now = Date.now();
  // Fin passée depuis 20 h ou plus (suppression dans 4 h ou moins), pas encore prévenu
  const plans = await prisma.plan.findMany({
    where: { deletionNoticeSentAt: null, endDate: { lte: new Date(now - (PLAN_GRACE_MS - DELETION_NOTICE_MS)), gt: new Date(now - PLAN_GRACE_MS) } },
    select: { id: true, title: true, circleId: true, members: { where: { rsvp: 'in', user: { isLight: false } }, select: { userId: true } } },
  });
  for (const plan of plans) {
    // Réservation : une seule notification, même si deux tâches tournent en même temps
    const claimed = await prisma.plan.updateMany({ where: { id: plan.id, deletionNoticeSentAt: null }, data: { deletionNoticeSentAt: new Date() } });
    if (claimed.count === 0) continue;
    for (const m of plan.members) {
      notify(io, m.userId, { type: 'plan_deleting', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview: 'Ce Plan sera supprimé dans 4 heures : pense à récupérer les photos et les documents.' });
    }
  }
}
