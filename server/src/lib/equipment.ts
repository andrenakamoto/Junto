import prisma from './prisma';
import { isCircleManager } from './circleRoles';
import { orgPermissions } from './orgPermissions';
import { notifyUser } from './push';

// Matériel (2026-11-13) : l'inventaire d'une Organisation (commun à tous ses Cercles) ou d'un Cercle simple, en
// quantités ; dans un Plan (fonction « materiel »), des réservations avec une période, puis la sortie (« Je le
// prends ») et le retour (« Rendu », état, nombre manquant). Les réservations survivent au Plan, qui disparaît 24 h
// après sa fin : on sait encore qui a le matériel. L'inventaire se modifie par les gestionnaires (Organisation : droit
// « manage_equipment » ou administration ; Cercle simple : créateur et organisateurs) ; tous les participants du Plan
// réservent, prennent et rendent.

export const EQUIPMENT_FEATURE = 'materiel';
export const EQUIPMENT_CATEGORIES = ['sono', 'lumiere', 'mobilier', 'cuisine', 'tentes', 'sport', 'deco', 'informatique', 'outils', 'autre'] as const;
export const ITEM_STATUSES = ['ok', 'repair', 'out'] as const;
export const RETURN_STATES = ['ok', 'damaged', 'missing'] as const;
export const QUANTITY_MAX = 9999;

const text = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const quantity = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= QUANTITY_MAX ? n : null;
};

// Fiche d'un objet : nom obligatoire à la création, le reste facultatif
export function parseItemInput(raw: any, creating: boolean): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};
  const name = text(raw?.name, 80);
  if (creating && !name) return { error: 'Indique le nom du matériel' };
  if (name) data.name = name;
  if (raw?.category !== undefined) {
    if (!(EQUIPMENT_CATEGORIES as readonly string[]).includes(raw.category)) return { error: 'Catégorie invalide' };
    data.category = raw.category;
  }
  if (raw?.quantity !== undefined || creating) {
    const q = quantity(raw?.quantity ?? 1);
    if (q === null) return { error: `Quantité : de 1 à ${QUANTITY_MAX}` };
    data.quantity = q;
  }
  const location = text(raw?.location, 120);
  if (location !== undefined) data.location = location;
  const notes = text(raw?.notes, 500);
  if (notes !== undefined) data.notes = notes;
  if (raw?.status !== undefined) {
    if (!(ITEM_STATUSES as readonly string[]).includes(raw.status)) return { error: 'État invalide' };
    data.status = raw.status;
  }
  return { data };
}

export const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

// Quantité libre sur une période : quantité de l'objet moins les réservations qui la chevauchent et ne sont pas
// encore rendues (une réservation rendue libère le matériel). Un objet en réparation ou hors service n'est pas libre.
export function availableFor(
  item: { quantity: number; status: string },
  bookings: { id: string; quantity: number; startsAt: Date; endsAt: Date; returnedAt: Date | null }[],
  period: { startsAt: Date; endsAt: Date },
  exceptBookingId?: string,
): number {
  if (item.status !== 'ok') return 0;
  const used = bookings
    .filter(b => b.id !== exceptBookingId && !b.returnedAt && overlaps(b, period))
    .reduce((n, b) => n + b.quantity, 0);
  return Math.max(0, item.quantity - used);
}

// Où est l'objet ? Sorti (pris, pas rendu) : chez qui ; sinon au lieu de rangement. Prochaines réservations.
export function whereNow<B extends { takenAt: Date | null; returnedAt: Date | null; startsAt: Date; endsAt: Date }>(bookings: B[], now = new Date()) {
  const out = bookings.filter(b => b.takenAt && !b.returnedAt);
  const upcoming = bookings.filter(b => !b.returnedAt && !b.takenAt && b.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const late = out.filter(b => b.endsAt < now);
  return { out, upcoming, late };
}

// Période par défaut d'une réservation : celle du Plan (début, ou 3 h avant la fin s'il n'a pas de début)
export function planPeriod(plan: { eventDate: Date | null; endDate: Date }) {
  return { startsAt: plan.eventDate ?? new Date(plan.endDate.getTime() - 3 * 3600_000), endsAt: plan.endDate };
}

// Inventaire d'un Cercle : celui de son Organisation, sinon le sien
export async function inventoryScope(circleId: string): Promise<{ organisationId: string } | { circleId: string } | null> {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { organisationId: true, isPersonal: true } });
  if (!circle || circle.isPersonal) return null;
  return circle.organisationId ? { organisationId: circle.organisationId } : { circleId };
}

