import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { markAllSeen } from '../lib/planActivity';
import { notifyMembershipChange } from '../lib/planNotifications';
import { notifyUser } from '../lib/push';
import {
  canManageShifts, parseShiftInput, sortShifts, shiftHours, volunteersEnabled, VOLUNTEERS_DISABLED_ERROR,
} from '../lib/volunteers';

// Planning des bénévoles (lib/volunteers.ts), monté dans le routeur des Plans (/api/plans) :
// même authentification et même diffusion temps réel (lib/realtime.ts).
const router = Router();

const shiftWithPlan = (shiftId: string) => prisma.volunteerShift.findUnique({
  where: { id: shiftId },
  include: {
    plan: { select: { id: true, title: true, circleId: true, creatorId: true, maxParticipants: true, enabledFeatures: true } },
    _count: { select: { signups: true } },
  },
});

// Notification ciblée (créateur du Plan, personne retirée…) : onglet Bénévoles du Plan
function notifyShift(req: AuthRequest, userId: string, plan: { id: string; title: string; circleId: string }, preview: string) {
  if (userId === req.userId) return;
  notifyUser(req.app.get('io'), userId, {
    type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId,
    from: req.pseudo!, actorId: req.userId!, preview,
  });
}

const label = (s: { title: string; startsAt: Date | null; endsAt: Date | null }) => {
  const hours = shiftHours(s);
  return hours ? `« ${s.title} » (${hours})` : `« ${s.title} »`;
};

// GET /:id/shifts — postes et inscrits, visibles de tous ceux qui voient le Plan
router.get('/:id/shifts', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const shifts = await prisma.volunteerShift.findMany({
    where: { planId: req.params.id },
    include: { signups: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, pseudo: true, firstName: true } } } } },
  });
  res.json({
    shifts: sortShifts(shifts).map(s => ({
      id: s.id, title: s.title, needed: s.needed, note: s.note, startsAt: s.startsAt, endsAt: s.endsAt,
      signups: s.signups.map(x => ({ userId: x.userId, user: x.user })),
    })),
    canManage: await canManageShifts(req.userId!, access.plan),
  });
});

// POST /:id/shifts — créer un poste (créateur du Plan, gestionnaires du Cercle)
router.post('/:id/shifts', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, circleId: true, creatorId: true, enabledFeatures: true } });
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!volunteersEnabled(plan)) { res.status(403).json({ error: VOLUNTEERS_DISABLED_ERROR }); return; }
  if (!(await canManageShifts(req.userId!, plan))) { res.status(403).json({ error: 'Seuls le créateur du Plan et les organisateurs du Cercle créent les postes' }); return; }
  const data = parseShiftInput(req.body);
  if ('error' in data) { res.status(400).json({ error: data.error }); return; }
  const shift = await prisma.volunteerShift.create({ data: { ...data, planId: plan.id, createdById: req.userId! } });
  res.json(shift);
});

