import jwt from 'jsonwebtoken';
import prisma from './prisma';
import { deleteUserAccount } from './accountDeletion';

// Réponse à un Plan sans compte (« invité léger ») : depuis un lien d'invitation, on donne
// son prénom et sa réponse (in / peut-être / je passe), sans email ni mot de passe.
//
// - C'est un vrai User (isLight = true) membre du Plan : il compte dans les participants,
//   apparaît dans la liste des membres et déclenche les notifications d'arrivée, sans rien
//   changer au reste du code. Pseudo généré « prenom.invite » : le point est interdit dans
//   les pseudos choisis (lib/pseudo.ts), il ne peut donc pas usurper un vrai compte.
// - Son jeton (JWT avec light: true) ne sert qu'aux routes /api/invite ; requireAuth et la
//   connexion temps réel le refusent. Il ne peut donc ni écrire dans le chat, ni proposer
//   de trajet, ni payer une dépense : il ne possède rien d'autre que ses réponses.
// - Inscription avec ce jeton : le même User devient un compte normal (après validation de
//   l'email). Connexion à un compte existant : ses réponses y sont transférées
//   (absorbLightUser), puis il est supprimé.
// - Supprimé automatiquement dès qu'il n'a plus aucun Plan (cron horaire).

const LIGHT_TOKEN_TTL = '60d';

export function makeLightToken(user: { id: string; pseudo: string }) {
  return jwt.sign({ userId: user.id, pseudo: user.pseudo, light: true }, process.env.JWT_SECRET!, { expiresIn: LIGHT_TOKEN_TTL });
}

export function isLightPayload(payload: unknown): boolean {
  return !!payload && typeof payload === 'object' && (payload as { light?: unknown }).light === true;
}

// Invité léger encore existant derrière un jeton (null si jeton invalide, expiré, ou si le
// compte est devenu un compte normal entre-temps)
export async function readLightUser(token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; light?: boolean };
    if (!payload.light || !payload.userId) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return user?.isLight ? user : null;
  } catch {
    return null;
  }
}

export function cleanFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= 30 ? name : null;
}

// « Julie-Anne » → « julieanne.invite », puis « julieanne.invite2 »… si déjà pris
export function lightPseudoBase(firstName: string): string {
  const slug = firstName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return `${slug || 'invite'}.invite`;
}

export async function createLightUser(firstName: string) {
  const base = lightPseudoBase(firstName);
  for (let i = 0; i < 20; i++) {
    const pseudo = i === 0 ? base : `${base}${i + 1}`;
    const taken = await prisma.user.findFirst({ where: { pseudo: { equals: pseudo, mode: 'insensitive' } }, select: { id: true } });
    if (taken) continue;
    try {
      return await prisma.user.create({ data: { pseudo, firstName, isLight: true, status: 'approved' } });
    } catch {
      // course avec une autre création du même pseudo : on essaie le suivant
    }
  }
  return prisma.user.create({
    data: { pseudo: `${base}${Date.now().toString(36)}`, firstName, isLight: true, status: 'approved' },
  });
}

// Connexion à un compte existant depuis un appareil où l'on avait répondu sans compte :
// les réponses (et parts de dépenses) passent sur le compte, puis l'invité léger disparaît.
// Si le compte participait déjà au Plan, sa propre réponse est gardée.
// Plans express créés sans compte (lib/express.ts) : ils passent aussi sur le compte, rangés
// dans son Cercle « Mes Plans » (celui de l'invité léger devient le sien s'il n'en avait pas).
export async function absorbLightUser(lightToken: unknown, targetUserId: string): Promise<string[]> {
  const light = await readLightUser(lightToken);
  if (!light || light.id === targetUserId) return [];
  const memberships = await prisma.planMember.findMany({ where: { userId: light.id } });
  const planIds: string[] = [];
  await prisma.$transaction(async tx => {
    for (const m of memberships) {
      const existing = await tx.planMember.findUnique({ where: { userId_planId: { userId: targetUserId, planId: m.planId } } });
      if (existing) {
        await tx.planMember.delete({ where: { userId_planId: { userId: light.id, planId: m.planId } } });
      } else {
        await tx.planMember.update({
          where: { userId_planId: { userId: light.id, planId: m.planId } },
          data: { userId: targetUserId },
        });
        planIds.push(m.planId);
      }
    }
    const shares = await tx.expenseShare.findMany({ where: { userId: light.id } });
    for (const s of shares) {
      const dup = await tx.expenseShare.findUnique({ where: { expenseId_userId: { expenseId: s.expenseId, userId: targetUserId } } });
      if (!dup) await tx.expenseShare.create({ data: { expenseId: s.expenseId, userId: targetUserId } });
    }
    await tx.reimbursement.updateMany({ where: { fromUserId: light.id }, data: { fromUserId: targetUserId } });
    await tx.reimbursement.updateMany({ where: { toUserId: light.id }, data: { toUserId: targetUserId } });
    // Plans express de l'organisateur sans compte, et son Cercle « Mes Plans »
    await tx.plan.updateMany({ where: { creatorId: light.id }, data: { creatorId: targetUserId } });
    const lightCircles = await tx.circle.findMany({ where: { creatorId: light.id }, select: { id: true } });
    const own = await tx.circle.findFirst({ where: { creatorId: targetUserId, isPersonal: true }, select: { id: true } });
    for (const c of lightCircles) {
      if (own) {
        await tx.plan.updateMany({ where: { circleId: c.id }, data: { circleId: own.id } });
        await tx.circle.delete({ where: { id: c.id } });
      } else {
        await tx.circle.update({ where: { id: c.id }, data: { creatorId: targetUserId } });
        await tx.circleMember.create({ data: { userId: targetUserId, circleId: c.id, role: 'admin' } });
      }
    }
    await tx.user.delete({ where: { id: light.id } }); // parts restantes : cascade
  });
  return planIds;
}

// Cron horaire : invités légers qui ne participent plus à aucun Plan (Plans terminés et
// supprimés, ou réponse retirée). Délai d'une heure pour ne pas gêner une réponse en cours.
// Un organisateur sans compte (lib/express.ts) part avec son Cercle « Mes Plans » vide, via
// deleteUserAccount (Circle.creator n'a pas de onDelete).
export async function deleteOrphanLightUsers() {
  try {
    const orphans = await prisma.user.findMany({
      where: { isLight: true, planMemberships: { none: {} }, createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { id: true },
    });
    for (const o of orphans) await deleteUserAccount(o.id);
    const count = orphans.length;
    if (count > 0) console.log(`[cleanup] ${count} réponse(s) sans compte supprimée(s)`);
  } catch (e) {
    console.error('[cleanup] invités sans compte', e);
  }
}
