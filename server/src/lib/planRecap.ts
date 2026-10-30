import path from 'path';
import { stripEmojiFromPdf } from './pdfText';
import { parseRichText, stripFormatting } from './richText';
import { escapeHtml } from './escapeHtml';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { parseLocale, type Locale } from './i18n';
import { mail } from './emailText';
import { isCircleManager } from './circleRoles';
import { computeByCurrency, formatAmount } from './expenses';
import { sortShifts, shiftHours } from './volunteers';
import { countVotes, isAdopted } from './assembly';
import { leaderboard } from './quiz';
import { leagueStandings } from './teams';
import { ranking as wordRanking } from './wordGame';
import { potTotals } from './giftPot';
import { scheduleItems } from './program';
import { zurichDay } from './tasks';

// Récapitulatif PDF d'un Plan (à garder avant sa suppression automatique) : infos, répétition,
// participants, liste d'attente, planning, « qui apporte quoi », dépenses et remboursements, votes,
// assemblée (résultats ; le PV reste le document officiel), quiz, équipes, Killer, mot piège, Père Noël
// secret et cagnotte — chaque rubrique seulement si elle a du contenu et que sa fonction est active.
// Réservé au créateur du Plan et aux gestionnaires du Cercle (canDownloadRecap). Pas le chat.
// Les secrets restent secrets : jeux seulement une fois terminés, Père Noël seulement après la
// révélation, bulletins secrets en totaux. La cagnotte est détaillée (montant de chacun) : les
// destinataires sont ceux qui gèrent la cagnotte dans l'app.
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
const PERSON = { pseudo: true, firstName: true, isLight: true } as const;
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
      members: { include: { user: { select: { pseudo: true, firstName: true, isLight: true } } }, orderBy: { joinedAt: 'asc' as const } },
      waitlist: { orderBy: { createdAt: 'asc' }, include: { user: { select: PERSON } } },
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
  const has = (f: string) => plan.enabledFeatures.includes(f);
  const [assembly, quiz, teamDraw, killer, words, santa, pot, programItems, taskGroups, tasks, ideaColumns, ideas] = await Promise.all([
    has('assemblee') ? prisma.assembly.findUnique({ where: { planId }, include: { items: { orderBy: { position: 'asc' }, include: { candidates: true, ballots: true } } } }) : null,
    has('quiz') ? prisma.quiz.findUnique({ where: { planId }, include: { questions: { select: { id: true } } } }) : null,
    has('equipes') ? prisma.teamDraw.findUnique({ where: { planId }, include: { teams: { orderBy: { position: 'asc' }, include: { members: { include: { user: { select: PERSON } } } } }, matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] } } }) : null,
    has('killer') ? prisma.killerGame.findUnique({ where: { planId }, include: { players: { include: { user: { select: PERSON } } } } }) : null,
    has('mot_piege') ? prisma.wordGame.findUnique({ where: { planId }, include: { players: { include: { user: { select: PERSON } } } } }) : null,
    has('pere_noel') ? prisma.secretSanta.findUnique({ where: { planId }, include: { pairs: { include: { giver: { select: PERSON }, receiver: { select: PERSON } } } } }) : null,
    has('cagnotte') ? prisma.giftPot.findUnique({ where: { planId }, include: { pledges: { orderBy: { createdAt: 'asc' }, include: { user: { select: PERSON } } }, ideas: true } }) : null,
    has('deroule') ? prisma.planProgramItem.findMany({ where: { planId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: { assignees: { include: { user: { select: PERSON } } } } }) : [],
    has('taches') ? prisma.planTaskGroup.findMany({ where: { planId }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true } }) : [],
    has('taches') ? prisma.planTask.findMany({ where: { planId }, orderBy: { createdAt: 'asc' }, include: { assignees: { include: { user: { select: PERSON } } }, dependsOn: { select: { dependsOnId: true } } } }) : [],
    has('idees') ? prisma.ideaColumn.findMany({ where: { planId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true } }) : [],
    has('idees') ? prisma.idea.findMany({ where: { planId }, orderBy: { createdAt: 'asc' } }) : [],
  ]);
  // Quiz : seulement une fois la partie terminée
  const quizAnswers = quiz?.endedAt ? await prisma.quizAnswer.findMany({ where: { planId }, select: { userId: true, points: true } }) : [];
  const quizPeople = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(quizAnswers.map(a => a.userId))] } }, select: { id: true, ...PERSON } })).map(u => [u.id, u]));

  const doc = stripEmojiFromPdf(new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 52, right: 52 }, bufferPages: true, info: { Title: m.s('recapPdf.title', { plan: plan.title }), Author: 'EvLY' } }));
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
  // Les polices du PDF n'ont pas d'emoji : retirés du titre (sinon un carré vide)
  const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();
  doc.moveDown(0.2).font('serif').fontSize(22).fillColor(INK).text(noEmoji(plan.title) || plan.title, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  line(m.s('recapPdf.date'), planDates(m, plan.eventDate, plan.endDate));
  if (plan.location) line(m.s('recapPdf.place'), plan.location);
  line(m.s('recapPdf.by'), who(plan.creator));
  if (plan.recurrence) {
    const label = m.s(plan.recurrence === 'biweekly' ? 'recapPdf.recurBiweekly' : plan.recurrence === 'monthly' ? 'recapPdf.recurMonthly' : 'recapPdf.recurWeekly');
    const until = plan.recurrenceUntil ? zurich(m, { day: 'numeric', month: 'long', year: 'numeric' }).format(plan.recurrenceUntil) : null;
    const text = until ? m.s('recapPdf.recurUntil', { label, date: until }) : label;
    line(m.s('recapPdf.repeat'), text.charAt(0).toUpperCase() + text.slice(1));
  }

  const section = (title: string, sub?: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1.1);
    doc.font('bold').fontSize(9).fillColor(CORAL).text(title.toUpperCase(), { characterSpacing: 1, continued: !!sub });
    if (sub) doc.font('regular').fillColor(DIM).text(`   ${sub}`, { characterSpacing: 0 });
    doc.moveDown(0.35);
  };
  const para = (text: string, color = INK) => doc.font('regular').fontSize(10).fillColor(color).text(text, { width, lineGap: 1.5 });
  const sub = (text: string) => { if (doc.y > doc.page.height - 110) doc.addPage(); doc.moveDown(0.3).font('semibold').fontSize(10).fillColor(INK).text(text, { width }); };

  // Texte mis en forme (lib/richText.ts) : gras et listes ; l'italique reste droit (pas de police italique d'Inter)
  const richPara = (text: string, color: string, x: number, w: number) => {
    for (const line of parseRichText(text)) {
      const prefix = line.kind === 'bullet' ? '•  ' : line.kind === 'number' ? `${line.number}.  ` : '';
      const parts = [{ text: prefix, bold: false }, ...line.parts].filter(p => p.text);
      doc.x = x;
      if (parts.length === 0) { doc.font('regular').fontSize(10).moveDown(0.6); continue; }
      parts.forEach((p, i) => doc.font(p.bold ? 'semibold' : 'regular').fontSize(10).fillColor(color)
        .text(p.text, { width: w, lineGap: 1.5, underline: !!(p as { underline?: boolean }).underline, continued: i < parts.length - 1 }));
    }
    doc.x = left;
  };

  if (plan.description?.trim()) { section(m.s('recapPdf.description')); richPara(plan.description.trim(), INK, left, width); }

  if (plan.importantInfo?.trim()) {
    section(m.s('recapPdf.important'));
    const text = plan.importantInfo.trim();
    doc.font('regular').fontSize(10);
    const h = doc.heightOfString(stripFormatting(text), { width: width - 20, lineGap: 1.5 }) + 20;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    doc.roundedRect(left, y, width, h, 6).fillColor(AMBER_BG).fill();
    doc.y = y + 8;
    richPara(text, AMBER, left + 10, width - 20);
    doc.x = left; doc.y = Math.max(doc.y, y + h);
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

  // Liste d'attente, dans l'ordre
  if (plan.waitlist.length > 0) {
    section(m.s('recapPdf.waitlist'), m.s('recapPdf.waitlistSub', { count: plan.waitlist.length }));
    para(plan.waitlist.map((w, i) => `${i + 1}. ${who(w.user)}`).join('    '), DIM);
  }

  // Planning des bénévoles
  if (plan.volunteerShifts.length > 0) {
    const shifts = sortShifts(plan.volunteerShifts);
    const filled = shifts.reduce((n, s) => n + Math.min(s.signups.length, s.needed), 0);
    const needed = shifts.reduce((n, s) => n + s.needed, 0);
    section(m.s('recapPdf.volunteers'), needed > 0 ? m.s('recapPdf.volunteersSub', { filled, needed }) : undefined);
    for (const s of shifts) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const hours = shiftHours(s, m.intl);
      const missing = s.needed - s.signups.length;
      // Ligne de programme (0 personne) : titre, horaire et remarque seulement
      if (s.needed === 0) {
        doc.font('semibold').fontSize(10.5).fillColor(INK).text(s.title, { continued: !!hours });
        if (hours) doc.font('regular').fillColor(DIM).text(`  ·  ${hours}`);
        if (s.note) para(s.note, DIM);
        doc.moveDown(0.5);
        continue;
      }
      doc.font('semibold').fontSize(10.5).fillColor(INK).text(s.title, { continued: true })
        .font('regular').fillColor(DIM).text(`${hours ? `  ·  ${hours}` : ''}  ·  ${s.signups.length}/${s.needed}`, { continued: missing > 0 || !!s.doneAt })
      if (s.doneAt) doc.font('semibold').fillColor('#059669').text(`  ·  ${m.s('recapPdf.shiftDone')}`);
      else if (missing > 0) doc.font('semibold').fillColor(CORAL).text(m.s('recapPdf.missing', { count: missing }));
      if (s.note) para(s.note, DIM);
      para(s.signups.length ? m.s('recapPdf.signed', { names: s.signups.map(x => who(x.user)).join(', ') }) : m.s('recapPdf.nobodySigned'), s.signups.length ? INK : DIM);
      doc.moveDown(0.5);
    }
  }

  // Déroulé : heures calculées comme dans l'app (lib/program.ts), responsables, lieu, matériel et remarques
  if (programItems.length > 0) {
    section(m.s('recapPdf.program'), m.s('recapPdf.programSub', { count: programItems.length }));
    const hm = zurich(m, { hour: '2-digit', minute: '2-digit' });
    for (const i of scheduleItems(programItems, plan.eventDate)) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const hours = i.start ? `${hm.format(i.start)}${i.end && i.durationMin > 0 ? ` – ${hm.format(i.end)}` : ''}` : '';
      doc.font('semibold').fontSize(10.5).fillColor(INK).text(hours ? `${hours}   ` : '', { continued: true }).text(i.title, { width });
      const details = [
        i.place && `${m.s('programPdf.place')} : ${i.place}`,
        i.assignees.length && `${m.s('programPdf.who')} : ${i.assignees.map(a => who(a.user)).join(', ')}`,
        i.tech && `${m.s('programPdf.tech')} : ${i.tech}`,
        i.note && `${m.s('programPdf.note')} : ${i.note}`,
      ].filter(Boolean) as string[];
      for (const d of details) para(d, DIM);
      doc.moveDown(0.5);
    }
  }

  // Tâches, par lot : état, responsables, échéance, ce qu'elles attendent (sans les commentaires)
  if (tasks.length > 0) {
    const doneCount = tasks.filter(x => x.status === 'done').length;
    section(m.s('recapPdf.tasks'), m.s('recapPdf.tasksSub', { done: doneCount, total: tasks.length }));
    const today = zurichDay();
    const dayFmt = zurich(m, { day: 'numeric', month: 'long' });
    const titleOf = new Map(tasks.map(x => [x.id, x.title]));
    const ORDER: Record<string, number> = { doing: 0, todo: 1, done: 2 };
    const lots = [...taskGroups.map(g => ({ id: g.id as string | null, title: g.title })), { id: null, title: m.s('recapPdf.taskNoGroup') }];
    for (const lot of lots) {
      const list = tasks.filter(x => x.groupId === lot.id).sort((a, b) => (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
      if (list.length === 0) continue;
      sub(`${lot.title}  (${list.filter(x => x.status === 'done').length}/${list.length})`);
      for (const x of list) {
        if (doc.y > doc.page.height - 90) doc.addPage();
        const late = x.status !== 'done' && !!x.dueDate && x.dueDate < today;
        const state = m.s(x.status === 'done' ? 'recapPdf.taskDone' : x.status === 'doing' ? 'recapPdf.taskDoing' : 'recapPdf.taskTodo');
        doc.font('regular').fontSize(10).fillColor(x.status === 'done' ? DIM : INK).text(`•  ${x.title}`, { continued: true })
          .font('semibold').fillColor(x.status === 'done' ? '#059669' : late ? CORAL : DIM).text(`  ·  ${late ? m.s('recapPdf.taskLate') : state}`);
        const details = [
          x.assignees.length ? x.assignees.map(a => who(a.user)).join(', ') : '',
          x.dueDate ? m.s('recapPdf.taskDue', { date: dayFmt.format(new Date(`${x.dueDate}T12:00:00Z`)) }) : '',
          x.status !== 'done' && x.dependsOn.length ? m.s('recapPdf.taskWaits', { titles: x.dependsOn.map(d => titleOf.get(d.dependsOnId)).filter(Boolean).join(', ') }) : '',
        ].filter(Boolean);
        doc.x = left + 12;
        if (details.length) doc.font('regular').fontSize(9).fillColor(DIM).text(details.join('  ·  '), left + 12, doc.y, { width: width - 12 });
        if (x.note) doc.font('regular').fontSize(9).fillColor(DIM).text(x.note, left + 12, doc.y, { width: width - 12 });
        doc.x = left;
      }
    }
  }

  // Idées, par thème : retenues, à creuser, autres, écartées ; votes notés en séance
  if (ideas.length > 0) {
    section(m.s('recapPdf.ideas'), m.s('recapPdf.ideasSub', { count: ideas.length }));
    const RANK: Record<string, number> = { kept: 0, explore: 1, new: 2, dropped: 3 };
    const LABEL: Record<string, string> = { kept: m.s('recapPdf.ideaKept'), explore: m.s('recapPdf.ideaExplore'), dropped: m.s('recapPdf.ideaDropped') };
    const themes = [...ideaColumns.map(c => ({ id: c.id as string | null, title: c.title })), { id: null, title: m.s('recapPdf.ideaNoColumn') }];
    for (const th of themes) {
      const list = ideas.filter(x => x.columnId === th.id).sort((a, b) => (RANK[a.status] ?? 2) - (RANK[b.status] ?? 2) || b.votes - a.votes);
      if (list.length === 0) continue;
      sub(th.title);
      for (const x of list) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const tags = [LABEL[x.status], x.votes ? m.s('recapPdf.ideaVotes', { count: x.votes }) : '', x.taskId ? m.s('recapPdf.ideaTask') : ''].filter(Boolean);
        doc.font(x.status === 'kept' ? 'semibold' : 'regular').fontSize(10).fillColor(x.status === 'dropped' ? DIM : INK).text(`•  ${x.text}`, { width, continued: tags.length > 0 });
        if (tags.length) doc.font('regular').fillColor(x.status === 'kept' ? '#059669' : DIM).text(`  ·  ${tags.join('  ·  ')}`);
      }
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
    if (plan.reimbursements.length > 0) {
      sub(m.s('recapPdf.reimbursements'));
      for (const r of plan.reimbursements) para(`@${pseudo(r.fromUserId)} → @${pseudo(r.toUserId)} : ${formatAmount(r.amount, r.currency, m.intl)}`, DIM);
    }
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

  // Assemblée : résultat de chaque point (totaux seulement, jamais qui a voté quoi au scrutin secret)
  if (assembly && assembly.items.length > 0) {
    section(m.s('recapPdf.assembly'), m.s(assembly.closedAt ? 'recapPdf.assemblyClosed' : assembly.openedAt ? 'recapPdf.assemblyOpen' : 'recapPdf.assemblyNotOpened'));
    assembly.items.forEach((it, i) => {
      sub(`${i + 1}. ${it.title}`);
      if (it.kind === 'info') return;
      const elected = it.candidates.filter(c => c.elected).map(c => c.name);
      if (it.status === 'tacit') {
        if (it.kind === 'election') para(elected.length ? m.s('recapPdf.elected', { names: elected.join(', ') }) : m.s('recapPdf.nobodyElected'), DIM);
        else para(m.s(it.tacitAdopted ? 'recapPdf.tacitAdopted' : 'recapPdf.tacitRejected'), DIM);
      } else if (it.status === 'closed') {
        if (it.kind === 'election') para(elected.length ? m.s('recapPdf.elected', { names: elected.join(', ') }) : m.s('recapPdf.nobodyElected'), DIM);
        else {
          const c = countVotes(it.ballots);
          para(m.s('recapPdf.voteCounts', { verdict: m.s(isAdopted(c, it.majority) ? 'recapPdf.adopted' : 'recapPdf.rejected'), yes: c.yes, no: c.no, abstain: c.abstain }), DIM);
        }
      } else para(m.s(it.status === 'open' ? 'recapPdf.itemOpen' : 'recapPdf.itemPending'), DIM);
    });
    doc.moveDown(0.3);
    para(m.s('recapPdf.pvHint'), DIM);
  }

  // Quiz : classement final
  if (quiz?.endedAt && quizAnswers.length > 0) {
    section(m.s('recapPdf.quiz'), m.s('recapPdf.quizSub', { count: quiz.questions.length }));
    const board = leaderboard([...quizPeople.keys()], quizAnswers);
    for (const l of board) {
      const u = quizPeople.get(l.userId);
      if (u) para(`${l.rank}. ${who(u)} — ${m.s('recapPdf.points', { count: l.points })}`, l.rank === 1 ? INK : DIM);
    }
  }

  // Équipes : composition, puis classement ou tableau
  if (teamDraw?.drawnAt && teamDraw.teams.length > 0) {
    section(m.s('recapPdf.teams'));
    const teamName = new Map(teamDraw.teams.map(t => [t.id, t.name]));
    for (const t of teamDraw.teams) { sub(t.name); para(t.members.map(x => who(x.user)).join(', '), DIM); }
    if (teamDraw.matches.length > 0 && teamDraw.format === 'league') {
      sub(m.s('recapPdf.league'));
      leagueStandings(teamDraw.teams.map(t => t.id), teamDraw.matches).forEach((s, i) =>
        para(m.s('recapPdf.standing', { rank: i + 1, team: teamName.get(s.teamId) ?? '?', points: s.points, won: s.won, drawn: s.drawn, lost: s.lost, diff: s.diff > 0 ? `+${s.diff}` : s.diff }), i === 0 ? INK : DIM));
    } else if (teamDraw.matches.length > 0 && teamDraw.format === 'knockout') {
      sub(m.s('recapPdf.knockout'));
      const rounds = [...new Set(teamDraw.matches.map(x => x.round))];
      for (const r of rounds) {
        const games = teamDraw.matches.filter(x => x.round === r && x.homeId && x.awayId);
        if (games.length === 0) continue;
        para(`${m.s('recapPdf.round', { n: r })} :  ` + games.map(g => `${teamName.get(g.homeId!) ?? '?'} ${g.homeScore ?? '–'} – ${g.awayScore ?? '–'} ${teamName.get(g.awayId!) ?? '?'}`).join('   ·   '), DIM);
      }
      const last = teamDraw.matches.filter(x => x.round === rounds[rounds.length - 1]);
      if (last.length === 1 && last[0].winnerId) para(m.s('recapPdf.winnerTeam', { team: teamName.get(last[0].winnerId) ?? '?' }), INK);
    }
  }

  // Killer : seulement une fois la partie terminée (missions secrètes avant)
  if (killer?.endedAt && killer.players.length > 0) {
    section(m.s('recapPdf.killer'));
    const winner = killer.players.find(p => p.userId === killer.winnerId);
    if (winner) para(m.s('recapPdf.winner', { who: who(winner.user) }), INK);
    for (const p of [...killer.players].sort((a, b) => b.kills - a.kills)) para(`${who(p.user)} — ${m.s('recapPdf.kills', { count: p.kills })}`, DIM);
  }

  // Le mot piège : seulement une fois la partie terminée
  if (words?.endedAt && words.players.length > 0) {
    section(m.s('recapPdf.wordTrap'));
    const winner = words.players.find(p => p.userId === words.winnerId);
    if (winner) para(m.s('recapPdf.winner', { who: who(winner.user) }), INK);
    wordRanking(words.players).forEach((p, i) => para(`${i + 1}. ${who(p.user)} — ${m.s('recapPdf.points', { count: p.points })}`, DIM));
  }

  // Père Noël secret : seulement après la révélation
  if (santa?.revealedAt && santa.pairs.length > 0) {
    section(m.s('recapPdf.santa'), santa.budget ? m.s('recapPdf.santaBudget', { budget: santa.budget }) : undefined);
    for (const p of santa.pairs) para(m.s('recapPdf.santaPair', { giver: who(p.giver), receiver: who(p.receiver) }), DIM);
  }

  // Cagnotte : détail de chaque participation (pour savoir qui doit encore quoi après la suppression)
  if (pot && (pot.pledges.length > 0 || pot.forWhom)) {
    section(m.s('recapPdf.pot'), pot.closedAt ? m.s('recapPdf.potClosed') : undefined);
    const money = (n: number) => formatAmount(n, pot.currency, m.intl);
    if (pot.forWhom) para(m.s('recapPdf.potFor', { who: pot.forWhom }));
    if (pot.target) para(m.s('recapPdf.potTarget', { amount: money(pot.target) }), DIM);
    const totals = potTotals(pot.pledges);
    para(m.s('recapPdf.potTotals', { total: money(totals.total), received: money(totals.received) }), DIM);
    const idea = pot.ideas.find(i => i.id === pot.chosenIdeaId);
    if (idea) para(m.s('recapPdf.potIdea', { idea: idea.text }), DIM);
    for (const p of pot.pledges) {
      const state = p.receivedAt ? m.s('recapPdf.pledgeReceived') : p.declaredPaidAt ? m.s('recapPdf.pledgePaid') : m.s('recapPdf.pledgeWaiting');
      doc.font('regular').fontSize(10).fillColor(INK).text(`•  ${who(p.user)} — ${money(p.amount)}`, { continued: true })
        .fillColor(p.receivedAt ? DIM : CORAL).text(`  (${state})`);
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
  // Les gestionnaires du Cercle ne le reçoivent que s'ils participent au Plan (« Je suis in » ou « Peut-être ») :
  // ni la liste d'attente, ni « Je passe », ni une personne exclue d'un Plan surprise
  const participants = await prisma.planMember.findMany({
    where: { planId: plan.id, rsvp: { in: ['in', 'maybe'] } }, select: { userId: true },
  });
  const inPlan = new Set(participants.map(p => p.userId));
  const circleManagers = [circle?.creatorId, ...managers.map(m => m.userId)].filter((x): x is string => !!x && inPlan.has(x));
  const ids = [...new Set([plan.creatorId, ...circleManagers])];
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

