import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
import type { Locale } from './i18n';
import { mail } from './emailText';
import { countVotes, electionResult, fullName, isAdopted, quorumRequired, votingRights } from './assembly';

// Procès-verbal d'une assemblée (lib/assembly.ts) : présents, procurations, quorum, chaque point de l'ordre du
// jour avec ses notes et le résultat des votes, élus, lignes de signature. Un PV identifie les personnes :
// prénom et nom (contrairement à l'app). Projet tant que l'assemblée n'est pas close.

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
const F = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  semibold: path.join(FONT_DIR, 'Inter-SemiBold.ttf'),
  bold: path.join(FONT_DIR, 'Inter-ExtraBold.ttf'),
  serif: path.join(FONT_DIR, 'Fraunces-ExtraBold.ttf'),
  serifLight: path.join(FONT_DIR, 'Fraunces-LightItalic.ttf'),
};
const CORAL = '#ea5a2b', INK = '#1c1410', DIM = '#6b5850', LINE = '#f0ddd3', GREEN = '#047857', RED = '#b91c1c';
export async function buildAssemblyPvPdf(planId: string, locale: Locale = 'fr'): Promise<{ buffer: Buffer; filename: string } | null> {
  const m = mail(locale);
  const zurich = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(m.intl, { timeZone: 'Europe/Zurich', ...opts });
  const day = zurich({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = zurich({ hour: '2-digit', minute: '2-digit' });
  const CHOICE: Record<string, string> = { yes: m.s('pvPdf.yes'), no: m.s('pvPdf.no'), abstain: m.s('pvPdf.abstain') };
  const MAJORITY: Record<string, string> = { simple: m.s('pvPdf.majoritySimple'), absolute: m.s('pvPdf.majorityAbsolute'), two_thirds: m.s('pvPdf.majorityTwoThirds') };
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      circle: { select: { name: true } },
      creator: { select: { pseudo: true, firstName: true, lastName: true } },
      members: { select: { userId: true, rsvp: true } },
      assembly: {
        include: {
          proxies: true, attendances: true,
          items: { orderBy: { position: 'asc' }, include: { candidates: true, voters: true, ballots: true } },
        },
      },
    },
  });
  if (!plan?.assembly) return null;
  const a = plan.assembly;
  const circleMembers = await prisma.circleMember.findMany({
    where: { circleId: plan.circleId, user: { isLight: false } },
    select: { user: { select: { id: true, pseudo: true, firstName: true, lastName: true } } },
  });
  const users = new Map(circleMembers.map(m => [m.user.id, m.user]));
  const name = (id: string | null | undefined) => { const u = id ? users.get(id) : null; return u ? fullName(u) : m.s('pvPdf.deleted'); };
  const sortByName = (ids: string[]) => [...ids].sort((x, y) => name(x).localeCompare(name(y), m.intl));
  const voterIds = [...users.keys()].filter(id => !a.nonVoterIds.includes(id));
  const present = new Set(a.attendances.map(x => x.userId));
  const r = votingRights(voterIds, present, a.proxies);
  const required = quorumRequired(a.quorumMode, a.quorumValue, voterIds.length);
  const docIds = [...new Set(a.items.flatMap(i => i.attachmentIds))];
  const docs = new Map((docIds.length ? await prisma.attachment.findMany({ where: { id: { in: docIds } }, select: { id: true, name: true } }) : []).map(d => [d.id, d.name]));

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 56, right: 56 }, bufferPages: true, info: { Title: m.s('pvPdf.title', { plan: plan.title }), Author: 'EvLY' } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const [n, file] of Object.entries(F)) doc.registerFont(n, file);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const draft = !a.closedAt;

  doc.font('serifLight').fontSize(20).fillColor(INK).text('Ev', left, 44, { continued: true }).font('serif').fillColor(CORAL).text('LY');
  doc.font('bold').fontSize(8).fillColor(draft ? RED : CORAL).text(draft ? m.s('pvPdf.draftHeader') : m.s('pvPdf.header'), left, 52, { width, align: 'right', characterSpacing: 1.2 });
  doc.moveTo(left, 76).lineTo(left + width, 76).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.y = 92;
  doc.font('semibold').fontSize(9).fillColor(CORAL).text(plan.circle.name.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.2).font('serif').fontSize(22).fillColor(INK).text(plan.title, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  const when = a.openedAt ?? plan.eventDate;
  if (when) line(m.s('pvPdf.date'), `${day.format(when)}`);
  if (a.openedAt) line(m.s('pvPdf.opening'), time.format(a.openedAt) + (a.closedAt ? m.s('pvPdf.closing', { time: time.format(a.closedAt) }) : ''));
  if (plan.location) line(m.s('pvPdf.place'), plan.location);
  line(m.s('pvPdf.organisation'), fullName(plan.creator));
  if (a.secretaryId) line(m.s('pvPdf.minutes'), name(a.secretaryId));

  const section = (title: string, sub?: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1.1);
    doc.font('bold').fontSize(9).fillColor(CORAL).text(title.toUpperCase(), { characterSpacing: 1, continued: !!sub });
    if (sub) doc.font('regular').fillColor(DIM).text(`   ${sub}`, { characterSpacing: 0 });
    doc.moveDown(0.35);
  };
  const para = (text: string, color = INK, font = 'regular') => doc.font(font).fontSize(10).fillColor(color).text(text, { width, lineGap: 1.5 });

  // Présences
  const presentIds = sortByName([...present].filter(id => users.has(id)));
  section(m.s('pvPdf.presence'), m.s('pvPdf.presentCount', { count: presentIds.length }));
  if (presentIds.length) para(presentIds.map(id => {
    const att = a.attendances.find(x => x.userId === id);
    const tags = [att?.remote ? m.s('pvPdf.remote') : null, a.nonVoterIds.includes(id) ? m.s('pvPdf.noVote') : null].filter(Boolean);
    return `${name(id)}${tags.length ? ` (${tags.join(', ')})` : ''}`;
  }).join(', '));
  else para(m.s('pvPdf.nobodyPresent'), DIM);
  if (r.validProxies.length) {
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(m.s('pvPdf.proxies', { count: r.validProxies.length }));
    para(r.validProxies.map(p => m.s('pvPdf.representedBy', { giver: name(p.giverId), holder: name(p.holderId) })).join(' ; '), DIM);
  }
  const excused = sortByName(plan.members.filter(m => m.rsvp === 'out' && users.has(m.userId) && !present.has(m.userId) && !r.validProxies.some(p => p.giverId === m.userId)).map(m => m.userId));
  if (excused.length) {
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(m.s('pvPdf.excused', { count: excused.length }));
    para(excused.map(name).join(', '), DIM);
  }

  section(m.s('pvPdf.quorum'));
  para(m.s('pvPdf.quorumLine', { voters: voterIds.length, present: r.presentVoters, proxies: r.validProxies.length, represented: r.represented }));
  if (required === null) para(m.s('pvPdf.noQuorum'), DIM);
  else {
    const status = r.represented >= required ? m.s('pvPdf.reached') : m.s('pvPdf.notReached');
    para(a.quorumMode === 'percent' ? m.s('pvPdf.quorumRequiredPercent', { required, value: a.quorumValue ?? '', status }) : m.s('pvPdf.quorumRequired', { required, status }), r.represented >= required ? GREEN : RED, 'semibold');
  }

  // Ordre du jour
  section(m.s('pvPdf.agenda'));
  a.items.forEach((i, n) => {
    if (doc.y > doc.page.height - 130) doc.addPage();
    doc.moveDown(0.5).font('semibold').fontSize(11.5).fillColor(INK).text(`${n + 1}. ${i.title}`, { width });
    if (i.description) para(i.description, DIM);
    const d = i.attachmentIds.map(id => docs.get(id)).filter(Boolean);
    if (d.length) para(m.s('pvPdf.documents', { names: d.join(', ') }), DIM);
    if (i.notes) { doc.moveDown(0.2); para(i.notes); }
    if (i.kind === 'vote') {
      doc.moveDown(0.2);
      if (i.status === 'tacit') para(i.tacitAdopted ? m.s('pvPdf.tacitAdopted') : m.s('pvPdf.tacitRejected'), i.tacitAdopted ? GREEN : RED, 'semibold');
      else if (i.status === 'closed') {
        const c = countVotes(i.ballots);
        const ok = isAdopted(c, i.majority);
        para(m.s(i.secret ? 'pvPdf.voteSecret' : 'pvPdf.voteOpen', { majority: MAJORITY[i.majority] ?? i.majority }), DIM);
        const vars = { verdict: ok ? m.s('pvPdf.adopted') : m.s('pvPdf.rejected'), yes: c.yes, no: c.no, abstain: c.abstain, cast: i.ballots.length, eligible: i.eligibleVotes ?? '' };
        para(m.s(i.eligibleVotes ? 'pvPdf.resultCast' : 'pvPdf.result', vars), ok ? GREEN : RED, 'semibold');
        if (!i.secret && i.voters.length) para(i.voters.map(v => `${v.userId !== v.onBehalfOfId ? m.s('pvPdf.by', { name: name(v.onBehalfOfId), by: name(v.userId) }) : name(v.onBehalfOfId)} : ${CHOICE[v.choice ?? ''] ?? '?'}`).join(' ; '), DIM);
      } else para(m.s('pvPdf.notVoted'), DIM);
    }
    if (i.kind === 'election') {
      doc.moveDown(0.2);
      const elected = i.candidates.filter(c => c.elected).map(c => c.name);
      if (i.status === 'tacit') para(m.s('pvPdf.tacitElected', { names: elected.join(', ') }), GREEN, 'semibold');
      else if (i.status === 'closed') {
        const res = electionResult(i.candidates.map(c => c.id), i.ballots, i.seats ?? 1);
        const key = i.secret ? (i.eligibleVotes ? 'pvPdf.electionSecretOf' : 'pvPdf.electionSecret') : (i.eligibleVotes ? 'pvPdf.electionOpenOf' : 'pvPdf.electionOpen');
        para(m.s(key, { seats: i.seats ?? 1, ballots: i.ballots.length, eligible: i.eligibleVotes ?? '' }), DIM);
        para(res.ranking.map(x => m.s('pvPdf.candidateVotes', { name: i.candidates.find(c => c.id === x.id)?.name ?? '?', count: x.votes })).join(' ; '), DIM);
        para(elected.length ? m.s('pvPdf.elected', { names: elected.join(', ') }) : m.s('pvPdf.nobodyElected'), elected.length ? GREEN : RED, 'semibold');
        if (res.tie && elected.length > res.elected.length) para(m.s('pvPdf.tieBroken'), DIM);
      } else para(i.candidates.length ? m.s('pvPdf.candidatesPending', { names: i.candidates.map(c => c.name).join(', ') }) : m.s('pvPdf.notElected'), DIM);
    }
  });

  // Signatures
  if (doc.y > doc.page.height - 170) doc.addPage();
  doc.moveDown(2.5);
  const y = doc.y + 30;
  const half = (width - 40) / 2;
  doc.moveTo(left, y).lineTo(left + half, y).lineWidth(0.6).strokeColor(DIM).stroke();
  doc.moveTo(left + half + 40, y).lineTo(left + width, y).stroke();
  doc.font('regular').fontSize(9).fillColor(DIM)
    .text(m.s('pvPdf.chair'), left, y + 6, { width: half })
    .text(a.secretaryId ? m.s('pvPdf.secretaryNamed', { name: name(a.secretaryId) }) : m.s('pvPdf.secretary'), left + half + 40, y + 6, { width: half });

  const generated = zurich({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(p);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 38;
    doc.font('regular').fontSize(8).fillColor(DIM)
      .text(m.s(draft ? 'pvPdf.footerDraft' : 'pvPdf.footer', { date: generated }), left, fy, { width: width - 40, lineBreak: false })
      .text(`${p + 1} / ${range.count}`, left, fy, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  const buffer = await done;
  return { buffer, filename: `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - ${m.s('pvPdf.file')}.pdf` };
}
