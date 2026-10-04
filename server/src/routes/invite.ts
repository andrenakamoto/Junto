import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { deleteUserAccount } from '../lib/accountDeletion';
import { cleanFirstName, createLightUser, makeLightToken, readLightUser } from '../lib/lightGuest';
import { markAllSeen, touchPlanSection } from '../lib/planActivity';
import { notifyMembershipChange, rsvpChange } from '../lib/planNotifications';

// Lien d'invitation à un Plan, côté personne sans compte (lib/lightGuest.ts). Public : le
// jeton du lien suffit pour voir l'essentiel du Plan ; le jeton « invité léger » (en-tête
// Authorization) identifie une réponse déjà donnée depuis cet appareil.
// Les personnes connectées passent par /api/plans/guest-invite (inchangé).
const router = Router();

// Création de réponses sans compte : limitée par connexion, comme les inscriptions
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de réponses depuis cette connexion, réessaie plus tard.' },
});
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de demandes, réessaie dans quelques minutes.' },
});

const RSVPS = ['in', 'maybe', 'out'] as const;
type Rsvp = typeof RSVPS[number];
const INVALID_INVITE = "Ce lien d'invitation n'est plus valide";

const bearer = (req: Request) => req.headers.authorization?.split(' ')[1];
const displayName = (u: { firstName: string | null; pseudo: string }) => u.firstName || u.pseudo;

async function findPlan(token: string) {
  const link = await prisma.planGuestLink.findUnique({
    where: { token },
    select: {
      plan: {
        select: {
          id: true, title: true, description: true, eventDate: true, endDate: true, location: true,
          maxParticipants: true, circleId: true,
          creator: { select: { firstName: true, pseudo: true } },
          members: { select: { userId: true, rsvp: true, user: { select: { firstName: true, pseudo: true } } } },
        },
      },
    },
  });
  if (!link || link.plan.endDate <= new Date()) return null;
  return link.plan;
}

type InvitePlan = NonNullable<Awaited<ReturnType<typeof findPlan>>>;

function isFull(plan: InvitePlan) {
  return plan.maxParticipants !== null && plan.members.length >= plan.maxParticipants;
}

// Ce que voit une personne sans compte. Avant de répondre : le Plan et le nombre de
// participants. Après avoir répondu (elle fait alors partie du Plan) : aussi les prénoms.
function preview(plan: InvitePlan, meId: string | null) {
  const me = meId ? plan.members.find(m => m.userId === meId) : undefined;
  return {
    planId: plan.id,
    title: plan.title,
    description: plan.description,
    eventDate: plan.eventDate,
    endDate: plan.endDate,
    location: plan.location,
    creatorName: displayName(plan.creator),
    counts: {
      in: plan.members.filter(m => m.rsvp === 'in').length,
      maybe: plan.members.filter(m => m.rsvp === 'maybe').length,
    },
    full: isFull(plan),
    me: me ? { firstName: me.user.firstName, rsvp: me.rsvp } : null,
    participants: me
      ? plan.members
          .filter(m => m.rsvp !== 'out')
          .map(m => ({ name: displayName(m.user), rsvp: m.rsvp, isMe: m.userId === meId }))
      : undefined,
  };
}

// Les écrans ouverts sur ce Plan / ce Cercle se rechargent (comme broadcastWrites)
function broadcastMembers(req: Request, plan: InvitePlan, actorId: string) {
  touchPlanSection(plan.id, 'membres', actorId);
  const io = req.app.get('io');
  io?.to(`plan:${plan.id}`).emit('plan-updated', { planId: plan.id });
  io?.to(`circle:${plan.circleId}`).emit('circle-updated', { circleId: plan.circleId });
}

// GET /api/invite/:token — aperçu du Plan (+ la réponse déjà donnée depuis cet appareil)
router.get('/:token', async (req, res) => {
  try {
    const plan = await findPlan(req.params.token);
    if (!plan) { res.status(404).json({ error: INVALID_INVITE }); return; }
    const light = await readLightUser(bearer(req));
    res.json(preview(plan, light?.id ?? null));
  } catch (e) {
    console.error('[invite preview]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/invite/:token/respond { firstName?, rsvp } — répondre sans compte (ou changer sa réponse)
async function respond(req: Request, res: Response) {
  try {
    const rsvp = req.body?.rsvp as Rsvp;
    if (!RSVPS.includes(rsvp)) { res.status(400).json({ error: 'Réponse invalide' }); return; }
    const plan = await findPlan(req.params.token);
    if (!plan) { res.status(404).json({ error: INVALID_INVITE }); return; }

    let light = await readLightUser(bearer(req));
    const existing = light ? plan.members.find(m => m.userId === light!.id) : undefined;

    if (existing) {
      if (existing.rsvp !== rsvp) {
        await prisma.planMember.update({ where: { userId_planId: { userId: light!.id, planId: plan.id } }, data: { rsvp } });
        const change = rsvpChange(existing.rsvp, rsvp);
        if (change) notifyMembershipChange(req.app.get('io'), plan.id, { id: light!.id, pseudo: light!.pseudo }, change).catch(e => console.error('[invite notify]', e));
        broadcastMembers(req, plan, light!.id);
      }
    } else {
      if (rsvp !== 'out' && isFull(plan)) { res.status(409).json({ error: 'Ce Plan est complet' }); return; }
      if (!light) {
        const firstName = cleanFirstName(req.body?.firstName);
        if (!firstName) { res.status(400).json({ error: 'Indique ton prénom (30 caractères maximum)' }); return; }
        light = await createLightUser(firstName);
      }
      await prisma.planMember.create({ data: { userId: light.id, planId: plan.id, rsvp } });
      await markAllSeen(plan.id, light.id);
      if (rsvp !== 'out') notifyMembershipChange(req.app.get('io'), plan.id, { id: light.id, pseudo: light.pseudo }, 'join').catch(e => console.error('[invite notify]', e));
      broadcastMembers(req, plan, light.id);
    }

    const updated = await findPlan(req.params.token);
    res.json({ lightToken: makeLightToken(light!), ...preview(updated ?? plan, light!.id) });
  } catch (e) {
    console.error('[invite respond]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
// Sans jeton d'invité valide, la requête crée une réponse : limite des inscriptions
async function limitCreation(req: Request, res: Response, next: () => void) {
  if (await readLightUser(bearer(req))) return next();
  return createLimiter(req, res, next);
}
router.post('/:token/respond', updateLimiter, limitCreation, respond);

// DELETE /api/invite/:token/respond — retirer sa réponse (et ses données si plus aucun Plan)
router.delete('/:token/respond', updateLimiter, async (req, res) => {
  try {
    const light = await readLightUser(bearer(req));
    const plan = await findPlan(req.params.token);
    if (!light || !plan) { res.status(404).json({ error: INVALID_INVITE }); return; }
    const member = plan.members.find(m => m.userId === light.id);
    if (member) {
      await prisma.planMember.delete({ where: { userId_planId: { userId: light.id, planId: plan.id } } });
      if (member.rsvp !== 'out') notifyMembershipChange(req.app.get('io'), plan.id, { id: light.id, pseudo: light.pseudo }, 'leave').catch(e => console.error('[invite notify]', e));
      broadcastMembers(req, plan, light.id);
    }
    const remaining = await prisma.planMember.count({ where: { userId: light.id } });
    // deleteUserAccount : un organisateur sans compte part aussi avec son Cercle « Mes Plans »
    if (remaining === 0) await deleteUserAccount(light.id);
    res.json({ removed: true, accountDeleted: remaining === 0 });
  } catch (e) {
    console.error('[invite remove]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
