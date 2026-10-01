import { Router } from 'express';
import prisma from '../lib/prisma';
import { purgePlanFiles } from '../lib/cloudinary';
import { mintMediaToken } from '../lib/mediaToken';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { computeByCurrency, parseCurrency } from '../lib/expenses';
import { icsEscape, icsDate } from '../lib/ical';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { removeUserFromRides } from '../lib/rides';
import { getPlanAccess, visiblePlansWhere, guestIdsAmong, validateExclusions } from '../lib/planAccess';
import { parseDeletionMode, parseDisabledFeatures, parseEditMode, isFeatureDisabled, FEATURE_DISABLED_ERROR } from '../lib/settings';
import { broadcastWrites, resolvePlanWrite } from '../lib/realtime';
import crypto from 'crypto';
import { withPlainContent } from '../lib/messageCrypto';
import { isPlanSection, markAllSeen, markSectionSeen, unseenByPlan } from '../lib/planActivity';

const router = Router();
router.use(requireAuth as any);
router.use(broadcastWrites(resolvePlanWrite));

const MAX_PLAN_DURATION_MS = 21 * 24 * 60 * 60 * 1000; // 3 semaines

async function assertPlanMember(userId: string, planId: string): Promise<boolean> {
  const m = await prisma.planMember.findUnique({
    where: { userId_planId: { userId, planId } },
  });
  return !!m;
}

const planInclude = {
  creator: { select: { id: true, pseudo: true } },
  members: { include: { user: { select: { id: true, pseudo: true, firstName: true, lastName: true } } } },
  deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
  polls: { include: { options: { include: { votes: true } } }, orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { id: 'asc' as const } },
  changeLogs: { orderBy: { changedAt: 'asc' as const }, include: { changedBy: { select: { id: true, pseudo: true } } } },
  // Jamais l'URL Cloudinary : le client affiche via /api/attachments/:id/view + mediaToken
  attachments: {
    select: { id: true, name: true, mimeType: true, size: true, uploadedBy: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
  exclusions: { include: { user: { select: { id: true, pseudo: true } } } },
};

// Ajoute `isGuest` à chaque membre (invité externe = pas membre du Cercle)
async function withGuestFlags<T extends { circleId: string; members: { userId: string }[] }>(plan: T) {
  const guests = await guestIdsAmong(plan.circleId, plan.members.map(m => m.userId));
  return { ...plan, members: plan.members.map(m => ({ ...m, isGuest: guests.has(m.userId) })) };
}

function sameMinute(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000);
}

// Un sondage anonyme masque l'identité des votants (sauf la sienne propre)
function anonymizePoll(poll: any, userId: string) {
  if (!poll?.anonymous) return poll;
  return {
    ...poll,
    options: poll.options.map((o: any) => ({
      ...o,
      votes: o.votes.map((v: any, i: number) => (v.userId === userId ? v : { ...v, userId: `anon-${i}` })),
    })),
  };
}

function anonymizePlanPolls(plan: any, userId: string) {
  if (!plan?.polls) return plan;
  return { ...plan, polls: plan.polls.map((p: any) => anonymizePoll(p, userId)) };
}

// Get all plans visible to the user: plans of their circles (minus surprises
// they're excluded from) + plans they were invited to as an external guest
router.get('/', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const userId = req.userId!;
    const [plans, myCircles] = await Promise.all([prisma.plan.findMany({
      where: {
        archived: false,
        endDate: { gt: now },
        ...visiblePlansWhere(userId),
      },
      include: {
        creator: { select: { id: true, pseudo: true } },
        members: { include: { user: { select: { id: true, pseudo: true } } } },
        deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
        circle: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
    }), prisma.circleMember.findMany({ where: { userId }, select: { circleId: true } })]);

    // Un invité externe ne doit rien savoir du Cercle : on masque son nom
    const circleIds = new Set(myCircles.map(c => c.circleId));
    const unseen = await unseenByPlan(userId, plans.map(p => p.id));
    res.json(plans.map(p => {
      const withUnseen = { ...p, unseen: unseen.get(p.id) ?? [] };
      return circleIds.has(p.circleId) ? withUnseen : { ...withUnseen, circle: null, isGuest: true };
    }));
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get plan detail (full)
router.get('/:id', async (req: AuthRequest, res) => {
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!access || access.isExcluded) {
    res.status(404).json({ error: 'Plan introuvable' });
    return;
  }
  if (!access.canView) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: planInclude,
  });
  if (!plan) {
    res.status(404).json({ error: 'Plan introuvable' });
    return;
  }
  const withGuests = await withGuestFlags(plan);
  const unseen = await unseenByPlan(req.userId!, [plan.id]);
  res.json({
    ...anonymizePlanPolls(withGuests, req.userId!),
    // Onglets avec du nouveau depuis la dernière visite (pastilles)
    unseen: unseen.get(plan.id) ?? [],
    viewerIsGuest: access.isGuest,
    mediaToken: mintMediaToken(plan.id, req.userId!),
  });
});