// Qui modifie l'inventaire ? Organisation : administration ou droit « manage_equipment » ; Cercle : créateur et organisateurs
export async function canManageEquipment(userId: string, scope: { organisationId?: string | null; circleId?: string | null }, viaCircleId?: string): Promise<boolean> {
  if (scope.organisationId) {
    const m = await prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId: scope.organisationId, userId } }, select: { isAdmin: true } });
    if (!m) return false;
    if (m.isAdmin) return true;
    return (await orgPermissions(userId, scope.organisationId, viaCircleId)).has('manage_equipment');
  }
  return !!scope.circleId && isCircleManager(userId, scope.circleId);
}

// Peut voir l'inventaire : membre d'un Cercle de l'Organisation, ou du Cercle
export async function canViewInventory(userId: string, scope: { organisationId?: string | null; circleId?: string | null }): Promise<boolean> {
  if (scope.organisationId) return !!(await prisma.circleMember.findFirst({ where: { userId, circle: { organisationId: scope.organisationId } }, select: { userId: true } }));
  return !!scope.circleId && !!(await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId: scope.circleId } }, select: { userId: true } }));
}

// Rappel le lendemain de la fin du Plan (dès 12 h après) à la personne qui a pris le matériel et ne l'a pas rendu.
// Notification « plan_activity » vers la rubrique Matériel (connue des apps installées) ; Plan supprimé : le Cercle.
export async function sendEquipmentReminders(io: any, now = new Date()) {
  try {
    const due = await prisma.equipmentBooking.findMany({
      where: { takenById: { not: null }, returnedAt: null, reminderSentAt: null, endsAt: { lt: new Date(now.getTime() - 12 * 3600_000) } },
      select: { id: true, takenById: true, planId: true, planTitle: true, circleId: true, quantity: true, item: { select: { name: true } } },
      take: 200,
    });
    for (const b of due) {
      const claimed = await prisma.equipmentBooking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (!claimed.count) continue;
      notifyUser(io, b.takenById!, {
        type: 'plan_activity', ...(b.planId ? { planId: b.planId } : {}), planTitle: b.planTitle, circleId: b.circleId, tab: EQUIPMENT_FEATURE,
        preview: `📦 Pense à rendre « ${b.quantity > 1 ? `${b.quantity} × ` : ''}${b.item.name} »`,
      });
    }
  } catch (e) {
    console.error('[equipment reminders]', e);
  }
}

// Conflits : réservations à venir d'un objet qui, ensemble sur une même période, dépassent sa quantité. Renvoie, pour
// chaque conflit, les réservations concernées et la quantité qui manque (une fois par groupe de réservations).
export function findConflicts<B extends { id: string; quantity: number; startsAt: Date; endsAt: Date; returnedAt: Date | null }>(
  item: { quantity: number; status: string }, bookings: B[], now = new Date(),
): { bookings: B[]; shortBy: number }[] {
  const live = bookings.filter(b => !b.returnedAt && b.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const capacity = item.status === 'ok' ? item.quantity : 0;
  const seen = new Set<string>();
  const out: { bookings: B[]; shortBy: number }[] = [];
  for (const b of live) {
    const group = live.filter(o => overlaps(o, b));
    const used = group.reduce((n, o) => n + o.quantity, 0);
    if (used <= capacity) continue;
    const key = group.map(o => o.id).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bookings: group, shortBy: used - capacity });
  }
  return out;
}
