import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { isCircleManager } from '../lib/circleRoles';
import {
  EQUIPMENT_FEATURE, RETURN_STATES, availableFor, canManageEquipment, canViewInventory, inventoryScope, parseItemInput, planPeriod, whereNow,
} from '../lib/equipment';

// Matériel (lib/equipment.ts). Deux routeurs :
// - planEquipmentRoutes, monté dans le routeur des Plans : réservations d'un Plan (/:id/equipment, /equipment/:bookingId)
// - equipmentRoutes, sur /api/equipment : inventaire, sortie et retour — hors du routeur des Plans, car on rend le
//   matériel après l'événement, quand le Plan est en lecture seule ou déjà supprimé.

const userSelect = { select: { id: true, pseudo: true, firstName: true } };
const bookingInclude = { item: { select: { id: true, name: true, category: true, location: true } }, takenBy: userSelect };

const toDate = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Participant du Plan (réponse « in » ou « peut-être »), créateur du Plan ou gestionnaire du Cercle
async function canWorkOnPlan(userId: string, plan: { id: string; creatorId: string; circleId: string }) {
  if (plan.creatorId === userId) return true;
  const m = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId: plan.id } }, select: { rsvp: true } });
  if (m && m.rsvp !== 'out') return true;
  return isCircleManager(userId, plan.circleId);
}

function emitPlan(req: AuthRequest, planId: string | null) {
  if (planId) req.app.get('io')?.to(`plan:${planId}`).emit('plan-updated', { planId, section: 'materiel' });
}

const shape = (b: any, now = new Date()) => ({
  id: b.id, itemId: b.itemId, item: b.item, quantity: b.quantity, startsAt: b.startsAt, endsAt: b.endsAt,
  planId: b.planId, planTitle: b.planTitle, circleId: b.circleId, createdById: b.createdById,
  takenBy: b.takenBy ? { id: b.takenBy.id, pseudo: b.takenBy.pseudo, firstName: b.takenBy.firstName } : null,
  takenAt: b.takenAt, returnedAt: b.returnedAt, returnState: b.returnState, missing: b.missing, returnNote: b.returnNote,
  late: !!b.takenAt && !b.returnedAt && b.endsAt < now,
});

// ───────────── Dans un Plan ─────────────
export const planEquipmentRoutes = Router();

// GET /:id/equipment — réservations du Plan et inventaire avec la quantité libre sur la période du Plan
planEquipmentRoutes.get('/:id/equipment', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, circleId: true, creatorId: true, eventDate: true, endDate: true } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const scope = await inventoryScope(plan.circleId);
  // Disponibilités calculées sur la période demandée (?from=&to=, dates de prise et de retour), sinon celle du Plan
  const asked = { startsAt: toDate(req.query.from), endsAt: toDate(req.query.to) };
  const period = asked.startsAt && asked.endsAt && asked.endsAt > asked.startsAt ? { startsAt: asked.startsAt, endsAt: asked.endsAt } : planPeriod(plan);
  const [bookings, items] = await Promise.all([
    prisma.equipmentBooking.findMany({ where: { planId: plan.id }, include: bookingInclude, orderBy: { createdAt: 'asc' } }),
    scope ? prisma.equipmentItem.findMany({
      where: { ...scope, archivedAt: null }, orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { bookings: { where: { returnedAt: null }, select: { id: true, quantity: true, startsAt: true, endsAt: true, returnedAt: true, planTitle: true, planId: true } } },
    }) : [],
  ]);
  res.json({
    period,
    hasInventory: !!scope,
    canManageInventory: scope ? await canManageEquipment(req.userId!, scope, plan.circleId) : false,
    canBook: await canWorkOnPlan(req.userId!, plan),
    canManagePlan: plan.creatorId === req.userId || await isCircleManager(req.userId!, plan.circleId),
    bookings: bookings.map(b => shape(b)),
    inventory: items.map(i => ({
      id: i.id, name: i.name, category: i.category, quantity: i.quantity, location: i.location, status: i.status,
      available: availableFor(i, i.bookings, period),
      // Autres Plans qui l'utilisent sur la même période (conflits)
      busyIn: i.bookings.filter(b => b.planId !== plan.id && b.startsAt < period.endsAt && period.startsAt < b.endsAt).map(b => ({ planTitle: b.planTitle, quantity: b.quantity })),
    })),
  });
});

