import prisma from './prisma';
import { copyShifts } from './volunteers';
import { purgePlanFiles } from './cloudinary';

// Plans récurrents : chaque semaine, toutes les 2 semaines ou chaque mois, jusqu'à une date
// facultative. Il n'y a toujours qu'un seul Plan à venir : quand la date du Plan est passée,
// le job horaire (spawnRecurringPlans) crée le suivant, à la même heure (heure suisse).
// Recopiés : titre, description, lieu, informations importantes, paramètres, exclusions (Plan
// surprise) et « Qui apporte quoi ? » sans les « Je prends ça ». Les réponses repartent à zéro
// (accord explicite) : seul le créateur est inscrit, et les membres reçoivent la notification
// « Nouveau Plan » habituelle. « Annuler cette fois » (POST /plans/:id/skip) crée le suivant puis
// supprime celui-ci ; supprimer un Plan autrement (vote) arrête la série.

export const RECURRENCES = ['weekly', 'biweekly', 'monthly'] as const;
export type Recurrence = typeof RECURRENCES[number];
const TZ = 'Europe/Zurich';
const ENDED = 'ended';

export function parseRecurrence(v: unknown): Recurrence | null | undefined {
  if (v === null || v === '' || v === 'none') return null;
  return typeof v === 'string' && (RECURRENCES as readonly string[]).includes(v) ? v as Recurrence : undefined;
}

// Saisie de la répétition (création ou modification) : il faut une date d'événement
export function parseRecurrenceInput(recurrenceIn: unknown, untilIn: unknown, eventDate: Date | null | undefined):
  { recurrence: Recurrence | null; recurrenceUntil: Date | null } | { error: string } {
  const recurrence = parseRecurrence(recurrenceIn ?? null);
  if (recurrence === undefined) return { error: 'Répétition invalide' };
  if (!recurrence) return { recurrence: null, recurrenceUntil: null };
  if (!eventDate || isNaN(eventDate.getTime())) return { error: 'Un Plan qui se répète a besoin d’une date et d’une heure' };
  let recurrenceUntil: Date | null = null;
  if (untilIn) {
    recurrenceUntil = new Date(String(untilIn));
    if (isNaN(recurrenceUntil.getTime())) return { error: 'Date de fin de la répétition invalide' };
    if (recurrenceUntil <= eventDate) return { error: 'La répétition doit se terminer après la date du Plan' };
  }
  return { recurrence, recurrenceUntil };
}

// Heure locale suisse d'un instant
function zurichParts(ts: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

// Instant correspondant à une heure locale suisse (gère les changements d'heure)
function fromZurich(y: number, m: number, d: number, h: number, mi: number, s: number): Date {
  const wanted = Date.UTC(y, m - 1, d, h, mi, s);
  let ts = wanted;
  for (let i = 0; i < 3; i++) {
    const p = zurichParts(ts);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    if (shown === wanted) break;
    ts += wanted - shown;
  }
  return new Date(ts);
}

// Date suivante, même heure locale. Mensuel : même jour du mois, ou le dernier jour du mois
// s'il n'existe pas (31 janvier → 28 ou 29 février).
export function nextOccurrence(date: Date, recurrence: Recurrence): Date {
  const p = zurichParts(date.getTime());
  if (recurrence === 'monthly') {
    const y = p.m === 12 ? p.y + 1 : p.y;
    const m = p.m === 12 ? 1 : p.m + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return fromZurich(y, m, Math.min(p.d, last), p.h, p.mi, p.s);
  }
  const days = recurrence === 'weekly' ? 7 : 14;
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return fromZurich(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), p.h, p.mi, p.s);
}

type CreatePlan = (app: any, circleId: string, creatorId: string, input: any) => Promise<{ plan: { id: string } } | { error: string }>;

