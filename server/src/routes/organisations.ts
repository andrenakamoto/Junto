import { Router } from 'express';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { applyToAnnouncement, chatSince, CIRCLE_CHAT_MAX, circleMessageInclude, plainCircleMessage } from '../lib/circleChat';
import { decryptMessage, encryptMessage } from '../lib/messageCrypto';
import { cleanContent } from '../lib/messageEdit';
import { countMessageSent } from '../lib/activity';
import { mutedAmong } from '../lib/mutes';
import { notifyUser } from '../lib/push';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { detachFromCircle } from '../lib/circleDetach';
import { isCircleManager } from '../lib/circleRoles';
import { joinCircleRoom } from '../lib/realtime';
import { cleanOrgName, isManagerKind, parseActions, parseAudience, parseOrganisationInput } from '../lib/organisations';
import { orgPermissions } from '../lib/orgPermissions';
import { audienceCount, integrateCircle, refreshOrgAudience, resolveAudience, syncOrganisation } from '../lib/orgSync';
import { createCirclePoll, createPlanInCircle, generateCode, missingPlanBasics } from './circles';

// Organisations — voir lib/organisations.ts. Création réservée aux comptes autorisés dans le panneau admin.
const router = Router();
router.use(requireAuth as any);

const membership = (organisationId: string, userId: string) =>
  prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId, userId } } });

async function uniqueCode(taken: Set<string>): Promise<string> {
  for (;;) {
    const code = generateCode();
    if (taken.has(code) || await prisma.circle.findUnique({ where: { code }, select: { id: true } })) continue;
    taken.add(code);
    return code;
  }
}

// POST / — l'assistant de création envoie toute la structure d'un coup
router.post('/', async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { canCreateOrganisation: true, isAdmin: true } });
  if (!me?.canCreateOrganisation && !me?.isAdmin) { res.status(403).json({ error: 'Création d’une Organisation non autorisée pour ce compte' }); return; }
  const parsed = parseOrganisationInput(req.body);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { input } = parsed;
  const userId = req.userId!;
  const taken = new Set<string>();
  const codes = new Map<string, string>();
  for (const c of input.circles) codes.set(c.ref, await uniqueCode(taken));

  const result = await prisma.$transaction(async tx => {
    const organisation = await tx.organisation.create({ data: { name: input.name, creatorId: userId, unitLabel: input.unitLabel, teamLabel: input.teamLabel } });
    const roleIds = new Map<string, string>();
    for (const [position, r] of input.roles.entries()) {
      const role = await tx.organisationRole.create({ data: { organisationId: organisation.id, name: r.name, kind: r.kind, position, permissions: r.permissions } });
      roleIds.set(r.ref, role.id);
    }
    const directionId = roleIds.get(input.roles.find(r => r.kind === 'direction')!.ref)!;
    const refs = (list: string[], map: Map<string, string>) => list.map(ref => map.get(ref)).filter((id): id is string => !!id);
    const circleIds = new Map<string, string>();
    for (const [index, c] of input.circles.entries()) {
      const circle = await tx.circle.create({
        data: {
          orgPosition: index + 1,
          name: c.name, code: codes.get(c.ref)!, color: c.color, creatorId: userId, organisationId: organisation.id, orgKind: c.kind,
          orgDefaultRoleId: c.defaultRoleRef ? roleIds.get(c.defaultRoleRef) : null, orgExtraPermissions: c.extraPermissions,
          orgDiscussionRoleIds: refs(c.discussionRoleRefs, roleIds), orgAutoDirection: c.autoDirection, orgAutoRoleIds: refs(c.autoRoleRefs, roleIds),
          admissionMode: 'creator', deletionMode: 'creator', planCreationMode: 'creator', pollCreationMode: 'creator', chatMode: 'open', availabilityEnabled: false,
          members: { create: { userId, role: 'admin', orgRoleId: directionId, orgIntegrated: c.kind === 'team' } },
        },
      });
      circleIds.set(c.ref, circle.id);
      // La personne qui crée est membre de tout : ses équipes restent silencieuses, comme après « Intégrer »
      if (c.kind === 'team') await tx.notificationMute.create({ data: { userId, circleId: circle.id } });
    }
    for (const c of input.circles.filter(x => x.autoCircleRefs.length)) {
      await tx.circle.update({ where: { id: circleIds.get(c.ref)! }, data: { orgAutoCircleIds: refs(c.autoCircleRefs, circleIds) } });
    }
    await tx.organisationMember.create({ data: { organisationId: organisation.id, userId, isAdmin: true, isDirection: true } });
    return { organisation, circleIds: [...circleIds.values()] };
  });
  for (const id of result.circleIds) joinCircleRoom(req.app.get('io'), userId, id);
  await syncOrganisation(req.app, result.organisation.id);
  // Sa liste de Cercles se recharge
  req.app.get('io')?.to(`user:${userId}`).emit('circle-updated', { circleId: result.circleIds[0] });
  res.json(result.organisation);
});

