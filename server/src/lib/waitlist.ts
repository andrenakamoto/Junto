import prisma from './prisma';
import { parseLocale } from './i18n';
import { mail } from './emailText';
import { getPlanAccess } from './planAccess';
import { markAllSeen } from './planActivity';
import { notifyUser } from './push';
import { notifyMembershipChange } from './planNotifications';
import { resend, FROM_EMAIL, APP_URL, notificationFooter } from './mailer';
import { wantsEmail } from './notificationPrefs';
import { escapeHtml } from './escapeHtml';

// Liste d'attente d'un Plan complet. Une place = une réponse « Je suis in » ou « Peut-être » : un
// « Je passe » libère donc sa place. Quand une place se libère, la première personne de la liste devient
// participante (« Je suis in ») et est prévenue (dans l'app, push et email selon ses réglages).
// Réservée aux membres du Cercle (les invités externes et les réponses sans compte voient « complet »).

// Personnes qui occupent une place
export const occupiedWhere = (planId: string) => ({ planId, rsvp: { not: 'out' } });

export async function occupiedCount(planId: string) {
  return prisma.planMember.count({ where: occupiedWhere(planId) });
}

// Reste-t-il une place pour cette personne ? Pas de limite : oui. Sinon il faut une place libre et que
// personne n'attende avant elle (la liste d'attente passe en premier).
export async function hasFreeSpot(plan: { id: string; maxParticipants: number | null }, userId?: string): Promise<boolean> {
  if (plan.maxParticipants === null) return true;
  if (await occupiedCount(plan.id) >= plan.maxParticipants) return false;
  const first = await prisma.planWaitlist.findFirst({ where: { planId: plan.id }, orderBy: { createdAt: 'asc' }, select: { userId: true } });
  return !first || first.userId === userId;
}

// Position (1 = premier) de chaque personne en attente
export function waitlistPositions(rows: { userId: string; createdAt: Date }[]): Map<string, number> {
  return new Map([...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((r, i) => [r.userId, i + 1]));
}

const busy = new Set<string>();

// Remplit les places libres avec la liste d'attente, dans l'ordre d'inscription. À appeler après tout ce
// qui peut libérer une place. Une seule promotion à la fois par Plan (dans ce serveur).
export async function promoteFromWaitlist(io: any, planId: string): Promise<string[]> {
  if (busy.has(planId)) return [];
  busy.add(planId);
  const promoted: string[] = [];
  try {
    for (let guard = 0; guard < 50; guard++) {
      const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true, maxParticipants: true, endDate: true } });
      if (!plan || plan.endDate <= new Date()) break;
      const first = await prisma.planWaitlist.findFirst({ where: { planId }, orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, pseudo: true, firstName: true, email: true, emailVerified: true, notificationChannel: true, locale: true } } } });
      if (!first) break;
      // Plus de limite, ou une place libre
      if (plan.maxParticipants !== null && await occupiedCount(planId) >= plan.maxParticipants) break;
      // La personne doit toujours avoir accès au Plan (encore dans le Cercle, pas exclue d'une surprise)
      const access = await getPlanAccess(first.userId, planId);
      if (!access?.canView || access.isExcluded || !access.isCircleMember) {
        await prisma.planWaitlist.delete({ where: { planId_userId: { planId, userId: first.userId } } });
        continue;
      }
      const existing = await prisma.planMember.findUnique({ where: { userId_planId: { userId: first.userId, planId } }, select: { rsvp: true } });
      await prisma.$transaction([
        existing
          ? prisma.planMember.update({ where: { userId_planId: { userId: first.userId, planId } }, data: { rsvp: 'in' } })
          : prisma.planMember.create({ data: { userId: first.userId, planId, rsvp: 'in' } }),
        prisma.planWaitlist.delete({ where: { planId_userId: { planId, userId: first.userId } } }),
      ]);
      if (!existing) await markAllSeen(planId, first.userId);
      promoted.push(first.userId);
      notifyUser(io, first.userId, { type: 'waitlist', planId, planTitle: plan.title, circleId: plan.circleId, preview: '🎉 Une place s’est libérée, tu es dedans !' });
      notifyMembershipChange(io, planId, { id: first.userId, pseudo: first.user.pseudo }, existing ? 'back' : 'join').catch(e => console.error('[waitlist notify]', e));
      if (first.user.email && first.user.emailVerified && wantsEmail(first.user.notificationChannel)) {
        const m = mail(parseLocale(first.user.locale) ?? 'fr');
        resend.emails.send({
          from: FROM_EMAIL,
          to: first.user.email,
          subject: m.s('waitlist.subject', { plan: plan.title }),
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2>${m.t('waitlist.title', { name: first.user.firstName ?? first.user.pseudo })}</h2>
              <p>${m.t('waitlist.text', { plan: plan.title })}</p>
              <p>${m.t('waitlist.cantCome')}</p>
              <a href="${APP_URL}/dashboard?planId=${planId}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${m.t('common.viewPlan')}</a>
              ${notificationFooter('simple', m.locale)}
            </div>`,
        }).then(r => { if (r.error) console.error('[waitlist email]', r.error); }).catch(e => console.error('[waitlist email]', e));
      }
    }
  } catch (e) {
    console.error('[waitlist promote]', e);
  } finally {
    busy.delete(planId);
  }
  if (promoted.length) {
    const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { circleId: true } });
    io?.to(`plan:${planId}`).emit('plan-updated', { planId });
    if (plan) io?.to(`circle:${plan.circleId}`).emit('circle-updated', { circleId: plan.circleId });
  }
  return promoted;
}
