import path from 'path';
import { escapeHtml } from './escapeHtml';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { parseLocale, type Locale } from './i18n';
import { mail } from './emailText';
import { isCircleManager } from './circleRoles';
import { computeByCurrency, formatAmount } from './expenses';
import { sortShifts, shiftHours } from './volunteers';

// Récapitulatif PDF d'un Plan (à garder avant sa suppression automatique) : infos, participants,
// bénévoles, « qui apporte quoi », dépenses et votes — ces dernières rubriques seulement si elles
// ont du contenu. Réservé au créateur du Plan et aux gestionnaires du Cercle (canDownloadRecap).
// Jamais de nom de famille ni d'email : prénom et @pseudo, comme dans l'app.

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
const F = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  semibold: path.join(FONT_DIR, 'Inter-SemiBold.ttf'),
  bold: path.join(FONT_DIR, 'Inter-ExtraBold.ttf'),
  serif: path.join(FONT_DIR, 'Fraunces-ExtraBold.ttf'),
  serifLight: path.join(FONT_DIR, 'Fraunces-LightItalic.ttf'),
};
const CORAL = '#ea5a2b', INK = '#1c1410', DIM = '#6b5850', LINE = '#f0ddd3', AMBER_BG = '#fffbeb', AMBER = '#92400e';

