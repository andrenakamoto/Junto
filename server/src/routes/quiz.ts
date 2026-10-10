import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { destroyFiles } from '../lib/cloudinary';
import { APP_URL } from '../lib/mailer';
import {
  MAX_QUESTIONS, QUESTION_LEAD_MS, QUIZ_DISABLED_ERROR, TIME_LIMITS, answerPoints, canManageQuiz, distribution,
  leaderboard, parseQuestion, quizEnabled, quizPlayers,
} from '../lib/quiz';

// Quiz (lib/quiz.ts), monté dans le routeur des Plans (/api/plans). Règle d'or : une question n'est envoyée
// aux joueurs qu'à partir de son heure de début, et sa bonne réponse seulement une fois close. Le temps fait
// foi côté serveur (réponses tardives refusées, clôture programmée). Les personnes qui préparent les
// questions (editorIds) animent sans jouer. Temps réel : événement « quiz-updated » dans plan:{id} (les
// écritures du quiz sont exclues de broadcastWrites, lib/realtime.ts), les écrans rechargent eux-mêmes.
const router = Router();

type PlanLite = { id: string; title: string; circleId: string; creatorId: string; enabledFeatures: string[] };
const person = { id: true, pseudo: true, firstName: true } as const;
const nameOf = (u?: { pseudo: string; firstName: string | null } | null) => (u ? u.firstName ?? `@${u.pseudo}` : '?');

async function loadPlan(req: AuthRequest, res: any, planId: string | undefined): Promise<PlanLite | null> {
  const access = planId ? await getPlanAccess(req.userId!, planId) : null;
  if (!planId || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !quizEnabled(plan)) { res.status(403).json({ error: QUIZ_DISABLED_ERROR }); return null; }
  return plan;
}

async function loadQuiz(planId: string) {
  return prisma.quiz.upsert({
    where: { planId },
    create: { planId },
    update: {},
    include: { questions: { orderBy: { position: 'asc' } } },
  });
}
type QuizFull = Awaited<ReturnType<typeof loadQuiz>>;

function emit(req: AuthRequest | { app: any }, planId: string) {
  req.app.get('io')?.to(`plan:${planId}`).emit('quiz-updated', { planId });
}

// Clôture programmée d'une question (en mémoire) ; un redémarrage du serveur est rattrapé à la lecture
const timers = new Map<string, NodeJS.Timeout>();
async function reveal(io: any, planId: string, index: number) {
  const { count } = await prisma.quiz.updateMany({ where: { planId, status: 'question', currentIndex: index }, data: { status: 'reveal' } });
  if (count) io?.to(`plan:${planId}`).emit('quiz-updated', { planId });
  return count > 0;
}
function scheduleReveal(io: any, planId: string, index: number, at: Date) {
  clearTimeout(timers.get(planId));
  timers.set(planId, setTimeout(() => { reveal(io, planId, index).catch(e => console.error('[quiz reveal]', e)); }, Math.max(0, at.getTime() - Date.now()) + 300));
}
// Question dont le temps est écoulé (serveur redémarré entre-temps) : close maintenant
async function catchUp(io: any, quiz: QuizFull) {
  if (quiz.status === 'question' && quiz.questionEndsAt && quiz.questionEndsAt.getTime() + 1000 < Date.now() && quiz.currentIndex !== null) {
    if (await reveal(io, quiz.planId, quiz.currentIndex)) quiz.status = 'reveal';
  }
}

// Ouvre la question n° index : affichée à tous dans QUESTION_LEAD_MS, close après le temps imparti
async function openQuestion(io: any, quiz: { planId: string; timeLimit: number }, index: number) {
  const startAt = new Date(Date.now() + QUESTION_LEAD_MS);
  const endsAt = new Date(startAt.getTime() + quiz.timeLimit * 1000);
  await prisma.quiz.update({ where: { planId: quiz.planId }, data: { status: 'question', currentIndex: index, questionStartedAt: startAt, questionEndsAt: endsAt } });
  scheduleReveal(io, quiz.planId, index, endsAt);
}

