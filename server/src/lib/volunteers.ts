import prisma from './prisma';
import { isCircleManager } from './circleRoles';

// Planning des bénévoles : fonction à activer dans les paramètres avancés du Plan
// (Plan.enabledFeatures contient « benevoles »). Le créateur du Plan et les gestionnaires
// du Cercle (créateur, organisateurs) créent les postes ; chacun s'inscrit, ce qui vaut
// « Je suis in ». Répondre « Je passe » retire des postes.

export const SHIFT_TITLE_MAX = 100;
export const SHIFT_NOTE_MAX = 300;
export const SHIFT_NEEDED_MAX = 200;
export const VOLUNTEERS_DISABLED_ERROR = 'Le planning des bénévoles n’est pas activé pour ce Plan';

export function volunteersEnabled(plan: { enabledFeatures: string[] }): boolean {
  return plan.enabledFeatures.includes('benevoles');
}

export async function canManageShifts(userId: string, plan: { creatorId: string; circleId: string }): Promise<boolean> {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

export interface ShiftData {
  title: string;
  needed: number;
  note: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// Validation d'un poste (création et modification)
export function parseShiftInput(body: any): ShiftData | { error: string } {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Nom du poste requis' };
  if (title.length > SHIFT_TITLE_MAX) return { error: `Nom du poste : ${SHIFT_TITLE_MAX} caractères maximum` };
  const needed = Number(body?.needed ?? 1);
  if (!Number.isInteger(needed) || needed < 1 || needed > SHIFT_NEEDED_MAX) {
    return { error: `Nombre de personnes : entre 1 et ${SHIFT_NEEDED_MAX}` };
  }
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (note && note.length > SHIFT_NOTE_MAX) return { error: `Remarque : ${SHIFT_NOTE_MAX} caractères maximum` };
  const startsAt = parseDate(body?.startsAt);
  const endsAt = parseDate(body?.endsAt);
  if (startsAt === undefined || endsAt === undefined) return { error: 'Horaire invalide' };
  if (endsAt && !startsAt) return { error: 'Indique aussi l’heure de début' };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'L’heure de fin doit être après l’heure de début' };
  return { title, needed, note, startsAt, endsAt };
}

// Deux créneaux se chevauchent (un créneau sans fin occupe seulement son heure de début)
export function shiftsOverlap(
  a: { startsAt: Date | null; endsAt: Date | null },
  b: { startsAt: Date | null; endsAt: Date | null },
): boolean {
  if (!a.startsAt || !b.startsAt) return false;
  const aEnd = (a.endsAt ?? a.startsAt).getTime();
  const bEnd = (b.endsAt ?? b.startsAt).getTime();
  const aStart = a.startsAt.getTime();
  const bStart = b.startsAt.getTime();
  if (aStart === aEnd || bStart === bEnd) return aStart <= bEnd && bStart <= aEnd;
  return aStart < bEnd && bStart < aEnd;
}

// Ordre d'affichage : par heure de début (postes sans horaire à la fin), puis création
export function sortShifts<T extends { startsAt: Date | null; createdAt: Date }>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    if (a.startsAt && b.startsAt && a.startsAt.getTime() !== b.startsAt.getTime()) return a.startsAt.getTime() - b.startsAt.getTime();
    if (!!a.startsAt !== !!b.startsAt) return a.startsAt ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function shiftHours(s: { startsAt: Date | null; endsAt: Date | null }): string {
  if (!s.startsAt) return '';
  const fmt = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
  const time = new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
  return s.endsAt ? `${fmt.format(s.startsAt)} – ${time.format(s.endsAt)}` : fmt.format(s.startsAt);
}

// « Je passe », exclusion, départ du Cercle : la personne quitte ses postes
export async function removeUserFromShifts(planId: string | { circleId: string }, userId: string) {
  await prisma.volunteerSignup.deleteMany({
    where: typeof planId === 'string' ? { planId, userId } : { userId, plan: { circleId: planId.circleId } },
  });
}

// Plan récurrent : les postes sont recopiés sur le Plan suivant, décalés comme lui, sans inscrits
export async function copyShifts(fromPlanId: string, toPlanId: string, offsetMs: number) {
  const shifts = await prisma.volunteerShift.findMany({ where: { planId: fromPlanId } });
  if (shifts.length === 0) return;
  const shift = (d: Date | null) => (d ? new Date(d.getTime() + offsetMs) : null);
  await prisma.volunteerShift.createMany({
    data: shifts.map(s => ({
      planId: toPlanId, title: s.title, needed: s.needed, note: s.note,
      startsAt: shift(s.startsAt), endsAt: shift(s.endsAt), createdById: s.createdById,
    })),
  });
}