// GET /mine — mes Organisations, avec mes droits Cercle par Cercle
router.get('/mine', async (req: AuthRequest, res) => {
  const rows = await prisma.organisationMember.findMany({ where: { userId: req.userId! }, include: { organisation: { select: { id: true, name: true } } } });
  const organisations = [];
  for (const row of rows) {
    const circles = await prisma.circleMember.findMany({ where: { userId: req.userId!, circle: { organisationId: row.organisationId } }, select: { circleId: true } });
    const permissions: Record<string, string[]> = {};
    for (const c of circles) permissions[c.circleId] = [...await orgPermissions(req.userId!, row.organisationId, c.circleId)];
    organisations.push({ ...row.organisation, isAdmin: row.isAdmin, isDirection: row.isDirection, permissions });
  }
  res.json(organisations);
});

// GET /:id — vue d'ensemble : direction et administrateurs
router.get('/:id', async (req: AuthRequest, res) => {
  const me = await membership(req.params.id, req.userId!);
  if (!me || (!me.isAdmin && !me.isDirection)) { res.status(403).json({ error: 'Réservé à la direction de l’Organisation' }); return; }
  const [organisation, circles, mine] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: req.params.id }, include: { roles: { orderBy: { position: 'asc' } } } }),
    prisma.circle.findMany({
      where: { organisationId: req.params.id }, orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, code: true, color: true, orgKind: true, orgPosition: true, createdAt: true, orgDiscussionRoleIds: true, orgDefaultRoleId: true, _count: { select: { members: true } } },
    }),
    prisma.circleMember.findMany({ where: { userId: req.userId!, circle: { organisationId: req.params.id } }, select: { circleId: true } }),
  ]);
  if (!organisation) { res.status(404).json({ error: 'Organisation introuvable' }); return; }
  const inCircle = new Set(mine.map(m => m.circleId));
  const canIntegrate = (await orgPermissions(req.userId!, req.params.id)).has('integrate_all');
  res.json({ ...organisation, isAdmin: me.isAdmin, canIntegrate, circles: circles.map(c => ({ ...c, isMember: inCircle.has(c.id) })) });
});

// POST /:id/circles/:circleId/integrate — entrer dans n'importe quel Cercle, sans code, en mode discret
router.post('/:id/circles/:circleId/integrate', async (req: AuthRequest, res) => {
  const { id, circleId } = req.params;
  const userId = req.userId!;
  if (!(await orgPermissions(userId, id)).has('integrate_all')) { res.status(403).json({ error: 'Réservé à la direction de l’Organisation' }); return; }
  const circle = await prisma.circle.findFirst({ where: { id: circleId, organisationId: id }, select: { id: true } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } } })) { res.status(409).json({ error: 'Tu es déjà dans ce Cercle', code: 'already_member' }); return; }
  await integrateCircle(req.app, id, circleId, userId);
  res.json({ ok: true });
});

