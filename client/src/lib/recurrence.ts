import { intlLocale, t } from '../i18n';

// Plans récurrents (serveur : lib/recurrence.ts) : libellés et étiquette « 🔁 Chaque lundi »
export type Recurrence = 'weekly' | 'biweekly' | 'monthly';

export const RECURRENCE_OPTIONS: { value: Recurrence | ''; label: string }[] = [
  { value: '', label: t('settings.recurrence.none') },
  { value: 'weekly', label: t('settings.recurrence.weekly') },
  { value: 'biweekly', label: t('settings.recurrence.biweekly') },
  { value: 'monthly', label: t('settings.recurrence.monthly') },
];

// « Chaque lundi », « Un lundi sur deux », « Chaque mois, le 15 »
export function recurrenceLabel(recurrence: string | null | undefined, eventDate: string | null | undefined): string | null {
  if (!recurrence || !eventDate) return null;
  const d = new Date(eventDate);
  const weekday = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' }).format(d);
  if (recurrence === 'weekly') return t('settings.recurrence.labelWeekly', { weekday });
  if (recurrence === 'biweekly') return t('settings.recurrence.labelBiweekly', { weekday });
  if (recurrence === 'monthly') return t('settings.recurrence.labelMonthly', { day: d.getDate() });
  return null;
}
