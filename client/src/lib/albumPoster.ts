import QRCode from 'qrcode';
import { intlLocale, t } from '../i18n';
import { albumLink } from './album';

// Affiche A4 de l'album souvenir (2026-11-23) : à imprimer et poser sur les tables ou à l'entrée de la soirée, ou à projeter.
// Titre de la soirée, grand QR code vers l'album, trois étapes, date de fin, adresse écrite pour qui n'a pas d'appareil photo.
// Dessinée sur un canvas (200 dpi), sans service extérieur ; le QR code est tracé module par module pour rester net.

export const POSTER_W = 1654;
export const POSTER_H = 2339;

const CORAL = '#ea5a2b';
const DARK = '#1e293b';

function lines(g: CanvasRenderingContext2D, text: string, max: number): string[] {
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

// Logo EvLY : « Ev » en italique fine, « LY » en gras corail (comme components/ui/Logo.tsx)
function wordmark(g: CanvasRenderingContext2D, cx: number, base: number, size: number) {
  g.font = `italic 300 ${size}px Fraunces, Georgia, serif`;
  const wEv = g.measureText('Ev').width;
  g.font = `800 ${size}px Fraunces, Georgia, serif`;
  const wLy = g.measureText('LY').width;
  const x0 = cx - (wEv + wLy) / 2;
  g.textAlign = 'left';
  g.fillStyle = DARK; g.font = `italic 300 ${size}px Fraunces, Georgia, serif`; g.fillText('Ev', x0, base);
  g.fillStyle = CORAL; g.font = `800 ${size}px Fraunces, Georgia, serif`; g.fillText('LY', x0 + wEv, base);
  g.textAlign = 'center';
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export async function albumPosterCanvas(album: { title: string; token: string; expiresAt: string }): Promise<HTMLCanvasElement> {
  const W = POSTER_W, H = POSTER_H;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try {
    await Promise.all([document.fonts.load('800 100px Fraunces'), document.fonts.load('italic 300 100px Fraunces')]);
  } catch { /* police par défaut */ }

  g.fillStyle = '#fff8f4'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';

  // En-tête blanc : le logo EvLY en grand et « Events Linked to You »
  const headH = 400;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, headH);
  wordmark(g, W / 2, 230, 190);
  g.fillStyle = '#64748b'; g.font = '700 46px Inter, Arial, sans-serif';
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '12px';
  g.fillText('EVENTS LINKED TO YOU', W / 2 + 6, 330);
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';

  // Bandeau corail vers rose, comme la page de l'album, avec des confettis discrets
  const bandY = headH, bandH = 720;
  const bg = g.createLinearGradient(0, bandY, W, bandY + bandH);
  bg.addColorStop(0, '#e24d1f'); bg.addColorStop(0.55, '#f97352'); bg.addColorStop(1, '#f43f5e');
  g.fillStyle = bg; g.fillRect(0, bandY, W, bandH);
  const dots = ['rgba(255,255,255,0.35)', 'rgba(253,230,138,0.55)', 'rgba(255,255,255,0.2)'];
  for (let i = 0; i < 60; i++) {
    g.fillStyle = dots[i % 3];
    const x = (i * 241) % W, y = bandY + 20 + ((i * 137) % (bandH - 80)), r = 5 + (i % 4) * 3;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  g.fillStyle = '#fff'; g.font = '700 44px Inter, Arial, sans-serif';
  g.fillText(`📸  ${t('album.poster.kicker').toUpperCase()}`, W / 2, bandY + 100);

  // Titre de la soirée : jusqu'à 2 lignes, réduit s'il est long
  let size = 120, tl: string[] = [];
  for (; size >= 60; size -= 6) {
    g.font = `800 ${size}px Fraunces, Georgia, serif`;
    tl = lines(g, album.title, W - 220);
    if (tl.length <= 2) break;
  }
  if (tl.length > 2) tl = [tl[0], `${tl[1]}…`];
  const titleTop = bandY + 230 + (tl.length === 1 ? size * 0.35 : 0);
  tl.forEach((l, i) => g.fillText(l, W / 2, titleTop + i * size * 1.08));

  // Carte blanche avec le QR code
  const cardW = 720, cardX = (W - cardW) / 2, cardY = bandY + 430, cardH = 720;
  g.save(); g.shadowColor = 'rgba(15,23,42,0.18)'; g.shadowBlur = 50; g.shadowOffsetY = 18;
  g.fillStyle = '#fff'; roundRect(g, cardX, cardY, cardW, cardH, 56); g.fill(); g.restore();

  const qr = QRCode.create(albumLink(album.token), { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, qrSize = 600, m = qrSize / n;
  const qx = (W - qrSize) / 2, qy = cardY + (cardH - qrSize) / 2;
  g.fillStyle = '#431a11';
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(r, col)) g.fillRect(Math.floor(qx + col * m), Math.floor(qy + r * m), Math.ceil(m), Math.ceil(m));
    }
  }

  // Appel
  g.fillStyle = DARK; g.font = '800 84px Fraunces, Georgia, serif';
  const head = lines(g, t('album.poster.headline'), W - 200);
  let y = cardY + cardH + 160;
  head.forEach((l, i) => g.fillText(l, W / 2, y + i * 88));
  y += (head.length - 1) * 92 + 100;

  // Trois étapes
  const steps = [t('album.poster.step1'), t('album.poster.step2'), t('album.poster.step3')];
  const colW = (W - 160) / 3;
  steps.forEach((s, i) => {
    const cx = 80 + colW * i + colW / 2;
    g.fillStyle = CORAL; g.beginPath(); g.arc(cx, y + 42, 42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '800 50px Inter, Arial, sans-serif'; g.fillText(String(i + 1), cx, y + 60);
    g.fillStyle = '#334155'; g.font = '600 40px Inter, Arial, sans-serif';
    lines(g, s, colW - 40).slice(0, 2).forEach((l, k) => g.fillText(l, cx, y + 145 + k * 48));
  });

  // Pied : sans compte, date de fin, adresse de l'album en petit, puis evly.ch en grand
  const date = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(new Date(album.expiresAt));
  g.fillStyle = '#64748b'; g.font = '500 34px Inter, Arial, sans-serif';
  g.fillText(t('album.poster.footer', { date }), W / 2, H - 205);
  g.fillStyle = '#94a3b8'; g.font = '500 26px Inter, Arial, sans-serif';
  g.fillText(albumLink(album.token).replace(/^https?:\/\//, ''), W / 2, H - 160);
  g.fillStyle = CORAL; g.font = '800 84px Inter, Arial, sans-serif';
  g.fillText('evly.ch', W / 2, H - 55);
  return c;
}

export async function albumPosterBlob(album: { title: string; token: string; expiresAt: string }): Promise<Blob> {
  const c = await albumPosterCanvas(album);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
}

export const posterFileName = (title: string) =>
  `affiche-album-${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'evly'}.png`;
