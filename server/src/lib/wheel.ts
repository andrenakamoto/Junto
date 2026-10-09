import { randomInt } from 'crypto';
import prisma from './prisma';

// « Qui s'y colle ? » : une roue qui tire au sort une personne du Plan. Sur la roue : les participants
// « Je suis in » et « Peut-être » (réponses sans compte comprises), moins les personnes retirées
// volontairement, moins les personnes déjà tirées si l'option « pas deux fois la même personne » est cochée.
// Le serveur tire le résultat (impossible de tricher depuis un téléphone) et fixe une heure de départ
// commune : chaque téléphone anime la roue pour qu'elle s'arrête au même instant sur le même nom.

export const WHEEL_QUESTION_MAX = 120;
// Délai avant le départ (le temps que tous les téléphones reçoivent le tirage), puis durée de la rotation
export const WHEEL_LEAD_MS = 3000;
export const WHEEL_SPIN_MS = 5000;

export function wheelCandidates(participantIds: string[], excludedIds: string[], previousWinners: string[], noRepeat: boolean) {
  const excluded = participantIds.filter(id => excludedIds.includes(id));
  const skipped = noRepeat ? participantIds.filter(id => !excludedIds.includes(id) && previousWinners.includes(id)) : [];
  const candidates = participantIds.filter(id => !excludedIds.includes(id) && !skipped.includes(id));
  return { candidates, excluded, skipped };
}

// Tirage équitable (aléatoire cryptographique)
export function pickWinner(candidates: string[], rand: (n: number) => number = n => randomInt(n)): string | null {
  return candidates.length ? candidates[rand(candidates.length)] : null;
}

// Personnes du Plan qui peuvent être sur la roue, dans un ordre stable (prénom)
export async function wheelParticipants(planId: string) {
  const members = await prisma.planMember.findMany({
    where: { planId, rsvp: { not: 'out' } },
    select: { userId: true, user: { select: { id: true, pseudo: true, firstName: true, isLight: true } } },
  });
  return members.map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr'));
}
