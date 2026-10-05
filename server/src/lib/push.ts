import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import prisma from './prisma';
import { isBlockedBy } from './moderation';

// Notifications push des apps Android / iOS, via Firebase Cloud Messaging (projet
// Firebase « EvLY »). Clé du compte de service dans FIREBASE_SERVICE_ACCOUNT_B64
// (JSON encodé en base64), sur Railway uniquement : sans elle (serveur local),
// rien n'est envoyé.
//
// Confidentialité : une notification ne contient jamais le texte d'un message
// (« Nouveau message de @julie »), seulement qui, où, et le lien à ouvrir.

export type AppNotification = {
  type: string;
  planId?: string;
  planTitle?: string;
  circleId?: string;
  circleName?: string;
  pollId?: string;
  from?: string;
  /** Auteur de l'action : pas de notification si le destinataire l'a masqué (lib/moderation.ts) */
  actorId?: string;
  preview?: string;
  /** Suggestion dont le statut a changé (type suggestion_update) */
  suggestionId?: string;
  status?: string;
};

let messaging: Messaging | null | undefined;

function getClient(): Messaging | null {
  if (messaging !== undefined) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_B64 absente : notifications push désactivées');
    return (messaging = null);
  }
  try {
    const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) });
    return (messaging = getMessaging(app));
  } catch (e) {
    console.error('[push] clé Firebase illisible', e);
    return (messaging = null);
  }
}

// Titre, texte, lien à ouvrir et clé de regroupement (une notification par Plan
// ou sondage : la suivante remplace la précédente au lieu de s'empiler)
export function pushContent(n: AppNotification): { title: string; body: string; url: string; group: string } | null {
  const from = n.from ? `@${n.from}` : 'Quelqu\'un';
  const planUrl = `/dashboard?planId=${n.planId}`;
  const pollUrl = `/dashboard?circleId=${n.circleId}&pollId=${n.pollId}`;
  const circleUrl = `/dashboard?circleId=${n.circleId}`;
  switch (n.type) {
    case 'new_message':
      return { title: n.planTitle ?? 'EvLY', body: `Nouveau message de ${from}`, url: `${planUrl}&tab=chat`, group: `chat:${n.planId}` };
    case 'mention':
      return { title: n.planTitle ?? 'EvLY', body: `${from} t'a mentionné(e)`, url: `${planUrl}&tab=chat`, group: `chat:${n.planId}` };
    case 'new_plan':
      return { title: n.circleName ?? 'Nouveau Plan', body: `${from} propose un nouveau Plan : ${n.planTitle}`, url: planUrl, group: `plan:${n.planId}` };
    case 'plan_activity':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? 'Du nouveau dans le Plan', url: planUrl, group: `activity:${n.planId}` };
    case 'plan_member':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? 'Du changement chez les participants', url: planUrl, group: `members:${n.planId}` };
    case 'plan_reminder':
      return { title: n.planTitle ?? 'EvLY', body: 'C\'est demain ! Pense à vérifier les détails du Plan', url: planUrl, group: `plan:${n.planId}` };
    case 'poll_reminder':
      return { title: n.planTitle ?? 'Sondage', body: 'Ton sondage se termine demain : crée le Plan tant qu\'il est temps', url: pollUrl, group: `poll:${n.pollId}` };
    case 'ride':
      return { title: n.planTitle ?? 'Covoiturage', body: n.preview ?? 'Du nouveau dans le covoiturage', url: planUrl, group: `ride:${n.planId}` };
    case 'new_circle_poll':
      return { title: n.circleName ?? 'Nouveau sondage', body: `${from} lance un sondage : ${n.planTitle}`, url: pollUrl, group: `poll:${n.pollId}` };
    case 'poll_message':
      return { title: n.planTitle ?? 'Sondage', body: `Nouveau message de ${from}`, url: pollUrl, group: `poll:${n.pollId}` };
    case 'join_request':
      return { title: n.circleName ?? 'EvLY', body: `${from} demande à rejoindre le Cercle`, url: circleUrl, group: `join:${n.circleId}` };
    case 'circle_renamed':
      return { title: n.circleName ?? 'EvLY', body: `${from} a renommé le Cercle « ${n.preview} » en « ${n.circleName} »`, url: circleUrl, group: `circle:${n.circleId}` };
    case 'circle_invite':
      return { title: n.circleName ?? 'EvLY', body: `${from} t'invite à rejoindre le Cercle`, url: '/dashboard?invitations=1', group: `invite:${n.circleName}` };
    case 'join_accepted':
      return { title: n.circleName ?? 'EvLY', body: 'Ta demande est acceptée : bienvenue dans le Cercle !', url: circleUrl, group: `join:${n.circleId}` };
    case 'suggestion_update':
      return {
        title: 'EvLY',
        body: n.status === 'done' ? 'Ta suggestion a été réalisée 🎉 Merci !' : 'Ta suggestion est prévue 🙌 Merci !',
        url: '/dashboard?suggestions=1',
        group: `suggestion:${n.suggestionId}`,
      };
    default:
      return null;
  }
}

const EXPIRED_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function sendPush(userId: string, n: AppNotification): Promise<void> {
  const client = getClient();
  const content = pushContent(n);
  if (!client || !content) return;
  // Personne qui a choisi « email uniquement » (lib/notificationPrefs.ts) : aucun appareil retenu
  const tokens = (await prisma.pushToken.findMany({
    where: { userId, user: { notificationChannel: { not: 'email' } } },
    select: { token: true },
  })).map(t => t.token);
  if (tokens.length === 0) return;

  const result = await client.sendEachForMulticast({
    tokens,
    notification: { title: content.title, body: content.body },
    data: { url: content.url },
    android: {
      collapseKey: content.group,
      priority: 'high',
      // Canal créé par l'app (client/src/lib/push.ts) : priorité haute → bannière en haut de l'écran
      notification: { channelId: 'evly_activity', tag: content.group, color: '#ea5a2b', icon: 'ic_stat_evly', sound: 'default' },
    },
    apns: {
      headers: { 'apns-collapse-id': content.group.slice(0, 64) },
      payload: { aps: { sound: 'default', threadId: content.group } },
    },
  });

  const expired = result.responses
    .map((r, i) => (!r.success && r.error && EXPIRED_TOKEN_ERRORS.has(r.error.code) ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  if (expired.length > 0) await prisma.pushToken.deleteMany({ where: { token: { in: expired } } });
  // Diagnostic dans les journaux Railway : type et nombre d'appareils, aucun contenu
  console.log(`[push] ${n.type} → ${result.successCount}/${tokens.length} appareil(s)${expired.length ? `, ${expired.length} jeton(s) expiré(s) retiré(s)` : ''}`);
}

// Notification dans l'app (temps réel) + push sur les téléphones, en arrière-plan
export function notifyUser(io: { to(room: string): { emit(ev: string, data: unknown): unknown } } | undefined, userId: string, n: AppNotification) {
  const deliver = () => {
    io?.to(`user:${userId}`).emit('notification', n);
    sendPush(userId, n).catch(e => console.error('[push]', e));
  };
  if (!n.actorId) { deliver(); return; }
  isBlockedBy(userId, n.actorId)
    .then(blocked => { if (!blocked) deliver(); })
    .catch(e => { console.error('[notify block check]', e); deliver(); });
}
