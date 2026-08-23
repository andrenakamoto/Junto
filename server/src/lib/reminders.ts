import prisma from './prisma';
import { resend, FROM_EMAIL, APP_URL } from './mailer';

const REMINDER_WINDOW_START_H = 23;
const REMINDER_WINDOW_END_H = 25;

export async function sendPlanReminders() {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + REMINDER_WINDOW_START_H * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_END_H * 60 * 60 * 1000);

    const plans = await prisma.plan.findMany({
      where: {
        eventDate: { gte: windowStart, lte: windowEnd },
        reminderSentAt: null,
      },
      include: {
        members: {
          where: { rsvp: { in: ['in', 'maybe'] } },
          include: { user: { select: { id: true, pseudo: true, email: true, emailVerified: true } } },
        },
      },
    });

    for (const plan of plans) {
      const recipients = plan.members
        .map(m => m.user)
        .filter(u => u.email && u.emailVerified);

      const eventDateFmt = plan.eventDate
        ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(plan.eventDate)
        : '';

      await Promise.all(recipients.map(u => resend.emails.send({
        from: FROM_EMAIL,
        to: u.email!,
        subject: `Rappel — "${plan.title}" c'est demain`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Ça se passe demain, ${u.pseudo} 👋</h2>
            <p><strong>${plan.title}</strong> a lieu le ${eventDateFmt}${plan.location ? ` — ${plan.location}` : ''}.</p>
            <a href="${APP_URL}/dashboard?planId=${plan.id}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le Plan
            </a>
          </div>`,
      }).catch(e => console.error('[reminder email]', u.email, e))));

      await prisma.plan.update({ where: { id: plan.id }, data: { reminderSentAt: now } });
      if (recipients.length > 0) console.log(`[reminders] "${plan.title}" — ${recipients.length} email(s) envoyé(s)`);
    }
  } catch (e) {
    console.error('[reminders] Erreur:', e);
  }
}

export async function sendWeeklyDigest() {
  try {
    const now = new Date();
    if (now.getUTCDay() !== 1) return; // lundi uniquement
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      where: {
        weeklyDigestEnabled: true,
        email: { not: null },
        emailVerified: true,
        OR: [{ lastDigestSentAt: null }, { lastDigestSentAt: { lt: sixDaysAgo } }],
      },
      select: { id: true, pseudo: true, email: true },
    });

    for (const user of users) {
      const plans = await prisma.plan.findMany({
        where: {
          endDate: { gt: now },
          circle: { members: { some: { userId: user.id } } },
        },
        include: { circle: { select: { name: true } } },
        orderBy: { eventDate: 'asc' },
        take: 10,
      });

      if (plans.length === 0) {
        await prisma.user.update({ where: { id: user.id }, data: { lastDigestSentAt: now } });
        continue;
      }

      const items = plans.map(p => {
        const dateStr = p.eventDate
          ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(p.eventDate)
          : 'Date libre';
        return `<li><strong>${p.title}</strong> (${p.circle.name}) — ${dateStr}</li>`;
      }).join('');

      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email!,
        subject: `Cette semaine sur Estelle — ${plans.length} Plan${plans.length > 1 ? 's' : ''} actif${plans.length > 1 ? 's' : ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${user.pseudo} 👋</h2>
            <p>Voici les Plans actifs dans tes Cercles :</p>
            <ul>${items}</ul>
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Ouvrir Estelle
            </a>
            <p style="color:#888;font-size:12px;margin-top:24px">
              Tu reçois cet email chaque lundi. Tu peux le désactiver dans les paramètres de notifications.
            </p>
          </div>`,
      }).catch(e => console.error('[digest email]', user.email, e));

      await prisma.user.update({ where: { id: user.id }, data: { lastDigestSentAt: now } });
    }

    if (users.length > 0) console.log(`[digest] ${users.length} résumé(s) hebdomadaire(s) envoyé(s)`);
  } catch (e) {
    console.error('[digest] Erreur:', e);
  }
}