export async function canDownloadRecap(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

type Person = { pseudo: string; firstName: string | null; isLight?: boolean };
type Mail = ReturnType<typeof mail>;
const whoIn = (m: Mail) => (u: Person) => u.isLight
  ? m.s('recapPdf.guest', { name: u.firstName ?? u.pseudo })
  : u.firstName ? `${u.firstName} (@${u.pseudo})` : `@${u.pseudo}`;

const zurich = (m: Mail, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(m.intl, { timeZone: 'Europe/Zurich', ...opts });
function planDates(m: Mail, start: Date | null, end: Date): string {
  const day = zurich(m, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = zurich(m, { hour: '2-digit', minute: '2-digit' });
  if (!start) return m.s('recapPdf.noDate', { date: day.format(end) });
  const sameDay = day.format(start) === day.format(end);
  return sameDay ? `${day.format(start)}, ${time.format(start)} – ${time.format(end)}` : `${day.format(start)}, ${time.format(start)} → ${day.format(end)}, ${time.format(end)}`;
}

export async function loadRecapData(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
    include: {
      circle: { select: { name: true, isPersonal: true } },
      creator: { select: { pseudo: true, firstName: true } },
      members: { include: { user: { select: { pseudo: true, firstName: true, isLight: true } } } },
      volunteerShifts: { include: { signups: { orderBy: { createdAt: 'asc' }, include: { user: { select: { pseudo: true, firstName: true } } } } } },
      items: true,
      expenses: { include: { paidBy: { select: { pseudo: true, firstName: true } }, splitWith: true }, orderBy: { createdAt: 'asc' } },
      reimbursements: true,
      polls: { include: { options: { include: { votes: true } } } },
    },
  });
}

export async function buildPlanRecapPdf(planId: string, locale: Locale = 'fr'): Promise<{ buffer: Buffer; filename: string } | null> {
  const plan = await loadRecapData(planId);
  if (!plan) return null;
  const m = mail(locale);
  const who = whoIn(m);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 52, right: 52 }, bufferPages: true, info: { Title: m.s('recapPdf.title', { plan: plan.title }), Author: 'EvLY' } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const [name, file] of Object.entries(F)) doc.registerFont(name, file);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // En-tête : logo EvLY + « Récapitulatif »
  doc.font('serifLight').fontSize(20).fillColor(INK).text('Ev', left, 44, { continued: true }).font('serif').fillColor(CORAL).text('LY');
  doc.font('bold').fontSize(8).fillColor(CORAL).text(m.s('recapPdf.header'), left, 52, { width, align: 'right', characterSpacing: 1.2 });
  doc.moveTo(left, 76).lineTo(left + width, 76).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.y = 92;

  if (plan.circle && !plan.circle.isPersonal) doc.font('semibold').fontSize(9).fillColor(CORAL).text(plan.circle.name.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.2).font('serif').fontSize(22).fillColor(INK).text(plan.title, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  line(m.s('recapPdf.date'), planDates(m, plan.eventDate, plan.endDate));
  if (plan.location) line(m.s('recapPdf.place'), plan.location);
  line(m.s('recapPdf.by'), who(plan.creator));

  const section = (title: string, sub?: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1.1);
    doc.font('bold').fontSize(9).fillColor(CORAL).text(title.toUpperCase(), { characterSpacing: 1, continued: !!sub });
    if (sub) doc.font('regular').fillColor(DIM).text(`   ${sub}`, { characterSpacing: 0 });
    doc.moveDown(0.35);
  };
  const para = (text: string, color = INK) => doc.font('regular').fontSize(10).fillColor(color).text(text, { width, lineGap: 1.5 });

  if (plan.description?.trim()) { section(m.s('recapPdf.description')); para(plan.description.trim()); }

  if (plan.importantInfo?.trim()) {
    section(m.s('recapPdf.important'));
    const text = plan.importantInfo.trim();
    doc.font('regular').fontSize(10);
    const h = doc.heightOfString(text, { width: width - 20, lineGap: 1.5 }) + 16;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    doc.roundedRect(left, y, width, h, 6).fillColor(AMBER_BG).fill();
    doc.fillColor(AMBER).text(text, left + 10, y + 8, { width: width - 20, lineGap: 1.5 });
    doc.x = left; doc.y = y + h;
  }

  // Participants, par réponse
  const groups = (['in', 'maybe', 'out'] as const).map(r => ({
    r, people: plan.members.filter(m => m.rsvp === r).map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, m.intl)),
  }));
  const count = (r: string, n: number) => m.s(r === 'in' ? 'recapPdf.countIn' : r === 'maybe' ? 'recapPdf.countMaybe' : 'recapPdf.countOut', { count: n });
  const RSVP_LABEL: Record<string, string> = { in: m.s('recapPdf.rsvpIn'), maybe: m.s('recapPdf.rsvpMaybe'), out: m.s('recapPdf.rsvpOut') };
  section(m.s('recapPdf.participants'), groups.map(g => count(g.r, g.people.length)).join(' · '));
  for (const g of groups) {
    if (g.people.length === 0) continue;
    doc.font('semibold').fontSize(10).fillColor(INK).text(`${RSVP_LABEL[g.r]} (${g.people.length})`);
    para(g.people.map(who).join(', '), DIM);
    doc.moveDown(0.4);
  }

  // Planning des bénévoles
  if (plan.volunteerShifts.length > 0) {
    const shifts = sortShifts(plan.volunteerShifts);
    const filled = shifts.reduce((n, s) => n + Math.min(s.signups.length, s.needed), 0);
    const needed = shifts.reduce((n, s) => n + s.needed, 0);
    section(m.s('recapPdf.volunteers'), m.s('recapPdf.volunteersSub', { filled, needed }));
    for (const s of shifts) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const hours = shiftHours(s, m.intl);
      const missing = s.needed - s.signups.length;
      doc.font('semibold').fontSize(10.5).fillColor(INK).text(s.title, { continued: true })
        .font('regular').fillColor(DIM).text(`${hours ? `  ·  ${hours}` : ''}  ·  ${s.signups.length}/${s.needed}`, { continued: missing > 0 })
      if (missing > 0) doc.font('semibold').fillColor(CORAL).text(m.s('recapPdf.missing', { count: missing }));
      if (s.note) para(s.note, DIM);
      para(s.signups.length ? m.s('recapPdf.signed', { names: s.signups.map(x => who(x.user)).join(', ') }) : m.s('recapPdf.nobodySigned'), s.signups.length ? INK : DIM);
      doc.moveDown(0.5);
    }
  }

  // Qui apporte quoi
  if (plan.items.length > 0) {
    section(m.s('recapPdf.bring'));
    for (const it of plan.items) {
      doc.font('regular').fontSize(10).fillColor(INK).text(`•  ${it.label}${it.quantity ? ` (${it.quantity})` : ''}`, { continued: true })
        .fillColor(it.claimedBy ? DIM : CORAL).text(it.claimedBy ? `  —  @${it.claimedBy}` : m.s('recapPdf.nobodyYet'));
    }
  }

  // Dépenses
  if (plan.expenses.length > 0) {
    const pseudo = (id: string) => plan.members.find(m => m.userId === id)?.user.pseudo ?? '?';
    const byCurrency = computeByCurrency(plan.members.map(m => m.userId), plan.expenses, plan.reimbursements);
    const totals = byCurrency.map(c => formatAmount(plan.expenses.filter(e => e.currency === c.currency).reduce((n, e) => n + e.amount, 0), c.currency, m.intl));
    section(m.s('recapPdf.expenses'), m.s('recapPdf.total', { amounts: totals.join(' + ') }));
    for (const e of plan.expenses) {
      doc.font('regular').fontSize(10).fillColor(INK).text(`•  ${e.description}`, { continued: true })
        .fillColor(DIM).text(m.s('recapPdf.paidBy', { amount: formatAmount(e.amount, e.currency, m.intl), who: who(e.paidBy) }));
    }
    const transfers = byCurrency.flatMap(c => c.transfers.map(t => ({ ...t, currency: c.currency })));
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(transfers.length ? m.s('recapPdf.balance') : m.s('recapPdf.balanced'));
    for (const t of transfers) para(`@${pseudo(t.fromUserId)} → @${pseudo(t.toUserId)} : ${formatAmount(t.amount, t.currency, m.intl)}`, DIM);
  }

  // Votes (comptes seulement)
  if (plan.polls.length > 0) {
    section(m.s('recapPdf.votes'));
    for (const p of plan.polls) {
      doc.font('semibold').fontSize(10).fillColor(INK).text(p.question);
      const total = p.options.reduce((n, o) => n + o.votes.length, 0);
      for (const o of [...p.options].sort((a, b) => b.votes.length - a.votes.length)) {
        para(`•  ${o.text} — ${m.s('recapPdf.voices', { count: o.votes.length })}${total ? ` (${Math.round((o.votes.length / total) * 100)} %)` : ''}`, DIM);
      }
      doc.moveDown(0.4);
    }
  }

  // Pied de page sur chaque page
  const generated = zurich(m, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // Sous la marge du bas : sans ce réglage, pdfkit ajouterait une page pour chaque texte
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 38;
    doc.font('regular').fontSize(8).fillColor(DIM)
      .text(m.s('recapPdf.footer', { date: generated }), left, y, { width: width - 40, lineBreak: false })
      .text(`${i + 1} / ${range.count}`, left, y, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  const buffer = await done;
  const filename = `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - ${m.s('recapPdf.file')}.pdf`;
  return { buffer, filename };
}

// Juste avant la suppression d'un Plan expiré : récapitulatif PDF par email au créateur du Plan et
// aux gestionnaires du Cercle qui ont activé l'option (User.recapEmailEnabled, « Notifications »).
// Choix explicite de la personne : ni le canal de notification ni le mode silencieux ne s'appliquent.
export async function sendRecapBeforeDeletion(plan: { id: string; title: string; creatorId: string; circleId: string }) {
  const circle = await prisma.circle.findUnique({ where: { id: plan.circleId }, select: { creatorId: true } });
  const managers = await prisma.circleMember.findMany({ where: { circleId: plan.circleId, role: 'organizer' }, select: { userId: true } });
  const ids = [...new Set([plan.creatorId, circle?.creatorId, ...managers.map(m => m.userId)].filter((x): x is string => !!x))];
  const recipients = await prisma.user.findMany({
    where: { id: { in: ids }, recapEmailEnabled: true, emailVerified: true, email: { not: null } },
    select: { email: true, pseudo: true, locale: true },
  });
  if (recipients.length === 0) return;
  const { resend, FROM_EMAIL, APP_URL } = await import('./mailer');
  // Un PDF par langue (dans la langue de chaque destinataire)
  const pdfs = new Map<Locale, Awaited<ReturnType<typeof buildPlanRecapPdf>>>();
  for (const u of recipients) {
    const locale = parseLocale(u.locale) ?? 'fr';
    if (!pdfs.has(locale)) pdfs.set(locale, await buildPlanRecapPdf(plan.id, locale));
  }
  await Promise.all(recipients.map(u => {
    const m = mail(parseLocale(u.locale) ?? 'fr');
    const pdf = pdfs.get(m.locale);
    if (!pdf) return Promise.resolve();
    return resend.emails.send({
    from: FROM_EMAIL,
    to: u.email!,
    subject: m.s('recap.subject', { plan: plan.title }),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>${m.t('recap.title', { plan: plan.title, name: u.pseudo })}</h2>
        <p>${m.t('recap.text')}</p>
        <p style="color:#64748b;font-size:13px">${m.t('recap.why', { menu: { html: m.t('footer.menu') } })}
        <a href="${APP_URL}/dashboard?reglages=notifications" style="color:#64748b">${m.t('common.manageNotifications')}</a></p>
      </div>`,
    attachments: [{ filename: pdf.filename, content: pdf.buffer }],
  }).then(r => { if (r.error) console.error('[recap email]', u.email, r.error); })
    .catch(e => console.error('[recap email]', u.email, e));
  }));
}

