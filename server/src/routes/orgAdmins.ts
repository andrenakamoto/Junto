import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { notifyUser } from '../lib/push';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { mail } from '../lib/emailText';
import { parseLocale } from '../lib/i18n';
import { detachFromCircle } from '../lib/circleDetach';
import { syncOrganisation } from '../lib/orgSync';
import { activeRemovals, canVoteOnRemoval, eligibleVoterIds, logAdmin, orgAdmins, removalThreshold, removeFromOrganisation, settleRemoval } from '../lib/orgAdmins';

// Administrateurs et départs d'une Organisation (lib/orgAdmins.ts, 2026-11-20). Monté sur /api/organisations.
const router = Router();
router.use(requireAuth as any);

const membership = (organisationId: string, userId: string) =>
  prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId, userId } } });
const nameOf = (u: { pseudo: string; firstName: string | null } | null | undefined) => (u ? (u.firstName ? `${u.firstName} (@${u.pseudo})` : `@${u.pseudo}`) : '');
const people = async (ids: string[]) => {
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, pseudo: true, firstName: true } });
  return new Map(users.map(u => [u.id, u]));
};
const orgName = async (id: string) => (await prisma.organisation.findUnique({ where: { id }, select: { name: true } }))?.name ?? '';

// Notification dans l'app + push (type org_admin : titre = Organisation, texte traduit par i18n/notifications.ts). Sans actorId :
// une question de sécurité arrive même si la personne a masqué l'auteur.
function notify(req: AuthRequest, userId: string, organisationName: string, preview: string) {
  notifyUser(req.app.get('io'), userId, { type: 'org_admin', circleName: organisationName, preview }, { ignoreMute: true });
}

