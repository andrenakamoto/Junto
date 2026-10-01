import prisma from './prisma';
import { resend, FROM_EMAIL, APP_URL, notificationFooter } from './mailer';
import { pollExpiresAt } from './pollExpiry';
import { wantsEmail } from './notificationPrefs';
import { sendPush } from './push';

const HOUR = 60 * 60 * 1000;

// Supprime les sondages de dates expirés (voir pollExpiry.ts), avec leurs votes
// et leur chat (cascade). Supprime aussi les sondages déjà convertis en Plan
// avant que la conversion ne les supprime directement (2026-09-28).
export async function deleteExpiredPolls() {
  try {
    const now = new Date();
    const polls = await prisma.circlePoll.findMany({
      select: { id: true, createdAt: true, resolvedAt: true, options: { select: { eventDate: true } } },
    });
    const ids = polls
      .filter(p => p.resolvedAt || pollExpiresAt(p.createdAt, p.options.map(o => o.eventDate)) <= now)
      .map(p => p.id);
    if (ids.length === 0) return;
    const { count } = await prisma.circlePoll.deleteMany({ where: { id: { in: ids } } });
    if (count > 0) console.log(`[cleanup] ${count} sondage(s) de dates expiré(s) ou converti(s) supprimé(s)`);
  } catch (e: any) {
    console.error('[cleanup] Erreur lors de la suppression des sondages expirés:', e.message);
  }
}

// La veille de l'échéance, rappelle au créateur de créer le Plan tant qu'il est
// temps. Pas pour un sondage créé il y a moins de 12 h (échéance déjà proche
// dès la création : le créateur sait ce qu'il fait).
export async function sendPollReminders() {
  try {
    const now = Date.now();
    const polls = await prisma.circlePoll.findMany({
      where: { resolvedAt: null, reminderSentAt: null, createdAt: { lt: new Date(now - 12 * HOUR) } },
      include: {
        options: { include: { votes: { select: { userId: true } } } },
        creator: { select: { id: true, pseudo: true, email: true, emailVerified: true, notificationChannel: true } },
        circle: { select: { id: true, name: true } },
      },
    });

    for (const poll of polls) {
      const expiresAt = pollExpiresAt(poll.createdAt, poll.options.map(o => o.eventDate)).getTime();
      if (expiresAt <= now || expiresAt - now > 24 * HOUR) continue;

      // Marqué avant l'envoi : un échec d'email ne doit pas provoquer un rappel toutes les 15 min
      await prisma.circlePoll.update({ where: { id: poll.id }, data: { reminderSentAt: new Date() } });
      sendPush(poll.creator.id, { type: 'poll_reminder', circleId: poll.circle.id, pollId: poll.id, planTitle: poll.question })
        .catch(e => console.error('[poll_reminder push]', e));
      if (!poll.creator.email || !poll.creator.emailVerified || !wantsEmail(poll.creator.notificationChannel)) continue;

      const voters = new Set(poll.options.flatMap(o => o.votes.map(v => v.userId))).size;
      const open = poll.options.filter(o => !o.eventDate || o.eventDate.getTime() > now);
      const best = Math.max(0, ...open.map(o => o.votes.length));
      const bestLabels = best > 0 ? open.filter(o => o.votes.length === best).map(o => o.label) : [];
      const summary = bestLabels.length > 0
        ? `<p>${voters} personne${voters > 1 ? 's ont' : ' a'} répondu. La date la plus demandée : <strong>${bestLabels.join(' / ')}</strong> (${best} vote${best > 1 ? 's' : ''}).</p>`
        : '<p>Personne n\'a encore coché de date.</p>';

      const r = await resend.emails.send({
        from: FROM_EMAIL,
        to: poll.creator.email,
        subject: `Ton sondage "${poll.question}" se termine demain`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${poll.creator.pseudo} 👋</h2>
            <p>Ton sondage de dates <strong>"${poll.question}"</strong> dans le Cercle <strong>"${poll.circle.name}"</strong> se termine demain. Sans Plan créé d'ici là, il sera supprimé avec ses votes et son chat.</p>
            ${summary}
            <a href="${APP_URL}/dashboard?circleId=${poll.circle.id}&pollId=${poll.id}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Créer le Plan
            </a>
          ${notificationFooter()}
          </div>`,
      }).catch(e => ({ data: null, error: e }));
      if (r.error) console.error('[poll_reminder email]', poll.id, r.error);
    }
  } catch (e: any) {
    console.error('[poll_reminder] Erreur:', e.message);
  }
}
