export function icsEscape(s: string): string {
  return s.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
}

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Début et fin de l'événement exporté : du début du Plan à sa date de fin. Sans date de
// début, l'événement est placé sur sa date de fin. Fin incohérente (avant le début) :
// 2 heures par défaut.
export function icsEventTimes(eventDate: Date | null, endDate: Date): { start: Date; end: Date } {
  if (!eventDate) return { start: endDate, end: endDate };
  const end = endDate.getTime() > eventDate.getTime() ? endDate : new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  return { start: eventDate, end };
}
