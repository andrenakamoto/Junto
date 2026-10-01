import { Router } from 'express';
import prisma from '../lib/prisma';
import { purgeCircleFiles } from '../lib/cloudinary';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { resend, FROM_EMAIL, APP_URL, notificationFooter } from '../lib/mailer';
import { validateExclusions } from '../lib/planAccess';
import { isCircleManager, nextCircleCreator, ORGANIZER_ROLE } from '../lib/circleRoles';
import { broadcastWrites, resolveCircleWrite, joinCircleRoom, leaveCircleRoom } from '../lib/realtime';
import { parseAdmissionMode, parseDeletionMode, parseDisabledFeatures, parseEditMode, parsePlanCreationMode, parsePollCreationMode, PLAN_CREATION_RESERVED_ERROR, POLL_CREATION_RESERVED_ERROR } from '../lib/settings';
import { encryptMessage, withPlainContent } from '../lib/messageCrypto';
import { checkMessageEdit, cleanContent } from '../lib/messageEdit';
import { isPastOption, pollExpiresAt, withExpiry } from '../lib/pollExpiry';
import { countMessageSent } from '../lib/activity';
import { sortCircles } from '../lib/planOrder';
import { unseenByPlan } from '../lib/planActivity';
import { notifyUser } from '../lib/push';
import { wantsEmail } from '../lib/notificationPrefs';

