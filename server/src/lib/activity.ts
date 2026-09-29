import prisma from './prisma';
import { visitDay } from './pageVisits';

// Dernière utilisation de l'app par compte, pour le total « membres actifs » du
// panneau admin. Au plus une écriture par heure et par personne (mémoire du
// serveur), lancée en arrière-plan : aucune requête n'attend la base pour ça.
const THROTTLE_MS = 60 * 60 * 1000;
const lastWrite = new Map<string, number>();

export function touchUser(userId: string) {
  const now = Date.now();
  if (now - (lastWrite.get(userId) ?? 0) < THROTTLE_MS) return;
  lastWrite.set(userId, now);
  prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } })
    .catch(() => { /* compte supprimé entre-temps : sans importance */ });
}

// Total anonyme des messages envoyés par jour (chat des Plans et des sondages) :
// conservé même après la suppression des Plans, sans auteur ni contenu.
export function countMessageSent() {
  const day = visitDay();
  prisma.pageVisit.upsert({
    where: { page_day: { page: 'messages', day } },
    create: { page: 'messages', day, count: 1 },
    update: { count: { increment: 1 } },
  }).catch(e => console.error('[messages count]', e));
}
