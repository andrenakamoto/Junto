import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { userLocale } from '../lib/i18n';
import { TEAM_NAMES } from '../i18n/games';
import {
  MAX_TEAMS, TEAMS_DISABLED_ERROR, TEAM_COLORS, TEAM_NAME_MAX, canManageTeams, drawTeams, knockoutFirstRound,
  knockoutWinner, leagueSchedule, leagueStandings, nextKnockoutRound, parseScore, teamParticipants, teamsEnabled,
} from '../lib/teams';

// Tirage des équipes et tournoi (lib/teams.ts), monté dans le routeur des Plans (/api/plans).
// Les niveaux servent à équilibrer et ne sont montrés qu'à l'organisateur.
const router = Router();

async function load(req: AuthRequest, res: any) {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true } });
  if (!plan || !teamsEnabled(plan)) { res.status(403).json({ error: TEAMS_DISABLED_ERROR }); return null; }
  const draw = await prisma.teamDraw.upsert({ where: { planId: plan.id }, create: { planId: plan.id }, update: {} });
  return { plan, draw };
}

async function requireManager(req: AuthRequest, res: any, plan: { creatorId: string; circleId: string }) {
  if (await canManageTeams(req.userId!, plan)) return true;
  res.status(403).json({ error: 'Réservé à l’organisateur' });
  return false;
}

function notify(req: AuthRequest, plan: { id: string; title: string; circleId: string }, userId: string, preview: string) {
  notifyUser(req.app.get('io'), userId, { type: 'teams', planId: plan.id, planTitle: plan.title, circleId: plan.circleId, preview });
}

// Crée les tours suivants de l'élimination directe tant que les précédents sont complets
async function advanceKnockout(planId: string) {
  for (let guard = 0; guard < 10; guard++) {
    const matches = await prisma.teamMatch.findMany({ where: { planId } });
    const next = nextKnockoutRound(matches);
    if (!next) return;
    await prisma.teamMatch.createMany({ data: next.map(f => ({ planId, ...f })) });
  }
}

// GET /:id/teams
router.get('/:id/teams', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  const { plan, draw } = ctx;
  const manager = await canManageTeams(req.userId!, plan);
  const [participants, teams, matches, levels] = await Promise.all([
    teamParticipants(plan.id),
    prisma.team.findMany({ where: { planId: plan.id }, orderBy: { position: 'asc' }, include: { members: { include: { user: { select: { id: true, pseudo: true, firstName: true } } } } } }),
    prisma.teamMatch.findMany({ where: { planId: plan.id }, orderBy: [{ round: 'asc' }, { position: 'asc' }] }),
    manager ? prisma.teamLevel.findMany({ where: { planId: plan.id } }) : Promise.resolve([]),
  ]);
  const assigned = new Set(teams.flatMap(t => t.members.map(m => m.userId)));
  const teamIds = teams.map(t => t.id);
  const lastRound = matches.length ? Math.max(...matches.map(m => m.round)) : 0;
  const final = draw.format === 'knockout' ? matches.filter(m => m.round === lastRound) : [];
  const champion = draw.format === 'knockout' && final.length === 1 && final[0].winnerId
    ? final[0].winnerId
    : draw.format === 'league' && matches.length && matches.every(m => m.homeScore != null)
      ? leagueStandings(teamIds, matches)[0]?.teamId ?? null
      : null;
  res.json({
    canManage: manager,
    teamCount: draw.teamCount,
    balanced: draw.balanced,
    drawn: !!draw.drawnAt,
    format: draw.format,
    participants: participants.map(p => ({
      id: p.id, pseudo: p.pseudo, firstName: p.firstName, isLight: p.isLight,
      level: manager ? levels.find(l => l.userId === p.id)?.level ?? 2 : undefined,
    })),
    teams: teams.map(t => ({ id: t.id, name: t.name, color: t.color, members: t.members.map(m => m.user) })),
    myTeamId: teams.find(t => t.members.some(m => m.userId === req.userId))?.id ?? null,
    // « Je suis in » sans équipe (arrivés après le tirage)
    unassigned: draw.drawnAt ? participants.filter(p => !assigned.has(p.id)).map(p => ({ id: p.id, pseudo: p.pseudo, firstName: p.firstName })) : [],
    matches: matches.map(m => ({ id: m.id, round: m.round, position: m.position, homeId: m.homeId, awayId: m.awayId, homeScore: m.homeScore, awayScore: m.awayScore, winnerId: m.winnerId })),
    standings: draw.format === 'league' ? leagueStandings(teamIds, matches) : [],
    championId: champion,
  });
});