// État du quiz vu par une personne (ou par l'écran de salle : viewer null)
export async function quizState(plan: PlanLite, quiz: QuizFull, viewer: { id: string; manager: boolean } | null) {
  const now = Date.now();
  const isEditor = !!viewer && quiz.editorIds.includes(viewer.id);
  const players = await quizPlayers(plan.id, quiz.editorIds);
  const current = quiz.currentIndex !== null ? quiz.questions[quiz.currentIndex] : null;
  const live = quiz.status === 'question' || quiz.status === 'reveal';
  const shown = !!current && live && (quiz.status === 'reveal' || (quiz.questionStartedAt?.getTime() ?? 0) <= now);
  const answers = quiz.status === 'preparation' ? [] : await prisma.quizAnswer.findMany({ where: { planId: plan.id } });
  const currentAnswers = current ? answers.filter(a => a.questionId === current.id) : [];
  const revealed = quiz.status === 'reveal' || quiz.status === 'ended';
  const board = leaderboard(players.map(p => p.id), answers.filter(a => quiz.questions.some(q => q.id === a.questionId)));
  const editors = await prisma.user.findMany({ where: { id: { in: quiz.editorIds } }, select: person });
  const mine = viewer ? currentAnswers.find(a => a.userId === viewer.id) : undefined;
  return {
    status: quiz.status,
    timeLimit: quiz.timeLimit,
    questionCount: quiz.questions.length,
    serverNow: now,
    meId: viewer?.id ?? null,
    role: !viewer ? 'screen' : isEditor ? 'editor' : players.some(p => p.id === viewer.id) ? 'player' : 'spectator',
    canEdit: !!viewer && viewer.manager && quiz.status === 'preparation',
    editors: editors.map(nameOf),
    players: players.map(p => ({ id: p.id, name: nameOf(p), answered: currentAnswers.some(a => a.userId === p.id) })),
    // Questions complètes : seulement pour les personnes qui animent
    questions: isEditor ? quiz.questions.map(q => ({ id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, attachmentId: q.attachmentId })) : null,
    current: current && live ? {
      index: quiz.currentIndex,
      id: current.id,
      startAt: quiz.questionStartedAt?.getTime() ?? null,
      endsAt: quiz.questionEndsAt?.getTime() ?? null,
      text: shown || isEditor ? current.text : null,
      options: shown || isEditor ? current.options : null,
      attachmentId: shown || isEditor ? current.attachmentId : null,
      answeredCount: currentAnswers.length,
      myAnswer: mine ? { option: mine.option, points: revealed ? mine.points : null } : null,
      correctIndex: revealed || isEditor ? current.correctIndex : null,
      distribution: revealed ? distribution(current.options.length, currentAnswers) : null,
      isLast: quiz.currentIndex === quiz.questions.length - 1,
    } : null,
    // Classement : à chaque résultat et à la fin
    leaderboard: revealed || quiz.status === 'ended' ? board.map(l => ({ ...l, name: nameOf(players.find(p => p.id === l.userId)) })) : null,
  };
}

async function editorCtx(req: AuthRequest, res: any, planId: string | undefined, opts: { preparation?: boolean } = {}) {
  const plan = await loadPlan(req, res, planId); if (!plan) return null;
  const quiz = await loadQuiz(plan.id);
  if (!quiz.editorIds.includes(req.userId!)) { res.status(403).json({ error: 'Réservé à la personne qui anime le quiz' }); return null; }
  if (opts.preparation && quiz.status !== 'preparation') { res.status(400).json({ error: 'Le quiz a commencé : les questions ne changent plus' }); return null; }
  return { plan, quiz };
}

// GET /:id/quiz
router.get('/:id/quiz', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan) return;
  const quiz = await loadQuiz(plan.id);
  await catchUp(req.app.get('io'), quiz);
  res.json(await quizState(plan, quiz, { id: req.userId!, manager: await canManageQuiz(req.userId!, plan) }));
});

