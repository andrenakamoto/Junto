import { Router } from 'express';
import { storageStats } from '../lib/storageStats';
import { circleMessageInclude } from '../lib/circleChat';
import { deletePhoto } from '../lib/photos';
import prisma from '../lib/prisma';
import { PLAN_KINDS, PLAN_KIND_LABELS } from '../lib/planKinds';
import { deleteUserAccount } from '../lib/accountDeletion';
import { sendPasswordReset } from '../lib/passwordReset';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { validatePseudo, isPseudoTaken } from '../lib/pseudo';
import { fillDays, TRACKED_PAGES, visitDay } from '../lib/pageVisits';
import { requestEmailChange } from '../lib/emailChange';
import { decryptMessage, withPlainContent } from '../lib/messageCrypto';
import { messageInclude } from '../lib/messageInclude';
import { destroyFiles } from '../lib/storage';

import { notifyUser } from '../lib/push';
import { isSuggestionStatus, NOTIFIED_STATUSES, SUGGESTION_REPLY_MAX } from '../lib/suggestions';

import { FUNNEL_STEPS, SOURCES, SOURCE_LABELS } from '../lib/funnel';
const router = Router();
router.use(requireAuth as any);
router.use(requireAdmin as any);

const userSelect = {
  id: true, pseudo: true, firstName: true, lastName: true, status: true, isAdmin: true, createdAt: true,
  email: true, emailVerified: true, pendingEmail: true, canPublishDiscover: true,
  _count: { select: { createdCircles: true } },
};

// List users (filter by ?status=pending|approved|rejected, or all)
router.get('/users', async (req: AuthRequest, res) => {
  const { status } = req.query;
  const users = await prisma.user.findMany({
    // Réponses sans compte (lib/lightGuest.ts) : pas des comptes, comptées à part dans /stats
    where: { isLight: false, ...(status ? { status: status as string } : {}) },
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// PUT /users/:id/discover { allowed } — autoriser un compte à publier ses Plans dans Découvrir
router.put('/users/:id/discover', async (req: AuthRequest, res) => {
  if (typeof req.body?.allowed !== 'boolean') { res.status(400).json({ error: 'Valeur invalide' }); return; }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { canPublishDiscover: req.body.allowed }, select: userSelect }).catch(() => null);
  if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
  // Autorisation retirée : ses annonces publiées depuis ses Plans disparaissent
  if (!req.body.allowed) await prisma.discoverEvent.deleteMany({ where: { createdById: user.id, planId: { not: null } } });
  res.json(user);
});

// Change a user's pseudo (peut cibler n'importe quel compte, y compris celui de l'admin connecté)
router.put('/users/:id/pseudo', async (req: AuthRequest, res) => {
  const pseudo = req.body?.pseudo?.trim();
  const pseudoError = validatePseudo(pseudo);
  if (pseudoError) { res.status(400).json({ error: pseudoError }); return; }
  try {
    if (await isPseudoTaken(pseudo, req.params.id)) {
      res.status(409).json({ error: 'Ce pseudo est déjà pris' }); return;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { pseudo },
      select: userSelect,
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Approve a user
router.put('/users/:id/approve', async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'approved' },
    select: userSelect,
  });
  res.json(user);
});

// Reject a user and remove them from all circles and plans
router.put('/users/:id/reject', async (req: AuthRequest, res) => {
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'rejected' },
      select: userSelect,
    }),
    prisma.circleMember.deleteMany({ where: { userId: req.params.id } }),
    prisma.planMember.deleteMany({ where: { userId: req.params.id } }),
  ]);
  res.json(user);
});