// PUT /:id/teams { teamCount, balanced, levels: { userId: 1|2|3 } } — réglages (organisateur)
router.put('/:id/teams', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const { teamCount, balanced, levels } = req.body ?? {};
  const data: { teamCount?: number; balanced?: boolean } = {};
  if (teamCount !== undefined) {
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > MAX_TEAMS) { res.status(400).json({ error: `De 2 à ${MAX_TEAMS} équipes` }); return; }
    data.teamCount = teamCount;
  }
  if (balanced !== undefined) data.balanced = balanced === true;
  if (Object.keys(data).length) await prisma.teamDraw.update({ where: { planId: ctx.plan.id }, data });
  if (levels && typeof levels === 'object') {
    const ids = new Set((await teamParticipants(ctx.plan.id)).map(p => p.id));
    const ops = Object.entries(levels)
      .filter(([userId, level]) => ids.has(userId) && [1, 2, 3].includes(level as number))
      .map(([userId, level]) => prisma.teamLevel.upsert({
        where: { planId_userId: { planId: ctx.plan.id, userId } },
        create: { planId: ctx.plan.id, userId, level: level as number }, update: { level: level as number },
      }));
    await prisma.$transaction(ops);
  }
  res.json({ ok: true });
});

// POST /:id/teams/draw — (re)faire le tirage (organisateur) : équipes et tournoi remis à zéro
router.post('/:id/teams/draw', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const participants = await teamParticipants(ctx.plan.id);
  if (participants.length < 2) { res.status(400).json({ error: 'Il faut au moins 2 personnes « Je suis in »' }); return; }
  const levels = await prisma.teamLevel.findMany({ where: { planId: ctx.plan.id } });
  const groups = drawTeams(participants.map(p => ({ id: p.id, level: levels.find(l => l.userId === p.id)?.level ?? 2 })), ctx.draw.teamCount, ctx.draw.balanced);
  // Noms gardés d'un tirage à l'autre s'ils ont été changés
  const previous = await prisma.team.findMany({ where: { planId: ctx.plan.id }, orderBy: { position: 'asc' } });
  const teamNames = TEAM_NAMES[await userLocale(ctx.plan.creatorId)];
  await prisma.$transaction([
    prisma.teamMatch.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.team.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.teamDraw.update({ where: { planId: ctx.plan.id }, data: { drawnAt: new Date(), format: null } }),
    ...groups.map((ids, i) => prisma.team.create({
      data: {
        planId: ctx.plan.id, position: i, name: previous[i]?.name ?? teamNames[i], color: TEAM_COLORS[i].color,
        members: { create: ids.map(userId => ({ planId: ctx.plan.id, userId })) },
      },
    })),
  ]);
  res.json({ ok: true });
  const names = groups.map((_, i) => previous[i]?.name ?? teamNames[i]);
  groups.forEach((ids, i) => ids.forEach(id => notify(req, ctx.plan, id, `⚽ Les équipes sont faites : tu joues chez les ${names[i]}`)));
});

// PUT /:id/teams/move { userId, teamId } — changer quelqu'un d'équipe ou placer un retardataire
router.put('/:id/teams/move', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const userId = String(req.body?.userId ?? ''); const teamId = req.body?.teamId ? String(req.body.teamId) : null;
  if (!(await teamParticipants(ctx.plan.id)).some(p => p.id === userId)) { res.status(400).json({ error: 'Cette personne n’a pas répondu « Je suis in »' }); return; }
  if (!teamId) {
    await prisma.teamMember.deleteMany({ where: { planId: ctx.plan.id, userId } });
    res.json({ ok: true }); return;
  }
  const team = await prisma.team.findFirst({ where: { id: teamId, planId: ctx.plan.id } });
  if (!team) { res.status(404).json({ error: 'Équipe introuvable' }); return; }
  await prisma.teamMember.upsert({
    where: { planId_userId: { planId: ctx.plan.id, userId } },
    create: { planId: ctx.plan.id, teamId, userId }, update: { teamId },
  });
  res.json({ ok: true });
  notify(req, ctx.plan, userId, `⚽ Tu joues maintenant chez les ${team.name}`);
});

