import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { cleanFirstName, createLightUser, makeLightToken, readLightUser } from '../lib/lightGuest';
import { ensureInviteToken, EXPRESS_TITLE_MAX, getOrCreatePersonalCircle } from '../lib/express';
import { createPlanInCircle } from './circles';
import { countFunnel } from '../lib/funnel';
import { joinCircleRoom } from '../lib/realtime';

// « Organiser une sortie » (page publique /organiser) — voir lib/express.ts.
// Public : avec un compte (jeton normal), le Plan va dans son Cercle « Mes Plans » ; sans
// compte, un jeton d'organisateur léger est créé (ou réutilisé) et renvoyé.
const router = Router();

// Sans compte : 3 Plans express par jour depuis une même connexion
const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false,
  // Seules les sorties réellement créées comptent (pas un formulaire refusé)
  skipFailedRequests: true,
  message: { error: 'Tu as déjà créé 3 sorties aujourd’hui. Crée ton compte pour en organiser d’autres.' },
});

const bearer = (req: Request) => req.headers.authorization?.split(' ')[1];

// Compte connecté derrière le jeton (null si absent, invalide ou jeton d'invité léger)
async function accountUser(req: Request) {
  const token = bearer(req);
  if (!token) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; light?: boolean };
    if (p.light || !p.userId) return null;
    return prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, pseudo: true, isLight: true } });
  } catch {
    return null;
  }
}

async function limitIfNoAccount(req: Request, res: any, next: () => void) {
  if (await accountUser(req)) return next();
  return createLimiter(req, res, next);
}

// POST /api/express { title, eventDate, location?, firstName? }
router.post('/', limitIfNoAccount, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > EXPRESS_TITLE_MAX) { res.status(400).json({ error: `Donne un titre à ta sortie (${EXPRESS_TITLE_MAX} caractères au plus)` }); return; }
    const eventDate = new Date(req.body?.eventDate);
    if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 60 * 60 * 1000) { res.status(400).json({ error: 'Choisis une date à venir' }); return; }
    if (eventDate.getTime() > Date.now() + 365 * 864e5) { res.status(400).json({ error: 'Choisis une date dans l’année qui vient' }); return; }
    const location = typeof req.body?.location === 'string' && req.body.location.trim() ? req.body.location.trim().slice(0, 200) : null;

    let user: { id: string; pseudo: string } | null = await accountUser(req);
    let lightToken: string | undefined;
    if (!user) {
      let light = await readLightUser(bearer(req));
      if (!light) {
        const firstName = cleanFirstName(req.body?.firstName);
        if (!firstName) { res.status(400).json({ error: 'Indique ton prénom (30 caractères maximum)' }); return; }
        light = await createLightUser(firstName);
      }
      user = light;
      lightToken = makeLightToken(light);
    }

    const circle = await getOrCreatePersonalCircle(user.id);
    // Le Plan disparaît le lendemain de la sortie, comme tous les Plans à leur date de fin
    const endDate = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
    const result = await createPlanInCircle(req.app, circle.id, user.id, {
      title, description: '', eventDate: eventDate.toISOString(), endDate: endDate.toISOString(), location,
    });
    if ('error' in result) { res.status(400).json({ error: result.error }); return; }
    const inviteToken = await ensureInviteToken(result.plan.id);
    if (!lightToken) joinCircleRoom(req.app.get('io'), user.id, circle.id);
    countFunnel('funnel_express_created');
    res.json({ planId: result.plan.id, circleId: circle.id, inviteToken, lightToken });
  } catch (e) {
    console.error('[express]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/express/mine — organisateur sans compte : ses sorties à venir et les réponses
router.get('/mine', async (req, res) => {
  const light = await readLightUser(bearer(req));
  if (!light) { res.json({ firstName: null, plans: [] }); return; }
  const plans = await prisma.plan.findMany({
    where: { creatorId: light.id, endDate: { gt: new Date() } },
    orderBy: { eventDate: 'asc' },
    select: {
      id: true, title: true, eventDate: true, location: true,
      guestLink: { select: { token: true } },
      members: { where: { userId: { not: light.id } }, orderBy: { joinedAt: 'asc' }, select: { rsvp: true, user: { select: { firstName: true, pseudo: true } } } },
    },
  });
  res.json({
    firstName: light.firstName,
    plans: plans.map(p => ({
      id: p.id, title: p.title, eventDate: p.eventDate, location: p.location,
      inviteToken: p.guestLink?.token ?? null,
      answers: p.members.map(m => ({ name: m.user.firstName || m.user.pseudo, rsvp: m.rsvp })),
    })),
  });
});

export default router;