// POST /:id/equipment { itemId, quantity, startsAt?, endsAt? } — réserver (un conflit est signalé, pas bloqué)
planEquipmentRoutes.post('/:id/equipment', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, eventDate: true, endDate: true, enabledFeatures: true } });
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!plan.enabledFeatures.includes(EQUIPMENT_FEATURE)) { res.status(400).json({ error: 'La rubrique Matériel n’est pas activée pour ce Plan' }); return; }
  if (!(await canWorkOnPlan(req.userId!, plan))) { res.status(403).json({ error: 'Réponds d’abord « Je suis in » ou « Peut-être »' }); return; }
  if (typeof req.body?.itemId !== 'string') { res.status(400).json({ error: 'Matériel introuvable' }); return; }
  const scope = await inventoryScope(plan.circleId);
  const item = scope && await prisma.equipmentItem.findFirst({ where: { id: req.body.itemId, ...scope, archivedAt: null }, include: { bookings: { where: { returnedAt: null } } } });
  if (!item) { res.status(404).json({ error: 'Matériel introuvable' }); return; }
  if (item.status !== 'ok') { res.status(400).json({ error: 'Ce matériel est en réparation ou hors service' }); return; }
  const quantity = Number(req.body.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) { res.status(400).json({ error: `Quantité : de 1 à ${item.quantity}` }); return; }
  const def = planPeriod(plan);
  const startsAt = toDate(req.body.startsAt) ?? def.startsAt;
  const endsAt = toDate(req.body.endsAt) ?? def.endsAt;
  if (endsAt <= startsAt) { res.status(400).json({ error: 'Le retour doit venir après la prise' }); return; }
  const available = availableFor(item, item.bookings, { startsAt, endsAt });
  const booking = await prisma.equipmentBooking.create({
    data: { itemId: item.id, planId: plan.id, planTitle: plan.title, circleId: plan.circleId, quantity, startsAt, endsAt, createdById: req.userId! },
    include: bookingInclude,
  });
  res.json({ booking: shape(booking), shortBy: Math.max(0, quantity - available) });
});

// POST /:id/equipment/batch { startsAt, endsAt, items: [{ itemId, quantity, startsAt?, endsAt? }] } — réserver plusieurs objets d'un coup :
// les dates de prise et de retour valent pour tous, chaque objet peut avoir les siennes (2026-11-14)
planEquipmentRoutes.post('/:id/equipment/batch', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, eventDate: true, endDate: true, enabledFeatures: true } });
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!plan.enabledFeatures.includes(EQUIPMENT_FEATURE)) { res.status(400).json({ error: 'La rubrique Matériel n’est pas activée pour ce Plan' }); return; }
  if (!(await canWorkOnPlan(req.userId!, plan))) { res.status(403).json({ error: 'Réponds d’abord « Je suis in » ou « Peut-être »' }); return; }
  const list = Array.isArray(req.body?.items) ? req.body.items : [];
  if (list.length < 1 || list.length > 50) { res.status(400).json({ error: 'Choisis au moins un objet' }); return; }
  const def = planPeriod(plan);
  const start0 = req.body.startsAt === undefined ? def.startsAt : toDate(req.body.startsAt);
  const end0 = req.body.endsAt === undefined ? def.endsAt : toDate(req.body.endsAt);
  if (!start0 || !end0 || end0 <= start0) { res.status(400).json({ error: 'Le retour doit venir après la prise' }); return; }
  const scope = await inventoryScope(plan.circleId);
  if (!scope) { res.status(404).json({ error: 'Matériel introuvable' }); return; }
  const ids = list.map((x: any) => x?.itemId).filter((x: unknown): x is string => typeof x === 'string');
  const items = await prisma.equipmentItem.findMany({ where: { id: { in: ids }, ...scope, archivedAt: null }, include: { bookings: { where: { returnedAt: null } } } });
  const rows: { item: (typeof items)[number]; quantity: number; startsAt: Date; endsAt: Date }[] = [];
  for (const x of list) {
    const item = items.find(i => i.id === x?.itemId);
    if (!item) { res.status(404).json({ error: 'Matériel introuvable' }); return; }
    if (item.status !== 'ok') { res.status(400).json({ error: 'Ce matériel est en réparation ou hors service' }); return; }
    const quantity = Number(x.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) { res.status(400).json({ error: `Quantité : de 1 à ${item.quantity}` }); return; }
    const startsAt = x.startsAt === undefined || x.startsAt === null ? start0 : toDate(x.startsAt);
    const endsAt = x.endsAt === undefined || x.endsAt === null ? end0 : toDate(x.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt) { res.status(400).json({ error: 'Le retour doit venir après la prise' }); return; }
    rows.push({ item, quantity, startsAt, endsAt });
  }
  const created = await prisma.$transaction(rows.map(r => prisma.equipmentBooking.create({
    data: { itemId: r.item.id, planId: plan.id, planTitle: plan.title, circleId: plan.circleId, quantity: r.quantity, startsAt: r.startsAt, endsAt: r.endsAt, createdById: req.userId! },
    include: bookingInclude,
  })));
  // Manques : calculés avec les autres réservations de la même demande
  const short = rows.map((r, i) => {
    const others = rows.filter((o, j) => j < i && o.item.id === r.item.id).map(o => ({ id: `new-${o.item.id}`, quantity: o.quantity, startsAt: o.startsAt, endsAt: o.endsAt, returnedAt: null }));
    return { name: r.item.name, shortBy: Math.max(0, r.quantity - availableFor(r.item, [...r.item.bookings, ...others], { startsAt: r.startsAt, endsAt: r.endsAt })) };
  }).filter(x => x.shortBy > 0);
  res.json({ bookings: created.map(b => shape(b)), short });
});

