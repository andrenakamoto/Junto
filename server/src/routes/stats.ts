import { Router } from 'express';
import prisma from '../lib/prisma';
import { visitLimiter, downloadLimiter } from '../middleware/rateLimit';
import { isBot, TRACKED_FILES, TRACKED_PAGES, visitDay } from '../lib/pageVisits';

// Public (sans compte) : appelé par navigator.sendBeacon depuis les pages
// publiques. N'enregistre qu'un +1 sur le total du jour — voir lib/pageVisits.ts.
const router = Router();

async function countVisit(page: string, userAgent: string | undefined) {
  if (isBot(userAgent)) return;
  try {
    const day = visitDay();
    await prisma.pageVisit.upsert({
      where: { page_day: { page, day } },
      create: { page, day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (e) {
    console.error('[page visit]', e);
  }
}

router.post('/visit', visitLimiter, async (req, res) => {
  const page = String(req.query.page ?? '');
  if (!(TRACKED_PAGES as readonly string[]).includes(page)) { res.status(400).end(); return; }
  await countVisit(page, req.get('user-agent'));
  res.status(204).end();
});

// Téléchargement compté d'un fichier public (brochure PDF) : evly.ch/brochure et
// l'ancienne adresse du PDF redirigent ici (client/vercel.json), on compte +1 puis
// on renvoie vers le fichier. Au-delà de la limite, redirection sans compter.
router.get('/go/:page', downloadLimiter, async (req, res) => {
  const target = TRACKED_FILES[req.params.page];
  if (!target) { res.status(404).end(); return; }
  await countVisit(req.params.page, req.get('user-agent'));
  res.redirect(302, target);
});

export default router;
