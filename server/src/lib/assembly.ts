import { randomInt } from 'crypto';
import prisma from './prisma';
import { isCircleManager } from './circleRoles';

// Assemblée : fonction à activer dans un Plan (enabledFeatures « assemblee »). La date du Plan est celle de
// l'assemblée. Organisée par le créateur du Plan et les gestionnaires du Cercle (la « présidence »), avec un ou
// une secrétaire facultatif (notes du procès-verbal). Votants = membres du Cercle, moins ceux décochés par
// l'organisateur (nonVoterIds) ; invités externes et réponses sans compte assistent sans voter.
//
// Pendant l'assemblée, seules les personnes pointées présentes votent (sur place, ou à distance si
// l'assemblée est hybride). Une procuration est valable tant que la personne qui l'a donnée n'est pas
// présente, et seulement si la personne qui la porte l'est : elle vote alors une fois par mandat.
// Au bulletin secret, « qui a voté » (AssemblyVoter) et le bulletin (AssemblyBallot) sont enregistrés
// séparément, sans lien : personne ne peut retrouver qui a voté quoi.

export const ASSEMBLY_FEATURE = 'assemblee';
export const ASSEMBLY_DISABLED_ERROR = 'L’assemblée n’est pas activée dans ce Plan';
export const ITEM_KINDS = ['info', 'vote', 'election'] as const;
export const MAJORITIES = ['simple', 'absolute', 'two_thirds'] as const;
export const QUORUM_MODES = ['none', 'count', 'percent'] as const;
export const VOTE_CHOICES = ['yes', 'no', 'abstain'] as const;
export const ITEM_TITLE_MAX = 150;
export const ITEM_TEXT_MAX = 2000;
export const NOTES_MAX = 4000;
export const MAX_ITEMS = 40;
export const MAX_CANDIDATES = 30;

export type ItemKind = typeof ITEM_KINDS[number];
export type Majority = typeof MAJORITIES[number];
export type VoteChoice = typeof VOTE_CHOICES[number];

export const MAJORITY_LABEL: Record<Majority, string> = {
  simple: 'majorité simple (plus de oui que de non, abstentions non comptées)',
  absolute: 'majorité absolue (plus de la moitié des voix, abstentions comprises)',
  two_thirds: 'deux tiers des voix exprimées (abstentions non comptées)',
};

export function assemblyEnabled(plan: { enabledFeatures: string[] }) {
  return plan.enabledFeatures.includes(ASSEMBLY_FEATURE);
}

export async function canManageAssembly(userId: string, plan: { creatorId: string; circleId: string }) {
  return plan.creatorId === userId || isCircleManager(userId, plan.circleId);
}

export function checkInCode() {
  return String(randomInt(10000)).padStart(4, '0');
}

// Nombre de voix nécessaires pour le quorum (null = pas de quorum)
export function quorumRequired(mode: string, value: number | null, voterCount: number): number | null {
  if (mode === 'count' && value) return value;
  if (mode === 'percent' && value) return Math.ceil((voterCount * value) / 100);
  return null;
}

export type Proxy = { giverId: string; holderId: string };

// Qui peut voter, et pour qui. `present` = personnes pointées (sur place ou à distance).
export function votingRights(voterIds: string[], present: Set<string>, proxies: Proxy[]) {
  const voters = new Set(voterIds);
  const valid = proxies.filter(p => voters.has(p.giverId) && voters.has(p.holderId) && !present.has(p.giverId) && present.has(p.holderId));
  const mandates = new Map<string, string[]>();
  for (const id of voterIds) if (present.has(id)) mandates.set(id, [id]);
  for (const p of valid) mandates.get(p.holderId)!.push(p.giverId);
  const presentVoters = voterIds.filter(id => present.has(id)).length;
  return { mandates, validProxies: valid, presentVoters, represented: presentVoters + valid.length };
}

// Une procuration peut-elle être donnée ?
export function proxyError(a: { proxiesAllowed: boolean; maxProxies: number; openedAt: Date | null; closedAt: Date | null },
  voterIds: string[], proxies: Proxy[], giverId: string, holderId: string): string | null {
  if (!a.proxiesAllowed) return 'Les procurations ne sont pas autorisées pour cette assemblée';
  if (a.openedAt || a.closedAt) return 'L’assemblée est ouverte : les procurations ne se modifient plus';
  if (giverId === holderId) return 'Choisis une autre personne';
  if (!voterIds.includes(giverId)) return 'Tu ne fais pas partie des votants';
  if (!voterIds.includes(holderId)) return 'Cette personne ne fait pas partie des votants';
  if (proxies.some(p => p.giverId === holderId)) return 'Cette personne a elle-même donné sa procuration';
  if (proxies.some(p => p.holderId === giverId)) return 'Tu représentes déjà quelqu’un : tu ne peux pas donner ta procuration';
  const held = proxies.filter(p => p.holderId === holderId && p.giverId !== giverId).length;
  if (held >= a.maxProxies) return `Cette personne a déjà ${held} procuration${held > 1 ? 's' : ''} (maximum ${a.maxProxies})`;
  return null;
}