const router = Router();
router.use(requireAuth as any);
router.use(broadcastWrites(resolveCircleWrite));

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const circleInclude = {
  members: { include: { user: { select: { id: true, pseudo: true, firstName: true, lastName: true } } } },
  creator: { select: { id: true, pseudo: true } },
  deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
  joinRequests: {
    include: {
      user: { select: { id: true, pseudo: true } },
      votes: { select: { userId: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

// List circles of current user
router.get('/', async (req: AuthRequest, res) => {
  const now = new Date();
  const circles = await prisma.circle.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      ...circleInclude,
      _count: { select: { plans: { where: { exclusions: { none: { userId: req.userId } } } } } },
      plans: {
        where: { archived: false, endDate: { gt: now }, exclusions: { none: { userId: req.userId } } },
        // Prochain Plan : même ordre que la liste des Plans (lib/planOrder.ts)
        orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
        take: 1,
        select: { id: true, title: true, eventDate: true, endDate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  // Pastille « nouveau » du Cercle : un de ses Plans (dont je suis participant) a un onglet non vu
  const myPlans = await prisma.planMember.findMany({
    where: {
      userId: req.userId!,
      plan: { circleId: { in: circles.map(c => c.id) }, archived: false, endDate: { gt: now }, exclusions: { none: { userId: req.userId } } },
    },
    select: { planId: true, plan: { select: { circleId: true } } },
  });
  const unseen = await unseenByPlan(req.userId!, myPlans.map(m => m.planId));
  const circlesWithNews = new Set(myPlans.filter(m => (unseen.get(m.planId)?.length ?? 0) > 0).map(m => m.plan.circleId));
  // Le Cercle dont le prochain Plan est le plus proche en premier
  res.json(sortCircles(circles).map(c => ({ ...c, hasUnseen: circlesWithNews.has(c.id) })));
});

const CIRCLE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];
const MAX_CIRCLES_PER_USER = 20;
const MAX_PLAN_DURATION_MS = 21 * 24 * 60 * 60 * 1000; // 3 semaines

// Create a circle
router.post('/', async (req: AuthRequest, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nom requis' });
    return;
  }
  const createdCount = await prisma.circle.count({ where: { creatorId: req.userId! } });
  if (createdCount >= MAX_CIRCLES_PER_USER) {
    res.status(400).json({ error: `Tu as atteint la limite de ${MAX_CIRCLES_PER_USER} Cercles créés.` });
    return;
  }
  let code = generateCode();
  while (await prisma.circle.findUnique({ where: { code } })) {
    code = generateCode();
  }
  const circle = await prisma.circle.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: CIRCLE_COLORS.includes(color) ? color : null,
      deletionMode: parseDeletionMode(req.body.deletionMode) ?? 'vote',
      planCreationMode: parsePlanCreationMode(req.body.planCreationMode) ?? 'all',
      pollCreationMode: parsePollCreationMode(req.body.pollCreationMode) ?? 'all',
      admissionMode: parseAdmissionMode(req.body.admissionMode) ?? 'vote',
      code,
      creatorId: req.userId!,
      members: { create: { userId: req.userId!, role: 'admin' } },
    },
    include: circleInclude,
  });
  joinCircleRoom(req.app.get('io'), req.userId!, circle.id);
  res.json(circle);
});

// Changer la couleur du thème d'un Cercle (créateur uniquement)
router.put('/:id/color', async (req: AuthRequest, res) => {
  const { color } = req.body;
  if (color !== null && !CIRCLE_COLORS.includes(color)) {
    res.status(400).json({ error: 'Couleur invalide' });
    return;
  }
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (!(await isCircleManager(req.userId!, circle.id))) { res.status(403).json({ error: 'Réservé au créateur et aux organisateurs' }); return; }
  const updated = await prisma.circle.update({
    where: { id: req.params.id },
    data: { color },
    include: circleInclude,
  });
  res.json(updated);
});

// Accepte une demande d'adhésion : ajoute le membre, supprime la demande, prévient l'intéressé.
async function acceptJoinRequest(app: any, request: { id: string; userId: string }, circleId: string, reason: string) {
  await prisma.$transaction([
    prisma.circleJoinRequest.delete({ where: { id: request.id } }),
    prisma.circleMember.create({ data: { userId: request.userId, circleId } }),
  ]);
  joinCircleRoom(app.get('io'), request.userId, circleId);

  const updatedCircle = await prisma.circle.findUnique({ where: { id: circleId }, include: circleInclude });

  try {
    const io = app.get('io');
    if (io && updatedCircle) {
      notifyUser(io, request.userId, {
        type: 'join_accepted',
        circleId,
        circleName: updatedCircle.name,
      });
    }
    const approvedUser = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { email: true, emailVerified: true, pseudo: true, notificationChannel: true },
    });
    if (updatedCircle && approvedUser?.email && approvedUser.emailVerified && wantsEmail(approvedUser.notificationChannel)) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: approvedUser.email,
        subject: `Tu as rejoint "${updatedCircle.name}" !`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Bienvenue dans "${updatedCircle.name}" ${approvedUser.pseudo} 🎉</h2>
            <p>${reason}</p>
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Ouvrir EvLY
            </a>
          ${notificationFooter()}
          </div>`,
      }).then(r => { if (r.error) console.error('[join_accepted email]', approvedUser.email, r.error); });
    }
  } catch (e) {
    console.error('[join_accepted notify]', e);
  }
  return updatedCircle;
}

// Paramètres du Cercle (description comprise) — modifiables par le créateur et les organisateurs, visibles par tous
router.put('/:id/settings', async (req: AuthRequest, res) => {
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (!(await isCircleManager(req.userId!, circle.id))) { res.status(403).json({ error: 'Réservé au créateur et aux organisateurs' }); return; }
  const deletionMode = req.body.deletionMode === undefined ? undefined : parseDeletionMode(req.body.deletionMode);
  const admissionMode = req.body.admissionMode === undefined ? undefined : parseAdmissionMode(req.body.admissionMode);
  if (deletionMode === undefined && req.body.deletionMode !== undefined) { res.status(400).json({ error: 'Mode de suppression invalide' }); return; }
  if (admissionMode === undefined && req.body.admissionMode !== undefined) { res.status(400).json({ error: "Mode d'admission invalide" }); return; }
  const planCreationMode = req.body.planCreationMode === undefined ? undefined : parsePlanCreationMode(req.body.planCreationMode);
  if (planCreationMode === undefined && req.body.planCreationMode !== undefined) { res.status(400).json({ error: 'Mode de création des Plans invalide' }); return; }
  const pollCreationMode = req.body.pollCreationMode === undefined ? undefined : parsePollCreationMode(req.body.pollCreationMode);
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) : undefined;
  if (pollCreationMode === undefined && req.body.pollCreationMode !== undefined) { res.status(400).json({ error: 'Mode de création des sondages invalide' }); return; }
  // La suppression du Cercle reste l'affaire du créateur : les organisateurs ne changent pas sa règle
  if (deletionMode && deletionMode !== circle.deletionMode && circle.creatorId !== req.userId) {
    res.status(403).json({ error: 'Seul le créateur peut changer la règle de suppression du Cercle' });
    return;
  }

  await prisma.circle.update({
    where: { id: circle.id },
    data: { ...(deletionMode && { deletionMode }), ...(admissionMode && { admissionMode }), ...(planCreationMode && { planCreationMode }), ...(pollCreationMode && { pollCreationMode }), ...(description !== undefined && { description: description || null }) },
  });
  // Les votes de suppression en cours n'ont plus de sens si c'est le créateur qui décide
  if (deletionMode === 'creator') await prisma.circleDeleteVote.deleteMany({ where: { circleId: circle.id } });
  // Passage en entrée libre : les demandes en attente sont acceptées
  if (admissionMode === 'open') {
    const pending = await prisma.circleJoinRequest.findMany({ where: { circleId: circle.id } });
    for (const r of pending) {
      await acceptJoinRequest(req.app, r, circle.id, 'Le Cercle est désormais ouvert à toute personne qui a le code.');
    }
  }
  const updated = await prisma.circle.findUnique({ where: { id: circle.id }, include: circleInclude });
  res.json(updated);
});

// Nommer / retirer un organisateur — réservé au créateur du Cercle
router.put('/:id/members/:userId/role', async (req: AuthRequest, res) => {
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (circle.creatorId !== req.userId) { res.status(403).json({ error: 'Seul le créateur nomme les organisateurs' }); return; }
  const { role } = req.body;
  if (role !== ORGANIZER_ROLE && role !== 'member') { res.status(400).json({ error: 'Rôle invalide' }); return; }
  if (req.params.userId === circle.creatorId) { res.status(400).json({ error: 'Le créateur garde son rôle' }); return; }
  const member = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId: req.params.userId, circleId: circle.id } } });
  if (!member) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  await prisma.circleMember.update({ where: { userId_circleId: { userId: member.userId, circleId: circle.id } }, data: { role } });
  const updated = await prisma.circle.findUnique({ where: { id: circle.id }, include: circleInclude });
  res.json(updated);
});

// Demander à rejoindre un cercle — nécessite l'approbation d'au moins la
// moitié des membres actuels (même principe que la suppression d'un Cercle/Plan)
router.post('/join', async (req: AuthRequest, res) => {
  const { name, code } = req.body;
  if (!name?.trim() || !code?.trim()) {
    res.status(400).json({ error: 'Nom et code requis' });
    return;
  }
  const circle = await prisma.circle.findFirst({
    where: { name: name.trim(), code: code.trim().toUpperCase() },
  });
  if (!circle) {
    res.status(404).json({ error: 'Cercle introuvable. Vérifie le nom et le code.' });
    return;
  }
  const existing = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: circle.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'Tu es déjà dans ce Cercle' });
    return;
  }
  if (circle.admissionMode === 'open') {
    // Entrée libre : le nom + le code suffisent
    await prisma.circleJoinRequest.deleteMany({ where: { circleId: circle.id, userId: req.userId! } });
    await prisma.circleMember.create({ data: { userId: req.userId!, circleId: circle.id } });
    joinCircleRoom(req.app.get('io'), req.userId!, circle.id);
    const joined = await prisma.circle.findUnique({ where: { id: circle.id }, include: circleInclude });
    res.json({ pending: false, circle: joined, circleName: circle.name });
    return;
  }
  const existingRequest = await prisma.circleJoinRequest.findUnique({
    where: { circleId_userId: { circleId: circle.id, userId: req.userId! } },
  });
  if (existingRequest) {
    res.json({ pending: true, circleName: circle.name, admissionMode: circle.admissionMode });
    return;
  }

  const requester = await prisma.user.findUnique({ where: { id: req.userId! }, select: { pseudo: true } });
  await prisma.circleJoinRequest.create({ data: { circleId: circle.id, userId: req.userId! } });
  res.json({ pending: true, circleName: circle.name, admissionMode: circle.admissionMode });

  // Notifier les membres actuels (ou le créateur seul s'il valide seul) — temps réel + email
  const byCreator = circle.admissionMode === 'creator';
  try {
    const io = req.app.get('io');
    const members = await prisma.circleMember.findMany({
      where: { circleId: circle.id, ...(byCreator && { OR: [{ userId: circle.creatorId }, { role: ORGANIZER_ROLE }] }) },
      select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true, notificationChannel: true } } },
    });
    if (io) {
      for (const m of members) {
        notifyUser(io, m.userId, {
          type: 'join_request',
          circleId: circle.id,
          circleName: circle.name,
          from: requester?.pseudo,
        });
      }
    }
    const recipients = members.filter(m => m.user.email && m.user.emailVerified && wantsEmail(m.user.notificationChannel));
    await Promise.all(recipients.map(m => resend.emails.send({
      from: FROM_EMAIL,
      to: m.user.email!,
      subject: `${requester?.pseudo} veut rejoindre "${circle.name}"`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Salut ${m.user.pseudo} 👋</h2>
          <p><strong>${requester?.pseudo}</strong> a demandé à rejoindre le Cercle <strong>"${circle.name}"</strong>.</p>
          <p>${byCreator ? 'Dans ce Cercle, les demandes sont validées par le créateur et les organisateurs, dont tu fais partie.' : 'La majorité des membres doit valider la demande pour qu\'elle soit acceptée.'}</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Voir la demande
          </a>
        ${notificationFooter()}
          </div>`,
    }).then(r => { if (r.error) console.error('[join_request email]', m.user.email, r.error); })
      .catch(e => console.error('[join_request email]', m.user.email, e))));
  } catch (e) {
    console.error('[join_request notify]', e);
  }
});

