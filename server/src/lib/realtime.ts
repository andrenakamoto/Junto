import { NextFunction, Request, Response } from 'express';
import prisma from './prisma';
import { PlanSection, touchPlanSection } from './planActivity';

// Rafraîchissement en temps réel : après chaque écriture réussie, on prévient les écrans
// concernés, qui rechargent eux-mêmes ce qu'ils affichent (les règles d'accès restent donc
// appliquées par les routes GET — un exclu d'un Plan surprise ne reçoit que des identifiants
// qu'il ne peut pas ouvrir).
//   plan-updated   { planId }   → room plan:{id}   (membres qui ont le Plan ouvert)
//   circle-updated { circleId } → room circle:{id} (listes de Plans, demandes, sondages…)

// section : onglet du Plan concerné, pour les pastilles « nouveau » (lib/planActivity.ts)
export type WriteTarget = { planId?: string; circleId?: string; circleWide?: boolean; section?: PlanSection } | null;

export function broadcastWrites(resolve: (req: Request) => Promise<WriteTarget>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') return next();
    let target: WriteTarget = null;
    try {
      // Résolu AVANT la route : la ressource peut être supprimée par la requête elle-même
      target = await resolve(req);
    } catch {
      target = null;
    }
    if (target) {
      res.on('finish', () => {
        if (res.statusCode >= 400 || !target) return;
        const io = req.app.get('io');
        if (!io) return;
        if (target.planId && target.section) touchPlanSection(target.planId, target.section, (req as any).userId);
        if (target.planId) io.to(`plan:${target.planId}`).emit('plan-updated', { planId: target.planId });
        if (target.circleId && target.circleWide !== false) {
          io.to(`circle:${target.circleId}`).emit('circle-updated', { circleId: target.circleId });
        }
      });
    }
    next();
  };
}

const segments = (req: Request) => req.path.split('/').filter(Boolean);

async function planTarget(planId: string | undefined, circleWide: boolean, section?: PlanSection): Promise<WriteTarget> {
  if (!planId) return null;
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, circleId: true } });
  // Une activité dans un onglet rafraîchit aussi la liste du Cercle, pour la pastille de la carte
  return plan ? { planId: plan.id, circleId: plan.circleId, circleWide: circleWide || !!section, section } : null;
}

// Onglet concerné par /api/plans/:id/<b>
const PLAN_SUBROUTE_SECTION: Record<string, PlanSection> = {
  join: 'membres', rsvp: 'membres', leave: 'membres',
  polls: 'votes', items: 'infos', expenses: 'depenses', reimbursements: 'depenses',
};

// Routes /api/plans
export async function resolvePlanWrite(req: Request): Promise<WriteTarget> {
  const [a, b, c] = segments(req);
  if (a === 'guest-invite') {
    if (c !== 'accept') return null;
    const link = await prisma.planGuestLink.findUnique({ where: { token: b }, select: { planId: true } });
    return planTarget(link?.planId, true, 'membres');
  }
  if (a === 'polls' && c === 'vote') {
    const option = await prisma.pollOption.findUnique({ where: { id: b }, select: { poll: { select: { planId: true } } } });
    return planTarget(option?.poll.planId, false, 'votes');
  }
  if (a === 'items') {
    const item = await prisma.bringItem.findUnique({ where: { id: b }, select: { planId: true } });
    return planTarget(item?.planId, false, 'infos');
  }
  if (a === 'expenses') {
    const expense = await prisma.expense.findUnique({ where: { id: b }, select: { planId: true } });
    return planTarget(expense?.planId, false, 'depenses');
  }
  // « seen » ne concerne que la personne : surtout pas de diffusion (chaque écran
  // rechargerait puis marquerait « vu » à son tour, en boucle)
  if (a === 'messages' || b === 'guest-link' || b === 'seen') return null;
  // PUT /:id (modification du Plan) → onglet Infos ; DELETE /:id → aucun
  const section = !b ? (req.method === 'PUT' ? 'infos' : undefined) : PLAN_SUBROUTE_SECTION[b];
  // /:id (modification) et /:id/{join,rsvp,vote-delete} changent aussi la liste du Cercle
  return planTarget(a, !b || ['join', 'rsvp', 'vote-delete'].includes(b), section);
}

// Routes /api/circles
export async function resolveCircleWrite(req: Request): Promise<WriteTarget> {
  const [a, b, c] = segments(req);
  if (!a) return null; // création : la room est rejointe dans la route
  if (a === 'join') {
    const { name, code } = req.body ?? {};
    if (typeof name !== 'string' || typeof code !== 'string') return null;
    const circle = await prisma.circle.findFirst({
      where: { name: name.trim(), code: code.trim().toUpperCase() },
      select: { id: true },
    });
    return circle ? { circleId: circle.id } : null;
  }
  if (a === 'polls') {
    if (c === 'messages') return null; // diffusé à part (poll-message), pas besoin de recharger les listes
    if (b === 'options') {
      const option = await prisma.circlePollOption.findUnique({ where: { id: c }, select: { poll: { select: { circleId: true } } } });
      return option ? { circleId: option.poll.circleId } : null;
    }
    const poll = await prisma.circlePoll.findUnique({ where: { id: b }, select: { circleId: true } });
    return poll ? { circleId: poll.circleId } : null;
  }
  return { circleId: a };
}

// Routes /api/attachments
export async function resolveAttachmentWrite(req: Request): Promise<WriteTarget> {
  const [a, b] = segments(req);
  if (a === 'plans') return b && !segments(req)[2] ? planTarget(b, false, 'infos') : null;
  const att = await prisma.attachment.findUnique({ where: { id: a }, select: { planId: true } });
  return planTarget(att?.planId, false, 'infos');
}

// Garder les rooms de Cercle à jour pour les sockets déjà connectés
export function joinCircleRoom(io: any, userId: string, circleId: string) {
  io?.in(`user:${userId}`).socketsJoin(`circle:${circleId}`);
}
export function leaveCircleRoom(io: any, userId: string, circleId: string) {
  io?.in(`user:${userId}`).socketsLeave(`circle:${circleId}`);
}