async function editableBooking(req: AuthRequest, res: any) {
  const b = await prisma.equipmentBooking.findUnique({ where: { id: req.params.bookingId }, include: { plan: { select: { id: true, creatorId: true, circleId: true } } } });
  if (!b || !b.plan || !(await getPlanAccess(req.userId!, b.plan.id))?.canView) { res.status(404).json({ error: 'Réservation introuvable' }); return null; }
  const ok = b.createdById === req.userId || b.plan.creatorId === req.userId || await isCircleManager(req.userId!, b.plan.circleId)
    || await canManageEquipment(req.userId!, (await inventoryScope(b.plan.circleId)) ?? {}, b.plan.circleId);
  if (!ok) { res.status(403).json({ error: 'Seuls la personne qui l’a réservé et l’organisation peuvent le modifier' }); return null; }
  return b;
}

// PUT /equipment/:bookingId { quantity?, startsAt?, endsAt? }
planEquipmentRoutes.put('/equipment/:bookingId', async (req: AuthRequest, res) => {
  const b = await editableBooking(req, res);
  if (!b) return;
  const item = await prisma.equipmentItem.findUnique({ where: { id: b.itemId }, include: { bookings: { where: { returnedAt: null } } } });
  if (!item) { res.status(404).json({ error: 'Matériel introuvable' }); return; }
  const quantity = req.body?.quantity === undefined ? b.quantity : Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) { res.status(400).json({ error: `Quantité : de 1 à ${item.quantity}` }); return; }
  const startsAt = req.body?.startsAt === undefined ? b.startsAt : toDate(req.body.startsAt);
  const endsAt = req.body?.endsAt === undefined ? b.endsAt : toDate(req.body.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) { res.status(400).json({ error: 'Le retour doit venir après la prise' }); return; }
  const updated = await prisma.equipmentBooking.update({ where: { id: b.id }, data: { quantity, startsAt, endsAt, reminderSentAt: null }, include: bookingInclude });
  const available = availableFor(item, item.bookings, { startsAt, endsAt }, b.id);
  res.json({ booking: shape(updated), shortBy: Math.max(0, quantity - available) });
});

