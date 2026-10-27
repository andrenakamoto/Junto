import prisma from './prisma';
import { isCircleManager } from './circleRoles';
import { notifyUser } from './push';

// Déroulé d'un Plan (fonction à activer « deroule », pour un Plan réservé à l'équipe d'organisation) : les
// moments de l'événement dans l'ordre (accueil, discours, repas…). Chaque moment a une durée et commence à la fin
// du précédent — le premier au début du Plan —, sauf s'il a une heure fixe : changer une durée décale toute la
// suite. Le soir même : moment en cours et suivant mis en évidence, « +15 min » quand on prend du retard, rappel
// aux responsables 10 minutes avant leur moment. Feuille de route PDF (lib/programPdf.ts).

export const PROGRAM_FEATURE = 'deroule';
export const PROGRAM_TITLE_MAX = 120;
export const PROGRAM_TEXT_MAX = 1000;
export const PROGRAM_PLACE_MAX = 100;
export const PROGRAM_MAX_ITEMS = 100;
export const DURATION_MAX = 24 * 60;
export const PROGRAM_DISABLED_ERROR = 'Le déroulé n’est pas activé pour ce Plan';
export const PROGRAM_REMINDER_MS = 10 * 60 * 1000;

export function programEnabled(plan: { enabledFeatures: string[] }): boolean {
  return plan.enabledFeatures.includes(PROGRAM_FEATURE);
}

