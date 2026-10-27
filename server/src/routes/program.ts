import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { requestLocale } from '../lib/i18n';
import { assignablePeople } from '../lib/tasks';
import {
  canManageProgram, delayChanges, moveItem, orderedItems, parseProgramInput, programEnabled, PROGRAM_DISABLED_ERROR,
  PROGRAM_MAX_ITEMS, ProgramInput, scheduleItems,
} from '../lib/program';
import { buildProgramPdf } from '../lib/programPdf';

// Déroulé d'un Plan (lib/program.ts), monté dans le routeur des Plans (/api/plans) : même authentification,
// même lecture seule après la fin du Plan et même diffusion temps réel (lib/realtime.ts). Tout le monde qui voit
// le Plan ajoute, modifie, réordonne et décale les moments ; supprimer : la personne qui a créé le moment, le
// créateur du Plan ou un gestionnaire du Cercle.
const router = Router();

const PLAN_SELECT = { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true, eventDate: true } as const;

async function writablePlan(req: AuthRequest, res: any, planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: PLAN_SELECT });
  if (!plan || !(await getPlanAccess(req.userId!, plan.id))?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!programEnabled(plan)) { res.status(403).json({ error: PROGRAM_DISABLED_ERROR }); return null; }
  return plan;
}

async function writableItem(req: AuthRequest, res: any) {
  const item = await prisma.planProgramItem.findUnique({ where: { id: req.params.itemId }, include: { plan: { select: PLAN_SELECT } } });
  if (!item || !(await getPlanAccess(req.userId!, item.planId))?.canView) { res.status(404).json({ error: 'Moment introuvable' }); return null; }
  if (!programEnabled(item.plan)) { res.status(403).json({ error: PROGRAM_DISABLED_ERROR }); return null; }
  return item;
}

async function checkPeople(planId: string, input: ProgramInput) {
  const people = new Set((await assignablePeople(planId)).map(p => p.id));
  return input.assigneeIds.every(id => people.has(id)) ? null : 'Responsable introuvable dans ce Plan';
}

// GET /:id/program — moments dans l'ordre, avec leurs heures calculées
router.get('/:id/program', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { eventDate: true } });
  const [items, people] = await Promise.all([orderedItems(req.params.id), assignablePeople(req.params.id)]);
  res.json({
    items: scheduleItems(items, plan?.eventDate ?? null).map(i => ({
      id: i.id, title: i.title, durationMin: i.durationMin, fixedStart: i.fixedStart, place: i.place, tech: i.tech, note: i.note,
      createdById: i.createdById, start: i.start, end: i.end,
      assignees: i.assignees.map(a => ({ userId: a.userId, user: a.user })),
    })),
    people,
    canManage: await canManageProgram(req.userId!, access.plan),
  });
});

