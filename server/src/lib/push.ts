import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import prisma from './prisma';
import { isMuted, MUTE_EXEMPT_TYPES } from './mutes';
import { isBlockedBy } from './moderation';
import { translateMessage, userLocale, type Locale } from './i18n';
import { PUSH_TEXTS } from '../i18n/push';

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
export function pushContent(n: AppNotification, locale: Locale = 'fr'): { title: string; body: string; url: string; group: string } | null {
  const T = PUSH_TEXTS[locale];
  const from = n.from ? `@${n.from}` : T.someone;
  const fill = (s: string) => s.replace('{from}', from).replace('{plan}', n.planTitle ?? '').replace('{circle}', n.circleName ?? '').replace('{old}', n.preview ?? '');
  const planUrl = `/dashboard?planId=${n.planId}`;
  const pollUrl = `/dashboard?circleId=${n.circleId}&pollId=${n.pollId}`;
  const circleUrl = `/dashboard?circleId=${n.circleId}`;
  switch (n.type) {
    case 'new_message':
      return { title: n.planTitle ?? 'EvLY', body: fill(T.newMessage), url: `${planUrl}&tab=chat`, group: `chat:${n.planId}` };
    case 'mention':
      return { title: n.planTitle ?? 'EvLY', body: fill(T.mention), url: `${planUrl}&tab=chat`, group: `chat:${n.planId}` };
    case 'new_plan':
      return { title: n.circleName ?? T.newPlanTitle, body: fill(T.newPlan), url: planUrl, group: `plan:${n.planId}` };
    case 'plan_activity':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? T.planNews, url: planUrl, group: `activity:${n.planId}` };
    case 'santa_draw':
    case 'santa_message':
    case 'santa_reveal':
    case 'santa_reminder':
      return { title: n.planTitle ?? T.santa, body: n.preview ?? T.santaNews, url: `${planUrl}&tab=pere_noel`, group: `santa:${n.planId}` };
    case 'killer':
      return { title: n.planTitle ?? 'Killer', body: n.preview ?? T.killerNews, url: `${planUrl}&tab=killer`, group: `killer:${n.planId}` };
    case 'quiz':
      return { title: n.planTitle ?? T.quiz, body: n.preview ?? T.quizNews, url: `${planUrl}&tab=quiz`, group: `quiz:${n.planId}` };
    case 'assembly':
    case 'assembly_vote':
      return { title: n.planTitle ?? T.assembly, body: n.preview ?? T.assemblyNews, url: `${planUrl}&tab=assemblee`, group: `assembly:${n.planId}` };
    case 'wheel':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? T.wheel, url: `${planUrl}&tab=votes`, group: `wheel:${n.planId}` };
    case 'match':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? T.matchNews, url: `${planUrl}&tab=votes`, group: `match:${n.planId}` };
    case 'waitlist':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? T.waitlist, url: planUrl, group: `plan:${n.planId}` };
    case 'shift_reminder':
      return { title: n.planTitle ?? T.volunteers, body: n.preview ?? T.shiftSoon, url: `${planUrl}&tab=benevoles`, group: `shift:${n.planId}` };
    case 'words':
      return { title: n.planTitle ?? T.words, body: n.preview ?? T.wordsNews, url: `${planUrl}&tab=mot_piege`, group: `words:${n.planId}` };
    case 'teams':
      return { title: n.planTitle ?? T.teams, body: n.preview ?? T.teamsNews, url: `${planUrl}&tab=equipes`, group: `teams:${n.planId}` };
    case 'pot':
      return { title: n.planTitle ?? T.pot, body: n.preview ?? T.potNews, url: `${planUrl}&tab=cagnotte`, group: `pot:${n.planId}` };
    case 'plan_member':
      return { title: n.planTitle ?? 'EvLY', body: n.preview ?? T.membersNews, url: planUrl, group: `members:${n.planId}` };
    case 'plan_reminder':
      return { title: n.planTitle ?? 'EvLY', body: T.planReminder, url: planUrl, group: `plan:${n.planId}` };
    case 'poll_reminder':
      return { title: n.planTitle ?? T.poll, body: T.pollReminder, url: pollUrl, group: `poll:${n.pollId}` };
    case 'ride':
      return { title: n.planTitle ?? T.rides, body: n.preview ?? T.ridesNews, url: planUrl, group: `ride:${n.planId}` };
    case 'new_circle_poll':
      return { title: n.circleName ?? T.newPollTitle, body: fill(T.newPoll), url: pollUrl, group: `poll:${n.pollId}` };
    case 'poll_message':
      return { title: n.planTitle ?? T.poll, body: fill(T.newMessage), url: pollUrl, group: `poll:${n.pollId}` };
    case 'join_request':
      return { title: n.circleName ?? 'EvLY', body: fill(T.joinRequest), url: circleUrl, group: `join:${n.circleId}` };
    case 'circle_renamed':
      return { title: n.circleName ?? 'EvLY', body: fill(T.renamed), url: circleUrl, group: `circle:${n.circleId}` };
    case 'circle_invite':
      return { title: n.circleName ?? 'EvLY', body: fill(T.invite), url: '/dashboard?invitations=1', group: `invite:${n.circleName}` };
    case 'join_accepted':
      return { title: n.circleName ?? 'EvLY', body: T.joinAccepted, url: circleUrl, group: `join:${n.circleId}` };
    case 'suggestion_update':
      return {
        title: 'EvLY',
        body: n.status === 'done' ? T.suggestionDone : T.suggestionPlanned,
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

export async function sendPush(userId: string, n: AppNotification, locale?: Locale): Promise<void> {
  const client = getClient();
  if (!client) return;
  const content = pushContent(n, locale ?? await userLocale(userId));
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
// Rien si l'auteur est masqué par le destinataire (lib/moderation.ts) ou si le Plan / le Cercle
// est en silence pour lui (lib/mutes.ts, sauf mentions et invitations)
export function notifyUser(io: { to(room: string): { emit(ev: string, data: unknown): unknown } } | undefined, userId: string, n: AppNotification) {
  // Aperçu traduit dans la langue du destinataire (lib/i18n.ts), comme le texte du push
  const deliver = () => {
    userLocale(userId)
      .catch(() => 'fr' as Locale)
      .then(locale => {
        const local = locale === 'fr' || !n.preview || n.type === 'circle_renamed' ? n : { ...n, preview: translateMessage(n.preview, locale) };
        io?.to(`user:${userId}`).emit('notification', local);
        return sendPush(userId, local, locale);
      })
      .catch(e => console.error('[push]', e));
  };
  const checks: Promise<boolean>[] = [];
  if (n.actorId) checks.push(isBlockedBy(userId, n.actorId));
  if (!MUTE_EXEMPT_TYPES.has(n.type) && (n.planId || n.circleId)) checks.push(isMuted(userId, { planId: n.planId, circleId: n.circleId }));
  if (checks.length === 0) { deliver(); return; }
  Promise.all(checks)
    .then(results => { if (!results.some(Boolean)) deliver(); })
    .catch(e => { console.error('[notify checks]', e); deliver(); });
}
