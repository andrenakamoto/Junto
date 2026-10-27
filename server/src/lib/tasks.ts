import prisma from './prisma';
import { isCircleManager } from './circleRoles';
import { notifyUser } from './push';

// Tâches de préparation d'un Plan (fonction à activer « taches », pensée pour un Plan réservé à une équipe
// d'organisation) : des lots (« Traiteur », « Lieu »…), et dans chaque lot des tâches avec responsables,
// échéance, statut et dépendances (« commencer après : réserver la salle »). Toute personne qui voit le Plan
// ajoute et fait avancer les tâches ; supprimer une tâche : la personne qui l'a créée, le créateur du Plan ou
// un gestionnaire du Cercle. Une tâche est « bloquée » tant qu'une de celles qu'elle attend n'est pas terminée ;
// quand la dernière se termine, ses responsables sont prévenus.

export const TASKS_FEATURE = 'taches';
export const TASK_TITLE_MAX = 120;
export const TASK_NOTE_MAX = 1000;
export const TASK_COMMENT_MAX = 500;
export const GROUP_TITLE_MAX = 60;
export const MAX_TASKS = 300;
export const MAX_GROUPS = 30;
export const MAX_ASSIGNEES = 10;
export const TASKS_DISABLED_ERROR = 'Les tâches ne sont pas activées pour ce Plan';

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskState = 'ready' | 'blocked' | 'doing' | 'done';

export function tasksEnabled(plan: { enabledFeatures: string[] }): boolean {
  return plan.enabledFeatures.includes(TASKS_FEATURE);
}

export async function canManageTasks(userId: string, plan: { creatorId: string; circleId: string }): Promise<boolean> {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

export function parseStatus(v: unknown): TaskStatus | null {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v) ? v as TaskStatus : null;
}

// « AAAA-MM-JJ » existant vraiment (pas de 31 février)
export function parseDueDate(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

const idList = (v: unknown, max: number): string[] | undefined => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string')) return undefined;
  return [...new Set(v as string[])];
};

export interface TaskInput {
  title: string;
  note: string | null;
  dueDate: string | null;
  groupId: string | null;
  assigneeIds: string[];
  dependsOnIds: string[];
}

// Validation d'une tâche (création et modification) ; les identifiants sont vérifiés ensuite par la route
export function parseTaskInput(body: any): TaskInput | { error: string } {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Nom de la tâche requis' };
  if (title.length > TASK_TITLE_MAX) return { error: `Nom de la tâche : ${TASK_TITLE_MAX} caractères maximum` };
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (note && note.length > TASK_NOTE_MAX) return { error: `Détails : ${TASK_NOTE_MAX} caractères maximum` };
  const dueDate = parseDueDate(body?.dueDate);
  if (dueDate === undefined) return { error: 'Échéance invalide' };
  const groupId = typeof body?.groupId === 'string' && body.groupId ? body.groupId : null;
  const assigneeIds = idList(body?.assigneeIds, MAX_ASSIGNEES);
  if (!assigneeIds) return { error: `Responsables : ${MAX_ASSIGNEES} au plus` };
  const dependsOnIds = idList(body?.dependsOnIds, MAX_TASKS);
  if (!dependsOnIds) return { error: 'Dépendances invalides' };
  return { title, note, dueDate, groupId, assigneeIds, dependsOnIds };
}

export function parseGroupTitle(v: unknown): string | { error: string } {
  const title = typeof v === 'string' ? v.trim() : '';
  if (!title) return { error: 'Nom du lot requis' };
  if (title.length > GROUP_TITLE_MAX) return { error: `Nom du lot : ${GROUP_TITLE_MAX} caractères maximum` };
  return title;
}

export function parseTaskComment(v: unknown): string | { error: string } {
  const content = typeof v === 'string' ? v.trim() : '';
  if (!content) return { error: 'Commentaire vide' };
  if (content.length > TASK_COMMENT_MAX) return { error: `Commentaire : ${TASK_COMMENT_MAX} caractères maximum` };
  return content;
}

type Edges = Map<string, string[]>; // tâche → tâches qu'elle attend

// Donner à `taskId` les dépendances `deps` créerait-il une boucle (A attend B qui attend A) ?
export function createsCycle(edges: Edges, taskId: string, deps: string[]): boolean {
  const seen = new Set<string>();
  const stack = [...deps];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return false;
}

