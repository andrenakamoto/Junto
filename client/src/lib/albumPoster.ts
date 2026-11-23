import QRCode from 'qrcode';
import { intlLocale, t } from '../i18n';
import { albumLink } from './album';

// Affiche A4 de l'album souvenir (2026-11-23, style « Polaroïds » choisi par l'utilisateur parmi 5) : à imprimer et poser sur les
// tables ou à l'entrée de la soirée, ou à projeter. Grand logo EvLY en haut, le QR code dans un polaroïd avec le titre,
// « Partage tes photos de la soirée ! », trois étapes, date de fin, adresse de l'album, evly.ch en bas.
// Dessinée sur un canvas (200 dpi), sans service extérieur ; le QR code est tracé module par module pour rester net.

export const POSTER_W = 1654;
export const POSTER_H = 2339;
const W = POSTER_W, H = POSTER_H;
const CORAL = '#ea5a2b';
const DARK = '#1e293b';
type Album = { title: string; token: string; expiresAt: string };
type G = CanvasRenderingContext2D;

function lines(g: G, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && g.measureText(next).width > max) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
function spacing(g: G, px: number) { (g as G & { letterSpacing?: string }).letterSpacing = `${px}px`; }
function wordmark(g: G, x: number, base: number, size: number, ev = DARK, ly = CORAL, align: 'center' | 'left' = 'center') {
  g.font = `italic 300 ${size}px Fraunces, Georgia, serif`;
  const wEv = g.measureText('Ev').width;
  g.font = `800 ${size}px Fraunces, Georgia, serif`;
  const wLy = g.measureText('LY').width;
  const x0 = align === 'center' ? x - (wEv + wLy) / 2 : x;
  g.textAlign = 'left';
  g.fillStyle = ev; g.font = `italic 300 ${size}px Fraunces, Georgia, serif`; g.fillText('Ev', x0, base);
  g.fillStyle = ly; g.font = `800 ${size}px Fraunces, Georgia, serif`; g.fillText('LY', x0 + wEv, base);
  g.textAlign = 'center';
  return wEv + wLy;
}
function tagline(g: G, x: number, y: number, color: string, size = 42, align: CanvasTextAlign = 'center') {
  g.fillStyle = color; g.font = `700 ${size}px Inter, Arial, sans-serif`; spacing(g, size * 0.28);
  g.textAlign = align; g.fillText('EVENTS LINKED TO YOU', x + (align === 'center' ? size * 0.14 : 0), y);
  spacing(g, 0); g.textAlign = 'center';
}
function qr(g: G, text: string, x: number, y: number, size: number, color: string) {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = q.modules.size, m = size / n;
  g.fillStyle = color;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (q.modules.get(r, c)) g.fillRect(Math.floor(x + c * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
  }
}
function fitTitle(g: G, title: string, max: number, from: number, weight = '800', italic = false) {
  let size = from, tl: string[] = [];
  for (; size >= 56; size -= 6) {
    g.font = `${italic ? 'italic ' : ''}${weight} ${size}px Fraunces, Georgia, serif`;
    tl = lines(g, title, max);
    if (tl.length <= 2) break;
  }
  if (tl.length > 2) tl = [tl[0], `${tl[1]}…`];
  return { size, tl };
}
function texts(album: Album) {
  const date = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(new Date(album.expiresAt));
  return {
    link: albumLink(album.token), short: albumLink(album.token).replace(/^https?:\/\//, ''),
    kicker: t('album.poster.kicker'), head: t('album.poster.headline'),
    steps: [t('album.poster.step1'), t('album.poster.step2'), t('album.poster.step3')],
    footer: t('album.poster.footer', { date }),
  };
}
function steps3(g: G, list: string[], y: number, circle: string, num: string, text: string, size = 40) {
  const colW = (W - 160) / 3;
  list.forEach((s, i) => {
    const cx = 80 + colW * i + colW / 2;
    g.fillStyle = circle; g.beginPath(); g.arc(cx, y + 42, 42, 0, Math.PI * 2); g.fill();
    g.fillStyle = num; g.font = '800 50px Inter, Arial, sans-serif'; g.fillText(String(i + 1), cx, y + 60);
    g.fillStyle = text; g.font = `600 ${size}px Inter, Arial, sans-serif`;
    lines(g, s, colW - 40).slice(0, 2).forEach((l, k) => g.fillText(l, cx, y + 145 + k * (size + 8)));
  });
}
function shadow(g: G, color: string, blur: number, dy: number) { g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetY = dy; }
function noShadow(g: G) { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }

// Fond crème, le QR code dans un polaroïd penché avec le titre de la soirée écrit dessous, photos instantanées éparpillées, le QR code dans le polaroïd du milieu
function polaroid(g: G, a: Album) {
  const x = texts(a);
  g.fillStyle = '#f7f1e8'; g.fillRect(0, 0, W, H);
  wordmark(g, W / 2, 225, 180); tagline(g, W / 2, 315, '#64748b');
  // Polaroïd central
  g.save(); g.translate(W / 2, 1050); g.rotate(-2 * Math.PI / 180);
  shadow(g, 'rgba(15,23,42,0.25)', 50, 20); g.fillStyle = '#fff'; g.fillRect(-430, -500, 860, 1040); noShadow(g);
  qr(g, x.link, -340, -410, 680, '#3b1c12');
  g.fillStyle = CORAL; g.font = '700 34px Inter, Arial, sans-serif'; spacing(g, 6);
  g.fillText(`📸 ${x.kicker.toUpperCase()}`, 0, 345); spacing(g, 0);
  const { size, tl } = fitTitle(g, a.title, 760, 84, '300', true);
  g.fillStyle = DARK; tl.forEach((l, i) => g.fillText(l, 0, 440 + i * size * 1.05 - (tl.length - 1) * size * 0.3));
  g.restore();
  g.fillStyle = DARK; g.font = '800 84px Fraunces, Georgia, serif'; g.fillText(x.head, W / 2, 1760, W - 160);
  steps3(g, x.steps, 1840, CORAL, '#fff', '#334155');
  g.fillStyle = '#64748b'; g.font = '500 34px Inter, Arial, sans-serif'; g.fillText(x.footer, W / 2, H - 200);
  g.fillStyle = '#94a3b8'; g.font = '500 26px Inter, Arial, sans-serif'; g.fillText(x.short, W / 2, H - 155);
  g.fillStyle = CORAL; g.font = '800 84px Inter, Arial, sans-serif'; g.fillText('evly.ch', W / 2, H - 55);
}


export async function albumPosterCanvas(album: Album): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try { await Promise.all([document.fonts.load('800 100px Fraunces'), document.fonts.load('italic 300 100px Fraunces')]); } catch { /* police par défaut */ }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  polaroid(g, album);
  return c;
}

export async function albumPosterBlob(album: Album): Promise<Blob> {
  const c = await albumPosterCanvas(album);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
}

export const posterFileName = (title: string) =>
  `affiche-album-${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'evly'}.png`;
