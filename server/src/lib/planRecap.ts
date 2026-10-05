import path from 'path';
import { escapeHtml } from './escapeHtml';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
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
const RSVP_LABEL: Record<string, string> = { in: 'Présents', maybe: 'Peut-être', out: 'Absents' };

export async function canDownloadRecap(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

type Person = { pseudo: string; firstName: string | null; isLight?: boolean };
const who = (u: Person) => u.isLight
  ? `${u.firstName ?? u.pseudo} (invité sans compte)`
  : u.firstName ? `${u.firstName} (@${u.pseudo})` : `@${u.pseudo}`;

const zurich = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', ...opts });
function planDates(start: Date | null, end: Date): string {
  const day = zurich({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = zurich({ hour: '2-digit', minute: '2-digit' });
  if (!start) return `Date non précisée (fin du Plan : ${day.format(end)})`;
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

export async function buildPlanRecapPdf(planId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const plan = await loadRecapData(planId);
  if (!plan) return null;

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 52, right: 52 }, bufferPages: true, info: { Title: `Récapitulatif — ${plan.title}`, Author: 'EvLY' } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const [name, file] of Object.entries(F)) doc.registerFont(name, file);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // En-tête : logo EvLY + « Récapitulatif »
  doc.font('serifLight').fontSize(20).fillColor(INK).text('Ev', left, 44, { continued: true }).font('serif').fillColor(CORAL).text('LY');
  doc.font('bold').fontSize(8).fillColor(CORAL).text('RÉCAPITULATIF DU PLAN', left, 52, { width, align: 'right', characterSpacing: 1.2 });
  doc.moveTo(left, 76).lineTo(left + width, 76).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.y = 92;

  if (plan.circle && !plan.circle.isPersonal) doc.font('semibold').fontSize(9).fillColor(CORAL).text(plan.circle.name.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.2).font('serif').fontSize(22).fillColor(INK).text(plan.title, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  line('Date', planDates(plan.eventDate, plan.endDate));
  if (plan.location) line('Lieu', plan.location);
  line('Organisé par', who(plan.creator));

  const section = (title: string, sub?: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1.1);
    doc.font('bold').fontSize(9).fillColor(CORAL).text(title.toUpperCase(), { characterSpacing: 1, continued: !!sub });
    if (sub) doc.font('regular').fillColor(DIM).text(`   ${sub}`, { characterSpacing: 0 });
    doc.moveDown(0.35);
  };
  const para = (text: string, color = INK) => doc.font('regular').fontSize(10).fillColor(color).text(text, { width, lineGap: 1.5 });

  if (plan.description?.trim()) { section('Description'); para(plan.description.trim()); }

  if (plan.importantInfo?.trim()) {
    section('Informations importantes');
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
    r, people: plan.members.filter(m => m.rsvp === r).map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr')),
  }));
  const count = (r: string, n: number) => r === 'maybe' ? `${n} peut-être` : `${n} ${r === 'in' ? 'présent' : 'absent'}${n > 1 ? 's' : ''}`;
  section('Participants', groups.map(g => count(g.r, g.people.length)).join(' · '));
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
    section('Bénévoles', `${filled} inscrits sur ${needed} places`);
    for (const s of shifts) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const hours = shiftHours(s);
      const missing = s.needed - s.signups.length;
      doc.font('semibold').fontSize(10.5).fillColor(INK).text(s.title, { continued: true })
        .font('regular').fillColor(DIM).text(`${hours ? `  ·  ${hours}` : ''}  ·  ${s.signups.length}/${s.needed}`, { continued: missing > 0 })
      if (missing > 0) doc.font('semibold').fillColor(CORAL).text(`  ·  il manque ${missing} personne${missing > 1 ? 's' : ''}`);
      if (s.note) para(s.note, DIM);
      para(s.signups.length ? `Inscrits : ${s.signups.map(x => who(x.user)).join(', ')}` : 'Personne d’inscrit', s.signups.length ? INK : DIM);
      doc.moveDown(0.5);
    }
  }

  // Qui apporte quoi
  if (plan.items.length > 0) {
    section('Qui apporte quoi');
    for (const it of plan.items) {
      doc.font('regular').fontSize(10).fillColor(INK).text(`•  ${it.label}${it.quantity ? ` (${it.quantity})` : ''}`, { continued: true })
        .fillColor(it.claimedBy ? DIM : CORAL).text(it.claimedBy ? `  —  @${it.claimedBy}` : '  —  personne pour l’instant');
    }
  }

  // Dépenses
  if (plan.expenses.length > 0) {
    const pseudo = (id: string) => plan.members.find(m => m.userId === id)?.user.pseudo ?? '?';
    const byCurrency = computeByCurrency(plan.members.map(m => m.userId), plan.expenses, plan.reimbursements);
    const totals = byCurrency.map(c => formatAmount(plan.expenses.filter(e => e.currency === c.currency).reduce((n, e) => n + e.amount, 0), c.currency));
    section('Dépenses', `total ${totals.join(' + ')}`);
    for (const e of plan.expenses) {
      doc.font('regular').fontSize(10).fillColor(INK).text(`•  ${e.description}`, { continued: true })
        .fillColor(DIM).text(`  —  ${formatAmount(e.amount, e.currency)}, payé par ${who(e.paidBy)}`);
    }
    const transfers = byCurrency.flatMap(c => c.transfers.map(t => ({ ...t, currency: c.currency })));
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(transfers.length ? 'Pour équilibrer les comptes' : 'Les comptes sont équilibrés.');
    for (const t of transfers) para(`@${pseudo(t.fromUserId)} → @${pseudo(t.toUserId)} : ${formatAmount(t.amount, t.currency)}`, DIM);
  }

  // Votes (comptes seulement)
  if (plan.polls.length > 0) {
    section('Votes');
    for (const p of plan.polls) {
      doc.font('semibold').fontSize(10).fillColor(INK).text(p.question);
      const total = p.options.reduce((n, o) => n + o.votes.length, 0);
      for (const o of [...p.options].sort((a, b) => b.votes.length - a.votes.length)) {
        para(`•  ${o.text} — ${o.votes.length} voix${total ? ` (${Math.round((o.votes.length / total) * 100)} %)` : ''}`, DIM);
      }
      doc.moveDown(0.4);
    }
  }

  // Pied de page sur chaque page
  const generated = zurich({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // Sous la marge du bas : sans ce réglage, pdfkit ajouterait une page pour chaque texte
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 38;
    doc.font('regular').fontSize(8).fillColor(DIM)
      .text(`Généré le ${generated} depuis evly.ch · ce Plan est supprimé automatiquement après sa date`, left, y, { width: width - 40, lineBreak: false })
      .text(`${i + 1} / ${range.count}`, left, y, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  const buffer = await done;
  const filename = `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - récapitulatif.pdf`;
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
    select: { email: true, pseudo: true },
  });
  if (recipients.length === 0) return;
  const pdf = await buildPlanRecapPdf(plan.id);
  if (!pdf) return;
  const { resend, FROM_EMAIL, APP_URL } = await import('./mailer');
  await Promise.all(recipients.map(u => resend.emails.send({
    from: FROM_EMAIL,
    to: u.email!,
    subject: `Récapitulatif — "${plan.title}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Le Plan "${escapeHtml(plan.title)}" est terminé, ${escapeHtml(u.pseudo)} 👋</h2>
        <p>Il vient d'être supprimé automatiquement. Voici son récapitulatif en pièce jointe (PDF) : infos, participants, bénévoles et dépenses s'il y en avait.</p>
        <p style="color:#64748b;font-size:13px">Tu reçois cet email parce que tu as activé « Récapitulatif avant suppression ».
        Pour l'arrêter : dans EvLY, touche le menu <b>☰</b> en bas de la liste de tes Cercles (à côté de ton pseudo), puis
        <b>« Notifications »</b>, et désactive « Récapitulatif avant suppression ».
        <a href="${APP_URL}/dashboard?reglages=notifications" style="color:#64748b">Gérer mes notifications</a></p>
      </div>`,
    attachments: [{ filename: pdf.filename, content: pdf.buffer }],
  }).then(r => { if (r.error) console.error('[recap email]', u.email, r.error); })
    .catch(e => console.error('[recap email]', u.email, e))));
}

