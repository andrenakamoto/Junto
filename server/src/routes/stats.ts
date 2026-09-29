import { Router } from 'express';
import prisma from '../lib/prisma';
import { visitLimiter } from '../middleware/rateLimit';
import { isBot, TRACKED_PAGES, visitDay } from '../lib/pageVisits';

// Public (sans compte) : appelé par navigator.sendBeacon depuis les pages
// publiques. N'enregistre qu'un +1 sur le total du jour — voir lib/pageVisits.ts.
const router = Router();

router.post('/visit', visitLimiter, async (req, res) => {
  const page = String(req.query.page ?? '');
  if (!(TRACKED_PAGES as readonly string[]).includes(page)) { res.status(400).end(); return; }
  if (!isBot(req.get('user-agent'))) {
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
  res.status(204).end();
});

export default router;
