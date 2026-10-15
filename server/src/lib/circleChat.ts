import prisma from './prisma';
import { decryptMessage, withPlainContent } from './messageCrypto';
import { deletePhoto } from './photos';

// Discussion d'un Cercle (2026-10-15) : un chat par Cercle, à côté des chats des Plans. Messages chiffrés en base
// (comme ceux des Plans), effacés après CIRCLE_CHAT_TTL_MS. Trois modes (Circle.chatMode) : open (tout le monde
// écrit), announce (créateur et organisateurs écrivent, les autres réagissent), off. Notifications discrètes :
// pastille « nouveau » (CircleMember.chatSeenAt), push seulement pour les mentions, sauf réglage User.circleChatPush.

export const CIRCLE_CHAT_TTL_MS = 7 * 24 * 3600 * 1000;
export const CIRCLE_CHAT_MAX = 2000;

export const chatSince = () => new Date(Date.now() - CIRCLE_CHAT_TTL_MS);

export const circleMessageInclude = {
  author: { select: { id: true, pseudo: true, firstName: true } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

// Peut-on écrire ? Mode ouvert : tout membre ; annonces : créateur et organisateurs
export function canWriteChat(mode: string, isManager: boolean): boolean {
  return mode === 'open' || (mode === 'announce' && isManager);
}

// Aperçu du dernier message (carte « Discussion », liste des Cercles)
export function chatPreview(m: { content: string; imageKey: string | null; deletedAt: Date | null }): string {
  if (m.deletedAt) return '';
  const text = decryptMessage(m.content).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 90) : m.imageKey ? '📷 Photo' : '';
}

// Dernier message de chaque Cercle (7 derniers jours) et Cercles avec du nouveau pour la personne
export async function chatStateFor(userId: string, circles: { id: string; chatMode: string }[]) {
  const ids = circles.filter(c => c.chatMode !== 'off').map(c => c.id);
  const result = new Map<string, { last: { author: string; text: string; at: Date } | null; unseen: boolean }>();
  if (ids.length === 0) return result;
  const [lasts, members] = await Promise.all([
    prisma.circleMessage.findMany({
      where: { circleId: { in: ids }, createdAt: { gt: chatSince() }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      distinct: ['circleId'],
      select: { circleId: true, authorId: true, content: true, imageKey: true, deletedAt: true, createdAt: true, author: { select: { pseudo: true } } },
    }),
    prisma.circleMember.findMany({ where: { userId, circleId: { in: ids } }, select: { circleId: true, chatSeenAt: true } }),
  ]);
  const seen = new Map(members.map(m => [m.circleId, m.chatSeenAt]));
  for (const id of ids) {
    const last = lasts.find(l => l.circleId === id);
    const seenAt = seen.get(id);
    result.set(id, {
      last: last ? { author: last.author.pseudo, text: chatPreview(last), at: last.createdAt } : null,
      unseen: !!last && last.authorId !== userId && (!seenAt || last.createdAt > seenAt),
    });
  }
  return result;
}

export const plainCircleMessage = <T extends { content: string; deletedAt: Date | null }>(m: T) => withPlainContent(m);

// Personnes mentionnées (@pseudo) parmi les membres du Cercle
export function mentionedIn(text: string, members: { userId: string; pseudo: string }[], authorId: string): string[] {
  return members
    .filter(m => m.userId !== authorId && new RegExp(`@${m.pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
    .map(m => m.userId);
}

// Tâche horaire (gated comme les autres crons) : messages de plus de 7 jours effacés, photos comprises
export async function deleteExpiredCircleMessages() {
  const old = await prisma.circleMessage.findMany({ where: { createdAt: { lt: chatSince() } }, select: { id: true, imageKey: true } });
  if (old.length === 0) return 0;
  for (const m of old) if (m.imageKey) await deletePhoto(m.imageKey).catch(() => {});
  await prisma.circleMessage.deleteMany({ where: { id: { in: old.map(m => m.id) } } });
  return old.length;
}
