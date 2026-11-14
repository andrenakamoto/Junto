import { t } from '../i18n';

// Image à partager après la révélation du Père Noël secret (2026-11-14) : format story 1080 × 1920,
// « Mon Père Noël secret était… <prénom> », signée EvLY. Dessinée sur un canvas, sans service extérieur.
export async function santaStoryBlob(name: string): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try { await document.fonts.load('800 120px Fraunces'); await document.fonts.load('italic 300 120px Fraunces'); } catch { /* police par défaut */ }

  // Fond : rouge de Noël vers le corail d'EvLY
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#9f1239'); bg.addColorStop(0.55, '#e11d48'); bg.addColorStop(1, '#ea5a2b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // Flocons
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 90; i++) {
    const x = (i * 197) % W, y = (i * 331) % H, r = 3 + (i % 4) * 2;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';

  g.font = '260px serif'; g.fillText('🎅', W / 2, 560);
  g.font = 'italic 300 92px Fraunces, serif'; g.fillText(t('games.santa.growth.shareLine1'), W / 2, 760, W - 120);
  g.fillText(t('games.santa.growth.shareLine2'), W / 2, 870);
  // Prénom en grand, réduit s'il est long
  let size = 190;
  do { g.font = `800 ${size}px Fraunces, serif`; size -= 10; } while (g.measureText(name).width > W - 120 && size > 70);
  g.fillText(name, W / 2, 1110);
  g.font = '200px serif'; g.fillText('🎁', W / 2, 1400);

  // Signature
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '600 44px Inter, sans-serif'; g.fillText(t('games.santa.growth.shareFooter'), W / 2, 1640);
  g.font = 'italic 300 120px Fraunces, serif';
  const ev = 'Ev', ly = 'LY';
  const wEv = g.measureText(ev).width; g.font = '800 120px Fraunces, serif'; const wLy = g.measureText(ly).width;
  const x0 = W / 2 - (wEv + wLy) / 2;
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'italic 300 120px Fraunces, serif'; g.fillText(ev, x0, 1780);
  g.fillStyle = '#fde68a'; g.font = '800 120px Fraunces, serif'; g.fillText(ly, x0 + wEv, 1780);
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '700 40px Inter, sans-serif'; g.fillText('www.evly.ch', W / 2, 1850);

  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.92));
}