// PUT /shifts/:shiftId — modifier un poste
router.put('/shifts/:shiftId', async (req: AuthRequest, res) => {
  const shift = await shiftWithPlan(req.params.shiftId);
  if (!shift || !(await getPlanAccess(req.userId!, shift.planId))?.canView) { res.status(404).json({ error: 'Poste introuvable' }); return; }
  if (!volunteersEnabled(shift.plan)) { res.status(403).json({ error: VOLUNTEERS_DISABLED_ERROR }); return; }
  if (!(await canManageShifts(req.userId!, shift.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const data = parseShiftInput(req.body);
  if ('error' in data) { res.status(400).json({ error: data.error }); return; }
  if (data.needed < shift._count.signups) {
    res.status(400).json({ error: `${shift._count.signups} personnes sont déjà inscrites : retire d’abord des inscrits` });
    return;
  }
  // Horaire changé : le rappel d'une heure avant repart pour le nouvel horaire
  const moved = (data.startsAt?.getTime() ?? null) !== (shift.startsAt?.getTime() ?? null);
  res.json(await prisma.volunteerShift.update({ where: { id: shift.id }, data: { ...data, ...(moved ? { reminderSentAt: null } : {}) } }));
});

// DELETE /shifts/:shiftId — supprimer un poste ; les inscrits sont prévenus
router.delete('/shifts/:shiftId', async (req: AuthRequest, res) => {
  const shift = await shiftWithPlan(req.params.shiftId);
  if (!shift || !(await getPlanAccess(req.userId!, shift.planId))?.canView) { res.status(404).json({ error: 'Poste introuvable' }); return; }
  if (!(await canManageShifts(req.userId!, shift.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const signups = await prisma.volunteerSignup.findMany({ where: { shiftId: shift.id }, select: { userId: true } });
  await prisma.volunteerShift.delete({ where: { id: shift.id } });
  res.json({ ok: true });
  for (const s of signups) notifyShift(req, s.userId, shift.plan, `Le poste ${label(shift)} a été supprimé`);
});

// POST /shifts/:shiftId/signup — s'inscrire (vaut « Je suis in »)
router.post('/shifts/:shiftId/signup', async (req: AuthRequest, res) => {
  const shift = await shiftWithPlan(req.params.shiftId);
  const access = shift && await getPlanAccess(req.userId!, shift.planId);
  if (!shift || !access?.canView) { res.status(404).json({ error: 'Poste introuvable' }); return; }
  const { plan } = shift;
  if (!volunteersEnabled(plan)) { res.status(403).json({ error: VOLUNTEERS_DISABLED_ERROR }); return; }
  const userId = req.userId!;
  const already = await prisma.volunteerSignup.findUnique({ where: { shiftId_userId: { shiftId: shift.id, userId } } });
  if (already) { res.status(409).json({ error: 'Tu es déjà inscrit(e) à ce poste' }); return; }
  if (shift._count.signups >= shift.needed) { res.status(409).json({ error: 'Ce poste est complet' }); return; }

  // S'inscrire = participer au Plan
  const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId: plan.id } } });
  let membership: 'join' | 'back' | null = null;
  if (!member) {
    if (plan.maxParticipants !== null && await prisma.planMember.count({ where: { planId: plan.id } }) >= plan.maxParticipants) {
      res.status(409).json({ error: 'Ce Plan est complet' });
      return;
    }
    await prisma.planMember.create({ data: { userId, planId: plan.id, rsvp: 'in' } });
    await markAllSeen(plan.id, userId);
    membership = 'join';
  } else if (member.rsvp !== 'in') {
    await prisma.planMember.update({ where: { userId_planId: { userId, planId: plan.id } }, data: { rsvp: 'in' } });
    if (member.rsvp === 'out') membership = 'back';
  }

  await prisma.volunteerSignup.create({ data: { shiftId: shift.id, userId, planId: plan.id } });
  // Deux inscriptions au même moment pour la dernière place : la plus récente est annulée
  const signups = await prisma.volunteerSignup.findMany({ where: { shiftId: shift.id }, orderBy: { createdAt: 'asc' }, select: { userId: true } });
  if (signups.findIndex(s => s.userId === userId) >= shift.needed) {
    await prisma.volunteerSignup.delete({ where: { shiftId_userId: { shiftId: shift.id, userId } } });
    res.status(409).json({ error: 'Ce poste vient d’être complété' });
    return;
  }
  res.json({ ok: true, rsvp: 'in' });

  const io = req.app.get('io');
  if (membership) notifyMembershipChange(io, plan.id, { id: userId, pseudo: req.pseudo! }, membership).catch(e => console.error('[volunteer join notify]', e));
  notifyShift(req, plan.creatorId, plan, `@${req.pseudo} s’est inscrit(e) au poste ${label(shift)}`);
});

// DELETE /shifts/:shiftId/signup — se désinscrire (la réponse au Plan ne change pas)
router.delete('/shifts/:shiftId/signup', async (req: AuthRequest, res) => {
  const shift = await shiftWithPlan(req.params.shiftId);
  if (!shift || !(await getPlanAccess(req.userId!, shift.planId))?.canView) { res.status(404).json({ error: 'Poste introuvable' }); return; }
  const { count } = await prisma.volunteerSignup.deleteMany({ where: { shiftId: shift.id, userId: req.userId! } });
  res.json({ ok: true });
  if (count) notifyShift(req, shift.plan.creatorId, shift.plan, `@${req.pseudo} s’est désinscrit(e) du poste ${label(shift)}`);
});

// DELETE /shifts/:shiftId/signups/:userId — retirer quelqu'un d'un poste (gestionnaires)
router.delete('/shifts/:shiftId/signups/:userId', async (req: AuthRequest, res) => {
  const shift = await shiftWithPlan(req.params.shiftId);
  if (!shift || !(await getPlanAccess(req.userId!, shift.planId))?.canView) { res.status(404).json({ error: 'Poste introuvable' }); return; }
  if (!(await canManageShifts(req.userId!, shift.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const { count } = await prisma.volunteerSignup.deleteMany({ where: { shiftId: shift.id, userId: req.params.userId } });
  res.json({ ok: true });
  if (count) notifyShift(req, req.params.userId, shift.plan, `@${req.pseudo} t’a retiré(e) du poste ${label(shift)}`);
});

export default router;
