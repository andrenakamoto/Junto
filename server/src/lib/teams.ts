import prisma from './prisma';
import { isCircleManager } from './circleRoles';

// Tirage des équipes et tournoi : fonction à activer dans un Plan (enabledFeatures « equipes »).
// L'organisateur choisit le nombre d'équipes ; le tirage peut être équilibré selon un niveau (1 à 3)
// qu'il est seul à voir. Ensuite, tournoi facultatif : championnat (chacun contre chacun) ou
// élimination directe. Participants : « Je suis in », y compris les réponses sans compte.

export const TEAMS_FEATURE = 'equipes';
export const TEAMS_DISABLED_ERROR = 'Le tirage des équipes n’est pas activé pour ce Plan';
export const TEAM_NAME_MAX = 30;
export const SCORE_MAX = 999;

export const TEAM_COLORS = [
  { name: 'Rouges', color: '#ef4444' },
  { name: 'Bleus', color: '#3b82f6' },
  { name: 'Verts', color: '#22c55e' },
  { name: 'Jaunes', color: '#eab308' },
  { name: 'Violets', color: '#a855f7' },
  { name: 'Oranges', color: '#f97316' },
  { name: 'Roses', color: '#ec4899' },
  { name: 'Noirs', color: '#334155' },
];
export const MAX_TEAMS = TEAM_COLORS.length;

export function teamsEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(TEAMS_FEATURE);
}

export async function canManageTeams(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Répartition : tailles égales à une personne près. Équilibrée : les plus forts d'abord, distribués
// « en serpent » (1, 2, 3, 3, 2, 1…) pour que chaque équipe ait sa part de chaque niveau.
export function drawTeams(people: { id: string; level?: number }[], teamCount: number, balanced: boolean, rand: () => number = Math.random): string[][] {
  const n = Math.max(1, Math.min(teamCount, people.length));
  const teams: string[][] = Array.from({ length: n }, () => []);
  let order = shuffle(people, rand);
  if (balanced) order = order.sort((a, b) => (b.level ?? 2) - (a.level ?? 2));
  // Les équipes qui reçoivent en premier changent d'un tirage à l'autre
  const slots = shuffle([...Array(n).keys()], rand);
  order.forEach((p, i) => {
    const pass = Math.floor(i / n); const k = i % n;
    teams[slots[pass % 2 === 0 ? k : n - 1 - k]].push(p.id);
  });
  return teams;
}

export type Fixture = { round: number; position: number; homeId: string | null; awayId: string | null };

// Championnat : méthode du « cercle », chacun rencontre chacun une fois ; avec un nombre impair
// d'équipes, une équipe est au repos à chaque journée (pas de match créé pour elle).
export function leagueSchedule(teamIds: string[]): Fixture[] {
  const ids: (string | null)[] = teamIds.length % 2 ? [...teamIds, null] : [...teamIds];
  const n = ids.length;
  const out: Fixture[] = [];
  for (let r = 0; r < n - 1; r++) {
    let position = 0;
    for (let i = 0; i < n / 2; i++) {
      const home = ids[i]; const away = ids[n - 1 - i];
      if (home && away) out.push({ round: r + 1, position: position++, homeId: r % 2 ? away : home, awayId: r % 2 ? home : away });
    }
    ids.splice(1, 0, ids.pop()!);
  }
  return out;
}

// Élimination directe, premier tour : tableau à la puissance de 2 supérieure ; les équipes en trop
// sont exemptées (qualifiées d'office, awayId vide).
export function knockoutFirstRound(teamIds: string[], rand: () => number = Math.random): (Fixture & { winnerId: string | null })[] {
  const order = shuffle(teamIds, rand);
  let size = 1; while (size < order.length) size *= 2;
  const byes = size - order.length;
  const out: (Fixture & { winnerId: string | null })[] = [];
  let position = 0;
  for (let i = 0; i < byes; i++) out.push({ round: 1, position: position++, homeId: order[i], awayId: null, winnerId: order[i] });
  for (let i = byes; i < order.length; i += 2) out.push({ round: 1, position: position++, homeId: order[i], awayId: order[i + 1], winnerId: null });
  return out;
}

// Tour suivant quand tous les matchs du tour sont joués ; null si pas prêt ou si c'était la finale
export function nextKnockoutRound(matches: { round: number; position: number; winnerId: string | null }[]): Fixture[] | null {
  if (!matches.length) return null;
  const last = Math.max(...matches.map(m => m.round));
  const current = matches.filter(m => m.round === last).sort((a, b) => a.position - b.position);
  if (current.length < 2 || current.some(m => !m.winnerId)) return null;
  const out: Fixture[] = [];
  for (let i = 0; i < current.length; i += 2) out.push({ round: last + 1, position: i / 2, homeId: current[i].winnerId, awayId: current[i + 1]?.winnerId ?? null });
  return out;
}

// Vainqueur d'un match à élimination directe : au score, sinon celui choisi (tirs au but…)
export function knockoutWinner(m: { homeId: string | null; awayId: string | null }, homeScore: number, awayScore: number, chosen?: string | null): string | null {
  if (homeScore > awayScore) return m.homeId;
  if (awayScore > homeScore) return m.awayId;
  return chosen && (chosen === m.homeId || chosen === m.awayId) ? chosen : null;
}

export type Standing = { teamId: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; diff: number; points: number };

// Classement du championnat : 3 points la victoire, 1 le nul ; départage à la différence de buts,
// puis aux buts marqués
export function leagueStandings(teamIds: string[], matches: { homeId: string | null; awayId: string | null; homeScore: number | null; awayScore: number | null }[]): Standing[] {
  const t = new Map(teamIds.map(id => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0 }]));
  for (const m of matches) {
    if (m.homeScore == null || m.awayScore == null || !m.homeId || !m.awayId) continue;
    const h = t.get(m.homeId); const a = t.get(m.awayId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.points += 3; }
    else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  const out = [...t.values()].map(s => ({ ...s, diff: s.goalsFor - s.goalsAgainst }));
  return out.sort((x, y) => y.points - x.points || y.diff - x.diff || y.goalsFor - x.goalsFor);
}

export function parseScore(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= SCORE_MAX ? n : null;
}

// Participants : « Je suis in », comptes et réponses sans compte
export async function teamParticipants(planId: string) {
  const members = await prisma.planMember.findMany({
    where: { planId, rsvp: 'in' },
    select: { user: { select: { id: true, pseudo: true, firstName: true, isLight: true } } },
  });
  return members.map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr'));
}

// Désistement : la personne quitte son équipe (les équipes ne sont pas retirées au sort)
export async function removeFromTeams(planId: string, userId: string) {
  await prisma.teamMember.deleteMany({ where: { planId, userId } });
}

export async function removeFromTeamsInCircle(circleId: string, userId: string) {
  await prisma.teamMember.deleteMany({ where: { userId, team: { draw: { plan: { circleId } } } } });
}