// Voter pour accepter une demande — accepte le membre si le seuil est atteint
router.post('/:id/join-requests/:requestId/vote', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const request = await prisma.circleJoinRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.circleId !== circleId) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const circleSettings = await prisma.circle.findUnique({ where: { id: circleId }, select: { creatorId: true, admissionMode: true } });
  if (circleSettings?.admissionMode !== 'vote') {
    // Validation par le créateur ou un organisateur (ou entrée libre : demande restée d'avant le changement)
    if (!(await isCircleManager(userId, circleId))) {
      res.status(403).json({ error: 'Seuls le créateur et les organisateurs du Cercle valident les demandes' });
      return;
    }
    const updatedCircle = await acceptJoinRequest(req.app, request, circleId, 'Ta demande a été validée par les organisateurs du Cercle.');
    res.json({ accepted: true, circle: updatedCircle });
    return;
  }

  const existingVote = await prisma.circleJoinVote.findUnique({
    where: { requestId_userId: { requestId: request.id, userId } },
  });
  if (existingVote) {
    await prisma.circleJoinVote.delete({ where: { requestId_userId: { requestId: request.id, userId } } });
  } else {
    await prisma.circleJoinVote.create({ data: { requestId: request.id, userId } });
  }

  const [memberCount, voteCount] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.circleJoinVote.count({ where: { requestId: request.id } }),
  ]);
  const threshold = Math.ceil(memberCount / 2);

  if (voteCount >= threshold) {
    const updatedCircle = await acceptJoinRequest(req.app, request, circleId, 'Les membres du Cercle ont validé ta demande.');
    res.json({ accepted: true, circle: updatedCircle });
    return;
  }

  const updatedCircle = await prisma.circle.findUnique({ where: { id: circleId }, include: circleInclude });
  res.json({ accepted: false, circle: updatedCircle, votes: voteCount, threshold });
});

