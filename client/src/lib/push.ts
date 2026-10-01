import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FirebaseMessagingPlugin } from '@capacitor-firebase/messaging';
import api from '../services/api';

// Notifications push des apps Android / iOS (Firebase Cloud Messaging) — envoi côté
// serveur dans server/src/lib/push.ts. Le plugin natif est appelé directement : sa
// version web importerait le SDK Firebase dans le site, qui n'en a pas besoin.
const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>('FirebaseMessaging');

export const pushAvailable = Capacitor.isNativePlatform();

// Canal Android de priorité haute : sans lui, Android range les notifications dans le canal
// par défaut de Firebase (son, mais pas de bannière en haut de l'écran). Même identifiant que
// le serveur (server/src/lib/push.ts) et le manifeste Android. Une fois créé, Android garde
// ses réglages : changer de priorité impose un nouvel identifiant.
const ANDROID_CHANNEL_ID = 'evly_activity';

let currentToken: string | null = null;

async function sendToken(token: string) {
  currentToken = token;
  await api.post('/push/token', { token, platform: Capacitor.getPlatform() });
}

// Après connexion : demande l'autorisation (une seule fois, le système retient la réponse)
// puis enregistre l'appareil pour ce compte
export async function registerPush() {
  if (!pushAvailable) return;
  try {
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ({ receive } = await FirebaseMessaging.requestPermissions());
    }
    if (receive !== 'granted') return;
    if (Capacitor.getPlatform() === 'android') {
      await FirebaseMessaging.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: 'Messages et Plans',
        description: 'Nouveaux messages, mentions, Plans, sondages et covoiturage',
        importance: 4, // Importance.High : bannière, son et vibration
        vibration: true,
      });
    }
    const { token } = await FirebaseMessaging.getToken();
    if (token) await sendToken(token);
  } catch (e) {
    console.warn('[push] enregistrement impossible', e);
  }
}

// Avant déconnexion : l'appareil ne doit plus recevoir les notifications de ce compte.
// Le jeton d'authentification est passé explicitement, il est effacé juste après.
export function unregisterPush(authToken: string | null) {
  if (!pushAvailable || !currentToken || !authToken) return;
  api.delete('/push/token', { data: { token: currentToken }, headers: { Authorization: `Bearer ${authToken}` } })
    .catch(() => {});
  currentToken = null;
}

// À monter une seule fois au démarrage : jeton renouvelé par Firebase, et toucher une
// notification ouvre le Plan / sondage / Cercle concerné (lien interne fourni par le serveur)
export function listenPush(openUrl: (url: string) => void) {
  if (!pushAvailable) return () => {};
  const subs = [
    FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      if (localStorage.getItem('estelle_token')) sendToken(token).catch(() => {});
    }),
    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      const url = (notification.data as { url?: unknown } | undefined)?.url;
      if (typeof url === 'string' && url.startsWith('/')) openUrl(url);
    }),
  ];
  return () => { subs.forEach(s => s.then(h => h.remove())); };
}
