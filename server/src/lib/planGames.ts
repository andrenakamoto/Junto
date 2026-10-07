import { removeFromSanta, removeFromSantaInCircle } from './secretSanta';
import { removeFromKiller, removeFromKillerInCircle } from './killer';
import { removeFromTeams, removeFromTeamsInCircle } from './teams';

// Une personne quitte un Plan (« Je passe », exclusion) ou un Cercle : elle sort aussi des jeux en
// cours (Père Noël secret, Killer, équipes). La cagnotte garde sa participation (argent réel).
export async function removeFromPlanGames(planId: string, userId: string) {
  await removeFromSanta(planId, userId).catch(e => console.error('[santa cleanup]', e));
  await removeFromKiller(planId, userId).catch(e => console.error('[killer cleanup]', e));
  await removeFromTeams(planId, userId).catch(e => console.error('[teams cleanup]', e));
}

export async function removeFromGamesInCircle(circleId: string, userId: string) {
  await removeFromSantaInCircle(circleId, userId).catch(e => console.error('[santa cleanup]', e));
  await removeFromKillerInCircle(circleId, userId).catch(e => console.error('[killer cleanup]', e));
  await removeFromTeamsInCircle(circleId, userId).catch(e => console.error('[teams cleanup]', e));
}