export type VoteCounts = { yes: number; no: number; abstain: number };

export function countVotes(ballots: { choice: string | null }[]): VoteCounts {
  const c = { yes: 0, no: 0, abstain: 0 };
  for (const b of ballots) if (b.choice === 'yes' || b.choice === 'no' || b.choice === 'abstain') c[b.choice]++;
  return c;
}

export function isAdopted(c: VoteCounts, majority: string): boolean {
  if (majority === 'absolute') return c.yes * 2 > c.yes + c.no + c.abstain;
  if (majority === 'two_thirds') return c.yes + c.no > 0 && c.yes * 3 >= (c.yes + c.no) * 2;
  return c.yes > c.no;
}

// Élection : les `seats` candidats qui ont le plus de voix (au moins une) ; égalité à la dernière place
// élue → `tie` (l'organisateur départage)
export function electionResult(candidateIds: string[], ballots: { candidateIds: string[] }[], seats: number) {
  const votes = new Map(candidateIds.map(id => [id, 0]));
  for (const b of ballots) for (const id of new Set(b.candidateIds)) if (votes.has(id)) votes.set(id, votes.get(id)! + 1);
  const ranking = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, votes: n }));
  const withVotes = ranking.filter(r => r.votes > 0);
  if (withVotes.length <= seats) return { ranking, elected: withVotes.map(r => r.id), tie: false, tiedIds: [] as string[] };
  const last = withVotes[seats - 1].votes;
  const tie = withVotes[seats].votes === last;
  const elected = tie ? withVotes.filter(r => r.votes > last).map(r => r.id) : withVotes.slice(0, seats).map(r => r.id);
  return { ranking, elected, tie, tiedIds: tie ? withVotes.filter(r => r.votes === last).map(r => r.id) : [] };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parseItemInput(body: any): { error: string } | {
  title: string; description: string | null; kind: ItemKind; secret: boolean; majority: Majority; seats: number | null; attachmentIds: string[];
} {
  const title = text(body?.title, ITEM_TITLE_MAX + 1);
  if (!title) return { error: 'Indique le titre du point' };
  if (title.length > ITEM_TITLE_MAX) return { error: `Titre : ${ITEM_TITLE_MAX} caractères maximum` };
  const kind = (ITEM_KINDS as readonly string[]).includes(body?.kind) ? body.kind as ItemKind : 'info';
  const majority = (MAJORITIES as readonly string[]).includes(body?.majority) ? body.majority as Majority : 'simple';
  const seatsRaw = Number(body?.seats);
  const seats = kind === 'election' ? (Number.isInteger(seatsRaw) && seatsRaw >= 1 && seatsRaw <= 20 ? seatsRaw : 1) : null;
  const attachmentIds = Array.isArray(body?.attachmentIds) ? [...new Set(body.attachmentIds.filter((x: unknown): x is string => typeof x === 'string'))].slice(0, 10) as string[] : [];
  return { title, description: text(body?.description, ITEM_TEXT_MAX) || null, kind, secret: body?.secret !== false, majority, seats, attachmentIds };
}

// Prénom + nom (le procès-verbal identifie les personnes ; jamais dans l'app pour les autres membres)
export const fullName = (u: { firstName: string | null; lastName?: string | null; pseudo: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || `@${u.pseudo}`;

export async function loadAssemblyPlan(planId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, title: true, circleId: true, creatorId: true, enabledFeatures: true, eventDate: true, endDate: true, location: true },
  });
}

// Votants : membres du Cercle (comptes normaux), moins les personnes décochées
export async function circleVoters(circleId: string, nonVoterIds: string[]) {
  const members = await prisma.circleMember.findMany({
    where: { circleId, user: { isLight: false } },
    select: { user: { select: { id: true, pseudo: true, firstName: true, lastName: true } } },
  });
  const all = members.map(m => m.user).sort((a, b) => (a.firstName ?? a.pseudo).localeCompare(b.firstName ?? b.pseudo, 'fr'));
  return { members: all, voterIds: all.filter(u => !nonVoterIds.includes(u.id)).map(u => u.id) };
}
