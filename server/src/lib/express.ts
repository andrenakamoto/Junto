import crypto from 'crypto';
import prisma from './prisma';

// Plan express (« Organiser une sortie », page publique /organiser) : un Plan créé en
// 30 secondes, même sans compte, puis partagé par lien. Les amis répondent sans compte
// (lib/lightGuest.ts) et sont des invités externes du Plan.
//
// - Le Plan est rangé dans le Cercle personnel « Mes Plans » de l'organisateur
//   (Circle.isPersonal, un par personne), créé à la première utilisation.
// - Sans compte, l'organisateur est un invité léger (isLight) : son jeton lui permet
//   seulement de créer ses Plans express et d'en suivre les réponses (routes/express.ts).
//   À l'inscription avec ce jeton, le même compte devient un compte normal ; à la connexion
//   à un compte existant, ses Plans y sont transférés (absorbLightUser).

export const PERSONAL_CIRCLE_NAME = 'Mes Plans';
export const EXPRESS_TITLE_MAX = 100;

function code(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[crypto.randomInt(chars.length)]).join('');
}

export async function getOrCreatePersonalCircle(userId: string) {
  const existing = await prisma.circle.findFirst({ where: { creatorId: userId, isPersonal: true }, select: { id: true } });
  if (existing) return existing;
  let c = code();
  while (await prisma.circle.findUnique({ where: { code: c } })) c = code();
  return prisma.circle.create({
    data: {
      name: PERSONAL_CIRCLE_NAME,
      description: 'Tes Plans partagés par lien',
      isPersonal: true,
      // Personne ne rejoint ce Cercle avec son code sans l'accord de son propriétaire
      admissionMode: 'creator',
      code: c,
      creatorId: userId,
      members: { create: { userId, role: 'admin' } },
    },
    select: { id: true },
  });
}

export function newInviteToken() {
  return crypto.randomBytes(18).toString('base64url');
}

// Lien d'invitation du Plan (le même pour tous, comme /plans/:id/guest-link)
export async function ensureInviteToken(planId: string): Promise<string> {
  const link = await prisma.planGuestLink.upsert({
    where: { planId },
    create: { planId, token: newInviteToken() },
    update: {},
  });
  return link.token;
}