// POST /:id/quiz/edit — préparer les questions (organisateur) : la personne anime alors sans jouer
router.post('/:id/quiz/edit', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan) return;
  if (!(await canManageQuiz(req.userId!, plan))) { res.status(403).json({ error: 'Réservé à l’organisateur' }); return; }
  const quiz = await loadQuiz(plan.id);
  if (quiz.status !== 'preparation') { res.status(400).json({ error: 'Le quiz a commencé : les questions ne changent plus' }); return; }
  if (!quiz.editorIds.includes(req.userId!)) await prisma.quiz.update({ where: { planId: plan.id }, data: { editorIds: { push: req.userId! } } });
  res.json({ ok: true });
  emit(req, plan.id);
});

// PUT /:id/quiz/settings { timeLimit }
router.put('/:id/quiz/settings', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id, { preparation: true }); if (!ctx) return;
  const timeLimit = Number(req.body?.timeLimit);
  if (!(TIME_LIMITS as readonly number[]).includes(timeLimit)) { res.status(400).json({ error: 'Temps de réponse invalide' }); return; }
  await prisma.quiz.update({ where: { planId: ctx.plan.id }, data: { timeLimit } });
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

async function checkAttachment(planId: string, attachmentId: unknown): Promise<string | null | false> {
  if (attachmentId === undefined || attachmentId === null || attachmentId === '') return null;
  if (typeof attachmentId !== 'string') return false;
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { planId: true, mimeType: true } });
  return a && a.planId === planId && a.mimeType.startsWith('image/') ? attachmentId : false;
}

// POST /:id/quiz/questions { text, options, correctIndex, attachmentId? }
router.post('/:id/quiz/questions', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id, { preparation: true }); if (!ctx) return;
  if (ctx.quiz.questions.length >= MAX_QUESTIONS) { res.status(400).json({ error: `${MAX_QUESTIONS} questions au maximum` }); return; }
  const q = parseQuestion(req.body);
  if ('error' in q) { res.status(400).json({ error: q.error }); return; }
  const attachmentId = await checkAttachment(ctx.plan.id, req.body?.attachmentId);
  if (attachmentId === false) { res.status(400).json({ error: 'Photo invalide' }); return; }
  const created = await prisma.quizQuestion.create({ data: { planId: ctx.plan.id, position: ctx.quiz.questions.length, ...q, attachmentId } });
  res.json({ id: created.id });
  emit(req, ctx.plan.id);
});

async function questionCtx(req: AuthRequest, res: any) {
  const question = await prisma.quizQuestion.findUnique({ where: { id: req.params.questionId } });
  if (!question) { res.status(404).json({ error: 'Question introuvable' }); return null; }
  const ctx = await editorCtx(req, res, question.planId, { preparation: true }); if (!ctx) return null;
  return { ...ctx, question };
}

async function removePhoto(attachmentId: string | null) {
  if (!attachmentId) return;
  const file = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { id: true, publicId: true, resourceType: true } });
  if (!file) return;
  await destroyFiles([file]);
  await prisma.attachment.delete({ where: { id: file.id } }).catch(() => {});
}

