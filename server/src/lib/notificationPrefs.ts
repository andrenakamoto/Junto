// Canal des notifications choisi par chaque personne (User.notificationChannel) :
//   push  → notifications push (apps Android / iPhone) uniquement (défaut depuis le 2026-10-17) ; tant que la personne
//           n'a aucun téléphone avec l'app, elle reçoit les emails à la place (sinon, sur le site seul, plus rien)
//   both  → push + emails de notification
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

import prisma from './prisma';

// Comptes qui ont au moins un téléphone enregistré pour le push (table PushToken, petite) : gardés en mémoire,
// rechargés au démarrage, toutes les 10 minutes et quand un appareil s'enregistre ou se retire (routes/push.ts)
let phoneUsers = new Set<string>();
export async function refreshPhoneUsers() {
  try {
    const rows = await prisma.pushToken.findMany({ select: { userId: true }, distinct: ['userId'] });
    phoneUsers = new Set(rows.map(r => r.userId));
  } catch (e) {
    console.error('[push] liste des téléphones', e);
  }
}
export const hasPhone = (userId: string) => phoneUsers.has(userId);

// Email de notification ? « push » sans téléphone avec l'app = emails en secours
export const wantsEmail = (channel: string | null | undefined, userId?: string | null) =>
  channel !== 'push' || (!!userId && !phoneUsers.has(userId));
export const wantsPush = (channel: string | null | undefined) => channel !== 'email';