// Gérer les membres : administrateurs de l'Organisation, droit « manage_members », organisateurs du Cercle
async function canManageMembers(userId: string, organisationId: string, circleId: string) {
  const me = await membership(organisationId, userId);
  if (me?.isAdmin) return true;
  return (await orgPermissions(userId, organisationId, circleId)).has('manage_members');
}

// GET /:id/circles/:circleId/members — membres d'un Cercle et leur rôle
router.get('/:id/circles/:circleId/members', async (req: AuthRequest, res) => {
  const { id, circleId } = req.params;
  const circle = await prisma.circle.findFirst({ where: { id: circleId, organisationId: id }, select: { id: true } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (!(await canManageMembers(req.userId!, id, circleId)) && !(await isCircleManager(req.userId!, circleId))) { res.status(403).json({ error: 'Réservé à la direction de l’Organisation' }); return; }
  const members = await prisma.circleMember.findMany({
    where: { circleId }, orderBy: { joinedAt: 'asc' },
    select: { userId: true, orgRoleId: true, orgIntegrated: true, user: { select: { pseudo: true, firstName: true } } },
  });
  res.json(members);
});

// PUT /:id/circles/:circleId/members/:userId/role { roleId } — nommer un responsable, ou le redevenir simple membre
router.put('/:id/circles/:circleId/members/:userId/role', async (req: AuthRequest, res) => {
  const { id, circleId, userId } = req.params;
  if (!(await canManageMembers(req.userId!, id, circleId))) { res.status(403).json({ error: 'Réservé à la direction de l’Organisation' }); return; }
  if (typeof req.body?.roleId !== 'string') { res.status(400).json({ error: 'Rôle invalide' }); return; }
  const [circle, role, member] = await Promise.all([
    prisma.circle.findFirst({ where: { id: circleId, organisationId: id }, select: { creatorId: true, orgKind: true } }),
    prisma.organisationRole.findFirst({ where: { id: req.body.roleId, organisationId: id } }),
    prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } } }),
  ]);
  if (!circle || !member) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  if (circle.orgKind !== 'team' || !role || role.kind === 'direction') { res.status(400).json({ error: 'Rôle invalide' }); return; }
  const stillManager = (await membership(id, userId))?.isDirection && member.orgIntegrated;
  await prisma.circleMember.update({
    where: { userId_circleId: { userId, circleId } },
    data: { orgRoleId: role.id, ...(circle.creatorId !== userId && { role: isManagerKind(role.kind) || stillManager ? 'organizer' : 'member' }) },
  });
  await refreshOrgAudience(userId, id);
  req.app.get('io')?.to(`circle:${circleId}`).emit('circle-updated', { circleId });
  await syncOrganisation(req.app, id);
  res.json({ ok: true });
});

// PUT /:id/members/:userId/direction { isDirection } — administrateurs seulement
router.put('/:id/members/:userId/direction', async (req: AuthRequest, res) => {
  const { id, userId } = req.params;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  if (typeof req.body?.isDirection !== 'boolean') { res.status(400).json({ error: 'Valeur invalide' }); return; }
  if (!(await membership(id, userId))) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  await prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: id, userId } }, data: { isDirection: req.body.isDirection } });
  if (!req.body.isDirection) {
    // Plus dirigeant : il quitte les Cercles intégrés
    const integrated = await prisma.circleMember.findMany({ where: { userId, orgIntegrated: true, circle: { organisationId: id, creatorId: { not: userId } } }, select: { circleId: true } });
    for (const c of integrated) {
      await detachFromCircle(req.app, c.circleId, userId);
      req.app.get('io')?.to(`user:${userId}`).emit('circle-updated', { circleId: c.circleId });
    }
  }
  await syncOrganisation(req.app, id);
  res.json({ ok: true });
});

// GET /:id/people — personnes de l'Organisation : administrateurs seulement
router.get('/:id/people', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  const people = await prisma.organisationMember.findMany({
    where: { organisationId: req.params.id }, orderBy: { createdAt: 'asc' },
    select: { userId: true, isAdmin: true, isDirection: true, user: { select: { pseudo: true, firstName: true } } },
  });
  res.json(people);
});