// Get circle details
// Refuser une demande — uniquement quand le Cercle est en validation par le créateur.
// En mode vote, aucun refus unilatéral : seule la majorité fait foi.
router.delete('/:id/join-requests/:requestId', async (req: AuthRequest, res) => {
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  if (circle.admissionMode === 'vote' || !(await isCircleManager(req.userId!, circle.id))) {
    res.status(403).json({ error: 'Seuls le créateur et les organisateurs peuvent refuser une demande, hors mode vote' });
    return;
  }
  const request = await prisma.circleJoinRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request || request.circleId !== circle.id) { res.status(404).json({ error: 'Demande introuvable' }); return; }
  await prisma.circleJoinRequest.delete({ where: { id: request.id } });
  const updated = await prisma.circle.findUnique({ where: { id: circle.id }, include: circleInclude });
  res.json(updated);
});

router.get('/:id', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const circle = await prisma.circle.findUnique({ where: { id: req.params.id }, include: circleInclude });
  res.json(circle);
});

// List plans for a circle
router.get('/:id/plans', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const plans = await prisma.plan.findMany({
    where: { circleId: req.params.id, archived: false, endDate: { gt: new Date() }, exclusions: { none: { userId: req.userId! } } },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      deleteVotes: { include: { user: { select: { id: true, pseudo: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ eventDate: { sort: 'asc', nulls: 'last' } }, { endDate: 'asc' }],
  });
  const unseen = await unseenByPlan(req.userId!, plans.map(p => p.id));
  res.json(plans.map(p => ({ ...p, unseen: unseen.get(p.id) ?? [] })));
});

// Paramètres avancés : création des Plans, et des sondages de dates, réservée au créateur et aux organisateurs
async function canCreatePlans(userId: string, circleId: string): Promise<boolean> {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { planCreationMode: true } });
  return !!circle && (circle.planCreationMode !== 'creator' || await isCircleManager(userId, circleId));
}

async function canCreatePolls(userId: string, circleId: string): Promise<boolean> {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { pollCreationMode: true } });
  return !!circle && (circle.pollCreationMode !== 'creator' || await isCircleManager(userId, circleId));
}

// Create a plan in a circle
interface NewPlanInput {
  title: string;
  description: string;
  eventDate?: string | null;
  endDate: string;
  location?: string | null;
  maxParticipants?: string | number | null;
  excludedUserIds?: unknown;
  deletionMode?: unknown;
  disabledFeatures?: unknown;
  editMode?: unknown;
}

// Crée un Plan dans un Cercle et notifie les membres (temps réel + email).
// Partagé entre POST /:id/plans et la conversion d'un CirclePoll en Plan.
async function createPlanInCircle(app: any, circleId: string, creatorId: string, input: NewPlanInput) {
  const { title, description, eventDate, endDate, location, maxParticipants } = input;
  if (!title?.trim()) return { error: 'Titre requis' as const };
  if (!endDate) return { error: 'Date de fin obligatoire' as const };
  const parsedEndDate = new Date(endDate);
  if (isNaN(parsedEndDate.getTime()) || parsedEndDate <= new Date()) {
    return { error: 'La date de fin doit être dans le futur' as const };
  }
  const parsedEventDate = eventDate ? new Date(eventDate) : null;
  const planStart = parsedEventDate && !isNaN(parsedEventDate.getTime()) ? parsedEventDate : new Date();
  if (parsedEndDate.getTime() - planStart.getTime() > MAX_PLAN_DURATION_MS) {
    return { error: 'Un Plan ne peut pas durer plus de 3 semaines' as const };
  }
  let parsedMaxParticipants: number | null = null;
  if (maxParticipants !== undefined && maxParticipants !== null && maxParticipants !== '') {
    parsedMaxParticipants = parseInt(String(maxParticipants), 10);
    if (isNaN(parsedMaxParticipants) || parsedMaxParticipants < 1) {
      return { error: 'Limite de participants invalide' as const };
    }
  }
  const excl = await validateExclusions(circleId, creatorId, input.excludedUserIds);
  if ('error' in excl) return { error: excl.error };
  const exclusions = excl.ids;

  const plan = await prisma.plan.create({
    data: {
      title: title.trim(),
      description: description?.trim() || '',
      eventDate: parsedEventDate,
      endDate: parsedEndDate,
      location: location?.trim() || null,
      maxParticipants: parsedMaxParticipants,
      deletionMode: parseDeletionMode(input.deletionMode) ?? 'vote',
      disabledFeatures: parseDisabledFeatures(input.disabledFeatures) ?? [],
      editMode: parseEditMode(input.editMode) ?? 'creator',
      creatorId,
      circleId,
      members: { create: { userId: creatorId, rsvp: 'in' } },
      exclusions: { create: exclusions.map(userId => ({ userId })) },
    },
    include: {
      creator: { select: { id: true, pseudo: true } },
      members: { include: { user: { select: { id: true, pseudo: true } } } },
      exclusions: { include: { user: { select: { id: true, pseudo: true } } } },
      _count: { select: { messages: true } },
    },
  });

  notifyNewPlan(app, circleId, plan).catch(e => console.error('[new_plan notify]', e));

  return { plan };
}

