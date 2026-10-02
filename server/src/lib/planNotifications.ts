import type { Server } from 'socket.io';
import prisma from './prisma';
import { notifyUser } from './push';

// Notifications aux participants d'un Plan (dans l'app + push) :
//   - arrivées, désistements et retours (plan_member) ;
//   - activité dans le Plan (plan_activity) : infos modifiées, fichiers, « qui apporte
//     quoi », sondages, dépenses, covoiturage. Déclenchée par broadcastWrites
//     (lib/realtime.ts, champ `activity` du WriteTarget) ou par les routes du covoiturage.
// Aucun email : ces notifications passent uniquement par le push (et l'app).

export type MembershipChange = 'join' | 'leave' | 'back';

// Texte de la notification (aussi utilisé tel quel dans la notification push)
export function membershipText(change: MembershipChange, pseudo: string): string {
  if (change === 'join') return `@${pseudo} a rejoint le Plan`;
  if (change === 'leave') return `@${pseudo} ne vient plus`;
  return `@${pseudo} revient dans le Plan`;
}

// Changement de réponse qui mérite une notification : passer à « Je passe » (désistement)
// ou en revenir. Entre « Je suis in » et « Peut-être » : rien, pour limiter le bruit.
export function rsvpChange(before: string, after: string): MembershipChange | null {
  if (before !== 'out' && after === 'out') return 'leave';
  if (before === 'out' && after !== 'out') return 'back';
  return null;
}

// Prévient les autres participants du Plan (dans l'app + push) qu'une personne arrive ou se
// désiste. Ceux qui ont eux-mêmes répondu « Je passe » ne sont pas dérangés.
export async function notifyMembershipChange(
  io: Server | undefined,
  planId: string,
  actor: { id: string; pseudo: string },
  change: MembershipChange,
) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { title: true, circleId: true, members: { where: { userId: { not: actor.id }, rsvp: { not: 'out' } }, select: { userId: true } } },
  });
  if (!plan) return;
  for (const m of plan.members) {
    notifyUser(io, m.userId, {
      type: 'plan_member',
      planId,
      planTitle: plan.title,
      circleId: plan.circleId,
      from: actor.pseudo,
      actorId: actor.id,
      preview: membershipText(change, actor.pseudo),
    });
  }
}

export type PlanActivityKind =
  | 'plan_edited' | 'item_added' | 'items_updated' | 'poll_created'
  | 'expense_added' | 'expense_deleted' | 'reimbursement_added' | 'file_added' | 'photo_added'
  | 'ride_offered' | 'ride_requested' | 'ride_updated' | 'ride_cancelled';

export function activityText(kind: PlanActivityKind, pseudo: string): string {
  const who = `@${pseudo}`;
  switch (kind) {
    case 'plan_edited': return `${who} a modifié les infos du Plan`;
    case 'item_added': return `${who} a ajouté un élément à « Qui apporte quoi »`;
    case 'items_updated': return `${who} a mis à jour « Qui apporte quoi »`;
    case 'poll_created': return `${who} a lancé un sondage`;
    case 'expense_added': return `${who} a ajouté une dépense`;
    case 'expense_deleted': return `${who} a supprimé une dépense`;
    case 'reimbursement_added': return `${who} a enregistré un remboursement`;
    case 'file_added': return `${who} a ajouté un fichier`;
    case 'photo_added': return `${who} a ajouté une photo`;
    case 'ride_offered': return `${who} propose un trajet en voiture`;
    case 'ride_requested': return `${who} cherche une place en voiture`;
    case 'ride_updated': return `${who} a modifié son trajet`;
    case 'ride_cancelled': return `${who} a annulé son trajet`;
  }
}

// Prévient les autres participants d'une activité dans le Plan. Pas ceux qui ont répondu
// « Je passe », ni ceux qui regardent le Plan à ce moment (ils voient le changement en
// direct), ni `skipUserIds` (déjà prévenus autrement, ex. passagers d'un trajet annulé).
export async function notifyPlanActivity(
  io: Server | undefined,
  planId: string,
  actor: { id: string; pseudo: string },
  kind: PlanActivityKind,
  skipUserIds: string[] = [],
) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { title: true, circleId: true, members: { where: { userId: { not: actor.id }, rsvp: { not: 'out' } }, select: { userId: true } } },
  });
  if (!plan) return;
  const watching = new Set<string>(skipUserIds);
  if (io) for (const s of await io.in(`plan:${planId}`).fetchSockets()) watching.add(s.data.userId);
  for (const m of plan.members) {
    if (watching.has(m.userId)) continue;
    notifyUser(io, m.userId, {
      type: 'plan_activity',
      planId,
      planTitle: plan.title,
      circleId: plan.circleId,
      from: actor.pseudo,
      actorId: actor.id,
      preview: activityText(kind, actor.pseudo),
    });
  }
}
