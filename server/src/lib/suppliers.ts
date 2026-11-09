import fs from 'fs/promises';
import { orgPlanAllows } from './orgPermissions';
import path from 'path';
import prisma from './prisma';
import { isCircleManager } from './circleRoles';
import { notifyUser } from './push';
import { STORAGE_DIR } from './storage';
import { daysUntil, parseDueDate, zurichDay } from './tasks';

// Fournisseurs d'un Plan (fonction à activer « fournisseurs », catégorie « Préparer en équipe », 2026-11-06) :
// - le carnet du Cercle (CircleSupplier) garde les coordonnées d'un fournisseur d'un événement à l'autre ;
// - dans chaque Plan, un engagement (PlanSupplier) suit l'étape (à contacter → devis demandé → devis reçu → confirmé →
//   payé, choisie directement sur une frise, en avant comme en arrière), « mis de côté » (garde son étape), le responsable,
//   le lot, les notes et les commentaires ; `history` raconte les changements dans l'ordre ;
// - montants et documents (devis, contrat, facture) : créateur du Plan et organisateurs du Cercle seulement. Le serveur ne
//   les envoie jamais aux autres (maskEntry) ; « Payé » est aussi réservé aux organisateurs.
// - SupplierUse garde l'historique (« Déjà utilisé pour… ») après la suppression du Plan.

export const SUPPLIERS_FEATURE = 'fournisseurs';
export const SUPPLIERS_DISABLED_ERROR = 'Les fournisseurs ne sont pas activés pour ce Plan';

export const SUPPLIER_CATEGORIES = ['repas', 'boissons', 'salle', 'technique', 'location', 'animation', 'impression', 'transport', 'securite', 'autre'] as const;
export type SupplierCategory = typeof SUPPLIER_CATEGORIES[number];

export const SUPPLIER_STATUSES = ['todo', 'quote_requested', 'quote_received', 'confirmed', 'paid'] as const;
export type SupplierStatus = typeof SUPPLIER_STATUSES[number];
// États que seuls les organisateurs peuvent donner (ils touchent à l'argent)
export const MONEY_STATUSES: readonly SupplierStatus[] = ['paid'];

export const SUPPLIER_LIMITS = {
  name: 80, contactName: 80, phone: 30, email: 120, website: 200, address: 200, notes: 1000, entryNotes: 1000, comment: 500,
  perPlan: 60, perCircle: 300, docsPerEntry: 10, docBytes: 10 * 1024 * 1024, docsPerPlanBytes: 30 * 1024 * 1024,
};
export const MAX_AMOUNT = 10_000_000;
export const PAYMENT_REMINDER_DAYS = 3;
export const FOLLOW_UP_DAYS = 7;

export function suppliersEnabled(plan: { enabledFeatures: string[] }): boolean {
  return plan.enabledFeatures.includes(SUPPLIERS_FEATURE);
}

// Organisateurs = créateur du Plan + créateur et organisateurs du Cercle (comme le récapitulatif PDF)
export async function canManageMoney(userId: string, plan: { creatorId: string; circleId: string }): Promise<boolean> {
  if (plan.creatorId === userId) return true;
  const org = await orgPlanAllows(userId, plan.circleId, 'see_money');
  return org ?? isCircleManager(userId, plan.circleId);
}

const text = (v: unknown, max: number, label: string): string | null | { error: string } => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return { error: `${label} invalide` };
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) return { error: `${label} : ${max} caractères maximum` };
  return t;
};

export interface SupplierInput {
  name: string;
  category: SupplierCategory;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
}