// PUT /quiz/questions/:questionId
router.put('/quiz/questions/:questionId', async (req: AuthRequest, res) => {
  const ctx = await questionCtx(req, res); if (!ctx) return;
  const q = parseQuestion(req.body);
  if ('error' in q) { res.status(400).json({ error: q.error }); return; }
  const attachmentId = await checkAttachment(ctx.plan.id, req.body?.attachmentId);
  if (attachmentId === false) { res.status(400).json({ error: 'Photo invalide' }); return; }
  await prisma.quizQuestion.update({ where: { id: ctx.question.id }, data: { ...q, attachmentId } });
  if (ctx.question.attachmentId && ctx.question.attachmentId !== attachmentId) await removePhoto(ctx.question.attachmentId);
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

// DELETE /quiz/questions/:questionId
router.delete('/quiz/questions/:questionId', async (req: AuthRequest, res) => {
  const ctx = await questionCtx(req, res); if (!ctx) return;
  await prisma.quizQuestion.delete({ where: { id: ctx.question.id } });
  await removePhoto(ctx.question.attachmentId);
  // Positions recalculées (0, 1, 2…)
  const rest = ctx.quiz.questions.filter(q => q.id !== ctx.question.id);
  await prisma.$transaction(rest.map((q, i) => prisma.quizQuestion.update({ where: { id: q.id }, data: { position: i } })));
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

// PUT /:id/quiz/order { ids } — nouvel ordre des questions
router.put('/:id/quiz/order', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id, { preparation: true }); if (!ctx) return;
  const ids: unknown = req.body?.ids;
  const current = ctx.quiz.questions.map(q => q.id);
  if (!Array.isArray(ids) || ids.length !== current.length || !current.every(id => ids.includes(id))) { res.status(400).json({ error: 'Ordre invalide' }); return; }
  await prisma.$transaction((ids as string[]).map((id, i) => prisma.quizQuestion.update({ where: { id }, data: { position: i } })));
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

// POST /:id/quiz/start — lancer : première question pour tout le monde
router.post('/:id/quiz/start', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id, { preparation: true }); if (!ctx) return;
  if (!ctx.quiz.questions.length) { res.status(400).json({ error: 'Ajoute d’abord des questions' }); return; }
  const players = await quizPlayers(ctx.plan.id, ctx.quiz.editorIds);
  if (!players.length) { res.status(400).json({ error: 'Personne ne joue encore : il faut des « Je suis in » ou « Peut-être » avec un compte' }); return; }
  const { count } = await prisma.quiz.updateMany({ where: { planId: ctx.plan.id, status: 'preparation' }, data: { startedAt: new Date(), hostId: req.userId!, endedAt: null } });
  if (!count) { res.status(409).json({ error: 'Le quiz a déjà commencé' }); return; }
  const io = req.app.get('io');
  await openQuestion(io, ctx.quiz, 0);
  res.json({ ok: true });
  emit(req, ctx.plan.id);
  // Les joueurs qui ne regardent pas le Plan sont prévenus
  try {
    const watching = new Set<string>();
    if (io) for (const s of await io.in(`plan:${ctx.plan.id}`).fetchSockets()) watching.add(s.data.userId);
    for (const p of players) {
      if (watching.has(p.id)) continue;
      notifyUser(io, p.id, { type: 'quiz', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, actorId: req.userId!, preview: '🧠 Le quiz commence : viens jouer !' });
    }
  } catch (e) { console.error('[quiz notify]', e); }
});

// POST /:id/quiz/answer { questionId, option } — une seule réponse par question, dans le temps imparti
router.post('/:id/quiz/answer', async (req: AuthRequest, res) => {
  const plan = await loadPlan(req, res, req.params.id); if (!plan) return;
  const quiz = await loadQuiz(plan.id);
  const now = Date.now();
  const current = quiz.currentIndex !== null ? quiz.questions[quiz.currentIndex] : null;
  if (quiz.status !== 'question' || !current || current.id !== req.body?.questionId) { res.status(409).json({ error: 'Cette question est terminée' }); return; }
  const start = quiz.questionStartedAt!.getTime(), end = quiz.questionEndsAt!.getTime();
  if (now < start) { res.status(409).json({ error: 'La question n’a pas encore commencé' }); return; }
  if (now > end + 500) { res.status(409).json({ error: 'Trop tard : le temps est écoulé' }); return; }
  const players = await quizPlayers(plan.id, quiz.editorIds);
  if (!players.some(p => p.id === req.userId)) { res.status(403).json({ error: 'Réponds « Je suis in » ou « Peut-être » pour jouer' }); return; }
  const option = Number(req.body?.option);
  if (!Number.isInteger(option) || option < 0 || option >= current.options.length) { res.status(400).json({ error: 'Réponse invalide' }); return; }
  const elapsedMs = Math.min(now - start, end - start);
  try {
    await prisma.quizAnswer.create({
      data: { questionId: current.id, planId: plan.id, userId: req.userId!, option, elapsedMs, points: answerPoints(option === current.correctIndex, elapsedMs, end - start) },
    });
  } catch {
    res.status(409).json({ error: 'Tu as déjà répondu' }); return;
  }
  res.json({ ok: true });
  // Tout le monde a répondu : résultat tout de suite
  const answered = await prisma.quizAnswer.count({ where: { questionId: current.id, userId: { in: players.map(p => p.id) } } });
  const io = req.app.get('io');
  if (answered >= players.length) {
    clearTimeout(timers.get(plan.id));
    await reveal(io, plan.id, quiz.currentIndex!);
  } else emit(req, plan.id);
});

// POST /:id/quiz/reveal — clore la question sans attendre (la personne qui anime)
router.post('/:id/quiz/reveal', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id); if (!ctx) return;
  if (ctx.quiz.status !== 'question' || ctx.quiz.currentIndex === null) { res.status(400).json({ error: 'Pas de question en cours' }); return; }
  clearTimeout(timers.get(ctx.plan.id));
  await reveal(req.app.get('io'), ctx.plan.id, ctx.quiz.currentIndex);
  res.json({ ok: true });
});