// Email aux personnes concernées (adresse vérifiée), quel que soit le canal choisi : c'est une question de sécurité
async function sendAdminEmail(userIds: string[], key: 'named' | 'removal', vars: Record<string, string>, organisationId: string) {
  const users = await prisma.user.findMany({ where: { id: { in: userIds }, emailVerified: true, email: { not: null } }, select: { email: true, pseudo: true, firstName: true, locale: true } });
  for (const u of users) {
    try {
      const m = mail(parseLocale(u.locale) ?? 'fr');
      const r = await resend.emails.send({
        from: FROM_EMAIL, to: u.email!,
        subject: m.s(`orgAdmin.${key}Subject`, vars),
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
          <p>${m.t('orgAdmin.hello', { name: u.firstName || u.pseudo })}</p>
          <p>${m.t(`orgAdmin.${key}Text`, vars)}</p>
          <p>${m.t(`orgAdmin.${key}Hint`, vars)}</p>
          <p style="margin-top:24px"><a href="${APP_URL}/dashboard?cockpit=${encodeURIComponent(organisationId)}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${m.t('orgAdmin.button')}</a></p>
          <p style="color:#64748b;font-size:13px">${m.t('orgAdmin.help')}</p></div>`,
      });
      if (r.error) console.error('[org admin email]', r.error);
    } catch (e) { console.error('[org admin email]', e); }
  }
}

// GET /:id/admins — administrateurs, demandes de retrait en cours et historique (administrateurs seulement)
router.get('/:id/admins', async (req: AuthRequest, res) => {
  const id = req.params.id;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  const [admins, removals, log] = await Promise.all([
    orgAdmins(id), activeRemovals(id),
    prisma.organisationAdminLog.findMany({ where: { organisationId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const names = await people([...admins.map(a => a.userId), ...removals.flatMap(r => [r.targetId, r.requestedById]), ...log.flatMap(l => [l.actorId, l.targetId].filter((x): x is string => !!x))]);
  const now = new Date();
  const rows = [];
  for (const r of removals) {
    const eligible = await eligibleVoterIds(id, r.targetId, now);
    rows.push({ id: r.id, targetId: r.targetId, target: nameOf(names.get(r.targetId)), requestedBy: nameOf(names.get(r.requestedById)), createdAt: r.createdAt,
      votes: r.votes.filter(v => eligible.includes(v.userId)).length, threshold: removalThreshold(eligible.length), myVote: r.votes.some(v => v.userId === req.userId),
      canVote: eligible.includes(req.userId!) });
  }
  res.json({
    admins: admins.map(a => ({ userId: a.userId, name: nameOf(names.get(a.userId)), adminSince: a.adminSince, canVote: canVoteOnRemoval(a.adminSince, now) })),
    removals: rows,
    log: log.map(l => ({ id: l.id, action: l.action, actor: l.actorId ? nameOf(names.get(l.actorId)) || null : 'EvLY', target: l.targetId ? nameOf(names.get(l.targetId)) || null : null, createdAt: l.createdAt })),
  });
});

// PUT /:id/members/:userId/admin — nommer un administrateur (un administrateur, seul) ; les autres sont prévenus
router.put('/:id/members/:userId/admin', async (req: AuthRequest, res) => {
  const { id, userId } = req.params;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  if (req.body?.isAdmin !== true) { res.status(400).json({ error: 'Valeur invalide' }); return; }
  const target = await membership(id, userId);
  if (!target) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  if (target.isAdmin) { res.json({ ok: true }); return; }
  await prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: id, userId } }, data: { isAdmin: true, adminSince: new Date() } });
  await logAdmin(id, 'named', req.userId!, userId);
  const [name, names, others] = await Promise.all([orgName(id), people([req.userId!, userId]), orgAdmins(id)]);
  const who = nameOf(names.get(req.userId!)), target2 = nameOf(names.get(userId));
  notify(req, userId, name, 'Tu es maintenant administrateur de l’Organisation');
  const toWarn = others.map(a => a.userId).filter(u => u !== userId && u !== req.userId);
  for (const u of toWarn) notify(req, u, name, `{0} a nommé {1} administrateur`.replace('{0}', who).replace('{1}', target2));
  sendAdminEmail(toWarn, 'named', { who, target: target2, org: name }, id).catch(() => {});
  res.json({ ok: true });
});

// POST /:id/admin/step-down — ne plus être administrateur soi-même (jamais le dernier)
router.post('/:id/admin/step-down', async (req: AuthRequest, res) => {
  const id = req.params.id;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Tu n’es pas administrateur de cette Organisation' }); return; }
  if ((await orgAdmins(id)).length < 2) { res.status(409).json({ error: 'Tu es le dernier administrateur : nomme d’abord quelqu’un d’autre' }); return; }
  await prisma.$transaction([
    prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: id, userId: req.userId! } }, data: { isAdmin: false, adminSince: null } }),
    prisma.organisationAdminRemoval.deleteMany({ where: { organisationId: id, targetId: req.userId! } }),
  ]);
  await logAdmin(id, 'stepped_down', req.userId!, req.userId!);
  res.json({ ok: true });
});

// POST /:id/admins/:userId/removal — demander le retrait d'un autre administrateur (la voix de la personne qui demande compte)
router.post('/:id/admins/:userId/removal', async (req: AuthRequest, res) => {
  const { id, userId } = req.params;
  const me = await membership(id, req.userId!);
  if (!me?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  if (userId === req.userId) { res.status(400).json({ error: 'Pour ne plus être administrateur, utilise « Ne plus être administrateur »' }); return; }
  if (!(await membership(id, userId))?.isAdmin) { res.status(404).json({ error: 'Cette personne n’est pas administrateur' }); return; }
  if (!canVoteOnRemoval(me.adminSince)) { res.status(403).json({ error: 'Tu pourras voter sur un retrait 7 jours après ta nomination' }); return; }
  const eligible = await eligibleVoterIds(id, userId);
  if (removalThreshold(eligible.length) === null) {
    res.status(409).json({ error: 'Il faut au moins 2 autres administrateurs, nommés depuis 7 jours, pour retirer un administrateur. En cas de blocage, écris à info@evly.ch.' });
    return;
  }
  await activeRemovals(id); // efface une ancienne demande expirée
  const existing = await prisma.organisationAdminRemoval.findUnique({ where: { organisationId_targetId: { organisationId: id, targetId: userId } } });
  const removal = existing ?? await prisma.organisationAdminRemoval.create({ data: { organisationId: id, targetId: userId, requestedById: req.userId! } });
  await prisma.organisationAdminRemovalVote.upsert({ where: { removalId_userId: { removalId: removal.id, userId: req.userId! } }, create: { removalId: removal.id, userId: req.userId! }, update: {} });
  if (!existing) {
    await logAdmin(id, 'removal_requested', req.userId!, userId);
    const [name, names] = await Promise.all([orgName(id), people([req.userId!, userId])]);
    const who = nameOf(names.get(req.userId!)), target = nameOf(names.get(userId));
    notify(req, userId, name, `{0} demande ton retrait comme administrateur`.replace('{0}', who));
    for (const u of eligible.filter(x => x !== req.userId)) notify(req, u, name, `{0} demande le retrait de {1} comme administrateur`.replace('{0}', who).replace('{1}', target));
    sendAdminEmail([userId], 'removal', { who, org: name }, id).catch(() => {});
  }
  const removed = await settleRemoval(removal.id);
  if (removed) notify(req, userId, await orgName(id), 'Tu n’es plus administrateur de l’Organisation');
  res.json({ ok: true, removed });
});

// POST /:id/admin-removals/:removalId/vote { vote } — voter (ou retirer sa voix) ; sans plus aucune voix, la demande disparaît
router.post('/:id/admin-removals/:removalId/vote', async (req: AuthRequest, res) => {
  const { id, removalId } = req.params;
  if (typeof req.body?.vote !== 'boolean') { res.status(400).json({ error: 'Valeur invalide' }); return; }
  const removal = (await activeRemovals(id)).find(r => r.id === removalId);
  if (!removal) { res.status(404).json({ error: 'Demande introuvable' }); return; }
  if (!(await eligibleVoterIds(id, removal.targetId)).includes(req.userId!)) { res.status(403).json({ error: 'Tu ne peux pas voter sur cette demande' }); return; }
  if (req.body.vote) {
    await prisma.organisationAdminRemovalVote.upsert({ where: { removalId_userId: { removalId, userId: req.userId! } }, create: { removalId, userId: req.userId! }, update: {} });
  } else {
    await prisma.organisationAdminRemovalVote.deleteMany({ where: { removalId, userId: req.userId! } });
    if (!(await prisma.organisationAdminRemovalVote.count({ where: { removalId } }))) await prisma.organisationAdminRemoval.delete({ where: { id: removalId } });
    res.json({ ok: true, removed: false });
    return;
  }
  const removed = await settleRemoval(removalId);
  if (removed) notify(req, removal.targetId, await orgName(id), 'Tu n’es plus administrateur de l’Organisation');
  res.json({ ok: true, removed });
});

// POST /:id/direction/leave — quitter la direction soi-même (et les Cercles intégrés), sans passer par un administrateur
router.post('/:id/direction/leave', async (req: AuthRequest, res) => {
  const id = req.params.id, userId = req.userId!;
  if (!(await membership(id, userId))?.isDirection) { res.status(400).json({ error: 'Tu ne fais pas partie de la direction' }); return; }
  await prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: id, userId } }, data: { isDirection: false } });
  const integrated = await prisma.circleMember.findMany({ where: { userId, orgIntegrated: true, circle: { organisationId: id, creatorId: { not: userId } } }, select: { circleId: true } });
  for (const c of integrated) {
    await detachFromCircle(req.app, c.circleId, userId);
    req.app.get('io')?.to(`user:${userId}`).emit('circle-updated', { circleId: c.circleId });
  }
  await syncOrganisation(req.app, id);
  res.json({ ok: true });
});

// DELETE /:id/members/:userId — retirer quelqu'un de l'Organisation (administrateurs ; jamais un administrateur : vote d'abord)
router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  const { id, userId } = req.params;
  if (!(await membership(id, req.userId!))?.isAdmin) { res.status(403).json({ error: 'Réservé aux administrateurs de l’Organisation' }); return; }
  if (userId === req.userId) { res.status(400).json({ error: 'Pour partir toi-même, utilise « Quitter l’Organisation »' }); return; }
  const target = await membership(id, userId);
  if (!target) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  if (target.isAdmin) { res.status(409).json({ error: 'Un administrateur ne peut pas être retiré ainsi : demande d’abord son retrait comme administrateur' }); return; }
  await removeFromOrganisation(req.app, id, userId);
  await logAdmin(id, 'member_removed', req.userId!, userId);
  res.json({ ok: true });
});

// POST /:id/leave — quitter l'Organisation soi-même (le dernier administrateur doit d'abord en nommer un autre)
router.post('/:id/leave', async (req: AuthRequest, res) => {
  const id = req.params.id, userId = req.userId!;
  const me = await membership(id, userId);
  if (!me) { res.status(404).json({ error: 'Tu ne fais pas partie de cette Organisation' }); return; }
  if (me.isAdmin && (await orgAdmins(id)).length < 2) { res.status(409).json({ error: 'Tu es le dernier administrateur : nomme d’abord quelqu’un d’autre' }); return; }
  if (me.isAdmin) await logAdmin(id, 'stepped_down', userId, userId);
  await removeFromOrganisation(req.app, id, userId);
  await logAdmin(id, 'left', userId, userId);
  res.json({ ok: true });
});

export default router;
