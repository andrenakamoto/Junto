import prisma from './prisma';

// Lettres non accentuées uniquement — la regex @mention du chat utilise \b,
// qui ne gère pas correctement les limites de mot autour des caractères accentués.
export const PSEUDO_REGEX = /^[a-zA-Z0-9_]{2,24}$/;

export function validatePseudo(pseudo: unknown): string | null {
  if (typeof pseudo !== 'string' || !PSEUDO_REGEX.test(pseudo.trim())) {
    return 'Le pseudo doit faire 2 à 24 caractères : lettres non accentuées, chiffres et underscore uniquement';
  }
  return null;
}

// Unicité insensible à la casse (Andre / andre sont considérés identiques)
export async function isPseudoTaken(pseudo: string, excludeUserId?: string): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { pseudo: { equals: pseudo, mode: 'insensitive' } },
  });
  return !!existing && existing.id !== excludeUserId;
}