// Fiche du carnet (création et modification)
export function parseSupplierInput(body: any): SupplierInput | { error: string } {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Nom du fournisseur requis' };
  if (name.length > SUPPLIER_LIMITS.name) return { error: `Nom du fournisseur : ${SUPPLIER_LIMITS.name} caractères maximum` };
  const category = typeof body?.category === 'string' && (SUPPLIER_CATEGORIES as readonly string[]).includes(body.category) ? body.category as SupplierCategory : null;
  if (!category) return { error: 'Catégorie invalide' };
  const fields: Record<string, string | null> = {};
  for (const [key, label] of [['contactName', 'Personne de contact'], ['phone', 'Téléphone'], ['email', 'Email'], ['website', 'Site web'], ['address', 'Adresse'], ['notes', 'Notes']] as const) {
    const v = text(body?.[key], SUPPLIER_LIMITS[key], label);
    if (v && typeof v === 'object') return v;
    fields[key] = v;
  }
  if (fields.phone && !/^[+()\d\s./-]{3,30}$/.test(fields.phone)) return { error: 'Téléphone invalide' };
  if (fields.email) {
    fields.email = fields.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return { error: 'Email invalide' };
  }
  if (fields.website) {
    const url = /^https?:\/\//i.test(fields.website) ? fields.website : `https://${fields.website}`;
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error();
      fields.website = u.toString();
    } catch { return { error: 'Site web invalide' }; }
  }
  return { name, category, ...(fields as any) };
}

export interface MoneyInput {
  currency: 'CHF' | 'EUR';
  quoteAmount: number | null;
  depositAmount: number | null;
  depositDue: string | null;
  balanceAmount: number | null;
  balanceDue: string | null;
}

const amount = (v: unknown): number | null | undefined => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.').replace(/['\s]/g, '')) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return undefined;
  return Math.round(n * 100) / 100;
};

// Montants et échéances (organisateurs)
export function parseMoneyInput(body: any): MoneyInput | { error: string } {
  const currency = body?.currency === 'EUR' ? 'EUR' : body?.currency === undefined || body?.currency === 'CHF' ? 'CHF' : null;
  if (!currency) return { error: 'Devise invalide' };
  const quoteAmount = amount(body?.quoteAmount);
  const depositAmount = amount(body?.depositAmount);
  const balanceAmount = amount(body?.balanceAmount);
  if (quoteAmount === undefined || depositAmount === undefined || balanceAmount === undefined) return { error: 'Montant invalide' };
  const depositDue = parseDueDate(body?.depositDue);
  const balanceDue = parseDueDate(body?.balanceDue);
  if (depositDue === undefined || balanceDue === undefined) return { error: 'Échéance invalide' };
  return { currency, quoteAmount, depositAmount, depositDue, balanceAmount, balanceDue };
}

export function parseStatus(v: unknown): SupplierStatus | null {
  return typeof v === 'string' && (SUPPLIER_STATUSES as readonly string[]).includes(v) ? v as SupplierStatus : null;
}

export function parseEntryNotes(v: unknown): string | null | { error: string } {
  return text(v, SUPPLIER_LIMITS.entryNotes, 'Notes');
}

export function parseComment(v: unknown): string | { error: string } {
  const content = typeof v === 'string' ? v.trim() : '';
  if (!content) return { error: 'Commentaire vide' };
  if (content.length > SUPPLIER_LIMITS.comment) return { error: `Commentaire : ${SUPPLIER_LIMITS.comment} caractères maximum` };
  return content;
}

// Montant total d'un engagement : le devis, sinon acompte + solde
export function entryTotal(e: { quoteAmount: number | null; depositAmount: number | null; balanceAmount: number | null }): number | null {
  if (e.quoteAmount != null) return e.quoteAmount;
  if (e.depositAmount == null && e.balanceAmount == null) return null;
  return Math.round(((e.depositAmount ?? 0) + (e.balanceAmount ?? 0)) * 100) / 100;
}

// Étapes franchies : date et pseudo de la personne pour chaque état atteint (frise de la carte)
export type Steps = Partial<Record<SupplierStatus, { at: string; by: string }>>;
export function recordStep(steps: unknown, status: SupplierStatus, by: string, at = new Date()): Steps {
  const base: Steps = steps && typeof steps === 'object' && !Array.isArray(steps) ? { ...(steps as Steps) } : {};
  base[status] = { at: at.toISOString(), by };
  return base;
}

