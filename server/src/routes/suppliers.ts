import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { decryptMessage, encryptMessage } from '../lib/messageCrypto';
import { assignablePeople } from '../lib/tasks';
import { fixUploadedFileName } from '../lib/fileName';
import {
  canManageMoney, maskEntry, MONEY_STATUSES, notifySupplier, parseComment, parseEntryNotes, parseMoneyInput, parseStatus,
  parseSupplierInput, recordStep, supplierDir, supplierFile, SUPPLIER_LIMITS, SUPPLIERS_DISABLED_ERROR, suppliersEnabled, syncUse,
} from '../lib/suppliers';

// Fournisseurs d'un Plan (lib/suppliers.ts), montés dans le routeur des Plans (/api/plans) : même authentification,
// même lecture seule après la fin du Plan et même diffusion temps réel (lib/realtime.ts, section « fournisseurs »).
const router = Router();

const PLAN_SELECT = { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } as const;
type SupplierPlan = { id: string; title: string; circleId: string; creatorId: string; enabledFeatures: string[] };
const actor = (req: AuthRequest) => ({ id: req.userId!, pseudo: req.pseudo! });

export const DOC_TOKEN_TTL = '12h';
export const mintDocToken = (planId: string, userId: string) => jwt.sign({ planId, userId, purpose: 'supplier-docs' }, process.env.JWT_SECRET!, { expiresIn: DOC_TOKEN_TTL });

async function writablePlan(req: AuthRequest, res: any, planId: string | undefined): Promise<SupplierPlan | null> {
  const plan = planId ? await prisma.plan.findUnique({ where: { id: planId }, select: PLAN_SELECT }) : null;
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!suppliersEnabled(plan)) { res.status(403).json({ error: SUPPLIERS_DISABLED_ERROR }); return null; }
  return plan;
}

const entryWithPlan = (entryId: string) => prisma.planSupplier.findUnique({
  where: { id: entryId },
  include: { plan: { select: PLAN_SELECT }, supplier: { select: { id: true, name: true, circleId: true } } },
});

async function writableEntry(req: AuthRequest, res: any, entryId: string) {
  const entry = await entryWithPlan(entryId);
  if (!entry || !(await getPlanAccess(req.userId!, entry.planId))?.canView) { res.status(404).json({ error: 'Fournisseur introuvable' }); return null; }
  if (!suppliersEnabled(entry.plan)) { res.status(403).json({ error: SUPPLIERS_DISABLED_ERROR }); return null; }
  return entry;
}

// Le carnet du Cercle n'est ouvert qu'aux membres du Cercle (un invité extérieur ne le voit pas)
const isCircleMember = async (userId: string, circleId: string) =>
  !!(await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }));

// GET /:id/suppliers — engagements du Plan (montants et documents : organisateurs seulement)
router.get('/:id/suppliers', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = access.plan;
  const [entries, people, groups, money, inCircle] = await Promise.all([
    prisma.planSupplier.findMany({
      where: { planId: plan.id },
      orderBy: { createdAt: 'asc' },
      include: {
        supplier: true,
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, pseudo: true, firstName: true } } } },
        documents: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, mimeType: true, size: true, createdAt: true } },
      },
    }),
    assignablePeople(plan.id),
    prisma.planTaskGroup.findMany({ where: { planId: plan.id }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true } }),
    canManageMoney(req.userId!, plan),
    isCircleMember(req.userId!, plan.circleId),
  ]);
  res.json({
    entries: entries.map(e => maskEntry({
      id: e.id, status: e.status, steps: e.steps, responsibleId: e.responsibleId, groupId: e.groupId, notes: e.notes,
      createdById: e.createdById, createdAt: e.createdAt,
      currency: e.currency, quoteAmount: e.quoteAmount, depositAmount: e.depositAmount, depositDue: e.depositDue, depositPaidAt: e.depositPaidAt,
      balanceAmount: e.balanceAmount, balanceDue: e.balanceDue, balancePaidAt: e.balancePaidAt,
      supplier: {
        id: e.supplier.id, name: e.supplier.name, category: e.supplier.category, contactName: e.supplier.contactName, phone: e.supplier.phone,
        email: e.supplier.email, website: e.supplier.website, address: e.supplier.address, notes: e.supplier.notes, createdById: e.supplier.createdById,
      },
      comments: e.comments.map(c => ({ id: c.id, content: decryptMessage(c.content), createdAt: c.createdAt, author: c.author })),
      documents: e.documents,
    }, money)),
    people, groups,
    canManageMoney: money,
    canUseBook: inCircle,
    docToken: money ? mintDocToken(plan.id, req.userId!) : null,
  });
});

