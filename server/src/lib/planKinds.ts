import prisma from './prisma';
import { visitDay } from './pageVisits';

// Types de Plan (« Créer › Plan spécifique ») : ils pré-règlent seulement la fenêtre de création (côté app), tout reste
// modifiable. Le type est gardé sur le Plan et compté chaque jour (PageVisit, anonyme) pour le panneau admin.
export const PLAN_KINDS = ['surprise', 'pere_noel', 'assemblee', 'organisation', 'annonce', 'cours', 'jeux', 'voyage'] as const;
export type PlanKind = typeof PLAN_KINDS[number];
export const PLAN_KIND_LABELS: Record<PlanKind | 'standard', string> = {
  standard: 'Plan standard', surprise: 'Surprise', pere_noel: 'Père Noël secret', assemblee: 'Assemblée générale',
  organisation: 'Organisation à plusieurs', annonce: 'Annonce d’un événement', cours: 'Cours ou entraînement', jeux: 'Soirée jeux', voyage: 'Week-end ou voyage',
};

export function parsePlanKind(v: unknown): PlanKind | null {
  return (PLAN_KINDS as readonly unknown[]).includes(v) ? v as PlanKind : null;
}

export function countPlanKind(kind: PlanKind | null) {
  const page = `plankind_${kind ?? 'standard'}`, day = visitDay();
  prisma.pageVisit.upsert({ where: { page_day: { page, day } }, create: { page, day, count: 1 }, update: { count: { increment: 1 } } })
    .catch(e => console.error('[plan kind]', e));
}

// Fin de la journée en cours, heure suisse (23 h 59) : le Père Noël secret se termine le soir de l'échange
export function zurichEndOfDay(now = new Date()): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(p => [p.type, p.value]));
  // Décalage de Zurich par rapport à UTC à cet instant (1 ou 2 heures)
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offset = asUtc - Math.floor(now.getTime() / 60000) * 60000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 23, 59) - offset);
}