export async function canManageProgram(userId: string, plan: { creatorId: string; circleId: string }): Promise<boolean> {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

export interface ProgramInput {
  title: string;
  durationMin: number;
  fixedStart: Date | null;
  place: string | null;
  tech: string | null;
  note: string | null;
  assigneeIds: string[];
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseProgramInput(body: any): ProgramInput | { error: string } {
  const title = text(body?.title) ?? '';
  if (!title) return { error: 'Nom du moment requis' };
  if (title.length > PROGRAM_TITLE_MAX) return { error: `Nom du moment : ${PROGRAM_TITLE_MAX} caractères maximum` };
  const durationMin = Number(body?.durationMin ?? 30);
  if (!Number.isInteger(durationMin) || durationMin < 0 || durationMin > DURATION_MAX) return { error: 'Durée invalide' };
  let fixedStart: Date | null = null;
  if (body?.fixedStart !== undefined && body?.fixedStart !== null && body?.fixedStart !== '') {
    if (typeof body.fixedStart !== 'string' || isNaN(new Date(body.fixedStart).getTime())) return { error: 'Heure invalide' };
    fixedStart = new Date(body.fixedStart);
  }
  const place = text(body?.place);
  if (place && place.length > PROGRAM_PLACE_MAX) return { error: `Lieu : ${PROGRAM_PLACE_MAX} caractères maximum` };
  const tech = text(body?.tech);
  const note = text(body?.note);
  if ((tech?.length ?? 0) > PROGRAM_TEXT_MAX || (note?.length ?? 0) > PROGRAM_TEXT_MAX) return { error: `Détails : ${PROGRAM_TEXT_MAX} caractères maximum` };
  const ids = body?.assigneeIds ?? [];
  if (!Array.isArray(ids) || ids.length > 10 || ids.some((x: unknown) => typeof x !== 'string')) return { error: 'Responsables : 10 au plus' };
  return { title, durationMin, fixedStart, place, tech, note, assigneeIds: [...new Set(ids as string[])] };
}

export interface Timed { start: Date | null; end: Date | null }

// Heures de chaque moment : heure fixe, sinon fin du moment précédent (le premier : début du Plan)
export function scheduleItems<T extends { durationMin: number; fixedStart: Date | null }>(items: T[], planStart: Date | null): (T & Timed)[] {
  let cursor = planStart;
  return items.map(item => {
    const start = item.fixedStart ?? cursor;
    const end = start ? new Date(start.getTime() + item.durationMin * 60000) : null;
    cursor = end;
    return { ...item, start, end };
  });
}

// « +15 min » : `extend` prolonge le moment (en cours) ; `shift` le fait commencer plus tard, avec la suite.
// Renvoie les changements à appliquer (durée d'un moment, heure fixe d'un autre).
export function delayChanges<T extends { id: string; durationMin: number; fixedStart: Date | null }>(
  items: T[], itemId: string, minutes: number, mode: 'extend' | 'shift', planStart: Date | null,
): { id: string; durationMin?: number; fixedStart?: Date }[] | null {
  const i = items.findIndex(x => x.id === itemId);
  if (i < 0) return null;
  const item = items[i];
  if (mode === 'extend') return [{ id: item.id, durationMin: Math.min(DURATION_MAX, Math.max(0, item.durationMin + minutes)) }];
  if (item.fixedStart) return [{ id: item.id, fixedStart: new Date(item.fixedStart.getTime() + minutes * 60000) }];
  if (i > 0) return [{ id: items[i - 1].id, durationMin: Math.min(DURATION_MAX, Math.max(0, items[i - 1].durationMin + minutes)) }];
  // Premier moment sans heure fixe : il prend le début du Plan décalé
  return planStart ? [{ id: item.id, fixedStart: new Date(planStart.getTime() + minutes * 60000) }] : null;
}

// Déplacer d'un cran : nouvel ordre des identifiants
export function moveItem(ids: string[], itemId: string, dir: 'up' | 'down'): string[] {
  const i = ids.indexOf(itemId);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// Rappel : moment qui commence dans les 10 prochaines minutes, pas encore rappelé pour cette heure-là
export function reminderDueFor(item: Timed & { remindedStart: Date | null }, now: number): boolean {
  if (!item.start) return false;
  const t = item.start.getTime();
  return t > now && t - now <= PROGRAM_REMINDER_MS && item.remindedStart?.getTime() !== t;
}

export function reminderText(title: string, start: Date, now = Date.now()): string {
  const time = new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(start);
  const mins = Math.max(1, Math.round((start.getTime() - now) / 60000));
  return `🎬 « ${title} » commence à ${time.replace(':', 'h')}, dans ${mins} minutes`;
}

export async function orderedItems(planId: string) {
  return prisma.planProgramItem.findMany({
    where: { planId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { assignees: { include: { user: { select: { id: true, pseudo: true, firstName: true } } } } },
  });
}

// « Je passe », exclusion, départ du Cercle : la personne n'est plus responsable des moments du Plan
export async function removeFromProgram(planId: string, userId: string) {
  await prisma.planProgramAssignee.deleteMany({ where: { planId, userId } });
}

export async function removeFromProgramInCircle(circleId: string, userId: string) {
  await prisma.planProgramAssignee.deleteMany({ where: { userId, item: { plan: { circleId } } } });
}

// Toutes les 5 minutes (tâches régulières) : Plans du jour avec un déroulé
export async function sendProgramReminders(io: any) {
  try {
    const now = Date.now();
    const plans = await prisma.plan.findMany({
      where: { archived: false, enabledFeatures: { has: PROGRAM_FEATURE }, eventDate: { gt: new Date(now - 2 * 864e5), lt: new Date(now + 864e5) }, programItems: { some: {} } },
      select: { id: true, title: true, circleId: true, eventDate: true },
    });
    for (const plan of plans) {
      const items = scheduleItems(await orderedItems(plan.id), plan.eventDate);
      for (const item of items) {
        if (!reminderDueFor(item, now) || item.assignees.length === 0) continue;
        // Réservation : un seul envoi par heure de début, même si deux serveurs tournent
        const claimed = await prisma.planProgramItem.updateMany({ where: { id: item.id, remindedStart: item.remindedStart }, data: { remindedStart: item.start } });
        if (!claimed.count) continue;
        for (const a of item.assignees) {
          notifyUser(io, a.userId, { type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: PROGRAM_FEATURE, preview: reminderText(item.title, item.start!, now) });
        }
      }
    }
  } catch (e) {
    console.error('[program reminders]', e);
  }
}