// Notifier les membres du cercle (sauf le créateur) — temps réel + email
async function notifyNewPlan(app: any, circleId: string, plan: any) {
  const io = app.get('io');
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: {
      name: true,
      members: { select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true, notificationChannel: true } } } },
    },
  });
  if (!circle) return;
  const excluded = new Set((plan.exclusions ?? []).map((e: { userId: string }) => e.userId));
  const otherMembers = circle.members.filter(m => m.userId !== plan.creatorId && !excluded.has(m.userId));

  if (io) {
    for (const m of otherMembers) {
      notifyUser(io, m.userId, {
        type: 'new_plan',
        planId: plan.id,
        planTitle: plan.title,
        circleId,
        circleName: circle.name,
        from: plan.creator.pseudo,
      });
    }
  }

  const recipients = otherMembers.filter((m: any) => m.user.email && m.user.emailVerified && wantsEmail(m.user.notificationChannel));
  await Promise.all(recipients.map((m: any) => resend.emails.send({
    from: FROM_EMAIL,
    to: m.user.email!,
    subject: `Nouveau Plan dans "${circle.name}" — ${plan.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Salut ${m.user.pseudo} 👋</h2>
        <p><strong>${plan.creator.pseudo}</strong> a créé un nouveau Plan dans le Cercle <strong>"${circle.name}"</strong> :</p>
        <p style="font-size:16px;font-weight:600;margin:16px 0">${plan.title}</p>
        <a href="${APP_URL}/dashboard?planId=${plan.id}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Voir le Plan
        </a>
      ${notificationFooter()}
          </div>`,
  }).then(r => { if (r.error) console.error('[new_plan email]', m.user.email, r.error); })
    .catch(e => console.error('[new_plan email]', m.user.email, e))));
}

router.post('/:id/plans', async (req: AuthRequest, res) => {
  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: req.userId!, circleId: req.params.id } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (!(await canCreatePlans(req.userId!, req.params.id))) { res.status(403).json({ error: PLAN_CREATION_RESERVED_ERROR }); return; }
  const result = await createPlanInCircle(req.app, req.params.id, req.userId!, req.body);
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }
  res.json(result.plan);
});

// Toggle delete vote — deletes circle if threshold reached
router.post('/:id/vote-delete', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const target = await prisma.circle.findUnique({ where: { id: circleId }, select: { creatorId: true, deletionMode: true } });
  if (target?.deletionMode === 'creator') {
    // Paramètre avancé : le créateur supprime seul, sans vote
    if (target.creatorId !== userId) {
      res.status(403).json({ error: 'Seul le créateur peut supprimer ce Cercle' });
      return;
    }
    await purgeCircleFiles(circleId);
    await prisma.circle.delete({ where: { id: circleId } });
    res.json({ deleted: true });
    return;
  }

  const existing = await prisma.circleDeleteVote.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });

  if (existing) {
    await prisma.circleDeleteVote.delete({ where: { userId_circleId: { userId, circleId } } });
  } else {
    await prisma.circleDeleteVote.create({ data: { userId, circleId } });
  }

  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: circleInclude,
  });
  if (!circle) { res.json({ deleted: true }); return; }

  const threshold = Math.ceil(circle.members.length / 2);
  const voteCount = circle.deleteVotes.length;

  if (voteCount >= threshold) {
    await purgeCircleFiles(circleId);
    await prisma.circle.delete({ where: { id: circleId } });
    res.json({ deleted: true });
    return;
  }

  res.json({ deleted: false, circle, votes: voteCount, threshold });
});

// Quitter un Cercle de son plein gré. Si le créateur part et qu'il reste
// d'autres membres, le rôle de créateur passe au membre le plus ancien.
// Si le créateur part et qu'il était seul, le Cercle est supprimé.
router.post('/:id/leave', async (req: AuthRequest, res) => {
  const circleId = req.params.id;
  const userId = req.userId!;

  const member = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });
  if (!member) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const circle = await prisma.circle.findUnique({ where: { id: circleId } });
  if (!circle) { res.status(404).json({ error: 'Cercle introuvable' }); return; }
  leaveCircleRoom(req.app.get('io'), userId, circleId);

  if (circle.creatorId === userId) {
    const nextMember = await nextCircleCreator(circleId, userId);

    if (!nextMember) {
      await purgeCircleFiles(circleId);
      await prisma.circle.delete({ where: { id: circleId } });
      res.json({ left: true, circleDeleted: true });
      return;
    }

    await prisma.$transaction([
      prisma.circle.update({ where: { id: circleId }, data: { creatorId: nextMember.userId } }),
      prisma.circleMember.update({
        where: { userId_circleId: { userId: nextMember.userId, circleId } },
        data: { role: 'admin' },
      }),
      prisma.circleDeleteVote.deleteMany({ where: { userId, circleId } }),
      prisma.planMember.deleteMany({ where: { userId, plan: { circleId } } }),
      prisma.circleMember.delete({ where: { userId_circleId: { userId, circleId } } }),
    ]);
    res.json({ left: true, circleDeleted: false });
    return;
  }

  await prisma.$transaction([
    prisma.circleDeleteVote.deleteMany({ where: { userId, circleId } }),
    prisma.planMember.deleteMany({ where: { userId, plan: { circleId } } }),
    prisma.circleMember.delete({ where: { userId_circleId: { userId, circleId } } }),
  ]);
  res.json({ left: true, circleDeleted: false });
});

