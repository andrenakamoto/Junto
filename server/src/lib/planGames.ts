import prisma from './prisma';
import { removeFromSanta, removeFromSantaInCircle } from './secretSanta';
import { removeFromKiller, removeFromKillerInCircle } from './killer';
import { removeFromTeams, removeFromTeamsInCircle } from './teams';
import { removeFromWordGame, removeFromWordGameInCircle } from './wordGame';
import { removeFromTasks, removeFromTasksInCircle } from './tasks';
import { removeFromProgram, removeFromProgramInCircle } from './program';

// Une personne quitte un Plan (« Je passe », exclusion) ou un Cercle : elle sort aussi des jeux en
// cours (Père Noël secret, Killer, mot piège, équipes). La cagnotte garde sa participation (argent réel).
export async function removeFromPlanGames(planId: string, userId: string) {
  await removeFromSanta(planId, userId).catch(e => console.error('[santa cleanup]', e));
  await removeFromKiller(planId, userId).catch(e => console.error('[killer cleanup]', e));
  await removeFromTeams(planId, userId).catch(e => console.error('[teams cleanup]', e));
  await removeFromWordGame(planId, userId).catch(e => console.error('[word game cleanup]', e));
  await removeFromTasks(planId, userId).catch(e => console.error('[tasks cleanup]', e));
  await removeFromProgram(planId, userId).catch(e => console.error('[program cleanup]', e));
}

// Départ d'un Cercle : jeux et voyages partagés des Plans auxquels la personne n'a plus accès
// (un Plan pour plusieurs Cercles reste accessible par un autre de ses Cercles)
export async function removeFromGamesInPlans(planIds: string[], userId: string) {
  for (const planId of planIds) await removeFromPlanGames(planId, userId);
  await prisma.transitGroupMember.deleteMany({ where: { userId, planId: { in: planIds } } }).catch((e: unknown) => console.error('[transit cleanup]', e));
  await prisma.transitGroup.deleteMany({ where: { planId: { in: planIds }, members: { none: {} } } }).catch((e: unknown) => console.error('[transit cleanup]', e));
}

export async function removeFromGamesInCircle(circleId: string, userId: string) {
  await removeFromSantaInCircle(circleId, userId).catch(e => console.error('[santa cleanup]', e));
  await removeFromKillerInCircle(circleId, userId).catch(e => console.error('[killer cleanup]', e));
  await removeFromTeamsInCircle(circleId, userId).catch(e => console.error('[teams cleanup]', e));
  await removeFromWordGameInCircle(circleId, userId).catch(e => console.error('[word game cleanup]', e));
  await removeFromTasksInCircle(circleId, userId).catch(e => console.error('[tasks cleanup]', e));
  await removeFromProgramInCircle(circleId, userId).catch(e => console.error('[program cleanup]', e));
  // Transports publics : voyages partagés des Plans du Cercle
  const plans = { plan: { circleId } };
  await prisma.transitGroupMember.deleteMany({ where: { userId, group: plans } }).catch((e: unknown) => console.error('[transit cleanup]', e));
  await prisma.transitGroup.deleteMany({ where: { ...plans, members: { none: {} } } }).catch((e: unknown) => console.error('[transit cleanup]', e));
}
