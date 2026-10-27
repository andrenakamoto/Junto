import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { decryptMessage, encryptMessage } from '../lib/messageCrypto';
import {
  assignablePeople, canManageTasks, commentRecipients, createsCycle, MAX_GROUPS, MAX_TASKS, newlyUnblocked, notifyTask, parseGroupTitle,
  parseStatus, parseTaskComment, parseTaskInput, TaskInput, tasksEnabled, TASKS_DISABLED_ERROR,
} from '../lib/tasks';

// Tâches de préparation d'un Plan (lib/tasks.ts), montées dans le routeur des Plans (/api/plans) :
// même authentification, même lecture seule après la fin du Plan et même diffusion temps réel (lib/realtime.ts).
const router = Router();

const PLAN_SELECT = { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } as const;
type TaskPlan = { id: string; title: string; circleId: string; creatorId: string; enabledFeatures: string[] };

// Plan visible et tâches activées (pour les écritures)
async function writablePlan(req: AuthRequest, res: any, planId: string | undefined): Promise<TaskPlan | null> {
  const plan = planId ? await prisma.plan.findUnique({ where: { id: planId }, select: PLAN_SELECT }) : null;
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!tasksEnabled(plan)) { res.status(403).json({ error: TASKS_DISABLED_ERROR }); return null; }
  return plan;
}

const assignable = assignablePeople;

const actor = (req: AuthRequest) => ({ id: req.userId!, pseudo: req.pseudo! });

// Responsables et dépendances : vérifiés contre le Plan (personnes du Plan, tâches du Plan, pas de boucle)
async function checkLinks(planId: string, input: TaskInput, taskId?: string): Promise<string | null> {
  if (input.groupId && !(await prisma.planTaskGroup.findFirst({ where: { id: input.groupId, planId }, select: { id: true } }))) return 'Lot introuvable';
  const people = new Set((await assignable(planId)).map(p => p.id));
  if (input.assigneeIds.some(id => !people.has(id))) return 'Responsable introuvable dans ce Plan';
  const tasks = await prisma.planTask.findMany({ where: { planId }, select: { id: true, dependsOn: { select: { dependsOnId: true } } } });
  const ids = new Set(tasks.map(t => t.id));
  if (input.dependsOnIds.some(id => !ids.has(id) || id === taskId)) return 'Dépendance introuvable';
  if (taskId) {
    const edges = new Map(tasks.map(t => [t.id, t.dependsOn.map(d => d.dependsOnId)]));
    if (createsCycle(edges, taskId, input.dependsOnIds)) return 'Ces tâches s’attendraient l’une l’autre';
  }
  return null;
}

// Nouveaux responsables prévenus (pas la personne qui confie la tâche)
function notifyAssigned(req: AuthRequest, plan: TaskPlan, title: string, userIds: string[]) {
  const io = req.app.get('io');
  for (const id of userIds) notifyTask(io, id, plan, `@${req.pseudo} t’a confié la tâche « ${title} »`, actor(req));
}

// GET /:id/tasks — lots, tâches, personnes à qui les confier (lecture : tous ceux qui voient le Plan)
router.get('/:id/tasks', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const planId = req.params.id;
  const [groups, tasks, people] = await Promise.all([
    prisma.planTaskGroup.findMany({ where: { planId }, orderBy: { createdAt: 'asc' } }),
    prisma.planTask.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' },
      include: {
        assignees: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, pseudo: true, firstName: true } } } },
        dependsOn: { select: { dependsOnId: true } },
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, pseudo: true, firstName: true } } } },
        doneBy: { select: { pseudo: true } },
      },
    }),
    assignable(planId),
  ]);
  res.json({
    groups: groups.map(g => ({ id: g.id, title: g.title, createdById: g.createdById })),
    tasks: tasks.map(t => ({
      id: t.id, title: t.title, note: t.note, dueDate: t.dueDate, status: t.status, groupId: t.groupId,
      createdById: t.createdById, createdAt: t.createdAt, doneAt: t.doneAt, doneBy: t.doneBy,
      assignees: t.assignees.map(a => ({ userId: a.userId, user: a.user })),
      dependsOn: t.dependsOn.map(d => d.dependsOnId),
      comments: t.comments.map(c => ({ id: c.id, content: decryptMessage(c.content), createdAt: c.createdAt, author: c.author })),
    })),
    people,
    canManage: await canManageTasks(req.userId!, access.plan),
  });
});

// POST /:id/tasks — ajouter une tâche (toute personne qui voit le Plan)
router.post('/:id/tasks', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  const input = parseTaskInput(req.body);
  if ('error' in input) { res.status(400).json({ error: input.error }); return; }
  if (await prisma.planTask.count({ where: { planId: plan.id } }) >= MAX_TASKS) { res.status(400).json({ error: `${MAX_TASKS} tâches au plus par Plan` }); return; }
  const problem = await checkLinks(plan.id, input);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const task = await prisma.planTask.create({
    data: {
      planId: plan.id, title: input.title, note: input.note, dueDate: input.dueDate, groupId: input.groupId, createdById: req.userId!,
      assignees: { create: input.assigneeIds.map(userId => ({ userId, planId: plan.id })) },
      dependsOn: { create: input.dependsOnIds.map(dependsOnId => ({ dependsOnId })) },
    },
  });
  res.json({ id: task.id });
  notifyAssigned(req, plan, task.title, input.assigneeIds);
});

