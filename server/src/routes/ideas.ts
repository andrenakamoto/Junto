import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import {
  ideasEnabled, IDEAS_DISABLED_ERROR, isIdeaColor, isIdeaStatus, MAX_COLUMNS, MAX_IDEAS, mergeIdeas, moveInList,
  parseColumnTitle, parseIdeaText,
} from '../lib/ideas';

// Idées d'un Plan (lib/ideas.ts), montées dans le routeur des Plans (/api/plans) : même authentification, même lecture
// seule après la fin du Plan et même diffusion temps réel (lib/realtime.ts) — les téléphones suivent la séance projetée.
const router = Router();

const PLAN_SELECT = { id: true, enabledFeatures: true } as const;

async function writablePlan(req: AuthRequest, res: any, planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: PLAN_SELECT });
  if (!plan || !(await getPlanAccess(req.userId!, plan.id))?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!ideasEnabled(plan)) { res.status(403).json({ error: IDEAS_DISABLED_ERROR }); return null; }
  return plan;
}

async function writableIdea(req: AuthRequest, res: any) {
  const idea = await prisma.idea.findUnique({ where: { id: req.params.ideaId }, include: { plan: { select: PLAN_SELECT } } });
  if (!idea || !(await getPlanAccess(req.userId!, idea.planId))?.canView) { res.status(404).json({ error: 'Idée introuvable' }); return null; }
  if (!ideasEnabled(idea.plan)) { res.status(403).json({ error: IDEAS_DISABLED_ERROR }); return null; }
  return idea;
}

async function writableColumn(req: AuthRequest, res: any) {
  const column = await prisma.ideaColumn.findUnique({ where: { id: req.params.columnId }, include: { plan: { select: PLAN_SELECT } } });
  if (!column || !(await getPlanAccess(req.userId!, column.planId))?.canView) { res.status(404).json({ error: 'Thème introuvable' }); return null; }
  if (!ideasEnabled(column.plan)) { res.status(403).json({ error: IDEAS_DISABLED_ERROR }); return null; }
  return column;
}

const columnOf = async (planId: string, columnId: unknown) => {
  if (columnId === null || columnId === undefined || columnId === '') return null;
  if (typeof columnId !== 'string') return undefined;
  const col = await prisma.ideaColumn.findFirst({ where: { id: columnId, planId }, select: { id: true } });
  return col ? col.id : undefined;
};

// GET /:id/ideas — thèmes et idées (lecture : tous ceux qui voient le Plan)
router.get('/:id/ideas', async (req: AuthRequest, res) => {
  if (!(await getPlanAccess(req.userId!, req.params.id))?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const [columns, ideas] = await Promise.all([
    prisma.ideaColumn.findMany({ where: { planId: req.params.id }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true } }),
    prisma.idea.findMany({ where: { planId: req.params.id }, orderBy: { createdAt: 'asc' }, select: { id: true, columnId: true, text: true, status: true, votes: true, color: true, taskId: true, createdAt: true } }),
  ]);
  res.json({ columns, ideas });
});

// POST /:id/idea-columns {title | titles} — ajouter un ou plusieurs thèmes
router.post('/:id/idea-columns', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  const raw: unknown[] = Array.isArray(req.body?.titles) ? req.body.titles : [req.body?.title];
  const titles: string[] = [];
  for (const v of raw.slice(0, MAX_COLUMNS)) {
    const title = parseColumnTitle(v);
    if (typeof title !== 'string') { res.status(400).json({ error: title.error }); return; }
    titles.push(title);
  }
  const existing = await prisma.ideaColumn.findMany({ where: { planId: plan.id }, select: { title: true } });
  const taken = new Set(existing.map(c => c.title.toLowerCase()));
  const fresh = [...new Set(titles)].filter(t => !taken.has(t.toLowerCase()));
  if (existing.length + fresh.length > MAX_COLUMNS) { res.status(400).json({ error: `${MAX_COLUMNS} thèmes au plus` }); return; }
  const created = [];
  for (const [i, title] of fresh.entries()) created.push(await prisma.ideaColumn.create({ data: { planId: plan.id, title, position: existing.length + i } }));
  res.json({ ids: created.map(c => c.id) });
});

// PUT /idea-columns/:columnId {title}
router.put('/idea-columns/:columnId', async (req: AuthRequest, res) => {
  const column = await writableColumn(req, res);
  if (!column) return;
  const title = parseColumnTitle(req.body?.title);
  if (typeof title !== 'string') { res.status(400).json({ error: title.error }); return; }
  await prisma.ideaColumn.update({ where: { id: column.id }, data: { title } });
  res.json({ ok: true });
});