// Envoie au membre un lien pour choisir lui-même un nouveau mot de passe.
// (L'admin ne fixe plus de mot de passe connu : l'ancien reset mettait « 123 ».)
router.put('/users/:id/reset-password', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, pseudo: true, email: true } });
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
    if (!user.email) { res.status(400).json({ error: "Ce compte n'a pas d'email : impossible d'envoyer un lien" }); return; }
    const sent = await sendPasswordReset({ id: user.id, pseudo: user.pseudo, email: user.email }, true);
    if (!sent) { res.status(502).json({ error: "L'email n'a pas pu être envoyé" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Secours : l'admin propose une nouvelle adresse pour un compte (la personne n'a plus accès
// à l'ancienne). Un lien de confirmation part à la nouvelle adresse : rien ne change sans clic.
router.put('/users/:id/email', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, pseudo: true, firstName: true, email: true } });
    if (!user) { res.status(404).json({ error: 'Utilisateur introuvable' }); return; }
    const result = await requestEmailChange(user, req.body?.email, true);
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete a user permanently
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    // Cercles et Plans créés par l'utilisateur transférés à d'autres membres, pas effacés
    await deleteUserAccount(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[delete user]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Visites d'une page publique (?page=decouvrir|brochure|brochure-pro — compteur anonyme, 30 derniers jours)
// GET /api/admin/funnel — parcours d'inscription (lib/funnel.ts) : totaux par étape
router.get('/funnel', async (_req, res) => {
  const today = visitDay();
  const since7 = new Date(today.getTime() - 6 * 864e5);
  const since30 = new Date(today.getTime() - 29 * 864e5);
  const pages = FUNNEL_STEPS.map(s => s.page);
  const rows = await prisma.pageVisit.findMany({ where: { page: { in: [...pages] } } });
  res.json(FUNNEL_STEPS.map(s => {
    const mine = rows.filter(r => r.page === s.page);
    const sum = (from?: Date) => mine.filter(r => !from || r.day >= from).reduce((n, r) => n + r.count, 0);
    return { page: s.page, label: s.label, last7: sum(since7), last30: sum(since30), total: sum() };
  }));
});

// GET /admin/sources — provenance des visiteurs (lib/funnel.ts) : visites et inscriptions par source
router.get('/sources', async (_req, res) => {
  const since30 = new Date(visitDay().getTime() - 29 * 864e5);
  const rows = await prisma.pageVisit.findMany({ where: { page: { startsWith: 'src_' } } });
  const sum = (page: string, from?: Date) => rows.filter(r => r.page === page && (!from || r.day >= from)).reduce((n, r) => n + r.count, 0);
  res.json(SOURCES.map(s => ({
    source: s, label: SOURCE_LABELS[s],
    visits30: sum(`src_${s}`, since30), visits: sum(`src_${s}`),
    signups30: sum(`src_${s}_signup`, since30), signups: sum(`src_${s}_signup`),
  })));
});

// GET /admin/plan-kinds — Plans créés par type (« Plan standard » ou « Plan spécifique ») : 30 jours, total, en cours
router.get('/plan-kinds', async (_req, res) => {
  const since30 = new Date(visitDay().getTime() - 29 * 864e5);
  const keys = ['standard', ...PLAN_KINDS] as const;
  const [rows, active] = await Promise.all([
    prisma.pageVisit.findMany({ where: { page: { in: keys.map(k => `plankind_${k}`) } } }),
    prisma.plan.groupBy({ by: ['kind'], where: { endDate: { gt: new Date() } }, _count: { _all: true } }),
  ]);
  res.json(keys.map(k => {
    const mine = rows.filter(r => r.page === `plankind_${k}`);
    return {
      kind: k, label: PLAN_KIND_LABELS[k],
      last30: mine.filter(r => r.day >= since30).reduce((n, r) => n + r.count, 0),
      total: mine.reduce((n, r) => n + r.count, 0),
      active: active.find(a => (a.kind ?? 'standard') === k)?._count._all ?? 0,
    };
  }));
});

router.get('/page-visits', async (req, res) => {
  const page = (TRACKED_PAGES as readonly string[]).includes(String(req.query.page)) ? String(req.query.page) : 'decouvrir';
  const today = visitDay();
  const since = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const [rows, total] = await Promise.all([
    prisma.pageVisit.findMany({ where: { page, day: { gte: since } } }),
    prisma.pageVisit.aggregate({ where: { page }, _sum: { count: true } }),
  ]);
  const days = fillDays(rows, 30, today);
  const sum = (list: { count: number }[]) => list.reduce((n, d) => n + d.count, 0);
  res.json({ days, last7: sum(days.slice(-7)), last30: sum(days), total: total._sum.count ?? 0 });
});

// Stats summary
// GET /api/admin/storage — espace utilisé (base, fichiers, sauvegardes) et disque libre (lib/storageStats.ts)
router.get('/storage', async (_req, res) => {
  try { res.json(await storageStats()); } catch (e) { console.error('[storage stats]', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/stats', async (_req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Jours civils suisses : aujourd'hui compris, 7 jours au total
  const since7Days = new Date(visitDay().getTime() - 6 * 24 * 60 * 60 * 1000);
  const [pending, approved, rejected, totalCircles, activePlans, messagesAgg, activeUsersLast7Days, lightGuests, newUsersLast7Days] = await Promise.all([
    prisma.user.count({ where: { status: 'pending', isAdmin: false } }),
    prisma.user.count({ where: { status: 'approved', isAdmin: false, isLight: false } }),
    prisma.user.count({ where: { status: 'rejected' } }),
    // Sans les Cercles personnels « Mes Plans » (Plans express)
    prisma.circle.count({ where: { isPersonal: false } }),
    prisma.plan.count({ where: { endDate: { gt: new Date() } } }),
    // Compteur quotidien anonyme (lib/activity.ts) : ne baisse pas quand un Plan est supprimé
    prisma.pageVisit.aggregate({ where: { page: 'messages', day: { gte: since7Days } }, _sum: { count: true } }),
    // Personnes ayant utilisé l'app ces 7 derniers jours (lastActiveAt, mis à jour au plus 1×/h)
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { isLight: true } }),
    // Inscriptions des 7 derniers jours (comptes, sans les réponses sans compte)
    prisma.user.count({ where: { isLight: false, isAdmin: false, createdAt: { gte: sevenDaysAgo } } }),
  ]);
  res.json({
    pending, approved, rejected,
    totalCircles, activePlans,
    messagesLast7Days: messagesAgg._sum.count ?? 0,
    activeUsersLast7Days,
    lightGuests,
    newUsersLast7Days,
  });
});

// ─── Suggestions (lib/suggestions.ts) ─────────────────────────────────────────

// GET /api/admin/suggestions — toutes, les plus récentes d'abord
router.get('/suggestions', async (_req, res) => {
  const list = await prisma.suggestion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { pseudo: true, firstName: true } } },
  });
  res.json(list);
});

