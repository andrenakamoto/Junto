import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { emailNewSuggestion, isSuggestionKind, SUGGESTION_MAX, SUGGESTIONS_PER_DAY } from '../lib/suggestions';

// « Proposer une amélioration » — voir lib/suggestions.ts
const router = Router();
router.use(requireAuth as any);

const PLATFORMS = ['web', 'android', 'ios'];

// POST /api/suggestions { kind, content, platform?, appVersion? }
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { kind, content } = req.body ?? {};
    if (!isSuggestionKind(kind)) { res.status(400).json({ error: 'Type de suggestion invalide' }); return; }
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) { res.status(400).json({ error: 'Écris ta suggestion' }); return; }
    if (text.length > SUGGESTION_MAX) { res.status(400).json({ error: `${SUGGESTION_MAX} caractères maximum` }); return; }
    const recent = await prisma.suggestion.count({ where: { userId: req.userId!, createdAt: { gte: new Date(Date.now() - 864e5) } } });
    if (recent >= SUGGESTIONS_PER_DAY) { res.status(429).json({ error: 'Merci pour toutes tes idées ! Tu pourras en envoyer d\'autres demain.' }); return; }
    const platform = PLATFORMS.includes(req.body?.platform) ? req.body.platform : null;
    const appVersion = typeof req.body?.appVersion === 'string' ? req.body.appVersion.slice(0, 30) : null;
    const suggestion = await prisma.suggestion.create({ data: { userId: req.userId!, kind, content: text, platform, appVersion } });
    emailNewSuggestion(suggestion, req.pseudo!).catch(e => console.error('[suggestion email]', e));
    res.json(suggestion);
  } catch (e) {
    console.error('[suggestion]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/suggestions/mine — mes suggestions et leur suivi
router.get('/mine', async (req: AuthRequest, res) => {
  const list = await prisma.suggestion.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, kind: true, content: true, status: true, reply: true, createdAt: true, updatedAt: true },
  });
  res.json(list);
});

export default router;