// POST /idea-columns/:columnId/move {dir: 'left'|'right'}
router.post('/idea-columns/:columnId/move', async (req: AuthRequest, res) => {
  const column = await writableColumn(req, res);
  if (!column) return;
  const dir = req.body?.dir === 'left' ? 'left' : req.body?.dir === 'right' ? 'right' : null;
  if (!dir) { res.status(400).json({ error: 'Direction invalide' }); return; }
  const cols = await prisma.ideaColumn.findMany({ where: { planId: column.planId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveInList(cols.map(c => c.id), column.id, dir);
  await prisma.$transaction(order.map((id, position) => prisma.ideaColumn.update({ where: { id }, data: { position } })));
  res.json({ ok: true });
});

// DELETE /idea-columns/:columnId — ses idées restent, « sans thème »
router.delete('/idea-columns/:columnId', async (req: AuthRequest, res) => {
  const column = await writableColumn(req, res);
  if (!column) return;
  await prisma.ideaColumn.delete({ where: { id: column.id } });
  res.json({ ok: true });
});

// POST /:id/ideas {text, columnId} — ajouter une idée
router.post('/:id/ideas', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  const text = parseIdeaText(req.body?.text);
  if (typeof text !== 'string') { res.status(400).json({ error: text.error }); return; }
  const columnId = await columnOf(plan.id, req.body?.columnId);
  if (columnId === undefined) { res.status(400).json({ error: 'Thème introuvable' }); return; }
  if (await prisma.idea.count({ where: { planId: plan.id } }) >= MAX_IDEAS) { res.status(400).json({ error: `${MAX_IDEAS} idées au plus` }); return; }
  const idea = await prisma.idea.create({ data: { planId: plan.id, columnId, text, createdById: req.userId! } });
  res.json({ id: idea.id });
});

// PUT /ideas/:ideaId {text?, columnId?, status?, color?, taskId?} — seuls les champs envoyés changent
router.put('/ideas/:ideaId', async (req: AuthRequest, res) => {
  const idea = await writableIdea(req, res);
  if (!idea) return;
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.text !== undefined) {
    const text = parseIdeaText(b.text);
    if (typeof text !== 'string') { res.status(400).json({ error: text.error }); return; }
    data.text = text;
  }
  if (b.columnId !== undefined) {
    const columnId = await columnOf(idea.planId, b.columnId);
    if (columnId === undefined) { res.status(400).json({ error: 'Thème introuvable' }); return; }
    data.columnId = columnId;
  }
  if (b.status !== undefined) {
    if (!isIdeaStatus(b.status)) { res.status(400).json({ error: 'Statut invalide' }); return; }
    data.status = b.status;
  }
  if (b.color !== undefined) {
    if (b.color !== null && !isIdeaColor(b.color)) { res.status(400).json({ error: 'Couleur invalide' }); return; }
    data.color = b.color;
  }
  if (b.taskId !== undefined) {
    if (typeof b.taskId !== 'string' || !(await prisma.planTask.findFirst({ where: { id: b.taskId, planId: idea.planId }, select: { id: true } }))) {
      res.status(400).json({ error: 'Tâche introuvable' }); return;
    }
    data.taskId = b.taskId;
    data.status = 'kept';
  }
  await prisma.idea.update({ where: { id: idea.id }, data });
  res.json({ ok: true });
});

// POST /ideas/:ideaId/vote {delta: 1|-1} — votes à main levée notés par la personne au clavier
router.post('/ideas/:ideaId/vote', async (req: AuthRequest, res) => {
  const idea = await writableIdea(req, res);
  if (!idea) return;
  const delta = req.body?.delta === -1 ? -1 : req.body?.delta === 1 ? 1 : 0;
  if (!delta) { res.status(400).json({ error: 'Vote invalide' }); return; }
  await prisma.idea.update({ where: { id: idea.id }, data: { votes: Math.max(0, idea.votes + delta) } });
  res.json({ ok: true });
});

// POST /ideas/:ideaId/merge {intoId} — fusionner cette idée dans une autre (celle-ci disparaît)
router.post('/ideas/:ideaId/merge', async (req: AuthRequest, res) => {
  const idea = await writableIdea(req, res);
  if (!idea) return;
  const into = typeof req.body?.intoId === 'string' && req.body.intoId !== idea.id
    ? await prisma.idea.findFirst({ where: { id: req.body.intoId, planId: idea.planId } }) : null;
  if (!into) { res.status(400).json({ error: 'Idée introuvable' }); return; }
  const merged = mergeIdeas(into, idea);
  await prisma.$transaction([
    prisma.idea.update({ where: { id: into.id }, data: { ...merged, taskId: into.taskId ?? idea.taskId } }),
    prisma.idea.delete({ where: { id: idea.id } }),
  ]);
  res.json({ ok: true });
});

// DELETE /ideas/:ideaId
router.delete('/ideas/:ideaId', async (req: AuthRequest, res) => {
  const idea = await writableIdea(req, res);
  if (!idea) return;
  await prisma.idea.delete({ where: { id: idea.id } });
  res.json({ ok: true });
});

export default router;
