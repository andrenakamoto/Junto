import { t } from '../i18n';

// Organisations (associations à plusieurs niveaux), miroir de server/src/lib/organisations.ts.
// Un modèle pré-remplit l'assistant ; tous les noms restent modifiables et sont gardés dans la langue de la personne qui crée.

// Ordre fixe d'une Organisation : la place choisie ; sans place (0), unités, groupes automatiques, équipes
const KIND_RANK: Record<string, number> = { unit: 0, auto: 1, team: 2 };
export function compareOrgCircles(a: { orgPosition?: number; orgKind?: string | null; createdAt?: string }, b: { orgPosition?: number; orgKind?: string | null; createdAt?: string }): number {
  return (a.orgPosition ?? 0) - (b.orgPosition ?? 0)
    || (KIND_RANK[a.orgKind ?? ''] ?? 3) - (KIND_RANK[b.orgKind ?? ''] ?? 3)
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

export type OrgModelKey = 'youth' | 'sport' | 'choir' | 'committee' | 'blank';
export const ORG_MODELS: { key: OrgModelKey; emoji: string; teamRoles: number[]; teamColors?: string[]; unitPerms?: Record<number, string[]> }[] = [
  { key: 'youth', emoji: '🏕️', teamRoles: [0, 0, 0, 1, 1], teamColors: ['#22c55e', '#f97316', '#3b82f6', '#ef4444', '#166534'], unitPerms: { 0: ['manage_members'], 1: ['see_money'], 4: ['publish_multi'] } },
  { key: 'sport', emoji: '⚽', teamRoles: [0, 0, 1], unitPerms: { 0: ['see_money'] } },
  { key: 'choir', emoji: '🎶', teamRoles: [0, 0, 0, 0], unitPerms: { 1: ['see_money'] } },
  { key: 'committee', emoji: '🤝', teamRoles: [0], unitPerms: { 0: ['see_money'] } },
  { key: 'blank', emoji: '✏️', teamRoles: [] },
];

// Droits proposés dans le tableau, dans l'ordre d'affichage (ceux qui ne sont pas encore appliqués n'y figurent pas)
export const ORG_MATRIX_ACTIONS = ['create_plan', 'create_poll', 'write_plan_chat', 'add_files', 'manage_shifts', 'invite_guests', 'see_money', 'send_announcement', 'manage_equipment', 'manage_members', 'integrate_all'] as const;
export type OrgMatrixAction = typeof ORG_MATRIX_ACTIONS[number];

const DIRECTION_PERMS = ['integrate_all', 'publish_multi', 'create_plan', 'create_poll', 'edit_others', 'write_plan_chat', 'add_files', 'manage_shifts', 'invite_guests', 'see_participants', 'see_money', 'manage_members', 'send_announcement', 'manage_equipment'];
const RESPONSIBLE_PERMS = ['publish_multi', 'create_plan', 'create_poll', 'edit_others', 'write_plan_chat', 'add_files', 'manage_shifts', 'invite_guests', 'see_participants'];
const MEMBER_PERMS = ['write_plan_chat'];

const PALETTE = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

export interface OrgTeamDraft { name: string; roleIndex: number; color: string }
export interface OrgDraft {
  name: string; modelKey: OrgModelKey; unitLabel: string; teamLabel: string;
  directionName: string; responsibleName: string; memberNames: string[];
  units: string[]; unitPerms: Record<number, string[]>; teams: OrgTeamDraft[];
  autoResponsibles: boolean; autoResponsiblesName: string; autoResponsibleUnits: number[];
  autoDirection: boolean; autoDirectionName: string;
}

// Clés construites à partir du modèle choisi
const text = t as unknown as (key: string) => string;
const list = (key: string) => text(key).split('|').map(s => s.trim()).filter(Boolean);

export function draftFromModel(modelKey: OrgModelKey, name = ''): OrgDraft {
  const model = ORG_MODELS.find(m => m.key === modelKey)!;
  const p = `org.models.${modelKey}`;
  const teams = list(`${p}.teams`);
  return {
    name, modelKey, unitLabel: t('org.words.units'), teamLabel: t('org.words.teams'),
    directionName: text(`${p}.direction`), responsibleName: text(`${p}.responsible`), memberNames: list(`${p}.members`),
    units: list(`${p}.units`), unitPerms: model.unitPerms ?? {},
    teams: teams.map((n, i) => ({ name: n, roleIndex: model.teamRoles[i] ?? 0, color: model.teamColors?.[i] ?? PALETTE[i % PALETTE.length] })),
    autoResponsibles: true, autoResponsiblesName: text(`${p}.responsibleGroup`), autoResponsibleUnits: modelKey === 'youth' ? [0, 1] : [],
    autoDirection: true, autoDirectionName: text(`${p}.directionGroup`),
  };
}

// Vérifie le brouillon : renvoie le texte à afficher, ou null
export function draftProblem(d: OrgDraft): string | null {
  if (!d.name.trim()) return t('org.create.needName');
  if (!d.directionName.trim() || !d.responsibleName.trim()) return t('org.create.needRoles');
  if (!d.memberNames.some(n => n.trim())) return t('org.create.needMemberRole');
  if (!d.teams.some(x => x.name.trim()) && !d.units.some(u => u.trim())) return t('org.create.needCircle');
  return null;
}

// Nombre de Cercles que l'assistant va créer
export function draftCircleCount(d: OrgDraft): number {
  return d.units.filter(u => u.trim()).length + d.teams.filter(x => x.name.trim()).length + (d.autoResponsibles ? 1 : 0) + (d.autoDirection ? 1 : 0);
}

export function draftPayload(d: OrgDraft) {
  const memberNames = d.memberNames.map(n => n.trim());
  const roles = [
    { ref: 'direction', name: d.directionName.trim(), kind: 'direction', permissions: DIRECTION_PERMS },
    { ref: 'responsible', name: d.responsibleName.trim(), kind: 'responsible', permissions: RESPONSIBLE_PERMS },
    ...memberNames.flatMap((name, i) => (name ? [{ ref: `member${i}`, name, kind: 'member', permissions: MEMBER_PERMS }] : [])),
  ];
  const memberRefs = memberNames.flatMap((name, i) => (name ? [`member${i}`] : []));
  const firstMember = memberRefs[0];
  const units = d.units.flatMap((name, i) => (name.trim() ? [{ ref: `unit${i}`, name: name.trim(), kind: 'unit', extraPermissions: d.unitPerms[i] ?? [] }] : []));
  const unitRefs = new Set(units.map(u => u.ref));
  const teams = d.teams.flatMap((team, i) => {
    if (!team.name.trim()) return [];
    const wanted = `member${team.roleIndex}`;
    return [{ ref: `team${i}`, name: team.name.trim(), kind: 'team', color: team.color, defaultRoleRef: memberRefs.includes(wanted) ? wanted : firstMember, discussionRoleRefs: memberRefs }];
  });
  const autos = [
    ...(d.autoResponsibles ? [{ ref: 'autoResponsibles', name: d.autoResponsiblesName.trim() || d.responsibleName.trim(), kind: 'auto', autoRoleRefs: ['responsible'], autoCircleRefs: d.autoResponsibleUnits.map(i => `unit${i}`).filter(r => unitRefs.has(r)) }] : []),
    ...(d.autoDirection ? [{ ref: 'autoDirection', name: d.autoDirectionName.trim() || d.directionName.trim(), kind: 'auto', autoDirection: true }] : []),
  ];
  return { name: d.name.trim(), unitLabel: d.unitLabel.trim() || null, teamLabel: d.teamLabel.trim() || null, roles, circles: [...units, ...autos, ...teams] };
}
