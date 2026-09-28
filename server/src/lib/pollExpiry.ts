// Échéance d'un sondage de dates (CirclePoll) : il expire à la première des deux
// échéances — le lendemain de la dernière date proposée, ou 30 jours après sa
// création. Passé ce délai, il est supprimé avec ses votes et son chat
// (deleteExpiredPolls). Calculée à la volée, rien n'est stocké.

export const POLL_MAX_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export function pollExpiresAt(createdAt: Date, optionDates: (Date | null)[]): Date {
  const cap = createdAt.getTime() + POLL_MAX_DAYS * DAY;
  const dated = optionDates.filter((d): d is Date => d !== null).map(d => d.getTime());
  if (dated.length === 0) return new Date(cap);
  return new Date(Math.min(cap, Math.max(...dated) + DAY));
}

// Une date déjà passée ne se vote plus et ne peut plus devenir un Plan
export function isPastOption(eventDate: Date | null, now = new Date()): boolean {
  return eventDate !== null && eventDate.getTime() < now.getTime();
}

// Ajoute expiresAt à un sondage renvoyé par l'API
export function withExpiry<T extends { createdAt: Date; options: { eventDate: Date | null }[] }>(poll: T): T & { expiresAt: Date } {
  return { ...poll, expiresAt: pollExpiresAt(poll.createdAt, poll.options.map(o => o.eventDate)) };
}
