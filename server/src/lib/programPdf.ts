import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from './prisma';
import { type Locale } from './i18n';
import { mail } from './emailText';
import { orderedItems, scheduleItems } from './program';

// Feuille de route du Déroulé (PDF à imprimer pour l'équipe et les prestataires) : chaque moment avec ses heures,
// sa durée, son lieu, ses responsables, le matériel et la technique, les remarques. Même mise en page que le
// récapitulatif (lib/planRecap.ts). Prénom et @pseudo, jamais de nom de famille.

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
const F = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  semibold: path.join(FONT_DIR, 'Inter-SemiBold.ttf'),
  bold: path.join(FONT_DIR, 'Inter-ExtraBold.ttf'),
  serif: path.join(FONT_DIR, 'Fraunces-ExtraBold.ttf'),
  serifLight: path.join(FONT_DIR, 'Fraunces-LightItalic.ttf'),
};
const CORAL = '#ea5a2b', INK = '#1c1410', DIM = '#6b5850', LINE = '#f0ddd3';
// Les polices du PDF n'ont pas d'emoji
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s{2,}/g, ' ').trim();

export async function buildProgramPdf(planId: string, locale: Locale = 'fr'): Promise<{ buffer: Buffer; filename: string } | null> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { title: true, eventDate: true, endDate: true, location: true } });
  if (!plan) return null;
  const m = mail(locale);
  const items = scheduleItems(await orderedItems(planId), plan.eventDate);
  const zurich = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(m.intl, { timeZone: 'Europe/Zurich', ...opts });
  const time = zurich({ hour: '2-digit', minute: '2-digit' });
  const day = zurich({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const doc = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 40, bottom: 50, left: 50, right: 50 }, info: { Title: `${m.s('programPdf.file')} — ${plan.title}` } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  for (const [name, file] of Object.entries(F)) doc.registerFont(name, file);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.font('serifLight').fontSize(20).fillColor(INK).text('Ev', left, 44, { continued: true }).font('serif').fillColor(CORAL).text('LY');
  doc.font('bold').fontSize(8).fillColor(CORAL).text(m.s('programPdf.header'), left, 52, { width, align: 'right', characterSpacing: 1.2 });
  doc.moveTo(left, 76).lineTo(left + width, 76).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.y = 92;
  doc.font('serif').fontSize(22).fillColor(INK).text(noEmoji(plan.title) || plan.title, left, doc.y, { width });
  doc.moveDown(0.4);
  const line = (label: string, value: string) => doc.font('semibold').fontSize(10).fillColor(DIM).text(`${label}  `, { continued: true }).font('regular').fillColor(INK).text(value);
  if (plan.eventDate) line(m.s('programPdf.date'), `${day.format(plan.eventDate)}, ${time.format(plan.eventDate)} – ${time.format(plan.endDate)}`);
  if (plan.location) line(m.s('programPdf.place'), plan.location);
  doc.moveDown(1);

  if (items.length === 0) doc.font('regular').fontSize(10).fillColor(DIM).text(m.s('programPdf.empty'));

  const timeCol = 92;
  const textX = left + timeCol;
  const textW = width - timeCol;
  for (const item of items) {
    const who = item.assignees.map(a => a.user.firstName ? `${a.user.firstName} (@${a.user.pseudo})` : `@${a.user.pseudo}`).join(', ');
    const rows: [string, string][] = [];
    if (item.place) rows.push([m.s('programPdf.place'), item.place]);
    if (who) rows.push([m.s('programPdf.who'), who]);
    if (item.tech) rows.push([m.s('programPdf.tech'), item.tech]);
    if (item.note) rows.push([m.s('programPdf.note'), item.note]);
    // Hauteur du bloc, pour ne pas le couper en bas de page
    doc.font('semibold').fontSize(11);
    let h = doc.heightOfString(noEmoji(item.title) || item.title, { width: textW }) + 8;
    doc.font('regular').fontSize(9.5);
    for (const [label, value] of rows) h += doc.heightOfString(`${label}  ${value}`, { width: textW, lineGap: 1 }) + 2;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom - 10) doc.addPage();

    const y = doc.y;
    doc.font('bold').fontSize(11).fillColor(CORAL).text(item.start ? time.format(item.start) : '—', left, y, { width: timeCol - 8 });
    if (item.end && item.durationMin > 0) doc.font('regular').fontSize(8.5).fillColor(DIM).text(`→ ${time.format(item.end)} · ${m.s('programPdf.minutes', { count: item.durationMin })}`, left, doc.y, { width: timeCol - 8 });
    const afterTime = doc.y;
    doc.font('semibold').fontSize(11).fillColor(INK).text(noEmoji(item.title) || item.title, textX, y, { width: textW });
    doc.moveDown(0.15);
    for (const [label, value] of rows) {
      doc.font('semibold').fontSize(9.5).fillColor(DIM).text(`${label}  `, textX, doc.y, { continued: true, width: textW, lineGap: 1 }).font('regular').fillColor(INK).text(value, { width: textW, lineGap: 1 });
    }
    doc.y = Math.max(doc.y, afterTime) + 8;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.y += 8;
    doc.x = left;
  }

  // Pied de page : date de la version (sous la marge du bas : marge remise à 0 le temps de l'écrire)
  const range = doc.bufferedPageRange();
  const stamp = m.s('programPdf.version', { date: zurich({ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()) });
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor(DIM).text(`${stamp} · ${i + 1}/${range.count}`, left, doc.page.height - 32, { width, align: 'right' });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  const safe = plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80);
  return { buffer: await done, filename: `${safe} - ${m.s('programPdf.file')}.pdf` };
}
