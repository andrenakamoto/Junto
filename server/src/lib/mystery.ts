import prisma from './prisma';
import { notifyUser } from './push';
import { refreshPlanDiscover } from './discover/planPublish';

// Plan mystère (2026-11-02). Les invités ne connaissent que le titre et le lieu publics, qui sont Plan.title et Plan.location
// tant que le mystère dure : cartes, notifications, agenda, « En bref », récapitulatif et Découvrir n'ont donc rien à cacher.
// Le vrai titre et le vrai lieu sont dans PlanMystery, renvoyés seulement au créateur du Plan et aux complices qu'il a
// choisis (pas aux organisateurs du Cercle). Des indices se dévoilent à l'heure prévue ; au dévoilement final, le vrai titre et le vrai lieu
// remplacent ceux du Plan, qui redevient un Plan ordinaire. Les invités parient sur la destination (« Tes paris »).

export const MYSTERY_FEATURE = 'mystere';
export const MYSTERY_TEXT_MAX = 200;
export const MYSTERY_TITLE_MAX = 100;
export const MYSTERY_PLACE_MAX = 200;
export const MYSTERY_GUESS_MAX = 150;
export const MYSTERY_MAX_CLUES = 8;
export const MYSTERY_MAX_ACCOMPLICES = 5;
export const MYSTERY_DISABLED_ERROR = 'Le Plan mystère n’est pas activé pour ce Plan';
const HOUR = 3600e3;

export const mysteryEnabled = (plan: { enabledFeatures: string[] }) => plan.enabledFeatures.includes(MYSTERY_FEATURE);

const cleanLine = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s && s.length <= max ? s : null;
};
export const parseRealTitle = (v: unknown) => cleanLine(v, MYSTERY_TITLE_MAX);
export const parseRealPlace = (v: unknown) => cleanLine(v, MYSTERY_PLACE_MAX);
export const parseGuess = (v: unknown) => cleanLine(v, MYSTERY_GUESS_MAX);

const parseDate = (v: unknown): Date | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Dévoilement final : au plus tard au début du Plan ; par défaut une heure avant
export function defaultRevealAt(start: Date | null, end: Date): Date {
  return new Date((start ?? end).getTime() - HOUR);
}
export function parseRevealAt(v: unknown, start: Date | null, end: Date): Date | null {
  const d = parseDate(v);
  if (!d) return null;
  return d > (start ?? end) ? null : d;
}

export interface ClueInput { id?: string; text: string; revealAt: Date }
// Indices : texte court, dévoilés avant (ou en même temps que) le dévoilement final ; 8 au plus
export function parseClues(v: unknown, revealAt: Date): ClueInput[] | null {
  if (!Array.isArray(v) || v.length > MYSTERY_MAX_CLUES) return null;
  const out: ClueInput[] = [];
  for (const c of v) {
    if (!c || typeof c !== 'object') return null;
    const text = cleanLine((c as any).text, MYSTERY_TEXT_MAX);
    const at = parseDate((c as any).revealAt);
    if (!text || !at || at > revealAt) return null;
    const id = typeof (c as any).id === 'string' ? (c as any).id : undefined;
    out.push({ id, text, revealAt: at });
  }
  return out.sort((a, b) => a.revealAt.getTime() - b.revealAt.getTime());
}

// Qui est dans la confidence : le créateur du Plan et les complices qu'il a choisis
export const isInsider = (userId: string, m: { accompliceIds: string[] }, manager: boolean) => manager || m.accompliceIds.includes(userId);

type Clue = { id: string; text: string; revealAt: Date; revealedAt: Date | null; position: number };
type Mystery = { realTitle: string; realLocation: string; revealAt: Date; revealedAt: Date | null; accompliceIds: string[] };