// POST /:id/quiz/next — question suivante, ou classement final après la dernière
router.post('/:id/quiz/next', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id); if (!ctx) return;
  if (ctx.quiz.status !== 'reveal' || ctx.quiz.currentIndex === null) { res.status(400).json({ error: 'Affiche d’abord la réponse' }); return; }
  const next = ctx.quiz.currentIndex + 1;
  const io = req.app.get('io');
  if (next < ctx.quiz.questions.length) await openQuestion(io, ctx.quiz, next);
  else {
    await prisma.quiz.update({ where: { planId: ctx.plan.id }, data: { status: 'ended', endedAt: new Date() } });
    // Le podium à ceux qui ne regardent pas le Plan
    try {
      const players = await quizPlayers(ctx.plan.id, ctx.quiz.editorIds);
      const answers = await prisma.quizAnswer.findMany({ where: { planId: ctx.plan.id } });
      const winner = leaderboard(players.map(p => p.id), answers)[0];
      const watching = new Set<string>();
      if (io) for (const s of await io.in(`plan:${ctx.plan.id}`).fetchSockets()) watching.add(s.data.userId);
      for (const p of players) {
        if (watching.has(p.id) || !winner) continue;
        notifyUser(io, p.id, { type: 'quiz', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, preview: `🏆 ${nameOf(players.find(x => x.id === winner.userId))} remporte le quiz ! Découvre le classement` });
      }
    } catch (e) { console.error('[quiz notify end]', e); }
  }
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

// POST /:id/quiz/reset — rejouer : réponses effacées, mêmes questions
router.post('/:id/quiz/reset', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id); if (!ctx) return;
  clearTimeout(timers.get(ctx.plan.id));
  await prisma.$transaction([
    prisma.quizAnswer.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.quiz.update({ where: { planId: ctx.plan.id }, data: { status: 'preparation', currentIndex: null, questionStartedAt: null, questionEndsAt: null, startedAt: null, endedAt: null, hostId: null } }),
  ]);
  res.json({ ok: true });
  emit(req, ctx.plan.id);
});

// GET /:id/quiz/screen-link — lien de l'écran de salle (télévision, projecteur), valable 24 h
router.get('/:id/quiz/screen-link', async (req: AuthRequest, res) => {
  const ctx = await editorCtx(req, res, req.params.id); if (!ctx) return;
  const token = jwt.sign({ purpose: 'quiz-screen', planId: ctx.plan.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
  res.json({ url: `${APP_URL}/ecran?t=${encodeURIComponent(token)}` });
});

export { catchUp, loadQuiz };
export default router;