// GET /:id/suppliers/book — carnet du Cercle principal du Plan, avec l'historique de chaque fournisseur
router.get('/:id/suppliers/book', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView || !(await isCircleMember(req.userId!, access.plan.circleId))) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const money = await canManageMoney(req.userId!, access.plan);
  const suppliers = await prisma.circleSupplier.findMany({
    where: { circleId: access.plan.circleId, archivedAt: null },
    orderBy: { name: 'asc' },
    include: { uses: { orderBy: { updatedAt: 'desc' }, take: 5 }, entries: { where: { planId: access.plan.id }, select: { id: true } } },
  });
  res.json({
    suppliers: suppliers.map(s => ({
      id: s.id, name: s.name, category: s.category, contactName: s.contactName, phone: s.phone, email: s.email, website: s.website,
      inPlan: s.entries.length > 0,
      uses: s.uses.map(u => ({ planTitle: u.planTitle, eventDate: u.eventDate, status: u.status, ...(money ? { total: u.total, currency: u.currency } : {}) })),
    })),
  });
});

// POST /:id/suppliers {supplierId} ou {supplier: {...}} — ajouter un fournisseur du carnet, ou en créer un (carnet + Plan)
router.post('/:id/suppliers', async (req: AuthRequest, res) => {
  const plan = await writablePlan(req, res, req.params.id);
  if (!plan) return;
  if (!(await isCircleMember(req.userId!, plan.circleId))) { res.status(403).json({ error: 'Réservé aux membres du Cercle' }); return; }
  if (await prisma.planSupplier.count({ where: { planId: plan.id } }) >= SUPPLIER_LIMITS.perPlan) { res.status(400).json({ error: `${SUPPLIER_LIMITS.perPlan} fournisseurs au plus par Plan` }); return; }
  let supplierId: string;
  if (typeof req.body?.supplierId === 'string') {
    const s = await prisma.circleSupplier.findFirst({ where: { id: req.body.supplierId, circleId: plan.circleId }, select: { id: true } });
    if (!s) { res.status(404).json({ error: 'Fournisseur introuvable' }); return; }
    supplierId = s.id;
  } else {
    const input = parseSupplierInput(req.body?.supplier);
    if ('error' in input) { res.status(400).json({ error: input.error }); return; }
    if (await prisma.circleSupplier.count({ where: { circleId: plan.circleId } }) >= SUPPLIER_LIMITS.perCircle) { res.status(400).json({ error: `${SUPPLIER_LIMITS.perCircle} fournisseurs au plus par Cercle` }); return; }
    supplierId = (await prisma.circleSupplier.create({ data: { ...input, circleId: plan.circleId, createdById: req.userId! } })).id;
  }
  const exists = await prisma.planSupplier.findUnique({ where: { planId_supplierId: { planId: plan.id, supplierId } }, select: { id: true } });
  if (exists) { res.json({ id: exists.id }); return; }
  const entry = await prisma.planSupplier.create({
    data: { planId: plan.id, supplierId, createdById: req.userId!, responsibleId: req.userId!, steps: recordStep({}, 'todo', req.pseudo!) },
  });
  await prisma.circleSupplier.update({ where: { id: supplierId }, data: { archivedAt: null } });
  await syncUse(entry.id);
  res.json({ id: entry.id });
});

