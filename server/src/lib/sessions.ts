import type { Server } from 'socket.io';
import prisma from './prisma';
import { refreshPhoneUsers } from './notificationPrefs';

// « Se déconnecter de tous les appareils » (2026-11-18, téléphone perdu) : chaque compte a un numéro de session
// (User.sessionVersion), écrit dans le jeton (`sv`). L'augmenter rend tous les jetons déjà donnés inutilisables. Le numéro
// est gardé en mémoire quelques minutes pour ne pas interroger la base à chaque requête ; le serveur est un seul processus,
// une déconnexion met donc la mémoire à jour aussitôt.
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { v: number; at: number }>();

export async function sessionVersion(userId: string): Promise<number | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  if (!u) { cache.delete(userId); return null; }
  cache.set(userId, { v: u.sessionVersion, at: Date.now() });
  return u.sessionVersion;
}

/** Le jeton appartient-il encore à une session ouverte ? (compte supprimé ou sessions fermées : non) */
export async function isSessionCurrent(userId: string, sv: number | undefined): Promise<boolean> {
  const v = await sessionVersion(userId);
  return v !== null && (sv ?? 0) === v;
}

/**
 * Ferme toutes les sessions du compte : jetons refusés, temps réel coupé, notifications push retirées des téléphones.
 * Renvoie le nouveau numéro, pour donner un jeton neuf à l'appareil qui a fait la demande.
 */
export async function revokeAllSessions(io: Server | undefined, userId: string): Promise<number> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  cache.set(userId, { v: u.sessionVersion, at: Date.now() });
  await prisma.pushToken.deleteMany({ where: { userId } });
  refreshPhoneUsers();
  // L'appareil qui a fait la demande se reconnecte tout seul avec son nouveau jeton (lib/socket.ts du client)
  io?.in(`user:${userId}`).disconnectSockets(true);
  return u.sessionVersion;
}
