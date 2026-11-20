import prisma from './prisma';
import { detachFromCircle } from './circleDetach';
import { nextCircleCreator } from './circleRoles';
import { syncOrganisation } from './orgSync';

// Administrateurs d'une Organisation (2026-11-20, demande de l'utilisateur : « nommer / retirer administrateur peut être dangereux
// si quelqu'un est mal intentionné »). Règles :
// - un administrateur en nomme un autre seul (ça n'enlève rien à personne), les autres administrateurs sont prévenus ;
// - chacun peut se retirer lui-même, sauf le dernier administrateur ;
// - retirer un AUTRE administrateur : jamais seul. Il faut la majorité des autres administrateurs, au moins 2 voix ; ne votent que
//   ceux nommés depuis 7 jours (contre les complices nommés à la hâte) ; la personne visée ne vote pas ; demande effacée après 14 jours.

export const ADMIN_VOTE_DELAY_MS = 7 * 24 * 3600e3;
export const REMOVAL_TTL_MS = 14 * 24 * 3600e3;

/** Un administrateur vote sur un retrait s'il l'est depuis 7 jours (date inconnue : administrateur d'avant cette règle) */
export function canVoteOnRemoval(adminSince: Date | null, now = new Date()): boolean {
  return !adminSince || now.getTime() - adminSince.getTime() >= ADMIN_VOTE_DELAY_MS;
}

/** Voix nécessaires pour retirer un administrateur : majorité des votants possibles, au moins 2. null = impossible (moins de 2 votants). */
export function removalThreshold(eligibleVoters: number): number | null {
  if (eligibleVoters < 2) return null;
  return Math.max(2, Math.floor(eligibleVoters / 2) + 1);
}

export const removalExpired = (createdAt: Date, now = new Date()) => now.getTime() - createdAt.getTime() > REMOVAL_TTL_MS;

export async function logAdmin(organisationId: string, action: string, actorId: string | null, targetId: string | null) {
  await prisma.organisationAdminLog.create({ data: { organisationId, action, actorId, targetId } });
}

/** Administrateurs de l'Organisation */
export const orgAdmins = (organisationId: string) =>
  prisma.organisationMember.findMany({ where: { organisationId, isAdmin: true }, select: { userId: true, adminSince: true } });

/** Votants possibles sur le retrait de `targetId` : les autres administrateurs, nommés depuis 7 jours */
export async function eligibleVoterIds(organisationId: string, targetId: string, now = new Date()) {
  return (await orgAdmins(organisationId)).filter(a => a.userId !== targetId && canVoteOnRemoval(a.adminSince, now)).map(a => a.userId);
}

/** Demandes de retrait encore valables (les plus vieilles que 14 jours sont effacées au passage) */
export async function activeRemovals(organisationId: string) {
  const all = await prisma.organisationAdminRemoval.findMany({ where: { organisationId }, include: { votes: { select: { userId: true } } } });
  const stale = all.filter(r => removalExpired(r.createdAt));
  if (stale.length) await prisma.organisationAdminRemoval.deleteMany({ where: { id: { in: stale.map(r => r.id) } } });
  return all.filter(r => !removalExpired(r.createdAt));
}

/**
 * Applique le retrait si la majorité est atteinte. Renvoie true si l'administrateur a été retiré.
 * Les voix qui ne comptent plus (administrateur retiré entre-temps, trop récent) sont ignorées.
 */
export async function settleRemoval(removalId: string): Promise<boolean> {
  const removal = await prisma.organisationAdminRemoval.findUnique({ where: { id: removalId }, include: { votes: { select: { userId: true } } } });
  if (!removal) return false;
  const eligible = await eligibleVoterIds(removal.organisationId, removal.targetId);
  const threshold = removalThreshold(eligible.length);
  const votes = removal.votes.filter(v => eligible.includes(v.userId)).length;
  if (threshold === null || votes < threshold) return false;
  await prisma.$transaction([
    prisma.organisationMember.updateMany({ where: { organisationId: removal.organisationId, userId: removal.targetId }, data: { isAdmin: false, adminSince: null } }),
    prisma.organisationAdminRemoval.delete({ where: { id: removal.id } }),
  ]);
  await logAdmin(removal.organisationId, 'removed', null, removal.targetId);
  return true;
}

/**
 * Fait sortir une personne de l'Organisation : tous ses Cercles de l'Organisation (équipes, unités, Cercles automatiques, Cercles
 * intégrés), puis sa ligne de membre. Un Cercle qu'elle a créé passe au membre le plus ancien (comme un départ) ; si elle y est
 * seule, il reste à son nom. Renvoie les Cercles quittés.
 */
export async function removeFromOrganisation(app: any, organisationId: string, userId: string): Promise<string[]> {
  const memberships = await prisma.circleMember.findMany({ where: { userId, circle: { organisationId } }, select: { circleId: true, circle: { select: { creatorId: true } } } });
  const left: string[] = [];
  for (const m of memberships) {
    if (m.circle.creatorId === userId) {
      const next = await nextCircleCreator(m.circleId, userId);
      if (!next) continue;
      await prisma.$transaction([
        prisma.circle.update({ where: { id: m.circleId }, data: { creatorId: next.userId } }),
        prisma.circleMember.update({ where: { userId_circleId: { userId: next.userId, circleId: m.circleId } }, data: { role: 'admin' } }),
      ]);
    }
    await detachFromCircle(app, m.circleId, userId);
    left.push(m.circleId);
  }
  // Encore créateur d'un Cercle où il est seul : il garde ce Cercle, donc sa place dans l'Organisation
  const stillIn = await prisma.circleMember.count({ where: { userId, circle: { organisationId } } });
  if (!stillIn) {
    await prisma.organisationAdminRemoval.deleteMany({ where: { organisationId, targetId: userId } });
    await prisma.organisationMember.deleteMany({ where: { organisationId, userId } });
  }
  await syncOrganisation(app, organisationId);
  const io = app.get('io');
  for (const circleId of left) {
    io?.to(`user:${userId}`).emit('circle-updated', { circleId });
    io?.to(`circle:${circleId}`).emit('circle-updated', { circleId });
  }
  return left;
}