// PUT /suppliers/:entryId — suivi (état, responsable, lot, notes : toute l'équipe) et montants (organisateurs)
router.put('/suppliers/:entryId', async (req: AuthRequest, res) => {
  const entry = await writableEntry(req, res, req.params.entryId);
  if (!entry) return;
  const money = await canManageMoney(req.userId!, entry.plan);
  const data: Record<string, any> = {};
  const body = req.body ?? {};

  if (body.status !== undefined) {
    const s = parseStatus(body.status);
    if (!s) { res.status(400).json({ error: 'Statut invalide' }); return; }
    if (MONEY_STATUSES.includes(s) && !money && s !== entry.status) { res.status(403).json({ error: 'Seuls les organisateurs peuvent marquer un fournisseur comme payé' }); return; }
    if (s !== entry.status) { data.status = s; data.steps = recordStep(entry.steps, s, req.pseudo!); }
  }
  if (body.responsibleId !== undefined) {
    if (body.responsibleId === null || body.responsibleId === '') data.responsibleId = null;
    else if (typeof body.responsibleId === 'string' && (await assignablePeople(entry.planId)).some(p => p.id === body.responsibleId)) data.responsibleId = body.responsibleId;
    else { res.status(400).json({ error: 'Responsable introuvable dans ce Plan' }); return; }
  }
  if (body.groupId !== undefined) {
    if (body.groupId === null || body.groupId === '') data.groupId = null;
    else if (typeof body.groupId === 'string' && await prisma.planTaskGroup.findFirst({ where: { id: body.groupId, planId: entry.planId }, select: { id: true } })) data.groupId = body.groupId;
    else { res.status(400).json({ error: 'Lot introuvable' }); return; }
  }
  if (body.notes !== undefined) {
    const notes = parseEntryNotes(body.notes);
    if (notes && typeof notes === 'object') { res.status(400).json({ error: notes.error }); return; }
    data.notes = notes;
  }
  if (body.money !== undefined) {
    if (!money) { res.status(403).json({ error: 'Montants réservés aux organisateurs' }); return; }
    const m = parseMoneyInput(body.money);
    if ('error' in m) { res.status(400).json({ error: m.error }); return; }
    Object.assign(data, m);
    // Échéance changée : le rappel repart pour la nouvelle date
    if (m.depositDue !== entry.depositDue) data.depositReminderSentAt = null;
    if (m.balanceDue !== entry.balanceDue) data.balanceReminderSentAt = null;
  }
  for (const k of ['depositPaid', 'balancePaid'] as const) {
    if (body[k] === undefined) continue;
    if (!money) { res.status(403).json({ error: 'Montants réservés aux organisateurs' }); return; }
    data[`${k}At`] = body[k] ? new Date() : null;
  }
  // Repassé à « Devis demandé » : la relance repart
  if (data.status === 'quote_requested') data.followUpSentAt = null;
  await prisma.planSupplier.update({ where: { id: entry.id }, data });
  await syncUse(entry.id);
  res.json({ ok: true });

  const io = req.app.get('io');
  if (data.responsibleId && data.responsibleId !== entry.responsibleId) {
    notifySupplier(io, data.responsibleId, entry.plan, `@${req.pseudo} t’a confié le suivi du fournisseur « ${entry.supplier.name} »`, actor(req));
  }
  // Fournisseur confirmé : l'équipe est prévenue (sans montant)
  if (data.status === 'confirmed') {
    for (const p of await assignablePeople(entry.planId)) notifySupplier(io, p.id, entry.plan, `✅ @${req.pseudo} a confirmé le fournisseur « ${entry.supplier.name} »`, actor(req));
  }
});

// DELETE /suppliers/:entryId — retirer du Plan (la fiche reste dans le carnet) : la personne qui l'a ajouté ou un organisateur
router.delete('/suppliers/:entryId', async (req: AuthRequest, res) => {
  const entry = await entryWithPlan(req.params.entryId);
  if (!entry || !(await getPlanAccess(req.userId!, entry.planId))?.canView) { res.status(404).json({ error: 'Fournisseur introuvable' }); return; }
  if (entry.createdById !== req.userId && !(await canManageMoney(req.userId!, entry.plan))) { res.status(403).json({ error: 'Seuls la personne qui a ajouté ce fournisseur et les organisateurs peuvent le retirer' }); return; }
  const docs = await prisma.supplierDocument.findMany({ where: { entryId: entry.id }, select: { fileKey: true } });
  for (const d of docs) await fs.rm(supplierFile(d.fileKey), { force: true }).catch(() => {});
  await prisma.supplierUse.deleteMany({ where: { entryId: entry.id } });
  await prisma.planSupplier.delete({ where: { id: entry.id } });
  res.json({ ok: true });
});