// DELETE /equipment/:bookingId — retirer la réservation (pas pendant qu'il est sorti)
planEquipmentRoutes.delete('/equipment/:bookingId', async (req: AuthRequest, res) => {
  const b = await editableBooking(req, res);
  if (!b) return;
  if (b.takenAt && !b.returnedAt) { res.status(409).json({ error: 'Ce matériel est sorti : indique d’abord qu’il est rendu' }); return; }
  await prisma.equipmentBooking.delete({ where: { id: b.id } });
  res.json({ ok: true });
});

// ───────────── Inventaire, sortie et retour (/api/equipment) ─────────────
const router = Router();
router.use(requireAuth as any);

// GET /circle/:circleId — inventaire (celui de l'Organisation du Cercle), où est chaque objet, historique récent
router.get('/circle/:circleId', async (req: AuthRequest, res) => {
  const scope = await inventoryScope(req.params.circleId);
  if (!scope || !(await prisma.circleMember.findUnique({ where: { userId_circleId: { userId: req.userId!, circleId: req.params.circleId } } }))) {
    res.status(404).json({ error: 'Cercle introuvable' }); return;
  }
  const now = new Date();
  const items = await prisma.equipmentItem.findMany({
    where: scope, orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { bookings: { orderBy: { startsAt: 'desc' }, take: 40, include: { takenBy: userSelect } } },
  });
  res.json({
    canManage: await canManageEquipment(req.userId!, scope, req.params.circleId),
    scope: 'organisationId' in scope ? 'organisation' : 'circle',
    items: items.map(i => {
      const w = whereNow(i.bookings, now);
      return {
        id: i.id, name: i.name, category: i.category, quantity: i.quantity, location: i.location, notes: i.notes, status: i.status,
        archived: !!i.archivedAt,
        out: w.out.map(b => shape(b, now)),
        upcoming: w.upcoming.slice(0, 5).map(b => shape(b, now)),
        history: i.bookings.filter(b => b.returnedAt).slice(0, 8).map(b => shape(b, now)),
      };
    }),
  });
});

async function itemScopeCircle(itemId: string) {
  return prisma.equipmentItem.findUnique({ where: { id: itemId } });
}

// POST /circle/:circleId/items — ajouter un objet à l'inventaire (gestionnaires)
router.post('/circle/:circleId/items', async (req: AuthRequest, res) => {
  const scope = await inventoryScope(req.params.circleId);
  if (!scope || !(await canManageEquipment(req.userId!, scope, req.params.circleId))) { res.status(403).json({ error: 'Seule l’organisation peut modifier l’inventaire' }); return; }
  const parsed = parseItemInput(req.body, true);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const item = await prisma.equipmentItem.create({ data: { ...(parsed.data as any), ...scope, createdById: req.userId! } });
  res.json(item);
});

async function manageableItem(req: AuthRequest, res: any) {
  const item = await itemScopeCircle(req.params.id);
  if (!item) { res.status(404).json({ error: 'Matériel introuvable' }); return null; }
  const scope = { organisationId: item.organisationId, circleId: item.circleId };
  if (!(await canViewInventory(req.userId!, scope))) { res.status(404).json({ error: 'Matériel introuvable' }); return null; }
  if (!(await canManageEquipment(req.userId!, scope, typeof req.body?.circleId === 'string' ? req.body.circleId : undefined))) { res.status(403).json({ error: 'Seule l’organisation peut modifier l’inventaire' }); return null; }
  return item;
}

// PUT /items/:id — modifier (nom, catégorie, quantité, rangement, notes, état), archiver / réactiver ({ archived })
router.put('/items/:id', async (req: AuthRequest, res) => {
  const item = await manageableItem(req, res);
  if (!item) return;
  const parsed = parseItemInput(req.body, false);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const data: any = { ...parsed.data };
  if (typeof req.body?.archived === 'boolean') data.archivedAt = req.body.archived ? new Date() : null;
  res.json(await prisma.equipmentItem.update({ where: { id: item.id }, data }));
});

// DELETE /items/:id — supprimer s'il n'a jamais servi, sinon archiver (l'historique reste)
router.delete('/items/:id', async (req: AuthRequest, res) => {
  const item = await manageableItem(req, res);
  if (!item) return;
  const used = await prisma.equipmentBooking.count({ where: { itemId: item.id } });
  if (used) await prisma.equipmentItem.update({ where: { id: item.id }, data: { archivedAt: new Date() } });
  else await prisma.equipmentItem.delete({ where: { id: item.id } });
  res.json({ ok: true, archived: used > 0 });
});