// GET /:id/program/pdf — feuille de route (tous ceux qui voient le Plan)
router.get('/:id/program/pdf', async (req: AuthRequest, res) => {
  if (!(await getPlanAccess(req.userId!, req.params.id))?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const pdf = await buildProgramPdf(req.params.id, requestLocale(req));
  if (!pdf) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
});

// POST /:id/program {…, afterId?} — ajouter un moment (à la fin, ou juste après `afterId`)
router.post('/:id/program', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  const input = parseProgramInput(req.body);
  if ('error' in input) { res.status(400).json({ error: input.error }); return; }
  const problem = await checkPeople(plan.id, input);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const items = await prisma.planProgramItem.findMany({ where: { planId: plan.id }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (items.length >= PROGRAM_MAX_ITEMS) { res.status(400).json({ error: `${PROGRAM_MAX_ITEMS} moments au plus` }); return; }
  const after = typeof req.body?.afterId === 'string' ? items.findIndex(i => i.id === req.body.afterId) : -1;
  const index = after >= 0 ? after + 1 : items.length;
  const { assigneeIds, ...data } = input;
  const created = await prisma.$transaction(async tx => {
    // Les moments suivants reculent d'un cran
    for (let i = index; i < items.length; i++) await tx.planProgramItem.update({ where: { id: items[i].id }, data: { position: i + 1 } });
    return tx.planProgramItem.create({
      data: { ...data, planId: plan.id, position: index, createdById: req.userId!, assignees: { create: assigneeIds.map(userId => ({ userId, planId: plan.id })) } },
    });
  });
  res.json({ id: created.id });
});

// PUT /program/:itemId — modifier un moment
router.put('/program/:itemId', async (req: AuthRequest, res) => {
  const item = await writableItem(req, res);
  if (!item) return;
  const input = parseProgramInput(req.body);
  if ('error' in input) { res.status(400).json({ error: input.error }); return; }
  const problem = await checkPeople(item.planId, input);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const { assigneeIds, ...data } = input;
  await prisma.$transaction([
    prisma.planProgramItem.update({ where: { id: item.id }, data }),
    prisma.planProgramAssignee.deleteMany({ where: { itemId: item.id, userId: { notIn: assigneeIds } } }),
    prisma.planProgramAssignee.createMany({ data: assigneeIds.map(userId => ({ itemId: item.id, userId, planId: item.planId })), skipDuplicates: true }),
  ]);
  res.json({ ok: true });
});

// POST /program/:itemId/move {dir: 'up'|'down'}
router.post('/program/:itemId/move', async (req: AuthRequest, res) => {
  const item = await writableItem(req, res);
  if (!item) return;
  const dir = req.body?.dir === 'up' ? 'up' : req.body?.dir === 'down' ? 'down' : null;
  if (!dir) { res.status(400).json({ error: 'Direction invalide' }); return; }
  const items = await prisma.planProgramItem.findMany({ where: { planId: item.planId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveItem(items.map(i => i.id), item.id, dir);
  await prisma.$transaction(order.map((id, position) => prisma.planProgramItem.update({ where: { id }, data: { position } })));
  res.json({ ok: true });
});

// POST /program/:itemId/delay {minutes, mode} — « +15 min » : prolonger le moment en cours (`extend`) ou le
// faire commencer plus tard (`shift`) ; dans les deux cas la suite se décale, sauf les heures fixes
router.post('/program/:itemId/delay', async (req: AuthRequest, res) => {
  const item = await writableItem(req, res);
  if (!item) return;
  const minutes = Number(req.body?.minutes);
  const mode = req.body?.mode === 'shift' ? 'shift' : 'extend';
  if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 240) { res.status(400).json({ error: 'Durée invalide' }); return; }
  const items = await prisma.planProgramItem.findMany({ where: { planId: item.planId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  const changes = delayChanges(items, item.id, minutes, mode, item.plan.eventDate);
  if (!changes) { res.status(400).json({ error: 'Indique d’abord une heure de début' }); return; }
  await prisma.$transaction(changes.map(({ id, ...data }) => prisma.planProgramItem.update({ where: { id }, data })));
  res.json({ ok: true });
});

// DELETE /program/:itemId — la personne qui l'a créé, le créateur du Plan ou un gestionnaire du Cercle
router.delete('/program/:itemId', async (req: AuthRequest, res) => {
  const item = await prisma.planProgramItem.findUnique({ where: { id: req.params.itemId }, include: { plan: { select: PLAN_SELECT } } });
  if (!item || !(await getPlanAccess(req.userId!, item.planId))?.canView) { res.status(404).json({ error: 'Moment introuvable' }); return; }
  if (item.createdById !== req.userId && !(await canManageProgram(req.userId!, item.plan))) { res.status(403).json({ error: 'Seuls la personne qui a créé ce moment et les organisateurs peuvent le supprimer' }); return; }
  await prisma.planProgramItem.delete({ where: { id: item.id } });
  res.json({ ok: true });
});

export default router;