// Onglet consulté : efface sa pastille « nouveau » (pas de diffusion, voir lib/realtime.ts)
router.post('/:id/seen', async (req: AuthRequest, res) => {
  const section = req.body?.section;
  if (!isPlanSection(section)) { res.status(400).json({ error: 'Onglet invalide' }); return; }
  await markSectionSeen(req.params.id, req.userId!, section);
  res.json({ ok: true });
});

// ─── Invités externes : lien d'invitation donnant accès à ce seul Plan ───────

function newGuestToken() {
  return crypto.randomBytes(18).toString('base64url');
}

const INVALID_INVITE = "Ce lien d'invitation n'est plus valide";

// POST /api/plans/:id/guest-link — obtenir le lien (tout membre du Plan)
router.post('/:id/guest-link', async (req: AuthRequest, res) => {
  try {
    const access = await getPlanAccess(req.userId!, req.params.id);
    if (!access || access.isExcluded) { res.status(404).json({ error: 'Plan introuvable' }); return; }
    if (!access.isPlanMember) { res.status(403).json({ error: 'Rejoins ce Plan pour pouvoir inviter' }); return; }
    const link = await prisma.planGuestLink.upsert({
      where: { planId: req.params.id },
      create: { planId: req.params.id, token: newGuestToken() },
      update: {},
    });
    res.json({ token: link.token });
  } catch (e) {
    console.error('[guest link]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/plans/:id/guest-link/reset — nouveau lien, l'ancien cesse de fonctionner (créateur uniquement)
router.post('/:id/guest-link/reset', async (req: AuthRequest, res) => {
  try {
    const access = await getPlanAccess(req.userId!, req.params.id);
    if (!access || access.isExcluded) { res.status(404).json({ error: 'Plan introuvable' }); return; }
    if (access.plan.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur' }); return; }
    const token = newGuestToken();
    await prisma.planGuestLink.upsert({
      where: { planId: req.params.id },
      create: { planId: req.params.id, token },
      update: { token, createdAt: new Date() },
    });
    res.json({ token });
  } catch (e) {
    console.error('[guest link reset]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

async function findActiveInvite(token: string) {
  const link = await prisma.planGuestLink.findUnique({
    where: { token },
    include: {
      plan: {
        select: {
          id: true, title: true, eventDate: true, endDate: true, maxParticipants: true,
          creator: { select: { pseudo: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });
  if (!link || link.plan.endDate <= new Date()) return null;
  return link.plan;
}

// GET /api/plans/guest-invite/:token — aperçu de l'invitation
router.get('/guest-invite/:token', async (req: AuthRequest, res) => {
  try {
    const plan = await findActiveInvite(req.params.token);
    const access = plan && await getPlanAccess(req.userId!, plan.id);
    if (!plan || !access || access.isExcluded) { res.status(404).json({ error: INVALID_INVITE }); return; }
    res.json({
      planId: plan.id,
      title: plan.title,
      eventDate: plan.eventDate,
      creatorPseudo: plan.creator.pseudo,
      alreadyMember: access.isPlanMember,
      full: plan.maxParticipants !== null && plan._count.members >= plan.maxParticipants,
    });
  } catch (e) {
    console.error('[guest invite preview]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/plans/guest-invite/:token/accept — rejoindre le Plan comme invité
router.post('/guest-invite/:token/accept', async (req: AuthRequest, res) => {
  try {
    const plan = await findActiveInvite(req.params.token);
    const access = plan && await getPlanAccess(req.userId!, plan.id);
    if (!plan || !access || access.isExcluded) { res.status(404).json({ error: INVALID_INVITE }); return; }
    if (access.isPlanMember) { res.json({ planId: plan.id }); return; }
    if (plan.maxParticipants !== null && plan._count.members >= plan.maxParticipants) {
      res.status(409).json({ error: 'Ce Plan est complet' }); return;
    }
    await prisma.planMember.create({ data: { userId: req.userId!, planId: plan.id, rsvp: 'in' } });
    await markAllSeen(plan.id, req.userId!);
    res.json({ planId: plan.id });
  } catch (e) {
    console.error('[guest invite accept]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update plan (creator only)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    // Créateur : tout. Paramètre « tous les participants » : les membres du Plan (hors invités
    // externes) modifient seulement les dates et le lieu ; le reste garde sa valeur actuelle.
    const isCreator = plan.creatorId === req.userId;
    if (!isCreator) {
      const member = plan.editMode === 'all' && await assertPlanMember(req.userId!, plan.id);
      const isGuest = member && (await guestIdsAmong(plan.circleId, [req.userId!])).has(req.userId!);
      if (!member || isGuest) { res.status(403).json({ error: 'Réservé au créateur' }); return; }
    }

    const { eventDate, endDate } = req.body;
    const title: string = isCreator ? req.body.title : plan.title;
    const description: string = isCreator ? req.body.description : plan.description;
    const maxParticipants = isCreator ? req.body.maxParticipants : plan.maxParticipants;
    const newLocation: string | null = req.body.location === undefined
      ? plan.location
      : (typeof req.body.location === 'string' && req.body.location.trim()) ? req.body.location.trim().slice(0, 200) : null;
    if (!title?.trim()) {
      res.status(400).json({ error: 'Titre requis' }); return;
    }
    const newDescription = description?.trim() || '';
    if (!endDate) {
      res.status(400).json({ error: 'Date de fin requise' }); return;
    }

    const newEventDate = eventDate ? new Date(eventDate) : null;
    const newEndDate = new Date(endDate);
    if (isNaN(newEndDate.getTime())) {
      res.status(400).json({ error: 'Date de fin invalide' }); return;
    }
    const planStart = newEventDate && !isNaN(newEventDate.getTime()) ? newEventDate : new Date();
    if (newEndDate.getTime() - planStart.getTime() > MAX_PLAN_DURATION_MS) {
      res.status(400).json({ error: 'Un Plan ne peut pas durer plus de 3 semaines' }); return;
    }
    let newMaxParticipants: number | null = null;
    if (maxParticipants !== undefined && maxParticipants !== null && maxParticipants !== '') {
      newMaxParticipants = parseInt(String(maxParticipants), 10);
      if (isNaN(newMaxParticipants) || newMaxParticipants < 1) {
        res.status(400).json({ error: 'Limite de participants invalide' }); return;
      }
      const currentCount = await prisma.planMember.count({ where: { planId: req.params.id } });
      if (newMaxParticipants < currentCount) {
        res.status(400).json({ error: `Il y a déjà ${currentCount} membre(s), la limite doit être au moins ${currentCount}` }); return;
      }
    }

    // Plan surprise : `excludedUserIds` absent = liste inchangée
    let exclusions: string[] | null = null;
    if (isCreator && req.body.excludedUserIds !== undefined) {
      const v = await validateExclusions(plan.circleId, plan.creatorId, req.body.excludedUserIds);
      if ('error' in v) { res.status(400).json({ error: v.error }); return; }
      exclusions = v.ids;
    }

    // Paramètres avancés (créateur seul) : absents = inchangés
    const settings = isCreator ? req.body : {};
    const deletionMode = settings.deletionMode === undefined ? plan.deletionMode : parseDeletionMode(settings.deletionMode);
    const disabledFeatures = settings.disabledFeatures === undefined ? plan.disabledFeatures : parseDisabledFeatures(settings.disabledFeatures);
    const editMode = settings.editMode === undefined ? plan.editMode : parseEditMode(settings.editMode);
    if (!deletionMode || !disabledFeatures || !editMode) { res.status(400).json({ error: 'Paramètres avancés invalides' }); return; }

    const logs: { planId: string; field: string; oldValue: string | null; newValue: string | null; changedById: string }[] = [];
    const changedById = req.userId!;
    const planId = req.params.id;

    if (title.trim() !== plan.title)
      logs.push({ planId, field: 'title', oldValue: plan.title, newValue: title.trim(), changedById });
    if (newDescription !== plan.description)
      logs.push({ planId, field: 'description', oldValue: plan.description, newValue: newDescription, changedById });
    if (!sameMinute(plan.eventDate, newEventDate))
      logs.push({ planId, field: 'eventDate', oldValue: plan.eventDate?.toISOString() ?? null, newValue: newEventDate?.toISOString() ?? null, changedById });
    if (!sameMinute(plan.endDate, newEndDate))
      logs.push({ planId, field: 'endDate', oldValue: plan.endDate.toISOString(), newValue: newEndDate.toISOString(), changedById });
    if (newLocation !== plan.location)
      logs.push({ planId, field: 'location', oldValue: plan.location, newValue: newLocation, changedById });

    await prisma.plan.update({
      where: { id: planId },
      data: { title: title.trim(), description: newDescription, eventDate: newEventDate, endDate: newEndDate, maxParticipants: newMaxParticipants, location: newLocation, deletionMode, disabledFeatures, editMode },
    });
    if (deletionMode === 'creator' && plan.deletionMode !== 'creator') {
      await prisma.planDeleteVote.deleteMany({ where: { planId } });
    }

    if (logs.length > 0) {
      await prisma.planChangeLog.createMany({ data: logs });
    }

    if (exclusions) {
      // Une personne nouvellement exclue qui avait rejoint le Plan en est retirée
      const removed = await prisma.planMember.findMany({
        where: { planId, userId: { in: exclusions } },
        include: { user: { select: { pseudo: true } } },
      });
      for (const m of removed) {
        await removeUserFromRides(req.app.get('io'), planId, m.userId, m.user.pseudo)
          .catch(e => console.error('[exclusion rides cleanup]', e));
      }
      await prisma.$transaction([
        prisma.planExclusion.deleteMany({ where: { planId } }),
        prisma.planExclusion.createMany({ data: exclusions.map(userId => ({ planId, userId })) }),
        prisma.planMember.deleteMany({ where: { planId, userId: { in: exclusions } } }),
        prisma.planDeleteVote.deleteMany({ where: { planId, userId: { in: exclusions } } }),
      ]);
    }

    const updated = await prisma.plan.findUnique({ where: { id: planId }, include: planInclude });
    res.json({
      ...anonymizePlanPolls(updated && await withGuestFlags(updated), req.userId!),
      mediaToken: mintMediaToken(planId, req.userId!),
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Join a plan
router.post('/:id/join', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  const access = await getPlanAccess(req.userId!, req.params.id);
  if (!plan || !access || access.isExcluded) {
    res.status(404).json({ error: 'Plan introuvable' });
    return;
  }
  // Les invités externes arrivent par le lien d'invitation, pas par ici
  if (!access.isCircleMember) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const existing = await prisma.planMember.findUnique({
    where: { userId_planId: { userId: req.userId!, planId: req.params.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'Tu es déjà dans ce Plan' });
    return;
  }
  if (plan.maxParticipants !== null) {
    const currentCount = await prisma.planMember.count({ where: { planId: req.params.id } });
    if (currentCount >= plan.maxParticipants) {
      res.status(409).json({ error: 'Ce Plan est complet' });
      return;
    }
  }
  await prisma.planMember.create({ data: { userId: req.userId!, planId: req.params.id, rsvp: 'in' } });
  // Ce qui existait avant l'arrivée n'est pas « nouveau » pour le nouveau participant
  await markAllSeen(req.params.id, req.userId!);
  const updatedPlan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      polls: { include: { options: { include: { votes: true } } } },
      items: true,
    },
  });
  res.json(anonymizePlanPolls(updatedPlan, req.userId!));

  // Premier membre (hors créateur) qui rejoint le Plan : prévient le créateur
  // par email — une seule fois, pas à chaque nouvelle personne qui rejoint.
  if (updatedPlan && updatedPlan.members.length === 2 && updatedPlan.creatorId !== req.userId) {
    try {
      const creator = await prisma.user.findUnique({
        where: { id: updatedPlan.creatorId },
        select: { email: true, emailVerified: true, pseudo: true },
      });
      const joiner = updatedPlan.members.find(m => m.userId === req.userId)?.user;
      if (creator?.email && creator.emailVerified && joiner) {
        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: creator.email,
          subject: `${joiner.pseudo} a rejoint "${updatedPlan.title}"`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2>Ça bouge, ${creator.pseudo} 👋</h2>
              <p><strong>${joiner.pseudo}</strong> vient de rejoindre ton Plan <strong>"${updatedPlan.title}"</strong>.</p>
              <a href="${APP_URL}/dashboard?planId=${updatedPlan.id}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Voir le Plan
              </a>
            </div>`,
        });
        if (result.error) console.error('[first_join email]', creator.email, result.error);
      }
    } catch (e) {
      console.error('[first_join notify]', e);
    }
  }
});

// Update RSVP
router.put('/:id/rsvp', async (req: AuthRequest, res) => {
  const { rsvp } = req.body;
  if (!['in', 'maybe', 'out'].includes(rsvp)) {
    res.status(400).json({ error: 'RSVP invalide' });
    return;
  }
  try {
    const member = await prisma.planMember.update({
      where: { userId_planId: { userId: req.userId!, planId: req.params.id } },
      data: { rsvp },
    });
    if (rsvp === 'out') {
      await removeUserFromRides(req.app.get('io'), req.params.id, req.userId!, req.pseudo!)
        .catch(e => console.error('[rsvp rides cleanup]', e));
    }
    res.json(member);
  } catch {
    res.status(404).json({ error: 'Tu n\'es pas membre de ce Plan' });
  }
});

// Get messages
const messageInclude = {
  author: { select: { id: true, pseudo: true } },
  reactions: { include: { user: { select: { id: true, pseudo: true } } } },
  _count: { select: { replies: true } },
};

router.get('/:id/messages', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const messages = await prisma.message.findMany({
    where: { planId: req.params.id, parentId: null },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(messages.map(withPlainContent));
});

// Fil de réponses d'un message
router.get('/messages/:messageId/replies', async (req: AuthRequest, res) => {
  const parent = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!parent) { res.status(404).json({ error: 'Message introuvable' }); return; }
  if (!(await assertPlanMember(req.userId!, parent.planId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const replies = await prisma.message.findMany({
    where: { parentId: req.params.messageId },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
  });
  res.json(replies.map(withPlainContent));
});

// Create poll
router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (await isFeatureDisabled(req.params.id, 'votes')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
  const { question, options, anonymous } = req.body;
  if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: 'Question et au moins 2 options requises' });
    return;
  }
  const poll = await prisma.poll.create({
    data: {
      question: question.trim(),
      anonymous: !!anonymous,
      planId: req.params.id,
      options: { create: (options as string[]).map((text) => ({ text: text.trim() })) },
    },
    include: { options: { include: { votes: true } } },
  });
  res.json(anonymizePoll(poll, req.userId!));
});

// Vote on a poll option
router.post('/polls/:optionId/vote', async (req: AuthRequest, res) => {
  const option = await prisma.pollOption.findUnique({
    where: { id: req.params.optionId },
    include: { poll: true },
  });
  if (!option) {
    res.status(404).json({ error: 'Option introuvable' });
    return;
  }
  if (!(await assertPlanMember(req.userId!, option.poll.planId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (await isFeatureDisabled(option.poll.planId, 'votes')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
  // Remove user's existing votes on this poll
  const siblings = await prisma.pollOption.findMany({ where: { pollId: option.pollId } });
  await prisma.pollVote.deleteMany({
    where: { userId: req.userId!, pollOptionId: { in: siblings.map((s) => s.id) } },
  });
  await prisma.pollVote.create({ data: { userId: req.userId!, pollOptionId: req.params.optionId } });
  const updatedPoll = await prisma.poll.findUnique({
    where: { id: option.pollId },
    include: { options: { include: { votes: true } } },
  });
  res.json(anonymizePoll(updatedPoll, req.userId!));
});

// Add bring item
router.post('/:id/items', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { label } = req.body;
  if (!label?.trim()) {
    res.status(400).json({ error: 'Label requis' });
    return;
  }
  const item = await prisma.bringItem.create({ data: { label: label.trim(), planId: req.params.id } });
  res.json(item);
});

// Claim / unclaim a bring item
router.put('/items/:itemId/claim', async (req: AuthRequest, res) => {
  const item = await prisma.bringItem.findUnique({ where: { id: req.params.itemId } });
  if (!item) {
    res.status(404).json({ error: 'Item introuvable' });
    return;
  }
  if (!(await assertPlanMember(req.userId!, item.planId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const updated = await prisma.bringItem.update({
    where: { id: req.params.itemId },
    data: { claimedBy: item.claimedBy === req.pseudo ? null : req.pseudo },
  });
  res.json(updated);
});

// Toggle vote de suppression — supprime le plan si le seuil est atteint
router.post('/:id/vote-delete', async (req: AuthRequest, res) => {
  const planId = req.params.id;
  const userId = req.userId!;

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { members: true, deleteVotes: true },
  });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

  const isMember = plan.members.some(m => m.userId === userId);
  if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

  if (plan.deletionMode === 'creator') {
    // Paramètre avancé : le créateur supprime seul, sans vote
    if (plan.creatorId !== userId) { res.status(403).json({ error: 'Seul le créateur peut supprimer ce Plan' }); return; }
    await purgePlanFiles([planId]);
    await prisma.plan.delete({ where: { id: planId } });
    res.json({ deleted: true });
    return;
  }

  const existingVote = plan.deleteVotes.find(v => v.userId === userId);

  if (existingVote) {
    await prisma.planDeleteVote.delete({ where: { userId_planId: { userId, planId } } });
  } else {
    await prisma.planDeleteVote.create({ data: { userId, planId } });
  }

  const updated = await prisma.plan.findUnique({
    where: { id: planId },
    include: { members: true, deleteVotes: true },
  });

  const voteCount = updated!.deleteVotes.length;
  const threshold = Math.ceil(updated!.members.length / 2);

  if (voteCount >= threshold) {
    await purgePlanFiles([planId]);
    await prisma.plan.delete({ where: { id: planId } });
    res.json({ deleted: true });
    return;
  }

  const full = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      polls: { include: { options: { include: { votes: true } } } },
      items: true,
    },
  });
  res.json({ deleted: false, plan: anonymizePlanPolls(full, userId) });
});

// ─── Dépenses ──────────────────────────────────────────────────────────────

router.get('/:id/expenses', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const [members, expenses, reimbursements] = await Promise.all([
    prisma.planMember.findMany({ where: { planId: req.params.id }, select: { userId: true, user: { select: { id: true, pseudo: true } } } }),
    prisma.expense.findMany({
      where: { planId: req.params.id },
      include: {
        paidBy: { select: { id: true, pseudo: true } },
        splitWith: { include: { user: { select: { id: true, pseudo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reimbursement.findMany({ where: { planId: req.params.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  // Comptes tenus séparément par devise (CHF, EUR), sans conversion
  const byCurrency = computeByCurrency(members.map(m => m.userId), expenses, reimbursements);
  const pseudoOf = (id: string) => members.find(m => m.userId === id)?.user.pseudo;
  const balances = members.map(m => ({
    userId: m.userId,
    pseudo: m.user.pseudo,
    amounts: byCurrency.map(c => ({ currency: c.currency, balance: Math.round((c.balance.get(m.userId) ?? 0) * 100) / 100 })),
  }));
  const suggestedTransfers = byCurrency.flatMap(c => c.transfers.map(t => ({
    ...t, currency: c.currency, fromPseudo: pseudoOf(t.fromUserId), toPseudo: pseudoOf(t.toUserId),
  })));
  // Devise proposée par défaut dans le formulaire : celle de la dernière dépense du Plan
  const defaultCurrency = expenses[0]?.currency ?? 'CHF';
  res.json({ defaultCurrency, expenses, reimbursements, balances, suggestedTransfers });
});

router.post('/:id/expenses', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (await isFeatureDisabled(req.params.id, 'depenses')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
  const { description, amount, splitWith } = req.body;
  const parsedAmount = parseFloat(amount);
  if (!description?.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Description et montant valides requis' });
    return;
  }
  const currency = req.body.currency === undefined ? 'CHF' : parseCurrency(req.body.currency);
  if (!currency) { res.status(400).json({ error: 'Devise invalide (CHF ou EUR)' }); return; }

  const planMembers = await prisma.planMember.findMany({ where: { planId: req.params.id }, select: { userId: true } });
  const memberIds = new Set(planMembers.map(m => m.userId));

  let participantIds: string[];
  if (Array.isArray(splitWith) && splitWith.length > 0) {
    participantIds = splitWith.filter((id: unknown) => typeof id === 'string' && memberIds.has(id));
    if (participantIds.length === 0) {
      res.status(400).json({ error: 'Sélectionne au moins un membre pour partager la dépense' });
      return;
    }
  } else {
    participantIds = [...memberIds];
  }

  const expense = await prisma.expense.create({
    data: {
      description: description.trim(),
      amount: parsedAmount,
      currency,
      planId: req.params.id,
      paidById: req.userId!,
      splitWith: { create: participantIds.map(userId => ({ userId })) },
    },
    include: {
      paidBy: { select: { id: true, pseudo: true } },
      splitWith: { include: { user: { select: { id: true, pseudo: true } } } },
    },
  });
  res.json(expense);
});

router.delete('/expenses/:expenseId', async (req: AuthRequest, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId }, include: { plan: true } });
  if (!expense) { res.status(404).json({ error: 'Dépense introuvable' }); return; }
  if (expense.paidById !== req.userId && expense.plan.creatorId !== req.userId) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  await prisma.expense.delete({ where: { id: req.params.expenseId } });
  res.json({ ok: true });
});

router.post('/:id/reimbursements', async (req: AuthRequest, res) => {
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (await isFeatureDisabled(req.params.id, 'depenses')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
  const { toUserId, amount } = req.body;
  const parsedAmount = parseFloat(amount);
  if (!toUserId || isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Destinataire et montant valides requis' });
    return;
  }
  const currency = req.body.currency === undefined ? 'CHF' : parseCurrency(req.body.currency);
  if (!currency) { res.status(400).json({ error: 'Devise invalide (CHF ou EUR)' }); return; }
  if (!(await assertPlanMember(toUserId, req.params.id))) {
    res.status(400).json({ error: 'Le destinataire doit être membre du Plan' });
    return;
  }
  const reimbursement = await prisma.reimbursement.create({
    data: { amount: parsedAmount, currency, planId: req.params.id, fromUserId: req.userId!, toUserId },
  });
  res.json(reimbursement);
});

// Export iCal (.ics) d'un Plan
router.get('/:id/ical', async (req: AuthRequest, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }
  if (!(await assertPlanMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const start = plan.eventDate ?? plan.endDate;
  const end = plan.eventDate ? new Date(plan.eventDate.getTime() + 2 * 60 * 60 * 1000) : plan.endDate;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EvLY//Plan//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${plan.id}@estelle.fan`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(plan.title)}`,
    `DESCRIPTION:${icsEscape(plan.description)}`,
    ...(plan.location ? [`LOCATION:${icsEscape(plan.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${plan.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
  res.send(ics);
});

export default router;
