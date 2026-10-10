import prisma from './prisma';
import { isCircleManager } from './circleRoles';

// Quiz (fonction à activer « quiz », routes/quiz.ts) : questions à choix multiple posées en direct à tous
// les participants. Les personnes qui préparent les questions (editorIds) animent sans jouer. Le serveur
// fixe l'heure de début et de fin de chaque question, calcule les points (bonus de rapidité) et ne révèle
// la bonne réponse qu'une fois la question close (tout le monde a répondu, ou temps écoulé).

export const QUIZ_FEATURE = 'quiz';
export const QUIZ_DISABLED_ERROR = 'Le quiz n’est pas activé pour ce Plan';
export const QUESTION_MAX = 300;
export const OPTION_MAX = 120;
export const MAX_QUESTIONS = 50;
export const TIME_LIMITS = [10, 15, 20, 30, 45, 60] as const;
// Délai avant l'affichage d'une question : laisse aux téléphones le temps de se mettre à jour
export const QUESTION_LEAD_MS = 3000;
export const MAX_POINTS = 1000;

export type QuizStatus = 'preparation' | 'question' | 'reveal' | 'ended';

export function quizEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(QUIZ_FEATURE);
}

export async function canManageQuiz(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

// Bonne réponse : de 1000 points (réponse immédiate) à 500 (dernière seconde) ; mauvaise réponse : 0
export function answerPoints(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.min(Math.max(elapsedMs / limitMs, 0), 1);
  return Math.round(MAX_POINTS * (1 - ratio / 2));
}

// Question saisie : texte, 2 à 4 réponses non vides, bonne réponse parmi elles
export function parseQuestion(body: any): { text: string; options: string[]; correctIndex: number } | { error: string } {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > QUESTION_MAX) return { error: `Question : de 1 à ${QUESTION_MAX} caractères` };
  const raw = Array.isArray(body?.options) ? body.options : [];
  const options = raw.map((o: unknown) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (options.length < 2 || options.length > 4 || options.length !== raw.length) return { error: 'De 2 à 4 réponses, toutes remplies' };
  if (options.some((o: string) => o.length > OPTION_MAX)) return { error: `Réponse : ${OPTION_MAX} caractères maximum` };
  const correctIndex = Number(body?.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return { error: 'Indique la bonne réponse' };
  return { text, options, correctIndex };
}

export type ScoreLine = { userId: string; points: number; correct: number };

// Classement : total des points, puis nombre de bonnes réponses ; à égalité, même rang
export function leaderboard(playerIds: string[], answers: { userId: string; points: number }[]): (ScoreLine & { rank: number })[] {
  const lines = new Map<string, ScoreLine>(playerIds.map(id => [id, { userId: id, points: 0, correct: 0 }]));
  for (const a of answers) {
    const line = lines.get(a.userId) ?? { userId: a.userId, points: 0, correct: 0 };
    line.points += a.points;
    if (a.points > 0) line.correct += 1;
    lines.set(a.userId, line);
  }
  const sorted = [...lines.values()].sort((x, y) => y.points - x.points || y.correct - x.correct);
  const out: (ScoreLine & { rank: number })[] = [];
  sorted.forEach((l, i) => {
    const prev = out[i - 1];
    const tie = prev && prev.points === l.points && prev.correct === l.correct;
    out.push({ ...l, rank: tie ? prev.rank : i + 1 });
  });
  return out;
}

// Répartition des réponses d'une question
export function distribution(optionCount: number, answers: { option: number }[]): number[] {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const a of answers) if (a.option >= 0 && a.option < optionCount) counts[a.option] += 1;
  return counts;
}

// Joueurs : « Je suis in » et « Peut-être », avec un compte, sauf les personnes qui animent
export async function quizPlayers(planId: string, editorIds: string[]): Promise<{ id: string; pseudo: string; firstName: string | null }[]> {
  const members = await prisma.planMember.findMany({
    where: { planId, rsvp: { in: ['in', 'maybe'] }, user: { isLight: false }, userId: { notIn: editorIds } },
    select: { user: { select: { id: true, pseudo: true, firstName: true } } },
  });
  return members.map(m => m.user);
}
