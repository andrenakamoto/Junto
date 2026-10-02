import path from 'path';
import { Resvg } from '@resvg/resvg-js';

// Image d'aperçu d'un lien d'invitation (WhatsApp, Messenger, iMessage… : balise og:image),
// 1200 × 630. Dessinée en SVG puis convertie en PNG, avec les polices du dossier
// server/assets/fonts (Fraunces pour le logo, Inter pour le texte).
// Volontairement sans le lieu : l'aperçu est vu (et gardé) par les messageries.

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
const FONT_FILES = ['Fraunces-ExtraBold.ttf', 'Fraunces-LightItalic.ttf', 'Inter-Medium.ttf', 'Inter-ExtraBold.ttf']
  .map(f => path.join(FONT_DIR, f));

export type ShareCard = {
  title: string;
  date: string | null;      // déjà formatée (« Samedi 4 octobre · 19:00 »)
  participants: number;
  creatorName: string;
} | null;                   // null : carte générique EvLY (lien invalide, page d'accueil)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Découpe approximative (largeur moyenne des caractères d'Inter) : 2 lignes au plus
export function wrapTitle(title: string, maxChars: number, maxLines = 2): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const used = lines.join(' ').replace(/…$/, '');
  if (used.length < title.trim().length && !lines[lines.length - 1].endsWith('…')) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…';
  }
  return lines;
}

export function shareCardSvg(card: ShareCard): string {
  const W = 1200, H = 630;
  const logo = `
    <text x="80" y="122" font-family="Fraunces" font-size="64">
      <tspan font-style="italic" font-weight="300" fill="#ffffff">Ev</tspan><tspan font-weight="800" fill="#ea5a2b">LY</tspan>
    </text>`;
  const background = `
    <rect width="${W}" height="${H}" fill="#0f172a"/>
    <circle cx="1120" cy="80" r="260" fill="#ea5a2b" opacity="0.16"/>
    <circle cx="1180" cy="600" r="180" fill="#ea5a2b" opacity="0.10"/>
    <rect x="0" y="0" width="12" height="${H}" fill="#ea5a2b"/>`;

  if (!card) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${background}${logo}
      <text x="80" y="330" font-family="Inter" font-weight="800" font-size="72" fill="#ffffff">Vos sorties entre proches,</text>
      <text x="80" y="420" font-family="Inter" font-weight="800" font-size="72" fill="#ea5a2b">enfin simples.</text>
      <text x="80" y="520" font-family="Inter" font-weight="500" font-size="34" fill="#94a3b8">Cercles, Plans, chat, covoiturage, dépenses — evly.ch</text>
    </svg>`;
  }

  // Une ligne : grand titre ; deux lignes : un peu plus petit, pour garder de l'air
  const lines = wrapTitle(card.title, 27);
  const [size, gap, titleY] = lines.length === 1 ? [72, 0, 300] : [64, 76, 280];
  const titleSvg = lines
    .map((l, i) => `<text x="80" y="${titleY + i * gap}" font-family="Inter" font-weight="800" font-size="${size}" fill="#ffffff">${esc(l)}</text>`)
    .join('');
  const infoY = titleY + (lines.length - 1) * gap + (lines.length === 1 ? 76 : 64);
  const who = `${card.participants} participant${card.participants > 1 ? 's' : ''} · proposé par ${card.creatorName}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${background}${logo}
    <rect x="80" y="160" width="232" height="44" rx="22" fill="#ea5a2b" opacity="0.18"/>
    <text x="196" y="190" text-anchor="middle" font-family="Inter" font-weight="800" font-size="20" letter-spacing="3" fill="#f5a383">INVITATION</text>
    ${titleSvg}
    ${card.date ? `<text x="80" y="${infoY}" font-family="Inter" font-weight="500" font-size="36" fill="#e2e8f0">${esc(card.date)}</text>` : ''}
    <text x="80" y="${infoY + (card.date ? 52 : 0)}" font-family="Inter" font-weight="500" font-size="30" fill="#94a3b8">${esc(who)}</text>
    <rect x="80" y="514" width="420" height="72" rx="36" fill="#ea5a2b"/>
    <text x="290" y="560" text-anchor="middle" font-family="Inter" font-weight="800" font-size="30" fill="#ffffff">Réponds en un clic →</text>
    <text x="1120" y="562" text-anchor="end" font-family="Inter" font-weight="500" font-size="30" fill="#94a3b8">evly.ch</text>
  </svg>`;
}

export function renderShareCard(card: ShareCard): Buffer {
  const resvg = new Resvg(shareCardSvg(card), {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: 1200 },
  });
  return resvg.render().asPng();
}