// POST /suppliers/:entryId/comments — commentaire de l'équipe ; responsable et personne qui l'a ajouté prévenus (sans le texte)
router.post('/suppliers/:entryId/comments', async (req: AuthRequest, res) => {
  const entry = await writableEntry(req, res, req.params.entryId);
  if (!entry) return;
  const content = parseComment(req.body?.content);
  if (typeof content !== 'string') { res.status(400).json({ error: content.error }); return; }
  const comment = await prisma.planSupplierComment.create({ data: { entryId: entry.id, planId: entry.planId, authorId: req.userId!, content: encryptMessage(content) } });
  res.json({ id: comment.id });
  const io = req.app.get('io');
  for (const id of new Set([entry.responsibleId, entry.createdById].filter((x): x is string => !!x))) {
    notifySupplier(io, id, entry.plan, `@${req.pseudo} a commenté le fournisseur « ${entry.supplier.name} »`, actor(req));
  }
});

// DELETE /suppliers/comments/:commentId — son auteur ou un organisateur
router.delete('/suppliers/comments/:commentId', async (req: AuthRequest, res) => {
  const comment = await prisma.planSupplierComment.findUnique({ where: { id: req.params.commentId }, include: { entry: { include: { plan: { select: PLAN_SELECT } } } } });
  if (!comment || !(await getPlanAccess(req.userId!, comment.planId))?.canView) { res.status(404).json({ error: 'Commentaire introuvable' }); return; }
  if (comment.authorId !== req.userId && !(await canManageMoney(req.userId!, comment.entry.plan))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  await prisma.planSupplierComment.delete({ where: { id: comment.id } });
  res.json({ ok: true });
});

// Documents (devis, contrat, facture) : organisateurs seulement, PDF ou photos, 10 Mo par fichier, 30 Mo par Plan
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SUPPLIER_LIMITS.docBytes } });

router.post('/suppliers/:entryId/documents', upload.single('file'), async (req: AuthRequest, res) => {
  const entry = await writableEntry(req, res, req.params.entryId);
  if (!entry) return;
  if (!(await canManageMoney(req.userId!, entry.plan))) { res.status(403).json({ error: 'Documents réservés aux organisateurs' }); return; }
  if (!req.file) { res.status(400).json({ error: 'Fichier manquant' }); return; }
  const mimeType = req.file.mimetype.split(';')[0].trim();
  if (!DOC_TYPES.includes(mimeType)) { res.status(400).json({ error: 'Seuls les PDF et les photos sont acceptés' }); return; }
  if (await prisma.supplierDocument.count({ where: { entryId: entry.id } }) >= SUPPLIER_LIMITS.docsPerEntry) { res.status(400).json({ error: `${SUPPLIER_LIMITS.docsPerEntry} documents au plus par fournisseur` }); return; }
  const { _sum } = await prisma.supplierDocument.aggregate({ where: { planId: entry.planId }, _sum: { size: true } });
  if ((_sum.size ?? 0) + req.file.size > SUPPLIER_LIMITS.docsPerPlanBytes) { res.status(400).json({ error: 'Place pour les documents des fournisseurs épuisée (30 Mo par Plan)' }); return; }
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1].replace('jpeg', 'jpg');
  const fileKey = `${path.basename(supplierDir(entry.planId))}/${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(supplierDir(entry.planId), { recursive: true });
  await fs.writeFile(supplierFile(fileKey), req.file.buffer);
  const doc = await prisma.supplierDocument.create({
    data: { entryId: entry.id, planId: entry.planId, name: fixUploadedFileName(req.file.originalname).slice(0, 120), mimeType, size: req.file.size, fileKey, uploadedById: req.userId! },
  });
  res.json({ id: doc.id });
});

router.delete('/suppliers/documents/:docId', async (req: AuthRequest, res) => {
  const doc = await prisma.supplierDocument.findUnique({ where: { id: req.params.docId }, include: { entry: { include: { plan: { select: PLAN_SELECT } } } } });
  if (!doc || !(await getPlanAccess(req.userId!, doc.planId))?.canView) { res.status(404).json({ error: 'Document introuvable' }); return; }
  if (!(await canManageMoney(req.userId!, doc.entry.plan))) { res.status(403).json({ error: 'Documents réservés aux organisateurs' }); return; }
  await fs.rm(supplierFile(doc.fileKey), { force: true }).catch(() => {});
  await prisma.supplierDocument.delete({ where: { id: doc.id } });
  res.json({ ok: true });
});

export default router;

