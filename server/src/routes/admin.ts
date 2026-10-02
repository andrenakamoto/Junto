import { Router } from 'express';
import prisma from '../lib/prisma';
import { deleteUserAccount } from '../lib/accountDeletion';
import { sendPasswordReset } from '../lib/passwordReset';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { validatePseudo, isPseudoTaken } from '../lib/pseudo';
import { fillDays, TRACKED_PAGES, visitDay } from '../lib/pageVisits';
import { requestEmailChange } from '../lib/emailChange';
import { decryptMessage, withPlainContent } from '../lib/messageCrypto';
import { messageInclude } from '../lib/messageInclude';
import { destroyFiles } from '../lib/cloudinary';

const router = Router();
router.use(requireAuth as any);
router.use(requireAdmin as any);

const userSelect = {
  id: true, pseudo: true, firstName: true, lastName: true, status: true, isAdmin: true, createdAt: true,
  email: true, emailVerified: true, pendingEmail: true,
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

// Visites d'une page publique (?page=decouvrir|brochure — compteur anonyme, 30 derniers jours)
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
router.get('/stats', async (_req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Jours civils suisses : aujourd'hui compris, 7 jours au total
  const since7Days = new Date(visitDay().getTime() - 6 * 24 * 60 * 60 * 1000);
  const [pending, approved, rejected, totalCircles, activePlans, messagesAgg, activeUsersLast7Days, lightGuests] = await Promise.all([
    prisma.user.count({ where: { status: 'pending', isAdmin: false } }),
    prisma.user.count({ where: { status: 'approved', isAdmin: false, isLight: false } }),
    prisma.user.count({ where: { status: 'rejected' } }),
    prisma.circle.count(),
    prisma.plan.count({ where: { endDate: { gt: new Date() } } }),
    // Compteur quotidien anonyme (lib/activity.ts) : ne baisse pas quand un Plan est supprimé
    prisma.pageVisit.aggregate({ where: { page: 'messages', day: { gte: since7Days } }, _sum: { count: true } }),
    // Personnes ayant utilisé l'app ces 7 derniers jours (lastActiveAt, mis à jour au plus 1×/h)
    prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { isLight: true } }),
  ]);
  res.json({
    pending, approved, rejected,
    totalCircles, activePlans,
    messagesLast7Days: messagesAgg._sum.count ?? 0,
    activeUsersLast7Days,
    lightGuests,
  });
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
  const [plans, polls] = await Promise.all([
    prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, title: true, circle: { select: { name: true } } } }),
    prisma.circlePoll.findMany({ where: { id: { in: pollIds } }, select: { id: true, question: true, circle: { select: { name: true } } } }),
  ]);
  res.json(reports.map(r => {
    const plan = plans.find(p => p.id === r.planId);
    const poll = polls.find(p => p.id === r.pollId);
    return {
      id: r.id, kind: r.kind, messageId: r.messageId, createdAt: r.createdAt, reason: r.reason,
      content: decryptMessage(r.content),
      reporter: r.reporter.pseudo, author: r.author,
      where: plan ? `Plan « ${plan.title} » (${plan.circle.name})` : poll ? `Sondage « ${poll.question} » (${poll.circle.name})` : 'Plan ou sondage supprimé',
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

export default router;