// Crée le Plan suivant de la série (une seule fois par Plan : nextOccurrenceId fait foi).
// Renvoie l'id du nouveau Plan, ou null si la série s'arrête là.
export async function createNextOccurrence(app: any, planId: string, createPlanInCircle: CreatePlan): Promise<string | null> {
  // Réservation atomique : le job horaire et « Annuler cette fois » ne créent jamais deux suivants
  const claimed = await prisma.plan.updateMany({ where: { id: planId, nextOccurrenceId: null, recurrence: { not: null } }, data: { nextOccurrenceId: 'pending' } });
  if (claimed.count === 0) return null;
  const end = async () => { await prisma.plan.update({ where: { id: planId }, data: { nextOccurrenceId: ENDED, recurrence: null } }); return null; };
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { items: true, exclusions: true } });
  if (!plan?.recurrence || !plan.eventDate) return end();
  const recurrence = parseRecurrence(plan.recurrence);
  if (!recurrence) return end();
  // Durée conservée ; dates déjà passées sautées (serveur arrêté longtemps, par exemple)
  const duration = plan.endDate.getTime() - plan.eventDate.getTime();
  let eventDate = nextOccurrence(plan.eventDate, recurrence);
  while (eventDate.getTime() + duration <= Date.now()) eventDate = nextOccurrence(eventDate, recurrence);
  if (plan.recurrenceUntil && eventDate > plan.recurrenceUntil) return end();
  // Le créateur a quitté le Cercle : la série s'arrête
  const stillMember = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId: plan.creatorId, circleId: plan.circleId } } });
  if (!stillMember) return end();
  const endDate = new Date(eventDate.getTime() + duration);
  const result = await createPlanInCircle(app, plan.circleId, plan.creatorId, {
    title: plan.title, description: plan.description, location: plan.location,
    eventDate: eventDate.toISOString(), endDate: endDate.toISOString(),
    maxParticipants: plan.maxParticipants, excludedUserIds: plan.exclusions.map(e => e.userId),
    deletionMode: plan.deletionMode, disabledFeatures: plan.disabledFeatures, enabledFeatures: plan.enabledFeatures, editMode: plan.editMode,
    importantInfo: plan.importantInfo, importantInfoMode: plan.importantInfoMode,
  });
  if ('error' in result) { console.error('[recurrence]', plan.id, result.error); return end(); }
  const next = result.plan;
  await prisma.$transaction([
    prisma.plan.update({ where: { id: next.id }, data: { recurrence: plan.recurrence, recurrenceUntil: plan.recurrenceUntil, seriesId: plan.seriesId ?? plan.id } }),
    prisma.bringItem.createMany({ data: plan.items.map(i => ({ planId: next.id, label: i.label, quantity: i.quantity, createdById: i.createdById })) }),
    prisma.plan.update({ where: { id: plan.id }, data: { nextOccurrenceId: next.id } }),
  ]);
  // Postes des bénévoles : mêmes horaires décalés, sans inscrits
  await copyShifts(plan.id, next.id, eventDate.getTime() - plan.eventDate.getTime());
  return next.id;
}

// Job horaire : Plans récurrents dont la date est passée et qui n'ont pas encore de suivant
export async function spawnRecurringPlans(app: any, createPlanInCircle: CreatePlan) {
  try {
    const due = await prisma.plan.findMany({
      where: { recurrence: { not: null }, nextOccurrenceId: null, eventDate: { lte: new Date() } },
      select: { id: true },
    });
    for (const p of due) {
      const id = await createNextOccurrence(app, p.id, createPlanInCircle).catch(e => { console.error('[recurrence]', p.id, e); return null; });
      if (id) console.log(`[recurrence] Plan suivant créé : ${id}`);
    }
  } catch (e) {
    console.error('[recurrence] Erreur:', e);
  }
}

// « Annuler cette fois » : le suivant est créé tout de suite, puis ce Plan est supprimé
export async function skipOccurrence(app: any, planId: string, createPlanInCircle: CreatePlan): Promise<string | null> {
  const nextId = await createNextOccurrence(app, planId, createPlanInCircle);
  await purgePlanFiles([planId]);
  await prisma.plan.delete({ where: { id: planId } });
  return nextId;
}