// PUT /:id/teams/team/:teamId { name } — renommer une équipe (organisateur)
router.put('/:id/teams/team/:teamId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > TEAM_NAME_MAX) { res.status(400).json({ error: `Nom : de 1 à ${TEAM_NAME_MAX} caractères` }); return; }
  const { count } = await prisma.team.updateMany({ where: { id: req.params.teamId, planId: ctx.plan.id }, data: { name } });
  if (!count) { res.status(404).json({ error: 'Équipe introuvable' }); return; }
  res.json({ ok: true });
});

// POST /:id/teams/tournament { format: 'league' | 'knockout' } — lancer le tournoi (organisateur)
router.post('/:id/teams/tournament', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const format = req.body?.format;
  if (format !== 'league' && format !== 'knockout') { res.status(400).json({ error: 'Format inconnu' }); return; }
  const teams = await prisma.team.findMany({ where: { planId: ctx.plan.id }, orderBy: { position: 'asc' }, include: { members: { select: { userId: true } } } });
  if (teams.length < 2) { res.status(400).json({ error: 'Fais d’abord le tirage des équipes' }); return; }
  const ids = teams.map(t => t.id);
  const fixtures = format === 'league' ? leagueSchedule(ids).map(f => ({ ...f, winnerId: null as string | null })) : knockoutFirstRound(ids);
  await prisma.$transaction([
    prisma.teamMatch.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.teamDraw.update({ where: { planId: ctx.plan.id }, data: { format } }),
    prisma.teamMatch.createMany({ data: fixtures.map(f => ({ planId: ctx.plan.id, ...f })) }),
  ]);
  if (format === 'knockout') await advanceKnockout(ctx.plan.id);
  res.json({ ok: true });
  for (const t of teams) for (const m of t.members) notify(req, ctx.plan, m.userId, `🏆 Le tournoi commence (${format === 'league' ? 'championnat' : 'élimination directe'}) : découvre les matchs`);
});

// DELETE /:id/teams/tournament — arrêter le tournoi (les équipes restent)
router.delete('/:id/teams/tournament', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  await prisma.$transaction([
    prisma.teamMatch.deleteMany({ where: { planId: ctx.plan.id } }),
    prisma.teamDraw.update({ where: { planId: ctx.plan.id }, data: { format: null } }),
  ]);
  res.json({ ok: true });
});

// PUT /:id/teams/matches/:matchId { homeScore, awayScore, winnerId? } — saisir un score (organisateur).
// Élimination directe : en cas d'égalité, winnerId désigne le qualifié ; si le qualifié change, les
// tours suivants sont recréés.
router.put('/:id/teams/matches/:matchId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res); if (!ctx) return;
  if (!(await requireManager(req, res, ctx.plan))) return;
  const match = await prisma.teamMatch.findFirst({ where: { id: req.params.matchId, planId: ctx.plan.id } });
  if (!match || !match.homeId || !match.awayId) { res.status(404).json({ error: 'Match introuvable' }); return; }
  if (req.body?.clear === true) {
    await prisma.teamMatch.update({ where: { id: match.id }, data: { homeScore: null, awayScore: null, winnerId: null } });
    if (ctx.draw.format === 'knockout') await prisma.teamMatch.deleteMany({ where: { planId: ctx.plan.id, round: { gt: match.round } } });
    res.json({ ok: true }); return;
  }
  const homeScore = parseScore(req.body?.homeScore); const awayScore = parseScore(req.body?.awayScore);
  if (homeScore === null || awayScore === null) { res.status(400).json({ error: 'Score invalide' }); return; }
  let winnerId: string | null = null;
  if (ctx.draw.format === 'knockout') {
    winnerId = knockoutWinner(match, homeScore, awayScore, req.body?.winnerId);
    if (!winnerId) { res.status(400).json({ error: 'Égalité : indique quelle équipe se qualifie' }); return; }
    if (match.winnerId && match.winnerId !== winnerId) await prisma.teamMatch.deleteMany({ where: { planId: ctx.plan.id, round: { gt: match.round } } });
  }
  await prisma.teamMatch.update({ where: { id: match.id }, data: { homeScore, awayScore, winnerId } });
  if (ctx.draw.format === 'knockout') await advanceKnockout(ctx.plan.id);
  res.json({ ok: true });
});

export default router;