// PUT /:id/roles/:roleId { name?, permissions? } — le tableau des droits : administrateurs seulement
router.put('/:id/roles/:roleId', async (req: AuthRequest, res) => {
  const { id, roleId } = req.params;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  const role = await prisma.organisationRole.findFirst({ where: { id: roleId, organisationId: id } });
  if (!role) { res.status(404).json({ error: 'Rôle invalide' }); return; }
  const name = req.body?.name === undefined ? role.name : cleanOrgName(req.body.name);
  if (!name) { res.status(400).json({ error: 'Rôle invalide' }); return; }
  const updated = await prisma.organisationRole.update({
    where: { id: roleId },
    data: { name, ...(req.body?.permissions !== undefined && { permissions: parseActions(req.body.permissions) }) },
  });
  res.json(updated);
});

// GET /:id/circles/:circleId/discussion — rôles réglables (membres) et rôles qui écrivent
router.get('/:id/circles/:circleId/discussion', async (req: AuthRequest, res) => {
  const { id, circleId } = req.params;
  const circle = await prisma.circle.findFirst({ where: { id: circleId, organisationId: id }, select: { orgDiscussionRoleIds: true } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (!(await prisma.circleMember.findUnique({ where: { userId_circleId: { userId: req.userId!, circleId } } }))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const roles = await prisma.organisationRole.findMany({ where: { organisationId: id, kind: 'member' }, orderBy: { position: 'asc' }, select: { id: true, name: true } });
  res.json({ roles, roleIds: circle.orgDiscussionRoleIds });
});

// PUT /:id/circles/:circleId/discussion { roleIds } — qui écrit dans la Discussion, Cercle par Cercle
router.put('/:id/circles/:circleId/discussion', async (req: AuthRequest, res) => {
  const { id, circleId } = req.params;
  const circle = await prisma.circle.findFirst({ where: { id: circleId, organisationId: id }, select: { id: true } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  const admin = (await membership(id, req.userId!))?.isAdmin;
  if (!admin && !(await isCircleManager(req.userId!, circleId))) { res.status(403).json({ error: 'Réservé au créateur et aux organisateurs du Cercle' }); return; }
  if (!Array.isArray(req.body?.roleIds) || req.body.roleIds.some((r: unknown) => typeof r !== 'string')) { res.status(400).json({ error: 'Rôle invalide' }); return; }
  const roles = await prisma.organisationRole.findMany({ where: { organisationId: id, id: { in: req.body.roleIds } }, select: { id: true } });
  await prisma.circle.update({ where: { id: circleId }, data: { orgDiscussionRoleIds: roles.map(r => r.id) } });
  req.app.get('io')?.to(`circle:${circleId}`).emit('circle-updated', { circleId });
  res.json({ ok: true });
});

// Après un changement d'ordre, les listes de Cercles se rechargent
async function refreshCircleLists(app: any, organisationId: string) {
  const circles = await prisma.circle.findMany({ where: { organisationId }, select: { id: true } });
  for (const { id } of circles) app.get('io')?.to(`circle:${id}`).emit('circle-updated', { circleId: id });
}

// PUT /:id/order { fixedOrder } — garder les Cercles dans l'ordre choisi : administrateurs seulement
router.put('/:id/order', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  if (typeof req.body?.fixedOrder !== 'boolean') { res.status(400).json({ error: 'Valeur invalide' }); return; }
  await prisma.organisation.update({ where: { id: req.params.id }, data: { fixedOrder: req.body.fixedOrder } });
  await refreshCircleLists(req.app, req.params.id);
  res.json({ ok: true });
});

// PUT /:id/circles-order { circleIds } — tous les Cercles de l'Organisation, dans le nouvel ordre : administrateurs seulement
router.put('/:id/circles-order', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  const raw = req.body?.circleIds;
  const circles = await prisma.circle.findMany({ where: { organisationId: id }, select: { id: true } });
  const known = new Set(circles.map(c => c.id));
  if (!Array.isArray(raw) || raw.length !== known.size || new Set(raw).size !== known.size || raw.some((x: unknown) => typeof x !== 'string' || !known.has(x))) { res.status(400).json({ error: 'Valeur invalide' }); return; }
  await prisma.$transaction((raw as string[]).map((circleId, index) => prisma.circle.update({ where: { id: circleId }, data: { orgPosition: index + 1 } })));
  await refreshCircleLists(req.app, id);
  res.json({ ok: true });
});

// GET /:id/audience — ce que la personne peut viser avec « Pour qui ? » (vide : la ligne n'apparaît pas)
router.get('/:id/audience', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (!(await membership(id, req.userId!))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const [organisation, circles, roles] = await Promise.all([
    prisma.organisation.findUnique({ where: { id }, select: { unitLabel: true, teamLabel: true } }),
    prisma.circle.findMany({ where: { organisationId: id }, orderBy: [{ orgPosition: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, color: true, orgKind: true } }),
    prisma.organisationRole.findMany({ where: { organisationId: id, kind: { not: 'direction' } }, orderBy: { position: 'asc' }, select: { id: true, name: true } }),
  ]);
  const action = req.query.action === 'send_announcement' ? 'send_announcement' : 'publish_multi';
  const allowed = [];
  for (const c of circles) if ((await orgPermissions(req.userId!, id, c.id)).has(action)) allowed.push(c);
  res.json({ ...organisation, circles: allowed, roles, total: circles.length });
});

// POST /:id/audience-count { circleIds, roleIds } — « N personnes recevront ce Plan »
router.post('/:id/audience-count', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  res.json({ count: await audienceCount(req.userId!, req.body) });
});

// POST /:id/plans { audience, …champs du Plan } — Plan créé avec « Pour qui ? »
router.post('/:id/plans', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const missing = missingPlanBasics(req.body);
  if (missing) { res.status(400).json({ error: missing }); return; }
  const target = await resolveAudience(req.app, req.userId!, req.params.id, req.body?.audience, 'create_plan');
  if ('error' in target) { res.status(target.status).json({ error: target.error }); return; }
  const result = await createPlanInCircle(req.app, target.primaryId, req.userId!, req.body, target);
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }
  res.json(result.plan);
});

// POST /:id/polls { audience, question, options } — sondage de dates créé avec « Pour qui ? »
router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const target = await resolveAudience(req.app, req.userId!, req.params.id, req.body?.audience, 'create_poll');
  if ('error' in target) { res.status(target.status).json({ error: target.error }); return; }
  await createCirclePoll(req, res, target.primaryId, target);
});

const announcementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req: any) => req.userId ?? 'anonyme',
  message: { error: 'Trop d’annonces envoyées, réessaie plus tard.' },
});

// POST /:id/announcements { content, circleIds } — un message dans la Discussion de chaque Cercle choisi
router.post('/:id/announcements', announcementLimiter, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  if (!(await membership(id, userId))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const text = cleanContent(req.body?.content, CIRCLE_CHAT_MAX);
  if (!text) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  const parsed = parseAudience({ circleIds: req.body?.circleIds });
  if (!parsed) { res.status(400).json({ error: 'Choisis au moins un Cercle' }); return; }
  const circles = await prisma.circle.findMany({ where: { id: { in: parsed.circleIds }, organisationId: id }, select: { id: true, name: true, chatMode: true } });
  if (circles.length !== parsed.circleIds.length) { res.status(400).json({ error: 'Choisis au moins un Cercle' }); return; }
  for (const c of circles) {
    if (!(await orgPermissions(userId, id, c.id)).has('send_announcement')) { res.status(403).json({ error: 'Tu ne peux pas envoyer d’annonce à tous ces Cercles' }); return; }
  }
  const targets = circles.filter(c => c.chatMode !== 'off');
  const skipped = circles.filter(c => c.chatMode === 'off').map(c => c.name);
  if (!targets.length) { res.status(400).json({ error: 'Aucun de ces Cercles n’a sa Discussion activée' }); return; }

  const announcementId = randomUUID();
  const io = req.app.get('io');
  const content = encryptMessage(text);
  for (const c of targets) {
    const message = plainCircleMessage(await prisma.circleMessage.create({ data: { circleId: c.id, authorId: userId, content, announcementId }, include: circleMessageInclude }));
    io?.to(`circle:${c.id}`).emit('circle-message', { circleId: c.id, message });
    io?.to(`circle:${c.id}`).emit('circle-updated', { circleId: c.id });
  }
  await prisma.circleMember.updateMany({ where: { userId, circleId: { in: targets.map(c => c.id) } }, data: { chatSeenAt: new Date() } });
  countMessageSent();
  res.json({ announcementId, sent: targets.length, skipped });

  // Une seule notification par personne, depuis le premier de ses Cercles qui n'est pas en silence
  try {
    const members = await prisma.circleMember.findMany({ where: { circleId: { in: targets.map(c => c.id) }, userId: { not: userId } }, select: { userId: true, circleId: true } });
    const done = new Set<string>();
    for (const c of targets) {
      const here = members.filter(m => m.circleId === c.id && !done.has(m.userId)).map(m => m.userId);
      const muted = await mutedAmong({ circleId: c.id }, here);
      for (const memberId of here) {
        if (muted.has(memberId)) continue;
        done.add(memberId);
        notifyUser(io, memberId, { type: 'circle_message', circleId: c.id, circleName: c.name, from: req.pseudo, actorId: userId, preview: `📣 ${text.slice(0, 78)}` });
      }
    }
  } catch (e) { console.error('[annonce notify]', e); }
});

