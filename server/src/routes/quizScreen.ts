import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { quizEnabled } from '../lib/quiz';
import { mintMediaToken } from '../lib/mediaToken';
import { catchUp, loadQuiz, quizState } from './quiz';

// Écran de salle d'un quiz (télévision, projecteur) : page publique /ecran?t=<jeton>. Le jeton (24 h,
// purpose « quiz-screen ») est donné par GET /plans/:id/quiz/screen-link à la personne qui anime. L'écran
// voit ce que voit un joueur (jamais la bonne réponse avant la fin de la question) et recharge chaque seconde.
const router = Router();

router.get('/:token', async (req, res) => {
  let planId: string;
  try {
    const payload = jwt.verify(req.params.token, process.env.JWT_SECRET!) as any;
    if (payload?.purpose !== 'quiz-screen' || typeof payload.planId !== 'string') throw new Error('purpose');
    planId = payload.planId;
  } catch {
    res.status(401).json({ error: 'Lien expiré, recharge la page' }); return;
  }
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !quizEnabled(plan)) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  const quiz = await loadQuiz(plan.id);
  await catchUp(req.app.get('io'), quiz);
  const state = await quizState(plan, quiz, null);
  // Photo de la question affichée : jeton d'affichage au nom de la personne qui anime (12 h)
  const host = quiz.hostId ?? quiz.editorIds[0];
  const mediaToken = state.current?.attachmentId && host ? mintMediaToken(plan.id, host) : undefined;
  res.json({ planTitle: plan.title, mediaToken, ...state });
});

export default router;
