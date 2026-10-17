// Fabrique les images fictives de la démo (affiches, programme, plan du site) à partir de affiches.html.
//   PW=<chemin vers playwright-core> node affiches.js
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright-core');
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1100, height: 1200 } });
  await p.goto('file://' + __dirname + '/affiches.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  for (const el of await p.$$('section')) await el.screenshot({ path: path.join(__dirname, (await el.getAttribute('id')) + '.png') });
  await b.close();
})();
