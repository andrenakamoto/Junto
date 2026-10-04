// Plans récurrents (serveur : lib/recurrence.ts) : libellés et étiquette « 🔁 Chaque lundi »
export type Recurrence = 'weekly' | 'biweekly' | 'monthly';

export const RECURRENCE_OPTIONS: { value: Recurrence | ''; label: string }[] = [
  { value: '', label: 'Ne se répète pas' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'biweekly', label: 'Toutes les 2 semaines' },
  { value: 'monthly', label: 'Chaque mois' },
];

// « Chaque lundi », « Un lundi sur deux », « Chaque mois, le 15 »
export function recurrenceLabel(recurrence: string | null | undefined, eventDate: string | null | undefined): string | null {
  if (!recurrence || !eventDate) return null;
  const d = new Date(eventDate);
  const weekday = new Intl.DateTimeFormat('fr-CH', { weekday: 'long' }).format(d);
  if (recurrence === 'weekly') return `Chaque ${weekday}`;
  if (recurrence === 'biweekly') return `Un ${weekday} sur deux`;
  if (recurrence === 'monthly') return `Chaque mois, le ${d.getDate()}`;
  return null;
}