// GET /:id/announcements — mes annonces encore visibles
router.get('/:id/announcements', async (req: AuthRequest, res) => {
  if (!(await membership(req.params.id, req.userId!))) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const rows = await prisma.circleMessage.findMany({
    where: { authorId: req.userId!, announcementId: { not: null }, deletedAt: null, createdAt: { gt: chatSince('org') }, circle: { organisationId: req.params.id } },
    orderBy: { createdAt: 'desc' }, select: { announcementId: true, content: true, createdAt: true, circle: { select: { name: true } } },
  });
  const groups = new Map<string, { announcementId: string; content: string; createdAt: Date; circles: string[] }>();
  for (const r of rows) {
    const group = groups.get(r.announcementId!) ?? { announcementId: r.announcementId!, content: decryptMessage(r.content), createdAt: r.createdAt, circles: [] };
    group.circles.push(r.circle.name);
    groups.set(r.announcementId!, group);
  }
  res.json([...groups.values()]);
});

// L'annonce appartient-elle à cette personne, dans cette Organisation ?
const ownsAnnouncement = async (organisationId: string, announcementId: string, userId: string) =>
  !!(await prisma.circleMessage.findFirst({ where: { announcementId, authorId: userId, circle: { organisationId } }, select: { id: true } }));

// PUT /:id/announcements/:announcementId { content } et DELETE : l'auteur, pour tous les Cercles
router.put('/:id/announcements/:announcementId', async (req: AuthRequest, res) => {
  if (!(await ownsAnnouncement(req.params.id, req.params.announcementId, req.userId!))) { res.status(404).json({ error: 'Message introuvable' }); return; }
  const text = cleanContent(req.body?.content, CIRCLE_CHAT_MAX);
  if (!text) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  await applyToAnnouncement(req.app.get('io'), req.params.announcementId, { content: text });
  res.json({ ok: true });
});

router.delete('/:id/announcements/:announcementId', async (req: AuthRequest, res) => {
  if (!(await ownsAnnouncement(req.params.id, req.params.announcementId, req.userId!))) { res.status(404).json({ error: 'Message introuvable' }); return; }
  await applyToAnnouncement(req.app.get('io'), req.params.announcementId, { deleted: true });
  res.json({ ok: true });
});

export default router;
