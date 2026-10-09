import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { MAJORITY_LABEL, countVotes, electionResult, fullName, isAdopted, quorumRequired, votingRights } from './assembly';

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
const zurich = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', ...opts });
const day = zurich({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const time = zurich({ hour: '2-digit', minute: '2-digit' });
const CHOICE: Record<string, string> = { yes: 'oui', no: 'non', abstain: 'abstention' };

export async function buildAssemblyPvPdf(planId: string): Promise<{ buffer: Buffer; filename: string } | null> {
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
  const name = (id: string | null | undefined) => { const u = id ? users.get(id) : null; return u ? fullName(u) : '(compte supprimé)'; };
  const sortByName = (ids: string[]) => [...ids].sort((x, y) => name(x).localeCompare(name(y), 'fr'));
  const voterIds = [...users.keys()].filter(id => !a.nonVoterIds.includes(id));
  const present = new Set(a.attendances.map(x => x.userId));
  const r = votingRights(voterIds, present, a.proxies);
  const required = quorumRequired(a.quorumMode, a.quorumValue, voterIds.length);
  const docIds = [...new Set(a.items.flatMap(i => i.attachmentIds))];
  const docs = new Map((docIds.length ? await prisma.attachment.findMany({ where: { id: { in: docIds } }, select: { id: true, name: true } }) : []).map(d => [d.id, d.name]));

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 60, left: 56, right: 56 }, bufferPages: true, info: { Title: `Procès-verbal — ${plan.title}`, Author: 'EvLY' } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const [n, file] of Object.entries(F)) doc.registerFont(n, file);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const draft = !a.closedAt;

  doc.font('serifLight').fontSize(20).fillColor(INK).text('Ev', left, 44, { continued: true }).font('serif').fillColor(CORAL).text('LY');
  doc.font('bold').fontSize(8).fillColor(draft ? RED : CORAL).text(draft ? 'PROJET DE PROCÈS-VERBAL' : 'PROCÈS-VERBAL', left, 52, { width, align: 'right', characterSpacing: 1.2 });
  doc.moveTo(left, 76).lineTo(left + width, 76).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.y = 92;
  doc.font('semibold').fontSize(9).fillColor(CORAL).text(plan.circle.name.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.2).font('serif').fontSize(22).fillColor(INK).text(plan.title, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  const when = a.openedAt ?? plan.eventDate;
  if (when) line('Date', `${day.format(when)}`);
  if (a.openedAt) line('Ouverture', time.format(a.openedAt) + (a.closedAt ? `  ·  Clôture : ${time.format(a.closedAt)}` : ''));
  if (plan.location) line('Lieu', plan.location);
  line('Organisation', fullName(plan.creator));
  if (a.secretaryId) line('Procès-verbal', name(a.secretaryId));

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
  section('Présences', `${presentIds.length} présent${presentIds.length > 1 ? 's' : ''}`);
  if (presentIds.length) para(presentIds.map(id => {
    const att = a.attendances.find(x => x.userId === id);
    const tags = [att?.remote ? 'à distance' : null, a.nonVoterIds.includes(id) ? 'sans droit de vote' : null].filter(Boolean);
    return `${name(id)}${tags.length ? ` (${tags.join(', ')})` : ''}`;
  }).join(', '));
  else para('Personne n’a été pointé présent.', DIM);
  if (r.validProxies.length) {
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(`Procurations (${r.validProxies.length})`);
    para(r.validProxies.map(p => `${name(p.giverId)}, représenté·e par ${name(p.holderId)}`).join(' ; '), DIM);
  }
  const excused = sortByName(plan.members.filter(m => m.rsvp === 'out' && users.has(m.userId) && !present.has(m.userId) && !r.validProxies.some(p => p.giverId === m.userId)).map(m => m.userId));
  if (excused.length) {
    doc.moveDown(0.4).font('semibold').fontSize(10).fillColor(INK).text(`Excusés (${excused.length})`);
    para(excused.map(name).join(', '), DIM);
  }

  section('Quorum');
  para(`${voterIds.length} membres votants · ${r.presentVoters} présents votants + ${r.validProxies.length} procuration${r.validProxies.length > 1 ? 's' : ''} = ${r.represented} voix.`);
  if (required === null) para('Aucun quorum requis.', DIM);
  else para(`Quorum requis : ${required} voix${a.quorumMode === 'percent' ? ` (${a.quorumValue} % des membres votants)` : ''} — ${r.represented >= required ? 'atteint.' : 'NON atteint.'}`, r.represented >= required ? GREEN : RED, 'semibold');

  // Ordre du jour
  section('Ordre du jour et décisions');
  a.items.forEach((i, n) => {
    if (doc.y > doc.page.height - 130) doc.addPage();
    doc.moveDown(0.5).font('semibold').fontSize(11.5).fillColor(INK).text(`${n + 1}. ${i.title}`, { width });
    if (i.description) para(i.description, DIM);
    const d = i.attachmentIds.map(id => docs.get(id)).filter(Boolean);
    if (d.length) para(`Documents : ${d.join(', ')}`, DIM);
    if (i.notes) { doc.moveDown(0.2); para(i.notes); }
    if (i.kind === 'vote') {
      doc.moveDown(0.2);
      if (i.status === 'tacit') para(`Décision : ${i.tacitAdopted ? 'adopté' : 'rejeté'} sans scrutin (par acclamation).`, i.tacitAdopted ? GREEN : RED, 'semibold');
      else if (i.status === 'closed') {
        const c = countVotes(i.ballots);
        const ok = isAdopted(c, i.majority);
        para(`Vote ${i.secret ? 'au bulletin secret' : 'à main levée'}, ${MAJORITY_LABEL[i.majority as keyof typeof MAJORITY_LABEL]}.`, DIM);
        para(`${ok ? 'Adopté' : 'Rejeté'} : ${c.yes} oui, ${c.no} non, ${c.abstain} abstention${c.abstain > 1 ? 's' : ''}${i.eligibleVotes ? ` (${i.ballots.length} voix exprimées sur ${i.eligibleVotes})` : ''}.`, ok ? GREEN : RED, 'semibold');
        if (!i.secret && i.voters.length) para(i.voters.map(v => `${name(v.onBehalfOfId)}${v.userId !== v.onBehalfOfId ? ` (par ${name(v.userId)})` : ''} : ${CHOICE[v.choice ?? ''] ?? '?'}`).join(' ; '), DIM);
      } else para('Pas encore voté.', DIM);
    }
    if (i.kind === 'election') {
      doc.moveDown(0.2);
      const elected = i.candidates.filter(c => c.elected).map(c => c.name);
      if (i.status === 'tacit') para(`Élu${elected.length > 1 ? 's' : ''} tacitement : ${elected.join(', ')}.`, GREEN, 'semibold');
      else if (i.status === 'closed') {
        const res = electionResult(i.candidates.map(c => c.id), i.ballots, i.seats ?? 1);
        para(`Élection ${i.secret ? 'au bulletin secret' : 'à main levée'}, ${i.seats ?? 1} siège${(i.seats ?? 1) > 1 ? 's' : ''} ; ${i.ballots.length} bulletins${i.eligibleVotes ? ` sur ${i.eligibleVotes} voix` : ''}.`, DIM);
        para(res.ranking.map(x => `${i.candidates.find(c => c.id === x.id)?.name} : ${x.votes} voix`).join(' ; '), DIM);
        para(elected.length ? `Élu${elected.length > 1 ? 's' : ''} : ${elected.join(', ')}.` : 'Personne d’élu.', elected.length ? GREEN : RED, 'semibold');
        if (res.tie && elected.length > res.elected.length) para('Égalité de voix départagée par la présidence.', DIM);
      } else para(i.candidates.length ? `Candidats : ${i.candidates.map(c => c.name).join(', ')}. Pas encore élu.` : 'Pas encore élu.', DIM);
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
    .text('La présidence', left, y + 6, { width: half })
    .text(a.secretaryId ? `Le ou la secrétaire (${name(a.secretaryId)})` : 'Le ou la secrétaire', left + half + 40, y + 6, { width: half });

  const generated = zurich({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(p);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 38;
    doc.font('regular').fontSize(8).fillColor(DIM)
      .text(`${draft ? 'Projet généré' : 'Généré'} le ${generated} depuis evly.ch`, left, fy, { width: width - 40, lineBreak: false })
      .text(`${p + 1} / ${range.count}`, left, fy, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  const buffer = await done;
  return { buffer, filename: `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - procès-verbal.pdf` };
}