const MONEY_FIELDS = ['currency', 'quoteAmount', 'depositAmount', 'depositDue', 'depositPaidAt', 'balanceAmount', 'balanceDue', 'balancePaidAt'] as const;

// Ce que voit une personne qui n'est pas organisatrice : ni montants, ni échéances de paiement, ni documents
export function maskEntry<T extends Record<string, any>>(entry: T, canMoney: boolean): T {
  if (canMoney) return entry;
  const copy: Record<string, any> = { ...entry };
  for (const f of MONEY_FIELDS) delete copy[f];
  delete copy.documents;
  copy.documentCount = Array.isArray(entry.documents) ? entry.documents.length : 0;
  return copy as T;
}

// Historique : un changement d'étape ou une mise de côté / reprise, avec sa date et le pseudo de la personne
export type HistoryItem = { at: string; by: string; from?: SupplierStatus; to?: SupplierStatus; hold?: boolean };
export const HISTORY_MAX = 50;
export function pushHistory(history: unknown, item: Omit<HistoryItem, 'at'>, at = new Date()): HistoryItem[] {
  const list: HistoryItem[] = Array.isArray(history) ? (history as HistoryItem[]) : [];
  return [...list, { at: at.toISOString(), ...item }].slice(-HISTORY_MAX);
}

// État court pour l'historique du carnet (SupplierUse) : l'étape, ou « on_hold » si mis de côté
export const useStatus = (e: { status: string; onHold: boolean }) => (e.onHold ? 'on_hold' : e.status);

export type ReminderKind = 'deposit' | 'balance' | 'followUp';

// Rappels dus aujourd'hui pour un engagement : acompte ou solde à payer dans les 3 jours (pas encore payé), devis
// demandé depuis 7 jours sans réponse. Une échéance passée ne déclenche plus rien.
export function dueReminders(e: {
  status: string; steps: unknown; onHold?: boolean;
  depositAmount: number | null; depositDue: string | null; depositPaidAt: Date | null; depositReminderSentAt: Date | null;
  balanceAmount: number | null; balanceDue: string | null; balancePaidAt: Date | null; balanceReminderSentAt: Date | null;
  followUpSentAt: Date | null;
}, today: string, now = new Date()): ReminderKind[] {
  const out: ReminderKind[] = [];
  if (e.onHold || e.status === 'paid') return out;
  const soon = (due: string | null) => !!due && daysUntil(due, today) >= 0 && daysUntil(due, today) <= PAYMENT_REMINDER_DAYS;
  if (e.depositAmount != null && !e.depositPaidAt && !e.depositReminderSentAt && soon(e.depositDue)) out.push('deposit');
  if (e.balanceAmount != null && !e.balancePaidAt && !e.balanceReminderSentAt && soon(e.balanceDue)) out.push('balance');
  const asked = (e.steps as Steps | null)?.quote_requested?.at;
  if (e.status === 'quote_requested' && !e.followUpSentAt && asked && now.getTime() - Date.parse(asked) >= FOLLOW_UP_DAYS * 864e5) out.push('followUp');
  return out;
}

// Notification ciblée : « plan_activity » (connu de toutes les apps installées) qui ouvre la rubrique Fournisseurs
export function notifySupplier(io: any, userId: string, plan: { id: string; title: string; circleId: string }, preview: string, actor?: { id: string; pseudo: string }) {
  if (actor && userId === actor.id) return;
  notifyUser(io, userId, {
    type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: SUPPLIERS_FEATURE, preview,
    ...(actor ? { from: actor.pseudo, actorId: actor.id } : {}),
  });
}

