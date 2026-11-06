import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { isCircleManager } from '../lib/circleRoles';
import { canManageMoney, parseSupplierInput, supplierFile } from '../lib/suppliers';

// Carnet des fournisseurs d'un Cercle (lib/suppliers.ts), sur /api/suppliers : consulter, modifier une fiche, archiver,
// supprimer ; et documents des engagements (lien signé, organisateurs seulement).
const router = Router();

// GET /files/:docId?t= — document d'un fournisseur (jeton « supplier-docs » donné aux seuls organisateurs, droits revérifiés)
router.get('/files/:docId', async (req, res) => {
  let tok: { planId?: string; userId?: string; purpose?: string };
  try { tok = jwt.verify(String(req.query.t ?? ''), process.env.JWT_SECRET!) as any; } catch { res.status(403).end(); return; }
  if (tok.purpose !== 'supplier-docs' || !tok.planId || !tok.userId) { res.status(403).end(); return; }
  const doc = await prisma.supplierDocument.findUnique({ where: { id: req.params.docId }, include: { entry: { include: { plan: { select: { creatorId: true, circleId: true } } } } } });
  if (!doc || doc.planId !== tok.planId) { res.status(404).end(); return; }
  if (!(await canManageMoney(tok.userId, doc.entry.plan))) { res.status(403).end(); return; }
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.name)}`);
  res.type(doc.mimeType);
  res.sendFile(supplierFile(doc.fileKey), err => { if (err && !res.headersSent) res.status(404).end(); });
});

router.use(requireAuth as any);

const member = (userId: string, circleId: string) =>
  prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } });

// GET /circle/:circleId — carnet complet (archivés compris), historique ; montants pour les gestionnaires du Cercle
router.get('/circle/:circleId', async (req: AuthRequest, res) => {
  if (!(await member(req.userId!, req.params.circleId))) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  const manager = await isCircleManager(req.userId!, req.params.circleId);
  const suppliers = await prisma.circleSupplier.findMany({
    where: { circleId: req.params.circleId },
    orderBy: { name: 'asc' },
    include: { uses: { orderBy: { updatedAt: 'desc' } } },
  });
  res.json({
    canManage: manager,
    suppliers: suppliers.map(s => ({
      id: s.id, name: s.name, category: s.category, contactName: s.contactName, phone: s.phone, email: s.email, website: s.website,
      address: s.address, notes: s.notes, createdById: s.createdById, archived: !!s.archivedAt,
      canEdit: manager || s.createdById === req.userId,
      uses: s.uses.map(u => ({ planId: u.planId, planTitle: u.planTitle, eventDate: u.eventDate, status: u.status, ...(manager ? { total: u.total, currency: u.currency } : {}) })),
    })),
  });
});

async function editable(req: AuthRequest, res: any) {
  const s = await prisma.circleSupplier.findUnique({ where: { id: req.params.id } });
  if (!s || !(await member(req.userId!, s.circleId))) { res.status(404).json({ error: 'Fournisseur introuvable' }); return null; }
  if (s.createdById !== req.userId && !(await isCircleManager(req.userId!, s.circleId))) { res.status(403).json({ error: 'Seuls la personne qui a ajouté ce fournisseur et les organisateurs peuvent le modifier' }); return null; }
  return s;
}

// PUT /:id — modifier la fiche (coordonnées, catégorie, notes)
router.put('/:id', async (req: AuthRequest, res) => {
  const s = await editable(req, res);
  if (!s) return;
  const input = parseSupplierInput(req.body);
  if ('error' in input) { res.status(400).json({ error: input.error }); return; }
  await prisma.circleSupplier.update({ where: { id: s.id }, data: input });
  res.json({ ok: true });
});

// POST /:id/archive {archived} — plus proposé dans les Plans (l'historique reste)
router.post('/:id/archive', async (req: AuthRequest, res) => {
  const s = await editable(req, res);
  if (!s) return;
  await prisma.circleSupplier.update({ where: { id: s.id }, data: { archivedAt: req.body?.archived === false ? null : new Date() } });
  res.json({ ok: true });
});

// DELETE /:id — supprimer la fiche et son historique ; refusé tant qu'un Plan l'utilise
router.delete('/:id', async (req: AuthRequest, res) => {
  const s = await editable(req, res);
  if (!s) return;
  if (await prisma.planSupplier.count({ where: { supplierId: s.id } })) { res.status(409).json({ error: 'Ce fournisseur est encore utilisé dans un Plan : retire-le d’abord du Plan, ou archive-le' }); return; }
  await prisma.circleSupplier.delete({ where: { id: s.id } });
  res.json({ ok: true });
});

export default router;