// PUT /api/admin/suggestions/:id { status?, reply? } — passer en « Prévu » ou « Réalisé »
// prévient la personne
router.put('/suggestions/:id', async (req: AuthRequest, res) => {
  const current = await prisma.suggestion.findUnique({ where: { id: req.params.id } });
  if (!current) { res.status(404).json({ error: 'Suggestion introuvable' }); return; }
  const status = req.body?.status === undefined ? current.status : req.body.status;
  if (!isSuggestionStatus(status)) { res.status(400).json({ error: 'Statut invalide' }); return; }
  const reply = req.body?.reply === undefined ? current.reply
    : (typeof req.body.reply === 'string' && req.body.reply.trim()) ? req.body.reply.trim().slice(0, SUGGESTION_REPLY_MAX) : null;
  const updated = await prisma.suggestion.update({ where: { id: current.id }, data: { status, reply } });
  if (status !== current.status && NOTIFIED_STATUSES.includes(status)) {
    notifyUser(req.app.get('io'), current.userId, { type: 'suggestion_update', suggestionId: current.id, status });
  }
  res.json(updated);
});

// ─── Signalements (lib/moderation.ts) ─────────────────────────────────────────

// GET /api/admin/reports — signalements en attente, avec le texte signalé
router.get('/reports', async (_req, res) => {
  const reports = await prisma.messageReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: { pseudo: true } },
      author: { select: { id: true, pseudo: true, firstName: true, lastName: true } },
    },
  });
  const planIds = reports.map(r => r.planId).filter((x): x is string => !!x);
  const pollIds = reports.map(r => r.pollId).filter((x): x is string => !!x);
  const circleMsgIds = reports.filter(r => r.kind === 'circle').map(r => r.messageId);
  const [plans, polls, circleMsgs] = await Promise.all([
    prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, title: true, circle: { select: { name: true } } } }),
    prisma.circlePoll.findMany({ where: { id: { in: pollIds } }, select: { id: true, question: true, circle: { select: { name: true } } } }),
    prisma.circleMessage.findMany({ where: { id: { in: circleMsgIds } }, select: { id: true, circle: { select: { name: true } } } }),
  ]);
  res.json(reports.map(r => {
    const plan = plans.find(p => p.id === r.planId);
    const poll = polls.find(p => p.id === r.pollId);
    const circleMsg = r.kind === 'circle' ? circleMsgs.find(m => m.id === r.messageId) : undefined;
    return {
      id: r.id, kind: r.kind, messageId: r.messageId, createdAt: r.createdAt, reason: r.reason,
      content: decryptMessage(r.content),
      reporter: r.reporter.pseudo, author: r.author,
      where: plan ? `Plan « ${plan.title} » (${plan.circle.name})` : poll ? `Sondage « ${poll.question} » (${poll.circle.name})` : circleMsg ? `Discussion du Cercle « ${circleMsg.circle.name} »` : r.kind === 'circle' ? 'Message déjà effacé (7 jours)' : 'Plan ou sondage supprimé',
    };
  }));
});