const taskWithPlan = (taskId: string) => prisma.planTask.findUnique({
  where: { id: taskId },
  include: { plan: { select: PLAN_SELECT }, assignees: { select: { userId: true } } },
});

async function writableTask(req: AuthRequest, res: any) {
  const task = await taskWithPlan(req.params.taskId);
  if (!task || !(await getPlanAccess(req.userId!, task.planId))?.canView) { res.status(404).json({ error: 'Tâche introuvable' }); return null; }
  if (!tasksEnabled(task.plan)) { res.status(403).json({ error: TASKS_DISABLED_ERROR }); return null; }
  return task;
}

// PUT /tasks/:taskId — modifier une tâche (nom, détails, lot, échéance, responsables, dépendances)
router.put('/tasks/:taskId', async (req: AuthRequest, res) => {
  const task = await writableTask(req, res);
  if (!task) return;
  const input = parseTaskInput(req.body);
  if ('error' in input) { res.status(400).json({ error: input.error }); return; }
  const problem = await checkLinks(task.planId, input, task.id);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const before = task.assignees.map(a => a.userId);
  const added = input.assigneeIds.filter(id => !before.includes(id));
  await prisma.$transaction([
    prisma.planTask.update({
      where: { id: task.id },
      data: {
        title: input.title, note: input.note, groupId: input.groupId, dueDate: input.dueDate,
        // Échéance changée : le rappel repart pour la nouvelle date
        ...(input.dueDate !== task.dueDate ? { reminderSentAt: null } : {}),
      },
    }),
    prisma.planTaskAssignee.deleteMany({ where: { taskId: task.id, userId: { notIn: input.assigneeIds } } }),
    prisma.planTaskAssignee.createMany({ data: added.map(userId => ({ taskId: task.id, userId, planId: task.planId })), skipDuplicates: true }),
    prisma.planTaskDependency.deleteMany({ where: { taskId: task.id } }),
    prisma.planTaskDependency.createMany({ data: input.dependsOnIds.map(dependsOnId => ({ taskId: task.id, dependsOnId })) }),
  ]);
  res.json({ ok: true });
  notifyAssigned(req, task.plan, input.title, added);
});

// POST /tasks/:taskId/status {status} — à faire, en cours, terminée. Terminer une tâche prévient les
// responsables des tâches qui l'attendaient et n'attendent plus rien, et la personne qui l'a créée.
router.post('/tasks/:taskId/status', async (req: AuthRequest, res) => {
  const task = await writableTask(req, res);
  if (!task) return;
  const status = parseStatus(req.body?.status);
  if (!status) { res.status(400).json({ error: 'Statut invalide' }); return; }
  if (status === task.status) { res.json({ ok: true }); return; }
  await prisma.planTask.update({
    where: { id: task.id },
    data: status === 'done' ? { status, doneAt: new Date(), doneById: req.userId! } : { status, doneAt: null, doneById: null },
  });
  res.json({ ok: true });
  if (status !== 'done') return;
  const io = req.app.get('io');
  if (task.createdById) notifyTask(io, task.createdById, task.plan, `✅ @${req.pseudo} a terminé la tâche « ${task.title} »`, actor(req));
  const all = await prisma.planTask.findMany({
    where: { planId: task.planId },
    select: { id: true, title: true, status: true, createdById: true, dependsOn: { select: { dependsOnId: true } }, assignees: { select: { userId: true } } },
  });
  const ready = newlyUnblocked(all.map(t => ({ ...t, dependsOn: t.dependsOn.map(d => d.dependsOnId) })), task.id);
  for (const t of ready) {
    const to = t.assignees.length ? t.assignees.map(a => a.userId) : t.createdById ? [t.createdById] : [];
    for (const id of to) notifyTask(io, id, task.plan, `▶️ Tu peux commencer « ${t.title} » : « ${task.title} » est terminée`, actor(req));
  }
});

// POST|DELETE /tasks/:taskId/me — « Je m'en occupe » / ne plus en être responsable
router.post('/tasks/:taskId/me', async (req: AuthRequest, res) => {
  const task = await writableTask(req, res);
  if (!task) return;
  if (!(await assignable(task.planId)).some(p => p.id === req.userId)) { res.status(403).json({ error: 'Réponds d’abord « Je suis in » ou « Peut-être » au Plan' }); return; }
  await prisma.planTaskAssignee.createMany({ data: [{ taskId: task.id, userId: req.userId!, planId: task.planId }], skipDuplicates: true });
  res.json({ ok: true });
});

router.delete('/tasks/:taskId/me', async (req: AuthRequest, res) => {
  const task = await writableTask(req, res);
  if (!task) return;
  await prisma.planTaskAssignee.deleteMany({ where: { taskId: task.id, userId: req.userId! } });
  res.json({ ok: true });
});