// Ce que reçoit chacun. Règle d'or : un invité ne reçoit jamais le vrai titre, le vrai lieu ni le texte d'un indice pas
// encore dévoilé (seulement l'heure du prochain), ni les paris des autres avant le dévoilement.
export function mysteryView(
  m: Mystery, clues: Clue[], guesses: { userId: string; text: string; user: { id: string; pseudo: string; firstName: string | null } }[],
  viewer: { userId: string; manager: boolean }, now = new Date(),
) {
  const insider = isInsider(viewer.userId, m, viewer.manager);
  const revealed = !!m.revealedAt;
  const shown = clues.filter(c => c.revealedAt);
  const next = clues.filter(c => !c.revealedAt && c.revealAt > now).sort((a, b) => a.revealAt.getTime() - b.revealAt.getTime())[0];
  const mine = guesses.find(g => g.userId === viewer.userId);
  return {
    revealed, revealAt: m.revealAt, revealedAt: m.revealedAt,
    canManage: viewer.manager, insider, accomplice: m.accompliceIds.includes(viewer.userId),
    clues: shown.map(c => ({ id: c.id, text: c.text, revealedAt: c.revealedAt })),
    clueCount: clues.length,
    nextClueAt: revealed ? null : next?.revealAt ?? null,
    myGuess: mine?.text ?? null,
    guessCount: guesses.length,
    ...(insider || revealed ? {
      realTitle: m.realTitle, realLocation: m.realLocation,
      guesses: guesses.map(g => ({ text: g.text, user: g.user })),
    } : {}),
    ...(insider && !revealed ? {
      accompliceIds: m.accompliceIds,
      allClues: clues.map(c => ({ id: c.id, text: c.text, revealAt: c.revealAt, revealedAt: c.revealedAt })),
    } : {}),
  };
}

// Participants à prévenir : membres du Plan avec un compte, sauf « Je passe »
async function audience(planId: string): Promise<string[]> {
  const members = await prisma.planMember.findMany({ where: { planId, rsvp: { not: 'out' }, user: { isLight: false } }, select: { userId: true } });
  return members.map(m => m.userId);
}

function emitUpdate(io: any, plan: { id: string; circleId: string }) {
  io?.to(`plan:${plan.id}`).emit('plan-updated', { planId: plan.id });
  io?.to(`circle:${plan.circleId}`).emit('circle-updated', { circleId: plan.circleId });
}

// Dévoiler un indice (à l'heure prévue ou plus tôt par l'organisation)
export async function revealClue(io: any, clueId: string, now = new Date()): Promise<boolean> {
  const claimed = await prisma.planMysteryClue.updateMany({ where: { id: clueId, revealedAt: null }, data: { revealedAt: now } });
  if (!claimed.count) return false;
  const clue = await prisma.planMysteryClue.findUnique({ where: { id: clueId }, select: { plan: { select: { id: true, title: true, circleId: true, mystery: { select: { revealedAt: true } } } } } });
  const plan = clue?.plan;
  if (!plan || plan.mystery?.revealedAt) return true;
  for (const userId of await audience(plan.id)) {
    notifyUser(io, userId, { type: 'plan_activity', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, tab: MYSTERY_FEATURE, preview: `🔍 Nouvel indice pour « ${plan.title} »` });
  }
  emitUpdate(io, plan);
  return true;
}

// Dévoilement final : le vrai titre et le vrai lieu remplacent ceux du Plan ; les indices restants sont dévoilés
export async function revealMystery(io: any, planId: string, now = new Date()): Promise<boolean> {
  const m = await prisma.planMystery.findUnique({ where: { planId }, include: { plan: { select: { id: true, title: true, location: true, circleId: true } } } });
  if (!m || m.revealedAt) return false;
  const claimed = await prisma.planMystery.updateMany({ where: { planId, revealedAt: null }, data: { revealedAt: now, publicTitle: m.plan.title, publicLocation: m.plan.location } });
  if (!claimed.count) return false;
  await prisma.$transaction([
    prisma.plan.update({ where: { id: planId }, data: { title: m.realTitle, location: m.realLocation } }),
    prisma.planMysteryClue.updateMany({ where: { planId, revealedAt: null }, data: { revealedAt: now } }),
  ]);
  refreshPlanDiscover(planId).catch(() => {});
  for (const userId of await audience(planId)) {
    notifyUser(io, userId, { type: 'plan_activity', planId, planTitle: m.realTitle, circleId: m.plan.circleId, tab: MYSTERY_FEATURE, preview: `🎉 Mystère levé : « ${m.realTitle} »` });
  }
  emitUpdate(io, m.plan);
  return true;
}

// Tâche toutes les 5 minutes (protégée comme les autres) : indices et dévoilements arrivés à leur heure
export async function mysteryTick(io: any) {
  try {
    const now = new Date();
    const due = await prisma.planMysteryClue.findMany({ where: { revealedAt: null, revealAt: { lte: now }, plan: { mystery: { is: { revealedAt: null } } } }, select: { id: true }, orderBy: { revealAt: 'asc' } });
    for (const c of due) await revealClue(io, c.id, now);
    for (const m of await prisma.planMystery.findMany({ where: { revealedAt: null, revealAt: { lte: now } }, select: { planId: true } })) await revealMystery(io, m.planId, now);
  } catch (e) {
    console.error('[mystère]', e);
  }
}
