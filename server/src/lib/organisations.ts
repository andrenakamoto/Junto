// Organisations (associations à plusieurs niveaux) : règles pures, sans base de données.
// Une Organisation regroupe des Cercles : unités (groupes de travail de la direction), équipes (groupes de membres) et
// Cercles automatiques (liste de membres calculée). Les noms (rôles, unités, équipes) sont choisis par l'organisation :
// EvLY ne connaît que les genres de rôle et les actions ci-dessous. Un Cercle sans Organisation n'est jamais concerné.

export const ORG_ACTIONS = [
  'integrate_all', 'publish_multi', 'create_plan', 'create_poll', 'edit_others', 'write_plan_chat', 'write_discussion',
  'add_files', 'manage_shifts', 'invite_guests', 'see_participants', 'manage_members', 'see_money',
] as const;
export type OrgAction = typeof ORG_ACTIONS[number];

// direction : un seul rôle, valable dans toute l'Organisation ; responsible : responsable d'une équipe ; member : membre
export const ROLE_KINDS = ['direction', 'responsible', 'member'] as const;
export type RoleKind = typeof ROLE_KINDS[number];
export const CIRCLE_KINDS = ['unit', 'team', 'auto'] as const;
export type OrgCircleKind = typeof CIRCLE_KINDS[number];

export const ORG_NAME_MAX = 60;
export const ORG_ROLES_MAX = 12;
export const ORG_CIRCLES_MAX = 60;

export function cleanOrgName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim();
  return name && name.length <= ORG_NAME_MAX ? name : null;
}

export function parseActions(v: unknown): OrgAction[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((a): a is OrgAction => typeof a === 'string' && (ORG_ACTIONS as readonly string[]).includes(a)))];
}

export interface RoleInput { ref: string; name: string; kind: RoleKind; permissions: OrgAction[] }
export interface CircleInput {
  ref: string; name: string; kind: OrgCircleKind; color: string | null; defaultRoleRef: string | null; extraPermissions: OrgAction[];
  discussionRoleRefs: string[]; autoRoleRefs: string[]; autoCircleRefs: string[]; autoDirection: boolean;
}
export interface OrganisationInput { name: string; unitLabel: string | null; teamLabel: string | null; roles: RoleInput[]; circles: CircleInput[] }

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// Vérifie la structure envoyée par l'assistant de création. Les « ref » sont des repères temporaires du formulaire.
export function parseOrganisationInput(raw: any): { input: OrganisationInput } | { error: string } {
  const name = cleanOrgName(raw?.name);
  if (!name) return { error: `Nom de l'Organisation requis (${ORG_NAME_MAX} caractères maximum)` };
  if (!Array.isArray(raw?.roles) || !Array.isArray(raw?.circles)) return { error: 'Structure de l’Organisation invalide' };
  if (raw.roles.length > ORG_ROLES_MAX || raw.circles.length > ORG_CIRCLES_MAX) return { error: 'Trop de rôles ou de Cercles dans cette Organisation' };

  const roles: RoleInput[] = [];
  for (const r of raw.roles) {
    const roleName = cleanOrgName(r?.name);
    if (!roleName || typeof r?.ref !== 'string' || !(ROLE_KINDS as readonly string[]).includes(r?.kind)) return { error: 'Structure de l’Organisation invalide' };
    roles.push({ ref: r.ref, name: roleName, kind: r.kind, permissions: parseActions(r.permissions) });
  }
  if (roles.filter(r => r.kind === 'direction').length !== 1) return { error: 'Une Organisation a exactement un rôle de direction' };
  if (new Set(roles.map(r => r.ref)).size !== roles.length) return { error: 'Structure de l’Organisation invalide' };
  const roleRefs = new Map(roles.map(r => [r.ref, r]));

  const circles: CircleInput[] = [];
  for (const c of raw.circles) {
    const circleName = cleanOrgName(c?.name);
    if (!circleName || typeof c?.ref !== 'string' || !(CIRCLE_KINDS as readonly string[]).includes(c?.kind)) return { error: 'Structure de l’Organisation invalide' };
    const defaultRoleRef = typeof c.defaultRoleRef === 'string' ? c.defaultRoleRef : null;
    if (c.kind === 'team' && (!defaultRoleRef || roleRefs.get(defaultRoleRef)?.kind !== 'member')) return { error: 'Chaque équipe doit indiquer le rôle de ses membres' };
    circles.push({
      ref: c.ref, name: circleName, kind: c.kind, defaultRoleRef: c.kind === 'team' ? defaultRoleRef : null,
      color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : null,
      extraPermissions: c.kind === 'unit' ? parseActions(c.extraPermissions) : [],
      discussionRoleRefs: strings(c.discussionRoleRefs).filter(ref => roleRefs.has(ref)),
      autoRoleRefs: c.kind === 'auto' ? strings(c.autoRoleRefs).filter(ref => roleRefs.has(ref)) : [],
      autoCircleRefs: c.kind === 'auto' ? strings(c.autoCircleRefs) : [],
      autoDirection: c.kind === 'auto' && c.autoDirection === true,
    });
  }
  if (new Set(circles.map(c => c.ref)).size !== circles.length) return { error: 'Structure de l’Organisation invalide' };
  const units = new Set(circles.filter(c => c.kind === 'unit').map(c => c.ref));
  if (circles.some(c => c.autoCircleRefs.some(ref => !units.has(ref)))) return { error: 'Structure de l’Organisation invalide' };
  return { input: { name, unitLabel: cleanOrgName(raw.unitLabel), teamLabel: cleanOrgName(raw.teamLabel), roles, circles } };
}