// Organisateurs du Plan (créateur du Plan + gestionnaires du Cercle) : destinataires des rappels de paiement
export async function moneyPeople(plan: { creatorId: string; circleId: string }): Promise<string[]> {
  const circle = await prisma.circle.findUnique({ where: { id: plan.circleId }, select: { creatorId: true, members: { where: { role: 'organizer' }, select: { userId: true } } } });
  return [...new Set([plan.creatorId, ...(circle ? [circle.creatorId, ...circle.members.map(m => m.userId)] : [])])];
}

// Historique « Déjà utilisé pour… » tenu à jour à chaque changement d'un engagement
export async function syncUse(entryId: string) {
  const e = await prisma.planSupplier.findUnique({ where: { id: entryId }, include: { plan: { select: { id: true, title: true, eventDate: true } } } });
  if (!e) return;
  const data = { supplierId: e.supplierId, planId: e.planId, planTitle: e.plan.title, eventDate: e.plan.eventDate, status: useStatus(e), total: entryTotal(e), currency: e.currency };
  await prisma.supplierUse.upsert({ where: { entryId }, create: { entryId, ...data }, update: data });
}

// Documents : STORAGE_DIR/suppliers/<planId>/<clé>. Effacés avec le Plan (purgePlanFiles) ou un par un.
export const supplierDir = (planId: string) => path.join(STORAGE_DIR, 'suppliers', planId.replace(/[^a-z0-9]/gi, ''));
export function supplierFile(fileKey: string): string {
  const p = path.resolve(STORAGE_DIR, 'suppliers', fileKey);
  if (!p.startsWith(path.join(STORAGE_DIR, 'suppliers') + path.sep)) throw new Error('Chemin de fichier invalide');
  return p;
}
export async function removeSupplierFiles(planIds: string[]) {
  for (const id of planIds) await fs.rm(supplierDir(id), { recursive: true, force: true }).catch(() => {});
}

// Rappels de paiement et de relance, vérifiés toutes les heures (tâches régulières), envoyés à partir de 9 h
export async function sendSupplierReminders(io: any) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (hour < 9) return;
    const today = zurichDay();
    const entries = await prisma.planSupplier.findMany({
      where: { status: { not: 'paid' }, onHold: false, plan: { archived: false, enabledFeatures: { has: SUPPLIERS_FEATURE } } },
      include: { supplier: { select: { name: true } }, plan: { select: { id: true, title: true, circleId: true, creatorId: true } } },
    });
    for (const e of entries) {
      for (const kind of dueReminders(e, today)) {
        const field = kind === 'deposit' ? 'depositReminderSentAt' : kind === 'balance' ? 'balanceReminderSentAt' : 'followUpSentAt';
        const claimed = await prisma.planSupplier.updateMany({ where: { id: e.id, [field]: null }, data: { [field]: new Date() } });
        if (!claimed.count) continue;
        if (kind === 'followUp') {
          const to = e.responsibleId ?? e.createdById ?? e.plan.creatorId;
          notifySupplier(io, to, e.plan, `📨 Pas encore de devis de « ${e.supplier.name} » : le relancer ?`);
          continue;
        }
        const due = kind === 'deposit' ? e.depositDue! : e.balanceDue!;
        const days = daysUntil(due, today);
        const what = kind === 'deposit' ? 'Acompte' : 'Solde';
        const preview = days === 0 ? `💶 ${what} de « ${e.supplier.name} » à payer aujourd’hui`
          : days === 1 ? `💶 ${what} de « ${e.supplier.name} » à payer demain`
          : `💶 ${what} de « ${e.supplier.name} » à payer d’ici ${days} jours`;
        const to = new Set([...(e.responsibleId ? [e.responsibleId] : []), ...(await moneyPeople(e.plan))]);
        for (const userId of to) {
          // Le responsable qui n'est pas organisateur ne voit pas les montants : le rappel ne cite pas de somme
          notifySupplier(io, userId, e.plan, preview);
        }
      }
    }
  } catch (err) {
    console.error('[supplier reminders]', err);
  }
}