// État affiché : terminée, en cours, bloquée (une tâche attendue n'est pas terminée) ou prête
export function taskState(task: { status: string; dependsOn: string[] }, statusOf: Map<string, string>): TaskState {
  if (task.status === 'done') return 'done';
  if (task.status === 'doing') return 'doing';
  return task.dependsOn.some(id => statusOf.get(id) !== 'done') ? 'blocked' : 'ready';
}

// Tâches qui deviennent faisables quand `doneId` se termine : pas encore commencées, elles l'attendaient et
// n'attendent plus rien
export function newlyUnblocked<T extends { id: string; status: string; dependsOn: string[] }>(tasks: T[], doneId: string): T[] {
  const statusOf = new Map(tasks.map(t => [t.id, t.id === doneId ? 'done' : t.status]));
  return tasks.filter(t => t.status === 'todo' && t.dependsOn.includes(doneId) && t.dependsOn.every(id => statusOf.get(id) === 'done'));
}

// Jour en Suisse, « AAAA-MM-JJ »
export function zurichDay(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export function daysUntil(dueDate: string, today: string): number {
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
}

// Rappel : 2 jours avant l'échéance (ou moins, si elle a été fixée tard), jamais pour une échéance passée
export const TASK_REMINDER_DAYS = 2;
export function reminderDue(dueDate: string | null, today: string): boolean {
  if (!dueDate) return false;
  const d = daysUntil(dueDate, today);
  return d >= 0 && d <= TASK_REMINDER_DAYS;
}

export function dueText(dueDate: string, intl = 'fr-CH'): string {
  return new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dueDate}T12:00:00Z`));
}

// Qui prévenir d'un commentaire : responsables et personne qui a créé la tâche, jamais l'auteur
export function commentRecipients(task: { createdById: string | null }, assigneeIds: string[], authorId: string): string[] {
  return [...new Set([...(task.createdById ? [task.createdById] : []), ...assigneeIds])].filter(id => id !== authorId);
}

// Notification ciblée : type « plan_activity » (connu de toutes les apps installées) avec la rubrique à ouvrir
export function notifyTask(io: any, userId: string, plan: { id: string; title: string; circleId: string }, preview: string, actor?: { id: string; pseudo: string }) {
  if (actor && userId === actor.id) return;
  notifyUser(io, userId, {
    type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: TASKS_FEATURE, preview,
    ...(actor ? { from: actor.pseudo, actorId: actor.id } : {}),
  });
}

// « Je passe », exclusion, départ du Cercle : la personne n'est plus responsable des tâches du Plan
export async function removeFromTasks(planId: string, userId: string) {
  await prisma.planTaskAssignee.deleteMany({ where: { planId, userId } });
}

export async function removeFromTasksInCircle(circleId: string, userId: string) {
  await prisma.planTaskAssignee.deleteMany({ where: { userId, task: { plan: { circleId } } } });
}

// Rappel avant l'échéance, aux responsables (à défaut à la personne qui a créé la tâche), vérifié toutes les
// heures avec les autres tâches régulières, envoyé à partir de 9 h (heure suisse)
export async function sendTaskReminders(io: any) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (hour < 9) return;
    const today = zurichDay();
    const candidates = await prisma.planTask.findMany({
      where: { reminderSentAt: null, status: { not: 'done' }, dueDate: { not: null, gte: today }, plan: { archived: false, enabledFeatures: { has: TASKS_FEATURE } } },
      include: { plan: { select: { id: true, title: true, circleId: true } }, assignees: { select: { userId: true } } },
    });
    for (const t of candidates) {
      if (!reminderDue(t.dueDate, today)) continue;
      const claimed = await prisma.planTask.updateMany({ where: { id: t.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
      if (!claimed.count) continue;
      const days = daysUntil(t.dueDate!, today);
      const preview = days === 0 ? `⏰ « ${t.title} » est à faire aujourd’hui` : days === 1 ? `⏰ « ${t.title} » est à faire pour demain` : `⏰ « ${t.title} » est à faire d’ici ${days} jours`;
      const to = t.assignees.length ? t.assignees.map(a => a.userId) : t.createdById ? [t.createdById] : [];
      for (const userId of to) notifyTask(io, userId, t.plan, preview);
    }
  } catch (e) {
    console.error('[task reminders]', e);
  }
}
