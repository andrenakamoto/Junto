// Modifier ou supprimer un message (chat d'un Plan ou d'un sondage de dates) :
// seulement son auteur, et seulement dans les 15 minutes qui suivent l'envoi.
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

type EditableMessage = { authorId: string; createdAt: Date; deletedAt: Date | null };

export function checkMessageEdit(message: EditableMessage | null, userId: string, now = new Date()): string | null {
  if (!message) return 'Message introuvable';
  if (message.authorId !== userId) return 'Tu ne peux modifier que tes propres messages';
  if (message.deletedAt) return 'Ce message a été supprimé';
  if (now.getTime() - message.createdAt.getTime() > MESSAGE_EDIT_WINDOW_MS) return 'Un message ne peut plus être modifié ni supprimé 15 minutes après son envoi';
  return null;
}

export function cleanContent(v: unknown, max = 2000): string | null {
  const content = typeof v === 'string' ? v.trim() : '';
  return content && content.length <= max ? content : null;
}
