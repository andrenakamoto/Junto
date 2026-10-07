import prisma from './prisma';
import { escapeHtml } from './escapeHtml';
import { mutedAmong } from './mutes';
import { sendRecapBeforeDeletion } from './planRecap';
import { shiftHours, sortShifts } from './volunteers';
import { purgePlanFiles } from './cloudinary';
import { visiblePlansWhere } from './planAccess';
import { resend, FROM_EMAIL, APP_URL, notificationFooter } from './mailer';
import { computeByCurrency, formatAmount } from './expenses';
import { wantsEmail } from './notificationPrefs';
import { sendPush } from './push';

const REMINDER_WINDOW_START_H = 23;
const REMINDER_WINDOW_END_H = 25;

// Plans dont la date de fin est passée : envoie un résumé des dépenses aux
// membres (s'il y en a) avant suppression, puis supprime le Plan. Fait au
// cas par cas (pas de deleteMany en masse) pour pouvoir mailer chaque Plan.
export async function deleteExpiredPlans() {
  try {
    const expiredPlans = await prisma.plan.findMany({
      where: { endDate: { lt: new Date() } },
      include: {
        members: { include: { user: { select: { id: true, pseudo: true, email: true, emailVerified: true } } } },
        // splitWith indispensable : sans lui, chaque dépense serait répartie entre tous les membres
        expenses: { include: { paidBy: { select: { id: true, pseudo: true } }, splitWith: { select: { userId: true } } } },
        reimbursements: true,
      },
    });

    for (const plan of expiredPlans) {
      // Récapitulatif PDF pour ceux qui l'ont demandé (avant la suppression : il lit le Plan)
      await sendRecapBeforeDeletion(plan).catch(e => console.error('[recap] Plan', plan.id, e));
      if (plan.expenses.length > 0) {
        try {
          const memberIds = plan.members.map(m => m.userId);
          const transfers = computeByCurrency(memberIds, plan.expenses, plan.reimbursements)
            .flatMap(c => c.transfers.map(t => ({ ...t, currency: c.currency })));
          const pseudoOf = (id: string) => plan.members.find(m => m.userId === id)?.user.pseudo ?? '?';

          const expenseLines = plan.expenses
            .map(e => {
              const shared = e.splitWith.length > 0 && e.splitWith.length < memberIds.length
                ? `, partagé entre ${e.splitWith.map(s => pseudoOf(s.userId)).join(', ')}`
                : '';
              return `<li>${e.description} — ${formatAmount(e.amount, e.currency)} (payé par ${e.paidBy.pseudo}${shared})</li>`;
            })
            .join('');
          const transferLines = transfers.length > 0
            ? transfers.map(t => `<li>${pseudoOf(t.fromUserId)} doit ${formatAmount(t.amount, t.currency)} à ${pseudoOf(t.toUserId)}</li>`).join('')
            : '<li>Tout le monde est déjà à l\'équilibre.</li>';

          const recipients = plan.members.filter(m => m.user.email && m.user.emailVerified);
          await Promise.all(recipients.map(m => resend.emails.send({
            from: FROM_EMAIL,
            to: m.user.email!,
            subject: `Résumé des dépenses — "${plan.title}"`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:auto">
                <h2>Le Plan "${escapeHtml(plan.title)}" est terminé, ${escapeHtml(m.user.pseudo)} 👋</h2>
                <p>Voici un dernier résumé des dépenses avant que le Plan ne disparaisse :</p>
                <p style="font-weight:600;margin-bottom:4px">Dépenses</p>
                <ul>${expenseLines}</ul>
                <p style="font-weight:600;margin-bottom:4px">Pour équilibrer les comptes</p>
                <ul>${transferLines}</ul>
              </div>`,
          }).then(r => { if (r.error) console.error('[expense_summary email]', m.user.email, r.error); })
            .catch(e => console.error('[expense_summary email]', m.user.email, e))));
        } catch (e) {
          console.error('[expense_summary] Erreur pour le plan', plan.id, e);
        }
      }
    }

    await purgePlanFiles(expiredPlans.map(p => p.id));
    const { count } = await prisma.plan.deleteMany({ where: { id: { in: expiredPlans.map(p => p.id) } } });
    if (count > 0) console.log(`[cleanup] ${count} plan(s) expiré(s) supprimé(s)`);
  } catch (e: any) {
    console.error('[cleanup] Erreur lors de la suppression des plans expirés:', e.message);
  }
}

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
          include: { user: { select: { id: true, pseudo: true, email: true, emailVerified: true, notificationChannel: true } } },
        },
        volunteerSignups: { include: { shift: true } },
        santa: { include: { pairs: { include: { receiver: { select: { pseudo: true, firstName: true } } } } } },
      },
    });

    for (const plan of plans) {
      // Plan ou Cercle en silence : rappel gardé pour ceux qui ont répondu « Je suis in »,
      // pas pour les « Peut-être » (lib/mutes.ts)
      const muted = await mutedAmong({ planId: plan.id, circleId: plan.circleId }, plan.members.map(m => m.userId));
      const reminded = plan.members.filter(m => m.rsvp === 'in' || !muted.has(m.userId));
      const recipients = reminded
        .map(m => m.user)
        .filter(u => u.email && u.emailVerified && wantsEmail(u.notificationChannel));

      // Rappel aussi en push, pour ceux qui l'ont choisi (filtré dans sendPush)
      for (const m of reminded) {
        sendPush(m.user.id, { type: 'plan_reminder', planId: plan.id, planTitle: plan.title, circleId: plan.circleId })
          .catch(e => console.error('[reminder push]', e));
      }

      const eventDateFmt = plan.eventDate
        ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(plan.eventDate)
        : '';

      // Postes de bénévole de chacun (planning des bénévoles)
      const shiftsOf = (userId: string) => sortShifts(plan.volunteerSignups.filter(s => s.userId === userId).map(s => s.shift));
      const shiftsBlock = (userId: string) => {
        const shifts = shiftsOf(userId);
        if (shifts.length === 0) return '';
        return `<div style="background:#f1f5f9;border-radius:8px;padding:12px 14px;margin:16px 0">
              <p style="margin:0 0 6px;font-weight:600;color:#1e293b">🙋 Tes postes de bénévole</p>
              ${shifts.map(s => `<p style="margin:2px 0;color:#1e293b">${escapeHtml(s.title)}${s.startsAt ? ` — ${shiftHours(s)}` : ''}</p>`).join('')}
            </div>`;
      };

      // Père Noël secret : à qui la personne offre un cadeau (elle seule le voit)
      const santaBlock = (userId: string) => {
        const pair = plan.santa?.drawnAt && !plan.santa.revealedAt ? plan.santa.pairs.find(p => p.giverId === userId) : null;
        if (!pair) return '';
        const who = pair.receiver.firstName ?? '@' + pair.receiver.pseudo;
        return `<div style="background:#fff1f2;border-radius:8px;padding:12px 14px;margin:16px 0">
              <p style="margin:0;color:#1e293b">🎅 N'oublie pas le cadeau de <strong>${escapeHtml(who)}</strong>${plan.santa?.budget ? ` (budget : ${escapeHtml(plan.santa.budget)})` : ''}.</p>
            </div>`;
      };

      const results = await Promise.all(recipients.map(u => resend.emails.send({
        from: FROM_EMAIL,
        to: u.email!,
        subject: `Rappel — "${plan.title}" c'est demain`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Ça se passe demain, ${escapeHtml(u.pseudo)} 👋</h2>
            <p><strong>${escapeHtml(plan.title)}</strong> a lieu le ${eventDateFmt}${plan.location ? ` — ${escapeHtml(plan.location)}` : ''}.</p>
            ${plan.importantInfo ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;margin:16px 0">
              <p style="margin:0 0 6px;font-weight:600;color:#92400e">📌 Informations importantes</p>
              <p style="margin:0;white-space:pre-wrap;color:#1e293b">${escapeHtml(plan.importantInfo)}</p>
            </div>` : ''}
            ${shiftsBlock(u.id)}
            ${santaBlock(u.id)}
            <a href="${APP_URL}/dashboard?planId=${plan.id}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le Plan
            </a>
          ${notificationFooter()}
          </div>`,
      }).then(r => {
        if (r.error) console.error('[reminder email]', u.email, r.error);
        return !r.error;
      }).catch(e => { console.error('[reminder email]', u.email, e); return false; })));

      const sentCount = results.filter(Boolean).length;
      await prisma.plan.update({ where: { id: plan.id }, data: { reminderSentAt: now } });
      if (sentCount > 0) console.log(`[reminders] "${plan.title}" — ${sentCount}/${recipients.length} email(s) envoyé(s)`);
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
    let sentCount = 0;

    for (const user of users) {
      const plans = await prisma.plan.findMany({
        where: {
          endDate: { gt: now },
          ...visiblePlansWhere(user.id),
        },
        include: { circle: { select: { name: true, members: { where: { userId: user.id }, select: { userId: true } } } } },
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
        // Invité externe : on ne révèle pas le nom du Cercle
        const where = p.circle.members.length > 0 ? p.circle.name : 'invitation';
        return `<li><strong>${p.title}</strong> (${where}) — ${dateStr}</li>`;
      }).join('');

      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email!,
        subject: `Cette semaine sur EvLY — ${plans.length} Plan${plans.length > 1 ? 's' : ''} actif${plans.length > 1 ? 's' : ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${escapeHtml(user.pseudo)} 👋</h2>
            <p>Voici les Plans actifs dans tes Cercles :</p>
            <ul>${items}</ul>
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Ouvrir EvLY
            </a>
          ${notificationFooter('digest')}
          </div>`,
      }).catch(e => { console.error('[digest email]', user.email, e); return null; });
      if (result?.error) console.error('[digest email]', user.email, result.error);
      else if (result) sentCount++;

      await prisma.user.update({ where: { id: user.id }, data: { lastDigestSentAt: now } });
    }

    if (sentCount > 0) console.log(`[digest] ${sentCount} résumé(s) hebdomadaire(s) envoyé(s)`);
  } catch (e) {
    console.error('[digest] Erreur:', e);
  }
}

// Texte saisi par un participant, inséré dans un email HTML