// ─── Sondages de Cercle (caler une date avant de créer un Plan) ───────────
// Contrairement aux sondages d'un Plan (choix unique), le vote y est
// multiple : chaque membre coche toutes les options qui lui conviennent.

const circlePollInclude = {
  creator: { select: { id: true, pseudo: true } },
  options: {
    include: { votes: { include: { user: { select: { id: true, pseudo: true } } } } },
  },
  exclusions: { include: { user: { select: { id: true, pseudo: true } } } },
  declines: { include: { user: { select: { id: true, pseudo: true } } }, orderBy: { createdAt: 'asc' as const } },
  _count: { select: { messages: true } },
};

async function assertCircleMember(userId: string, circleId: string): Promise<boolean> {
  const m = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId } } });
  return !!m;
}

// Un sondage est visible par les membres du Cercle, sauf ceux à qui il est caché (surprise).
// Pour un exclu, le sondage n'existe pas : 404, comme un Plan surprise.
type VisiblePoll =
  | { status: number; error: string }
  | { poll: { id: string; circleId: string; resolvedAt: Date | null; question: string } };

async function getVisiblePoll(pollId: string, userId: string): Promise<VisiblePoll> {
  const poll = await prisma.circlePoll.findUnique({
    where: { id: pollId },
    include: { exclusions: { select: { userId: true } }, options: { select: { eventDate: true } } },
  });
  if (!poll) return { status: 404, error: 'Sondage introuvable' };
  // Expiré mais pas encore supprimé par le job horaire : déjà considéré comme disparu
  if (pollExpiresAt(poll.createdAt, poll.options.map(o => o.eventDate)) <= new Date()) return { status: 404, error: 'Sondage terminé' };
  if (poll.exclusions.some(e => e.userId === userId)) return { status: 404, error: 'Sondage introuvable' };
  if (!(await assertCircleMember(userId, poll.circleId))) return { status: 403, error: 'Accès refusé' };
  return { poll };
}

// Destinataires d'un sondage (temps réel, notifications) : membres du Cercle non exclus
async function pollAudience(pollId: string, circleId: string) {
  const [members, exclusions] = await Promise.all([
    prisma.circleMember.findMany({
      where: { circleId },
      select: { userId: true, user: { select: { email: true, emailVerified: true, pseudo: true, notificationChannel: true } } },
    }),
    prisma.circlePollExclusion.findMany({ where: { pollId }, select: { userId: true } }),
  ]);
  const excluded = new Set(exclusions.map(e => e.userId));
  return members.filter(m => !excluded.has(m.userId));
}

router.get('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertCircleMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const polls = await prisma.circlePoll.findMany({
    where: { circleId: req.params.id, resolvedAt: null, exclusions: { none: { userId: req.userId! } } },
    include: circlePollInclude,
    orderBy: { createdAt: 'desc' },
  });
  const now = new Date();
  res.json(polls.map(withExpiry).filter(p => p.expiresAt > now));
});

router.get('/polls/:pollId', async (req: AuthRequest, res) => {
  const access = await getVisiblePoll(req.params.pollId, req.userId!);
  if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }
  const poll = await prisma.circlePoll.findUnique({ where: { id: req.params.pollId }, include: circlePollInclude });
  res.json(poll && withExpiry(poll));
});

