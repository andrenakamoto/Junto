// Canal des notifications choisi par chaque personne (User.notificationChannel) :
//   push  → notifications push (apps Android / iPhone) uniquement
//   both  → push + emails de notification (défaut)
//   email → emails de notification uniquement
// Ne concerne que les notifications : les emails indispensables (validation de compte, mot
// de passe, changement d'adresse, suppression de compte) et le résumé des dépenses d'un Plan
// qui se termine partent toujours. Le résumé hebdomadaire garde son propre réglage. Les
// notifications dans l'app (pendant qu'on l'utilise) ne changent pas.
export const NOTIFICATION_CHANNELS = ['push', 'both', 'email'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export function parseNotificationChannel(value: unknown): NotificationChannel | null {
  return NOTIFICATION_CHANNELS.includes(value as NotificationChannel) ? value as NotificationChannel : null;
}

export const wantsEmail = (channel: string | null | undefined) => channel !== 'push';
export const wantsPush = (channel: string | null | undefined) => channel !== 'email';