// Sortie et retour : participants du Plan, la personne qui l'a pris, ou l'organisation (aussi après la fin du Plan)
async function workableBooking(req: AuthRequest, res: any) {
  const b = await prisma.equipmentBooking.findUnique({ where: { id: req.params.id }, include: { item: true, plan: { select: { id: true, creatorId: true, circleId: true } } } });
  if (!b) { res.status(404).json({ error: 'Réservation introuvable' }); return null; }
  const scope = { organisationId: b.item.organisationId, circleId: b.item.circleId };
  const ok = b.takenById === req.userId
    || (b.plan && (await getPlanAccess(req.userId!, b.plan.id))?.canView && await canWorkOnPlan(req.userId!, b.plan))
    || await canManageEquipment(req.userId!, scope, b.circleId)
    || await isCircleManager(req.userId!, b.circleId);
  if (!ok) { res.status(403).json({ error: 'Réservé aux participants du Plan et à l’organisation' }); return null; }
  return b;
}

// POST /bookings/:id/take — « Je le prends »
router.post('/bookings/:id/take', async (req: AuthRequest, res) => {
  const b = await workableBooking(req, res);
  if (!b) return;
  if (b.returnedAt) { res.status(409).json({ error: 'Ce matériel a déjà été rendu' }); return; }
  const updated = await prisma.equipmentBooking.update({ where: { id: b.id }, data: { takenById: req.userId!, takenAt: new Date(), reminderSentAt: null }, include: bookingInclude });
  emitPlan(req, b.planId);
  res.json(shape(updated));
});

// POST /bookings/:id/return { state: ok|damaged|missing, missing?, note? } — « Rendu ». Manquant : la quantité de
// l'inventaire baisse d'autant ; abîmé : l'objet passe « en réparation » (l'organisation le remet en état ensuite).
router.post('/bookings/:id/return', async (req: AuthRequest, res) => {
  const b = await workableBooking(req, res);
  if (!b) return;
  if (b.returnedAt) { res.status(409).json({ error: 'Ce matériel a déjà été rendu' }); return; }
  const state = typeof req.body?.state === 'string' && (RETURN_STATES as readonly string[]).includes(req.body.state) ? req.body.state : 'ok';
  const missing = state === 'missing' ? Math.min(b.quantity, Math.max(1, Number(req.body?.missing) || 1)) : 0;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) || null : null;
  const [updated] = await prisma.$transaction([
    prisma.equipmentBooking.update({
      where: { id: b.id },
      data: { returnedAt: new Date(), returnState: state, missing, returnNote: note, ...(b.takenById ? {} : { takenById: req.userId!, takenAt: new Date() }) },
      include: bookingInclude,
    }),
    ...(missing > 0 ? [prisma.equipmentItem.update({ where: { id: b.itemId }, data: { quantity: Math.max(0, b.item.quantity - missing) } })] : []),
    ...(state === 'damaged' ? [prisma.equipmentItem.update({ where: { id: b.itemId }, data: { status: 'repair' } })] : []),
  ]);
  emitPlan(req, b.planId);
  res.json(shape(updated));
});

// POST /bookings/:id/undo-return — annuler un retour enregistré par erreur (organisation, ou la personne qui l'avait)
router.post('/bookings/:id/undo-return', async (req: AuthRequest, res) => {
  const b = await workableBooking(req, res);
  if (!b) return;
  if (!b.returnedAt) { res.status(409).json({ error: 'Ce matériel n’est pas indiqué comme rendu' }); return; }
  await prisma.$transaction([
    prisma.equipmentBooking.update({ where: { id: b.id }, data: { returnedAt: null, returnState: null, missing: 0, returnNote: null } }),
    ...(b.missing > 0 ? [prisma.equipmentItem.update({ where: { id: b.itemId }, data: { quantity: b.item.quantity + b.missing } })] : []),
  ]);
  emitPlan(req, b.planId);
  res.json({ ok: true });
});

export default router;