router.post('/:id/polls', async (req: AuthRequest, res) => {
  if (!(await assertCircleMember(req.userId!, req.params.id))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (!(await canCreatePolls(req.userId!, req.params.id))) { res.status(403).json({ error: POLL_CREATION_RESERVED_ERROR }); return; }
  const { question, options } = req.body;
  if (!question?.trim() || !Array.isArray(options)) {
    res.status(400).json({ error: 'Question et options requises' });
    return;
  }
  const validOptions = (options as { label?: string; eventDate?: string }[])
    .filter(o => o?.label?.trim());
  if (validOptions.length < 2) {
    res.status(400).json({ error: 'Au moins 2 options valides requises' });
    return;
  }
  const excl = await validateExclusions(req.params.id, req.userId!, req.body.excludedUserIds);
  if ('error' in excl) { res.status(400).json({ error: excl.error }); return; }

  const poll = await prisma.circlePoll.create({
    data: {
      question: question.trim(),
      circleId: req.params.id,
      creatorId: req.userId!,
      options: {
        create: validOptions.map(o => ({
          label: o.label!.trim(),
          eventDate: o.eventDate ? new Date(o.eventDate) : null,
        })),
      },
      exclusions: { create: excl.ids.map(userId => ({ userId })) },
    },
    include: circlePollInclude,
  });
  res.json(withExpiry(poll));

  // Notifier les autres membres du cercle (hors exclus) — temps réel + email
  try {
    const io = req.app.get('io');
    const circle = await prisma.circle.findUnique({ where: { id: req.params.id }, select: { name: true } });
    if (circle) {
      const otherMembers = (await pollAudience(poll.id, req.params.id)).filter(m => m.userId !== req.userId);

      if (io) {
        for (const m of otherMembers) {
          notifyUser(io, m.userId, {
            type: 'new_circle_poll',
            circleId: req.params.id,
            circleName: circle.name,
            from: poll.creator.pseudo,
            planTitle: poll.question,
            pollId: poll.id,
          });
        }
      }

      const recipients = otherMembers.filter(m => m.user.email && m.user.emailVerified && wantsEmail(m.user.notificationChannel));
      await Promise.all(recipients.map(m => resend.emails.send({
        from: FROM_EMAIL,
        to: m.user.email!,
        subject: `Sondage de dates dans "${circle.name}" — ${poll.question}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Salut ${m.user.pseudo} 👋</h2>
            <p><strong>${poll.creator.pseudo}</strong> propose plusieurs dates dans le Cercle <strong>"${circle.name}"</strong> :</p>
            <p style="font-size:16px;font-weight:600;margin:16px 0">${poll.question}</p>
            <p>Indique les dates qui te conviennent pour aider à trouver le meilleur créneau.</p>
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Voir le sondage
            </a>
          ${notificationFooter()}
          </div>`,
      }).then(r => { if (r.error) console.error('[circle_poll email]', m.user.email, r.error); })
        .catch(e => console.error('[circle_poll email]', m.user.email, e))));
    }
  } catch (e) {
    console.error('[circle_poll notify]', e);
  }
});

router.delete('/polls/:pollId', async (req: AuthRequest, res) => {
  const poll = await prisma.circlePoll.findUnique({ where: { id: req.params.pollId } });
  if (!poll) { res.status(404).json({ error: 'Sondage introuvable' }); return; }
  if (poll.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur du sondage' }); return; }
  await prisma.circlePoll.delete({ where: { id: req.params.pollId } });
  res.json({ ok: true });
});

// Vote (bascule), plusieurs options possibles à la fois. Voter retire le « pas intéressé(e) ».
router.post('/polls/options/:optionId/vote', async (req: AuthRequest, res) => {
  const option = await prisma.circlePollOption.findUnique({
    where: { id: req.params.optionId },
    include: { poll: true },
  });
  if (!option) { res.status(404).json({ error: 'Option introuvable' }); return; }
  const access = await getVisiblePoll(option.pollId, req.userId!);
  if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }
  if (option.poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage est clos' }); return; }
  if (isPastOption(option.eventDate)) { res.status(400).json({ error: 'Cette date est déjà passée' }); return; }

  const existing = await prisma.circlePollVote.findUnique({
    where: { optionId_userId: { optionId: req.params.optionId, userId: req.userId! } },
  });
  if (existing) {
    await prisma.circlePollVote.delete({ where: { optionId_userId: { optionId: req.params.optionId, userId: req.userId! } } });
  } else {
    await prisma.$transaction([
      prisma.circlePollDecline.deleteMany({ where: { pollId: option.pollId, userId: req.userId! } }),
      prisma.circlePollVote.create({ data: { optionId: req.params.optionId, userId: req.userId! } }),
    ]);
  }

  const updatedPoll = await prisma.circlePoll.findUnique({ where: { id: option.pollId }, include: circlePollInclude });
  res.json(updatedPoll && withExpiry(updatedPoll));
});

// « Pas intéressé(e) » (bascule) — retire aussi les dates cochées
router.post('/polls/:pollId/decline', async (req: AuthRequest, res) => {
  const access = await getVisiblePoll(req.params.pollId, req.userId!);
  if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }
  if (access.poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage est clos' }); return; }
  const pollId = access.poll.id;
  const userId = req.userId!;

  const existing = await prisma.circlePollDecline.findUnique({ where: { pollId_userId: { pollId, userId } } });
  if (existing) {
    await prisma.circlePollDecline.delete({ where: { pollId_userId: { pollId, userId } } });
  } else {
    await prisma.$transaction([
      prisma.circlePollVote.deleteMany({ where: { userId, option: { pollId } } }),
      prisma.circlePollDecline.create({ data: { pollId, userId } }),
    ]);
  }
  const updatedPoll = await prisma.circlePoll.findUnique({ where: { id: pollId }, include: circlePollInclude });
  res.json(updatedPoll && withExpiry(updatedPoll));
});

// ─── Chat du sondage ───────────────────────────────────────────────────────
const pollMessageInclude = { author: { select: { id: true, pseudo: true } } };

router.get('/polls/:pollId/messages', async (req: AuthRequest, res) => {
  const access = await getVisiblePoll(req.params.pollId, req.userId!);
  if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }
  const messages = await prisma.circlePollMessage.findMany({
    where: { pollId: access.poll.id },
    include: pollMessageInclude,
    orderBy: { createdAt: 'asc' },
    take: 300,
  });
  res.json(messages.map(withPlainContent));
});

router.post('/polls/:pollId/messages', async (req: AuthRequest, res) => {
  const access = await getVisiblePoll(req.params.pollId, req.userId!);
  if ('error' in access) { res.status(access.status).json({ error: access.error }); return; }
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 2000) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  const poll = access.poll;
  if (poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage est clos' }); return; }

  const message = withPlainContent(await prisma.circlePollMessage.create({
    data: { content: encryptMessage(content), pollId: poll.id, authorId: req.userId! },
    include: pollMessageInclude,
  }));
  countMessageSent();
  res.json(message);

  // Diffusion aux seuls membres qui voient le sondage (room user:* — pas de room à rejoindre)
  try {
    const io = req.app.get('io');
    if (!io) return;
    const [audience, circle] = await Promise.all([
      pollAudience(poll.id, poll.circleId),
      prisma.circle.findUnique({ where: { id: poll.circleId }, select: { name: true } }),
    ]);
    for (const m of audience) {
      io.to(`user:${m.userId}`).emit('poll-message', { pollId: poll.id, message });
      if (m.userId !== req.userId) {
        notifyUser(io, m.userId, {
          type: 'poll_message',
          circleId: poll.circleId,
          circleName: circle?.name,
          pollId: poll.id,
          planTitle: poll.question,
          from: message.author.pseudo,
          preview: content.slice(0, 80),
        });
      }
    }
  } catch (e) {
    console.error('[poll_message notify]', e);
  }
});

// Modifier / supprimer son message dans le chat d'un sondage (15 minutes, lib/messageEdit.ts)
async function editPollMessage(req: AuthRequest, res: any, change: (text: string | null) => object | null) {
  const message = await prisma.circlePollMessage.findUnique({ where: { id: req.params.messageId } });
  const access = message && await getVisiblePoll(message.pollId, req.userId!);
  if (!message || !access || 'error' in access) { res.status(404).json({ error: 'Message introuvable' }); return; }
  const refused = checkMessageEdit(message, req.userId!);
  if (refused) { res.status(403).json({ error: refused }); return; }
  const data = change(cleanContent(req.body?.content));
  if (!data) { res.status(400).json({ error: 'Message vide ou trop long (2000 caractères max)' }); return; }
  const updated = withPlainContent(await prisma.circlePollMessage.update({ where: { id: message.id }, data, include: pollMessageInclude }));
  res.json(updated);
  try {
    const io = req.app.get('io');
    for (const m of await pollAudience(message.pollId, access.poll.circleId)) {
      io?.to(`user:${m.userId}`).emit('poll-message-updated', { pollId: message.pollId, message: updated });
    }
  } catch (e) {
    console.error('[poll message update]', e);
  }
}

router.put('/polls/messages/:messageId', (req: AuthRequest, res) =>
  editPollMessage(req, res, text => text ? { content: encryptMessage(text), editedAt: new Date() } : null));

router.delete('/polls/messages/:messageId', (req: AuthRequest, res) =>
  editPollMessage(req, res, () => ({ content: '', deletedAt: new Date() })));

// Convertit l'option gagnante d'un sondage en Plan (créateur du sondage, ou créateur/organisateurs du Cercle).
// Le chat du sondage est recopié au début du chat du Plan, puis le sondage est
// supprimé (il n'a plus d'utilité et ses données seraient conservées en double).
router.post('/polls/:pollId/convert', async (req: AuthRequest, res) => {
  const poll = await prisma.circlePoll.findUnique({ where: { id: req.params.pollId }, include: { options: true } });
  if (!poll) { res.status(404).json({ error: 'Sondage introuvable' }); return; }
  if (poll.resolvedAt) { res.status(409).json({ error: 'Ce sondage a déjà été converti' }); return; }
  // Le créateur du sondage le convertit s'il peut créer des Plans ; sinon (sondages ouverts à
  // tous, Plans réservés), le créateur du Cercle ou un organisateur le fait à sa place.
  const isManager = await isCircleManager(req.userId!, poll.circleId);
  if (!isManager) {
    if (poll.creatorId !== req.userId) { res.status(403).json({ error: 'Réservé au créateur du sondage et aux organisateurs du Cercle' }); return; }
    if (!(await canCreatePlans(req.userId!, poll.circleId))) { res.status(403).json({ error: PLAN_CREATION_RESERVED_ERROR }); return; }
  }

  const { optionId, title, description, endDate, location, maxParticipants, excludedUserIds, deletionMode, disabledFeatures, editMode } = req.body;
  const option = poll.options.find(o => o.id === optionId);
  if (!option) { res.status(400).json({ error: 'Option invalide' }); return; }
  if (isPastOption(option.eventDate)) { res.status(400).json({ error: 'Cette date est déjà passée' }); return; }
  if (pollExpiresAt(poll.createdAt, poll.options.map(o => o.eventDate)) <= new Date()) { res.status(404).json({ error: 'Sondage terminé' }); return; }

  const result = await createPlanInCircle(req.app, poll.circleId, req.userId!, {
    title, description, endDate, location, maxParticipants, excludedUserIds, deletionMode, disabledFeatures, editMode,
    eventDate: option.eventDate?.toISOString() ?? null,
  });
  if ('error' in result) { res.status(400).json({ error: result.error }); return; }

  const messages = await prisma.circlePollMessage.findMany({ where: { pollId: poll.id }, orderBy: { createdAt: 'asc' } });
  await prisma.$transaction([
    prisma.message.createMany({
      // Contenu recopié tel quel : déjà chiffré avec la même clé
      data: messages.map(m => ({ content: m.content, authorId: m.authorId, planId: result.plan.id, createdAt: m.createdAt, editedAt: m.editedAt, deletedAt: m.deletedAt })),
    }),
    prisma.circlePoll.delete({ where: { id: poll.id } }),
  ]);

  res.json(result.plan);
});

export default router;
