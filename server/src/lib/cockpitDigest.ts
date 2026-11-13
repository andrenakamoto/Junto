import prisma from './prisma';
import { parseLocale } from './i18n';
import { mail } from './emailText';
import { escapeHtml } from './escapeHtml';
import { formatAmount } from './expenses';
import { resend, FROM_EMAIL, APP_URL } from './mailer';
import { buildCockpit, zurichDay } from './cockpit';

// Résumé hebdomadaire du cockpit (2026-11-13) : chaque lundi dès 7 h (heure suisse), à la direction et aux
// administrateurs de chaque Organisation qui ne l'ont pas désactivé (OrganisationMember.cockpitDigest). Rien n'est
// envoyé quand il n'y a rien à signaler. Lancé toutes les heures par index.ts (gated comme les autres crons).

const zurichHour = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Zurich' }).format(d));
const zurichWeekday = (d: Date) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Zurich' }).format(d);

export async function sendCockpitDigests(now = new Date()) {
  try {
    if (zurichWeekday(now) !== 'Mon' || zurichHour(now) < 7) return;
    const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
    const rows = await prisma.organisationMember.findMany({
      where: {
        cockpitDigest: true,
        OR: [{ isAdmin: true }, { isDirection: true }],
        AND: [{ OR: [{ cockpitDigestSentAt: null }, { cockpitDigestSentAt: { lt: sixDaysAgo } }] }],
        user: { email: { not: null }, emailVerified: true },
      },
      select: { organisationId: true, userId: true, user: { select: { email: true, pseudo: true, firstName: true, locale: true } } },
    });
    let sent = 0;
    for (const row of rows) {
      await prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: row.organisationId, userId: row.userId } }, data: { cockpitDigestSentAt: now } });
      const c = await buildCockpit(row.organisationId, row.userId, now);
      if (!c) continue;
      const m = mail(parseLocale(row.user.locale) ?? 'fr');
      const li = (html: string) => `<li style="margin:4px 0">${html}</li>`;
      const section = (title: string, items: string[]) => items.length ? `<h3 style="margin:20px 0 6px;font-size:15px">${title}</h3><ul style="margin:0;padding-left:18px">${items.join('')}</ul>` : '';
      const date = (d: Date | null) => d ? new Intl.DateTimeFormat(m.intl, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(d) : '';

      const todo = [
        ...groupCount(c.todo.joinRequests.map(r => r.circleName ?? '')).map(([circle, count]) => li(m.t('cockpit.joinRequests', { count, circle }))),
        ...c.todo.noResponsible.map(x => li(m.t('cockpit.noResponsible', { circle: x.circleName }))),
        ...c.todo.noRole.map(x => li(m.t('cockpit.noRole', { count: x.count, circle: x.circleName }))),
        ...c.todo.pollsEnding.map(p => li(m.t('cockpit.pollEnding', { question: p.question, circle: p.circleName ?? '' }))),
        ...c.todo.lowAnswers.map(p => li(m.t('cockpit.lowAnswers', { plan: p.title, count: p.pending }))),
        ...(c.tasks.overdue ? [li(m.t('cockpit.tasks', { count: c.tasks.overdue }))] : []),
        ...(c.equipment?.late ?? []).map(x => li(m.t('cockpit.gearLate', { item: x.itemName, who: x.holder ?? '?', plan: x.planTitle }))),
        ...(c.equipment?.conflicts ?? []).map(x => li(m.t('cockpit.gearConflict', { item: x.itemName, count: x.shortBy }))),
        ...(c.equipment?.repair.length ? [li(m.t('cockpit.gearRepair', { count: c.equipment.repair.length }))] : []),
      ];
      const week = now.getTime() + 7 * 86_400_000;
      const agenda = c.agenda.filter(p => new Date(p.eventDate ?? p.endDate).getTime() <= week)
        .map(p => li(`<strong>${escapeHtml(p.title)}</strong> — ${escapeHtml(date(p.eventDate ? new Date(p.eventDate) : null))}${p.circleName ? ` · ${escapeHtml(p.circleName)}` : ''}<br><span style="color:#64748b;font-size:13px">${m.t('cockpit.coming', { coming: p.coming, pending: p.pending })}</span>`));
      const teams = c.teams.filter(x => x.status !== 'ok').map(x => li(`${escapeHtml(x.name)} — ${m.t(x.status === 'quiet' ? 'cockpit.quiet' : 'cockpit.watch')}`));
      const today = zurichDay(now);
      const suppliers = (c.suppliers ?? []).map(s => li(`${escapeHtml(s.planTitle)} · ${escapeHtml(s.name)} — ${m.t(s.kind === 'deposit' ? 'cockpit.deposit' : 'cockpit.balance')} ${escapeHtml(formatAmount(s.amount, s.currency, m.intl))}, ${escapeHtml(s.due)}${s.due < today ? ' ⚠️' : ''}`));
      if (!todo.length && !agenda.length && !teams.length && !suppliers.length) continue;

      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: row.user.email!,
        subject: m.s('cockpit.subject', { org: c.organisation.name }),
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2>${m.t('common.hello', { name: row.user.firstName ?? row.user.pseudo })}</h2>
            <p>${m.t('cockpit.intro', { org: c.organisation.name })}</p>
            ${section(m.t('cockpit.todo'), todo)}
            ${section(m.t('cockpit.agenda'), agenda)}
            ${section(m.t('cockpit.teams'), teams)}
            ${section(m.t('cockpit.suppliers'), suppliers)}
            <p style="margin-top:24px"><a href="${APP_URL}/dashboard?cockpit=${encodeURIComponent(c.organisation.id)}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${m.t('cockpit.button')}</a></p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">${m.t('cockpit.footer')}</p>
          </div>`,
      }).catch(e => { console.error('[cockpit digest]', row.user.email, e); return null; });
      if (result?.error) console.error('[cockpit digest]', row.user.email, result.error);
      else if (result) sent++;
    }
    if (sent) console.log(`[cockpit] ${sent} résumé(s) envoyé(s)`);
  } catch (e) {
    console.error('[cockpit digest] Erreur:', e);
  }
}

function groupCount(names: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
  return [...map.entries()];
}