// Le rôle donne-t-il les droits d'organisateur du Cercle (Planning, jeux, admissions…) ?
export const isManagerKind = (kind: string | null | undefined): boolean => kind === 'direction' || kind === 'responsible';

export interface AutoRule { autoDirection: boolean; autoRoleIds: string[]; autoCircleIds: string[] }
export interface AutoFacts { directionIds: string[]; assignments: { userId: string; roleId: string | null }[]; circleMembers: Map<string, string[]> }

// Membres d'un Cercle automatique : direction (si la règle le dit), personnes ayant un des rôles, membres des unités citées
export function autoMemberIds(rule: AutoRule, facts: AutoFacts): Set<string> {
  const ids = new Set<string>(rule.autoDirection ? facts.directionIds : []);
  for (const a of facts.assignments) if (a.roleId && rule.autoRoleIds.includes(a.roleId)) ids.add(a.userId);
  for (const circleId of rule.autoCircleIds) for (const userId of facts.circleMembers.get(circleId) ?? []) ids.add(userId);
  return ids;
}

// Droits d'une personne dans un Cercle : ceux de son rôle ici, de la direction si elle en fait partie, de ses unités
export function permissionsOf(p: { rolePermissions?: string[] | null; directionPermissions?: string[] | null; unitPermissions?: string[][] }): Set<string> {
  return new Set([...(p.rolePermissions ?? []), ...(p.directionPermissions ?? []), ...(p.unitPermissions ?? []).flat()]);
}

// Discussion d'un Cercle d'Organisation : réglable rôle par rôle ; les responsables et la direction écrivent toujours
export function canWriteOrgDiscussion(chatMode: string, isManager: boolean, roleId: string | null | undefined, allowedRoleIds: string[]): boolean {
  if (chatMode === 'off') return false;
  if (isManager) return true;
  return chatMode === 'open' && !!roleId && allowedRoleIds.includes(roleId);
}

// « Pour qui ? » : Cercles visés et rôles visés dans les équipes
export function parseAudience(raw: any): { circleIds: string[]; roleIds: string[] } | null {
  if (!Array.isArray(raw?.circleIds) || raw.circleIds.some((x: unknown) => typeof x !== 'string')) return null;
  if (raw.roleIds !== undefined && (!Array.isArray(raw.roleIds) || raw.roleIds.some((x: unknown) => typeof x !== 'string'))) return null;
  const circleIds = [...new Set(raw.circleIds as string[])];
  if (!circleIds.length || circleIds.length > ORG_CIRCLES_MAX) return null;
  return { circleIds, roleIds: [...new Set((raw.roleIds ?? []) as string[])] };
}

export interface AudienceMembership { userId: string; circleKind: string | null; roleId: string | null; roleKind: string | null }

// Une personne est concernée si un de ses Cercles visés la retient : unité ou Cercle automatique (tout le Cercle), rôle visé dans
// une équipe. La direction entrée dans une équipe garde la vue sur ce qui s'y passe.
export function audienceAllows(memberships: AudienceMembership[], roleIds: string[]): boolean {
  if (!roleIds.length) return memberships.length > 0;
  return memberships.some(m => m.circleKind !== 'team' || m.roleKind === 'direction' || (!!m.roleId && roleIds.includes(m.roleId)));
}

export function audienceExcludedIds(memberships: AudienceMembership[], roleIds: string[], creatorId: string): string[] {
  const byUser = new Map<string, AudienceMembership[]>();
  for (const m of memberships) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m]);
  return [...byUser].filter(([userId, list]) => userId !== creatorId && !audienceAllows(list, roleIds)).map(([userId]) => userId);
}