// DELETE /tasks/:taskId — la personne qui l'a créée, le créateur du Plan ou un gestionnaire du Cercle
router.delete('/tasks/:taskId', async (req: AuthRequest, res) => {
  const task = await taskWithPlan(req.params.taskId);
  if (!task || !(await getPlanAccess(req.userId!, task.planId))?.canView) { res.status(404).json({ error: 'Tâche introuvable' }); return; }
  if (task.createdById !== req.userId && !(await canManageTasks(req.userId!, task.plan))) { res.status(403).json({ error: 'Seuls la personne qui a créé la tâche et les organisateurs peuvent la supprimer' }); return; }
  await prisma.planTask.delete({ where: { id: task.id } });
  res.json({ ok: true });
});

// POST /tasks/:taskId/comments — commenter ; responsables et personne qui a créé la tâche prévenus (sans le texte)
router.post('/tasks/:taskId/comments', async (req: AuthRequest, res) => {
  const task = await writableTask(req, res);
  if (!task) return;
  const content = parseTaskComment(req.body?.content);
  if (typeof content !== 'string') { res.status(400).json({ error: content.error }); return; }
  const comment = await prisma.planTaskComment.create({ data: { taskId: task.id, planId: task.planId, authorId: req.userId!, content: encryptMessage(content) } });
  res.json({ id: comment.id });
  const io = req.app.get('io');
  for (const id of commentRecipients(task, task.assignees.map(a => a.userId), req.userId!)) {
    notifyTask(io, id, task.plan, `@${req.pseudo} a commenté la tâche « ${task.title} »`, actor(req));
  }
});

// DELETE /tasks/comments/:commentId — son auteur ou un gestionnaire
router.delete('/tasks/comments/:commentId', async (req: AuthRequest, res) => {
  const comment = await prisma.planTaskComment.findUnique({ where: { id: req.params.commentId }, include: { task: { include: { plan: { select: PLAN_SELECT } } } } });
  if (!comment || !(await getPlanAccess(req.userId!, comment.planId))?.canView) { res.status(404).json({ error: 'Commentaire introuvable' }); return; }
  if (comment.authorId !== req.userId && !(await canManageTasks(req.userId!, comment.task.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  await prisma.planTaskComment.delete({ where: { id: comment.id } });
  res.json({ ok: true });
});

// POST /:id/task-groups {titles} — ajouter un ou plusieurs lots (les lots types en un geste)
router.post('/:id/task-groups', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  const raw: unknown[] = Array.isArray(req.body?.titles) ? req.body.titles : [req.body?.title];
  const titles: string[] = [];
  for (const v of raw.slice(0, MAX_GROUPS)) {
    const title = parseGroupTitle(v);
    if (typeof title !== 'string') { res.status(400).json({ error: title.error }); return; }
    titles.push(title);
  }
  const existing = await prisma.planTaskGroup.findMany({ where: { planId: plan.id }, select: { title: true } });
  const taken = new Set(existing.map(g => g.title.toLowerCase()));
  const fresh = [...new Set(titles)].filter(t => !taken.has(t.toLowerCase()));
  if (existing.length + fresh.length > MAX_GROUPS) { res.status(400).json({ error: `${MAX_GROUPS} lots au plus par Plan` }); return; }
  // Un à un pour garder l'ordre de création (ordre d'affichage)
  const created = [];
  for (const title of fresh) created.push(await prisma.planTaskGroup.create({ data: { planId: plan.id, title, createdById: req.userId! } }));
  res.json({ ids: created.map(g => g.id) });
});

const groupWithPlan = (groupId: string) => prisma.planTaskGroup.findUnique({ where: { id: groupId }, include: { plan: { select: PLAN_SELECT } } });

// PUT /task-groups/:groupId {title} — renommer un lot
router.put('/task-groups/:groupId', async (req: AuthRequest, res) => {
  const group = await groupWithPlan(req.params.groupId);
  if (!group || !(await getPlanAccess(req.userId!, group.planId))?.canView) { res.status(404).json({ error: 'Lot introuvable' }); return; }
  if (!tasksEnabled(group.plan)) { res.status(403).json({ error: TASKS_DISABLED_ERROR }); return; }
  const title = parseGroupTitle(req.body?.title);
  if (typeof title !== 'string') { res.status(400).json({ error: title.error }); return; }
  await prisma.planTaskGroup.update({ where: { id: group.id }, data: { title } });
  res.json({ ok: true });
});

// DELETE /task-groups/:groupId — supprimer un lot (ses tâches restent, « Sans lot ») : la personne qui
// l'a créé, le créateur du Plan ou un gestionnaire du Cercle
router.delete('/task-groups/:groupId', async (req: AuthRequest, res) => {
  const group = await groupWithPlan(req.params.groupId);
  if (!group || !(await getPlanAccess(req.userId!, group.planId))?.canView) { res.status(404).json({ error: 'Lot introuvable' }); return; }
  if (group.createdById !== req.userId && !(await canManageTasks(req.userId!, group.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  await prisma.planTaskGroup.delete({ where: { id: group.id } });
  res.json({ ok: true });
});

export default router;