// POST /api/admin/reports/:id/resolve { action: 'delete' | 'dismiss' } — tous les signalements
// du même message sont traités ensemble, et la copie du texte est effacée
router.post('/reports/:id/resolve', async (req: AuthRequest, res) => {
  const action = req.body?.action;
  if (action !== 'delete' && action !== 'dismiss') { res.status(400).json({ error: 'Action invalide' }); return; }
  const report = await prisma.messageReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Signalement introuvable' }); return; }
  if (action === 'delete') {
    const now = new Date();
    if (report.kind === 'plan') {
      // Photo jointe au message : supprimée aussi
      const original = await prisma.message.findUnique({ where: { id: report.messageId }, include: { attachment: true } });
      if (original?.attachment) {
        await destroyFiles([original.attachment]).catch(e => console.error('[report photo delete]', e));
        await prisma.attachment.delete({ where: { id: original.attachment.id } }).catch(() => {});
      }
      const updated = await prisma.message.updateMany({ where: { id: report.messageId }, data: { content: '', deletedAt: now } });
      if (updated.count && report.planId) {
        const message = await prisma.message.findUnique({
          where: { id: report.messageId },
          include: messageInclude,
        });
        if (message) req.app.get('io')?.to(`plan:${report.planId}`).emit('message-updated', withPlainContent(message));
      }
    } else if (report.kind === 'circle') {
      const original = await prisma.circleMessage.findUnique({ where: { id: report.messageId } });
      if (original) {
        await deletePhoto(original.imageKey).catch(() => {});
        const updated = await prisma.circleMessage.update({ where: { id: original.id }, data: { content: '', imageKey: null, deletedAt: now }, include: circleMessageInclude });
        req.app.get('io')?.to(`circle:${original.circleId}`).emit('circle-message-updated', { circleId: original.circleId, message: withPlainContent(updated) });
      }
    } else {
      await prisma.circlePollMessage.updateMany({ where: { id: report.messageId }, data: { content: '', deletedAt: now } });
    }
  }
  await prisma.messageReport.updateMany({
    where: { kind: report.kind, messageId: report.messageId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolution: action === 'delete' ? 'deleted' : 'dismissed', content: '' },
  });
  res.json({ ok: true });
});

// ─── Signalements de photos (profil, Cercle — lib/photos.ts) ───────────────────

// GET /api/admin/photo-reports — en attente, regroupés par photo
router.get('/photo-reports', async (_req, res) => {
  const reports = await prisma.photoReport.findMany({
    where: { resolvedAt: null }, orderBy: { createdAt: 'desc' },
    include: { reporter: { select: { pseudo: true } } },
  });
  const userIds = reports.filter(r => r.kind === 'user').map(r => r.targetId);
  const circleIds = reports.filter(r => r.kind === 'circle').map(r => r.targetId);
  const [users, circles] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, pseudo: true, firstName: true, lastName: true, avatarKey: true } }),
    prisma.circle.findMany({ where: { id: { in: circleIds } }, select: { id: true, name: true, photoKey: true } }),
  ]);
  res.json(reports.map(r => {
    const u = users.find(x => x.id === r.targetId);
    const c = circles.find(x => x.id === r.targetId);
    const current = r.kind === 'user' ? u?.avatarKey : c?.photoKey;
    return {
      id: r.id, kind: r.kind, createdAt: r.createdAt, reason: r.reason, reporter: r.reporter.pseudo, photoKey: r.photoKey,
      // La photo a pu changer depuis : on ne montre (et ne retire) que celle qui a été signalée
      stillOnline: current === r.photoKey,
      target: r.kind === 'user' ? (u ? `@${u.pseudo}${u.firstName ? ` (${[u.firstName, u.lastName].filter(Boolean).join(' ')})` : ''}` : 'Compte supprimé') : (c ? `Cercle « ${c.name} »` : 'Cercle supprimé'),
    };
  }));
});

// POST /api/admin/photo-reports/:id/resolve { action: 'remove' | 'dismiss' } — tous les signalements de la même photo
router.post('/photo-reports/:id/resolve', async (req: AuthRequest, res) => {
  const action = req.body?.action;
  if (action !== 'remove' && action !== 'dismiss') { res.status(400).json({ error: 'Action invalide' }); return; }
  const report = await prisma.photoReport.findUnique({ where: { id: req.params.id } });
  if (!report) { res.status(404).json({ error: 'Signalement introuvable' }); return; }
  if (action === 'remove') {
    if (report.kind === 'user') {
      const n = await prisma.user.updateMany({ where: { id: report.targetId, avatarKey: report.photoKey }, data: { avatarKey: null } });
      if (n.count) await deletePhoto(report.photoKey);
    } else {
      const n = await prisma.circle.updateMany({ where: { id: report.targetId, photoKey: report.photoKey }, data: { photoKey: null } });
      if (n.count) {
        await deletePhoto(report.photoKey);
        req.app.get('io')?.to(`circle:${report.targetId}`).emit('circle-updated', { circleId: report.targetId });
      }
    }
  }
  await prisma.photoReport.updateMany({
    where: { kind: report.kind, targetId: report.targetId, photoKey: report.photoKey, resolvedAt: null },
    data: { resolvedAt: new Date(), resolution: action === 'remove' ? 'removed' : 'dismissed' },
  });
  res.json({ ok: true });
});

export default router;
