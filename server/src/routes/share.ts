import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { APP_URL } from '../lib/mailer';
import { renderShareCard, type ShareCard } from '../lib/shareImage';

// Aperçu des liens d'invitation dans les messageries (WhatsApp, Messenger, iMessage…).
// Vercel renvoie /invitation vers GET /api/share/invitation (client/vercel.json) : on sert
// la page de l'app (index.html du site) en y ajoutant les balises og:* du Plan, puis l'app
// s'affiche normalement pour les personnes. L'image passe par /apercu/<jeton>.png (aussi
// renvoyée ici par Vercel). Public : le jeton du lien suffit, comme pour /api/invite.
// L'aperçu ne montre ni le lieu ni la description : les messageries le gardent en cache.
const router = Router();

const SITE = (APP_URL.startsWith('http://localhost') ? 'https://www.evly.ch' : APP_URL).replace(/\/$/, '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// « Samedi 4 octobre · 19:00 » (heure suisse)
export function shareDate(date: Date | null): string | null {
  if (!date) return null;
  const tz = { timeZone: 'Europe/Zurich' } as const;
  const day = new Intl.DateTimeFormat('fr-CH', { ...tz, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  const time = new Intl.DateTimeFormat('fr-CH', { ...tz, hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

async function shareCardFor(token: string): Promise<ShareCard> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const link = await prisma.planGuestLink.findUnique({
    where: { token },
    select: {
      plan: {
        select: {
          title: true, eventDate: true, endDate: true,
          creator: { select: { firstName: true, pseudo: true } },
          _count: { select: { members: { where: { rsvp: 'in' } } } },
        },
      },
    },
  });
  if (!link || link.plan.endDate <= new Date()) return null;
  const { plan } = link;
  return {
    title: plan.title,
    date: shareDate(plan.eventDate),
    participants: plan._count.members,
    creatorName: plan.creator.firstName || plan.creator.pseudo,
  };
}

// Version de l'image : change quand le titre, la date ou le nombre de participants change
// (les messageries gardent une image par adresse)
const cardVersion = (card: ShareCard) => crypto.createHash('sha1').update(JSON.stringify(card)).digest('hex').slice(0, 10);

// index.html du site, relu au plus une fois par minute (il change à chaque mise en ligne)
let indexCache: { html: string; at: number } | null = null;
async function siteIndex(): Promise<string | null> {
  if (indexCache && Date.now() - indexCache.at < 60_000) return indexCache.html;
  try {
    const r = await fetch(`${SITE}/index.html`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    indexCache = { html: await r.text(), at: Date.now() };
  } catch (e) {
    console.error('[share] index.html indisponible', e);
  }
  return indexCache?.html ?? null; // dernière copie connue si le site ne répond pas
}

export function injectMeta(html: string, card: ShareCard, token: string): string {
  const title = card ? `${card.title} — invitation EvLY` : 'Invitation EvLY';
  const parts = card
    ? [card.date, `${card.participants} participant${card.participants > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
    : '';
  const description = card
    ? `${parts} — Réponds en un clic, sans créer de compte.`
    : 'Cette invitation n\'est plus valide. Découvre EvLY pour organiser tes sorties entre proches.';
  const image = card ? `${SITE}/apercu/${token}.png?v=${cardVersion(card)}` : `${SITE}/og-evly.png`;
  const url = `${SITE}/invitation?token=${encodeURIComponent(token)}`;
  const meta = `
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="${esc(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="EvLY" />
    <meta property="og:locale" content="fr_CH" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
  `;
  return html
    // Balises génériques du site (index.html) remplacées par celles de l'invitation
    .replace(/\s*<meta (?:property="og:[^"]+"|name="(?:twitter:[^"]+|description)")[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace('</head>', `${meta}</head>`);
}

// GET /api/share/invitation?token=… — la page /invitation, avec l'aperçu du Plan
router.get('/invitation', async (req, res) => {
  const token = String(req.query.token ?? '');
  const [html, card] = await Promise.all([siteIndex(), shareCardFor(token).catch(() => null)]);
  if (!html) {
    // Site injoignable et aucune copie : la même page, servie sans aperçu par Vercel
    res.redirect(302, `/invitation-plan?token=${encodeURIComponent(token)}`);
    return;
  }
  res.set('Cache-Control', 'no-store');
  res.type('html').send(injectMeta(html, card, token));
});

// GET /api/share/image/:file — /apercu/<jeton>.png (image de l'aperçu), gardée 10 minutes
const imageCache = new Map<string, { png: Buffer; at: number }>();
router.get('/image/:file', async (req, res) => {
  try {
    const token = req.params.file.replace(/\.png$/, '');
    const card = await shareCardFor(token);
    const key = `${token}:${cardVersion(card)}`;
    let entry = imageCache.get(key);
    if (!entry || Date.now() - entry.at > 10 * 60_000) {
      entry = { png: renderShareCard(card), at: Date.now() };
      imageCache.set(key, entry);
      if (imageCache.size > 200) imageCache.delete(imageCache.keys().next().value!);
    }
    res.set('Cache-Control', 'public, max-age=600');
    res.type('png').send(entry.png);
  } catch (e) {
    console.error('[share image]', e);
    res.status(500).end();
  }
});

export default router;
