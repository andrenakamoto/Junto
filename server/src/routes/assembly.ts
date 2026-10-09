import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanAccess } from '../lib/planAccess';
import { notifyUser } from '../lib/push';
import { wantsEmail } from '../lib/notificationPrefs';
import { escapeHtml } from '../lib/escapeHtml';
import {
  ASSEMBLY_DISABLED_ERROR, MAX_CANDIDATES, MAX_ITEMS, MAJORITY_LABEL, NOTES_MAX, QUORUM_MODES, VOTE_CHOICES,
  assemblyEnabled, canManageAssembly, checkInCode, circleVoters, countVotes, electionResult, isAdopted,
  loadAssemblyPlan, parseItemInput, proxyError, quorumRequired, votingRights,
} from '../lib/assembly';
import { buildAssemblyPvPdf } from '../lib/assemblyPv';

// Assemblée (lib/assembly.ts), montée dans le routeur des Plans (/api/plans). Les écritures déclenchent le
// rechargement en direct (lib/realtime.ts, `/:id/assembly…` et `/assembly/…`) ; les notifications sont
// envoyées ici (type `assembly`, et `assembly_vote` pour l'ouverture d'un vote, qui passe le mode silencieux).
const router = Router();

type PlanLite = NonNullable<Awaited<ReturnType<typeof loadAssemblyPlan>>>;
type Ctx = { plan: PlanLite; assembly: NonNullable<Awaited<ReturnType<typeof getAssembly>>>; manager: boolean; circleMember: boolean };
const nameOf = (u?: { pseudo: string; firstName: string | null } | null) => (u ? u.firstName ?? u.pseudo : '?');

const getAssembly = (planId: string) => prisma.assembly.findUnique({ where: { planId }, include: { proxies: true, attendances: true } });

// Plan visible, fonction active ; `write` : réservé aux membres du Cercle ; `manage` : organisateur
async function load(req: AuthRequest, res: any, planId: string | undefined, opts: { write?: boolean; manage?: boolean } = {}): Promise<Ctx | null> {
  const plan = planId ? await loadAssemblyPlan(planId) : null;
  const access = plan && await getPlanAccess(req.userId!, plan.id);
  if (!plan || !access?.canView) { res.status(404).json({ error: 'Plan introuvable' }); return null; }
  if (!assemblyEnabled(plan)) { res.status(403).json({ error: ASSEMBLY_DISABLED_ERROR }); return null; }
  const manager = await canManageAssembly(req.userId!, plan);
  if (opts.manage && !manager) { res.status(403).json({ error: 'Réservé au créateur du Plan et aux organisateurs du Cercle' }); return null; }
  if (opts.write && !access.isCircleMember) { res.status(403).json({ error: 'Réservé aux membres du Cercle' }); return null; }
  let assembly = await getAssembly(plan.id);
  if (!assembly) {
    await prisma.assembly.upsert({ where: { planId: plan.id }, update: {}, create: { planId: plan.id } });
    assembly = (await getAssembly(plan.id))!;
  }
  return { plan, assembly, manager, circleMember: access.isCircleMember };
}

async function itemCtx(req: AuthRequest, res: any, itemId: string, opts: { write?: boolean; manage?: boolean } = {}) {
  const item = await prisma.assemblyItem.findUnique({ where: { id: itemId }, include: { assembly: { select: { planId: true } }, candidates: true } });
  const ctx = await load(req, res, item?.assembly.planId, opts);
  if (!ctx || !item) { if (ctx) res.status(404).json({ error: 'Point introuvable' }); return null; }
  return { ...ctx, item };
}

async function rights(ctx: Ctx) {
  const { members, voterIds } = await circleVoters(ctx.plan.circleId, ctx.assembly.nonVoterIds);
  const present = new Set(ctx.assembly.attendances.map(a => a.userId));
  return { members, voterIds, present, ...votingRights(voterIds, present, ctx.assembly.proxies) };
}

// Personnes à prévenir : membres du Cercle (comptes normaux), hors auteur ; `notWatching` : hors de la room du Plan
async function notifyMembers(req: AuthRequest, ctx: Ctx, preview: string, opts: { type?: string; only?: string[]; notWatching?: boolean } = {}) {
  const io = req.app.get('io');
  const { members } = await circleVoters(ctx.plan.circleId, []);
  const watching = new Set<string>();
  if (opts.notWatching && io) for (const s of await io.in(`plan:${ctx.plan.id}`).fetchSockets()) watching.add(s.data.userId);
  for (const m of members) {
    if (m.id === req.userId || watching.has(m.id) || (opts.only && !opts.only.includes(m.id))) continue;
    notifyUser(io, m.id, { type: opts.type ?? 'assembly', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, actorId: req.userId!, preview });
  }
}

const resultText = (item: { kind: string; majority: string }, c: { yes: number; no: number; abstain: number }) =>
  `${isAdopted(c, item.majority) ? 'Adopté' : 'Rejeté'} — ${c.yes} oui, ${c.no} non, ${c.abstain} abstention${c.abstain > 1 ? 's' : ''}`;

// GET /:id/assembly — tout l'état de l'assemblée, selon la personne
router.get('/:id/assembly', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id); if (!ctx) return;
  const { plan, assembly, manager, circleMember } = ctx;
  const r = await rights(ctx);
  const items = await prisma.assemblyItem.findMany({
    where: { assemblyId: assembly.id }, orderBy: { position: 'asc' },
    include: { candidates: { orderBy: { name: 'asc' } }, voters: true, ballots: true },
  });
  const byId = new Map(r.members.map(m => [m.id, m]));
  const person = (id: string | null | undefined) => (id ? { id, name: nameOf(byId.get(id)) } : null);
  const docIds = [...new Set(items.flatMap(i => i.attachmentIds))];
  const docs = docIds.length ? await prisma.attachment.findMany({ where: { id: { in: docIds }, planId: plan.id }, select: { id: true, name: true, mimeType: true } }) : [];
  const docById = new Map(docs.map(d => [d.id, d]));
  const myMandates = r.mandates.get(req.userId!) ?? [];
  const required = quorumRequired(assembly.quorumMode, assembly.quorumValue, r.voterIds.length);
  const isSecretary = assembly.secretaryId === req.userId;
  const attendance = new Map(assembly.attendances.map(a => [a.userId, a]));
  const myProxy = assembly.proxies.find(p => p.giverId === req.userId);

  res.json({
    canManage: manager, isSecretary, canSeePv: manager || isSecretary, isVoter: r.voterIds.includes(req.userId!), circleMember,
    status: assembly.closedAt ? 'closed' : assembly.openedAt ? 'open' : 'preparation',
    convokedAt: assembly.convokedAt, openedAt: assembly.openedAt, closedAt: assembly.closedAt,
    eventDate: plan.eventDate,
    settings: {
      nonVoterIds: assembly.nonVoterIds, proxiesAllowed: assembly.proxiesAllowed, maxProxies: assembly.maxProxies,
      quorumMode: assembly.quorumMode, quorumValue: assembly.quorumValue, codeCheckIn: assembly.codeCheckIn,
      hybrid: assembly.hybrid, noticeDays: assembly.noticeDays, secretaryId: assembly.secretaryId,
    },
    checkInCode: manager && assembly.openedAt && !assembly.closedAt && assembly.codeCheckIn ? assembly.checkInCode : null,
    // Membres du Cercle (pas pour un invité externe : il ne voit rien du Cercle)
    members: circleMember ? r.members.map(m => ({
      id: m.id, name: nameOf(m), isVoter: r.voterIds.includes(m.id),
      present: attendance.has(m.id), remote: attendance.get(m.id)?.remote ?? false,
      proxyTo: manager ? person(assembly.proxies.find(p => p.giverId === m.id)?.holderId) : null,
    })) : [],
    quorum: { required, represented: r.represented, presentVoters: r.presentVoters, validProxies: r.validProxies.length, voterCount: r.voterIds.length, reached: required === null || r.represented >= required },
    me: {
      present: attendance.has(req.userId!), remote: attendance.get(req.userId!)?.remote ?? false,
      proxyGivenTo: person(myProxy?.holderId),
      proxiesHeld: assembly.proxies.filter(p => p.holderId === req.userId).map(p => person(p.giverId)),
      mandates: myMandates.map(id => person(id)),
    },
    proxies: manager ? assembly.proxies.map(p => ({ id: p.id, giver: person(p.giverId), holder: person(p.holderId) })) : [],
    items: items.map(i => {
      const counts = countVotes(i.ballots);
      const done = i.status === 'closed' || i.status === 'tacit';
      const election = i.kind === 'election' && i.status === 'closed' ? electionResult(i.candidates.map(c => c.id), i.ballots, i.seats ?? 1) : null;
      const votedFor = new Set(i.voters.map(v => v.onBehalfOfId));
      return {
        id: i.id, position: i.position, title: i.title, description: i.description, kind: i.kind, notes: i.notes,
        documents: i.attachmentIds.map(id => docById.get(id)).filter(Boolean),
        secret: i.secret, majority: i.majority, majorityLabel: MAJORITY_LABEL[i.majority as keyof typeof MAJORITY_LABEL], seats: i.seats,
        status: i.status, eligibleVotes: i.eligibleVotes, votedCount: i.voters.length,
        myMandates: i.status === 'open' ? myMandates.map(id => ({ ...person(id)!, voted: votedFor.has(id) })) : [],
        candidates: i.candidates.map(c => ({ id: c.id, name: c.name, userId: c.userId, elected: c.elected })),
        result: !done ? null : i.kind === 'vote'
          ? (i.status === 'tacit' ? { tacit: true, adopted: !!i.tacitAdopted } : { counts, adopted: isAdopted(counts, i.majority) })
          : {
            tacit: i.status === 'tacit',
            ranking: election?.ranking.map(x => ({ id: x.id, name: i.candidates.find(c => c.id === x.id)?.name ?? '?', votes: x.votes })) ?? [],
            elected: i.candidates.filter(c => c.elected).map(c => c.name),
            tie: !!election?.tie && i.candidates.filter(c => c.elected).length < (i.seats ?? 1),
            tiedIds: election?.tiedIds ?? [],
            blank: i.ballots.filter(b => b.candidateIds.length === 0).length,
            ballots: i.ballots.length,
          },
        // Main levée : qui a voté quoi, à la clôture
        openVotes: done && !i.secret && i.kind === 'vote' ? i.voters.map(v => ({ name: nameOf(byId.get(v.onBehalfOfId)), by: v.userId !== v.onBehalfOfId ? nameOf(byId.get(v.userId)) : null, choice: v.choice })) : [],
      };
    }),
  });
});

// PUT /:id/assembly — réglages (organisateur)
router.put('/:id/assembly', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (ctx.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée est close' }); return; }
  const b = req.body ?? {};
  const { members } = await circleVoters(ctx.plan.circleId, []);
  const memberIds = members.map(m => m.id);
  const data: any = {};
  if (Array.isArray(b.nonVoterIds)) data.nonVoterIds = [...new Set(b.nonVoterIds.filter((x: unknown) => typeof x === 'string' && memberIds.includes(x as string)))];
  if (typeof b.proxiesAllowed === 'boolean') data.proxiesAllowed = b.proxiesAllowed;
  if (Number.isInteger(b.maxProxies) && b.maxProxies >= 1 && b.maxProxies <= 10) data.maxProxies = b.maxProxies;
  if ((QUORUM_MODES as readonly string[]).includes(b.quorumMode)) data.quorumMode = b.quorumMode;
  if (b.quorumValue === null || (Number.isInteger(b.quorumValue) && b.quorumValue >= 1 && b.quorumValue <= 10000)) data.quorumValue = b.quorumValue;
  if ((data.quorumMode ?? ctx.assembly.quorumMode) === 'percent' && (data.quorumValue ?? ctx.assembly.quorumValue) > 100) { res.status(400).json({ error: 'Quorum : 100 % maximum' }); return; }
  if (typeof b.codeCheckIn === 'boolean') { data.codeCheckIn = b.codeCheckIn; if (b.codeCheckIn && !ctx.assembly.checkInCode) data.checkInCode = checkInCode(); }
  if (typeof b.hybrid === 'boolean') data.hybrid = b.hybrid;
  if (Number.isInteger(b.noticeDays) && b.noticeDays >= 0 && b.noticeDays <= 90) data.noticeDays = b.noticeDays;
  if (b.secretaryId === null || (typeof b.secretaryId === 'string' && memberIds.includes(b.secretaryId))) data.secretaryId = b.secretaryId;
  await prisma.assembly.update({ where: { id: ctx.assembly.id }, data });
  // Une personne décochée des votants perd la procuration qu'elle avait donnée ou reçue
  if (data.nonVoterIds?.length) await prisma.assemblyProxy.deleteMany({ where: { assemblyId: ctx.assembly.id, OR: [{ giverId: { in: data.nonVoterIds } }, { holderId: { in: data.nonVoterIds } }] } });
  res.json({ ok: true });
});

// Ordre du jour ---------------------------------------------------------------------------------------------

async function validDocs(planId: string, ids: string[]) {
  if (!ids.length) return [];
  const docs = await prisma.attachment.findMany({ where: { id: { in: ids }, planId }, select: { id: true } });
  const ok = new Set(docs.map(d => d.id));
  return ids.filter(id => ok.has(id));
}

router.post('/:id/assembly/items', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (ctx.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée est close' }); return; }
  const data = parseItemInput(req.body);
  if ('error' in data) { res.status(400).json({ error: data.error }); return; }
  const count = await prisma.assemblyItem.count({ where: { assemblyId: ctx.assembly.id } });
  if (count >= MAX_ITEMS) { res.status(400).json({ error: `${MAX_ITEMS} points maximum` }); return; }
  const item = await prisma.assemblyItem.create({ data: { ...data, attachmentIds: await validDocs(ctx.plan.id, data.attachmentIds), assemblyId: ctx.assembly.id, position: count } });
  res.json({ id: item.id });
});

router.put('/assembly/items/:itemId', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée est close' }); return; }
  const data = parseItemInput(req.body);
  if ('error' in data) { res.status(400).json({ error: data.error }); return; }
  const base = { title: data.title, description: data.description, attachmentIds: await validDocs(c.plan.id, data.attachmentIds) };
  // Le type de vote ne change plus une fois le vote ouvert
  const update = c.item.status === 'pending' ? { ...base, kind: data.kind, secret: data.secret, majority: data.majority, seats: data.seats } : base;
  await prisma.assemblyItem.update({ where: { id: c.item.id }, data: update });
  if (c.item.status === 'pending' && data.kind !== 'election') await prisma.assemblyCandidate.deleteMany({ where: { itemId: c.item.id } });
  res.json({ ok: true });
});

router.delete('/assembly/items/:itemId', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.item.status !== 'pending') { res.status(400).json({ error: 'Ce point a déjà été voté' }); return; }
  await prisma.assemblyItem.delete({ where: { id: c.item.id } });
  const rest = await prisma.assemblyItem.findMany({ where: { assemblyId: c.assembly.id }, orderBy: { position: 'asc' }, select: { id: true } });
  await prisma.$transaction(rest.map((x, i) => prisma.assemblyItem.update({ where: { id: x.id }, data: { position: i } })));
  res.json({ ok: true });
});

// PUT /:id/assembly/order { ids } — réordonner
router.put('/:id/assembly/order', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  const items = await prisma.assemblyItem.findMany({ where: { assemblyId: ctx.assembly.id }, select: { id: true } });
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length !== items.length || !items.every(i => ids.includes(i.id))) { res.status(400).json({ error: 'Ordre invalide' }); return; }
  await prisma.$transaction(ids.map((id, i) => prisma.assemblyItem.update({ where: { id }, data: { position: i } })));
  res.json({ ok: true });
});

// PUT /assembly/items/:itemId/notes — notes du procès-verbal (organisateur ou secrétaire)
router.put('/assembly/items/:itemId/notes', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId); if (!c) return;
  if (!c.manager && c.assembly.secretaryId !== req.userId) { res.status(403).json({ error: 'Réservé à l’organisateur et au ou à la secrétaire' }); return; }
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, NOTES_MAX) : '';
  await prisma.assemblyItem.update({ where: { id: c.item.id }, data: { notes: notes || null } });
  res.json({ ok: true });
});

// Candidats d'une élection
router.post('/assembly/items/:itemId/candidates', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.item.kind !== 'election' || c.item.status !== 'pending') { res.status(400).json({ error: 'Les candidats se saisissent avant le vote' }); return; }
  if (c.item.candidates.length >= MAX_CANDIDATES) { res.status(400).json({ error: `${MAX_CANDIDATES} candidats maximum` }); return; }
  let name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  let userId: string | null = null;
  if (typeof req.body?.userId === 'string') {
    const { members } = await circleVoters(c.plan.circleId, []);
    const m = members.find(x => x.id === req.body.userId);
    if (!m) { res.status(400).json({ error: 'Membre introuvable' }); return; }
    if (c.item.candidates.some(x => x.userId === m.id)) { res.status(400).json({ error: 'Déjà candidat(e)' }); return; }
    userId = m.id; name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.pseudo;
  }
  if (!name) { res.status(400).json({ error: 'Indique le nom' }); return; }
  await prisma.assemblyCandidate.create({ data: { itemId: c.item.id, userId, name } });
  res.json({ ok: true });
});

router.delete('/assembly/candidates/:candidateId', async (req: AuthRequest, res) => {
  const cand = await prisma.assemblyCandidate.findUnique({ where: { id: req.params.candidateId } });
  const c = cand && await itemCtx(req, res, cand.itemId, { manage: true });
  if (!cand) { res.status(404).json({ error: 'Candidat introuvable' }); return; }
  if (!c) return;
  if (c.item.status !== 'pending') { res.status(400).json({ error: 'Le vote a déjà eu lieu' }); return; }
  await prisma.assemblyCandidate.delete({ where: { id: cand.id } });
  res.json({ ok: true });
});

// Convocation ------------------------------------------------------------------------------------------------

const lastConvocation = new Map<string, number>();
const zurichDate = (d: Date) => new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

router.post('/:id/assembly/convoke', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (ctx.assembly.openedAt) { res.status(400).json({ error: 'L’assemblée a déjà commencé' }); return; }
  const items = await prisma.assemblyItem.findMany({ where: { assemblyId: ctx.assembly.id }, orderBy: { position: 'asc' } });
  if (!items.length) { res.status(400).json({ error: 'Ajoute d’abord l’ordre du jour' }); return; }
  if (Date.now() - (lastConvocation.get(ctx.plan.id) ?? 0) < 10 * 60 * 1000) { res.status(429).json({ error: 'Convocation déjà envoyée il y a moins de 10 minutes' }); return; }
  lastConvocation.set(ctx.plan.id, Date.now());
  await prisma.assembly.update({ where: { id: ctx.assembly.id }, data: { convokedAt: new Date() } });
  res.json({ ok: true });

  const when = ctx.plan.eventDate ? zurichDate(ctx.plan.eventDate) : null;
  await notifyMembers(req, ctx, `📣 Convocation${when ? ` : ${when}` : ''} — ordre du jour et documents dans le Plan`);
  // Email : convocation officielle, même pour un Cercle en silence ; selon le canal choisi
  const circle = await prisma.circle.findUnique({ where: { id: ctx.plan.circleId }, select: { name: true } });
  const users = await prisma.user.findMany({
    where: { memberships: { some: { circleId: ctx.plan.circleId } }, isLight: false, emailVerified: true, email: { not: null }, id: { not: req.userId } },
    select: { email: true, firstName: true, pseudo: true, notificationChannel: true },
  });
  const { resend, FROM_EMAIL, APP_URL, notificationFooter } = await import('../lib/mailer');
  const link = `${APP_URL}/dashboard?planId=${ctx.plan.id}&tab=assemblee`;
  const agenda = items.map((i, n) => `<li style="margin:4px 0"><b>${escapeHtml(i.title)}</b>${i.kind === 'vote' ? ' — vote' : i.kind === 'election' ? ' — élection' : ''}${i.description ? `<br><span style="color:#64748b">${escapeHtml(i.description)}</span>` : ''}</li>`).join('');
  for (const u of users.filter(x => wantsEmail(x.notificationChannel))) {
    resend.emails.send({
      from: FROM_EMAIL, to: u.email!,
      subject: `Convocation — ${ctx.plan.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <p style="color:#ea5a2b;font-weight:700;letter-spacing:1px;font-size:12px">${escapeHtml(circle?.name ?? '').toUpperCase()}</p>
          <h2 style="margin-top:4px">${escapeHtml(ctx.plan.title)}</h2>
          <p>Bonjour ${escapeHtml(u.firstName ?? u.pseudo)},<br>tu es convoqué·e à l'assemblée${when ? ` du <b>${escapeHtml(when)}</b>` : ''}${ctx.plan.location ? `, <b>${escapeHtml(ctx.plan.location)}</b>` : ''}.</p>
          <p style="margin-bottom:4px"><b>Ordre du jour</b></p>
          <ol style="padding-left:20px;margin-top:0">${agenda}</ol>
          ${ctx.assembly.proxiesAllowed ? '<p>Tu ne peux pas venir ? Tu peux donner ta procuration à un autre membre dans EvLY.</p>' : ''}
          <p><a href="${link}" style="display:inline-block;background:#ea5a2b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Voir l'ordre du jour et les documents</a></p>
          ${notificationFooter('simple')}
        </div>`,
    }).then(r => { if (r.error) console.error('[assembly convocation]', r.error); }).catch(e => console.error('[assembly convocation]', e));
  }
});

// Procurations -----------------------------------------------------------------------------------------------

router.post('/:id/assembly/proxy', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { write: true }); if (!ctx) return;
  const holderId = String(req.body?.holderId ?? '');
  const { voterIds } = await circleVoters(ctx.plan.circleId, ctx.assembly.nonVoterIds);
  const err = proxyError(ctx.assembly, voterIds, ctx.assembly.proxies, req.userId!, holderId);
  if (err) { res.status(400).json({ error: err }); return; }
  await prisma.assemblyProxy.upsert({
    where: { assemblyId_giverId: { assemblyId: ctx.assembly.id, giverId: req.userId! } },
    update: { holderId, createdAt: new Date() }, create: { assemblyId: ctx.assembly.id, giverId: req.userId!, holderId },
  });
  res.json({ ok: true });
  notifyUser(req.app.get('io'), holderId, { type: 'assembly', planId: ctx.plan.id, planTitle: ctx.plan.title, circleId: ctx.plan.circleId, actorId: req.userId!, from: req.pseudo!, preview: `🤝 ${req.pseudo} te donne sa procuration : tu voteras aussi pour cette personne` });
});

router.delete('/:id/assembly/proxy', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { write: true }); if (!ctx) return;
  if (ctx.assembly.openedAt) { res.status(400).json({ error: 'L’assemblée est ouverte : viens voter toi-même, ta procuration tombe dès que tu es pointé·e présent·e' }); return; }
  await prisma.assemblyProxy.deleteMany({ where: { assemblyId: ctx.assembly.id, giverId: req.userId! } });
  res.json({ ok: true });
});

// Refuser une procuration (organisateur) : les deux personnes sont prévenues
router.delete('/:id/assembly/proxies/:proxyId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  const proxy = ctx.assembly.proxies.find(p => p.id === req.params.proxyId);
  if (!proxy) { res.status(404).json({ error: 'Procuration introuvable' }); return; }
  await prisma.assemblyProxy.delete({ where: { id: proxy.id } });
  res.json({ ok: true });
  await notifyMembers(req, ctx, '⚠️ Une procuration a été refusée par l’organisateur', { only: [proxy.giverId, proxy.holderId] });
});

// Déroulement ------------------------------------------------------------------------------------------------

router.post('/:id/assembly/open', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (ctx.assembly.openedAt && !ctx.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée est déjà ouverte' }); return; }
  await prisma.assembly.update({ where: { id: ctx.assembly.id }, data: { openedAt: ctx.assembly.openedAt ?? new Date(), closedAt: null, checkInCode: ctx.assembly.checkInCode ?? checkInCode() } });
  res.json({ ok: true });
  if (!ctx.assembly.openedAt) await notifyMembers(req, ctx, '🔔 L’assemblée est ouverte : pointe ta présence', { notWatching: true });
});

// POST /:id/assembly/checkin { code?, remote? } — se pointer soi-même
router.post('/:id/assembly/checkin', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { write: true }); if (!ctx) return;
  const a = ctx.assembly;
  if (!a.openedAt || a.closedAt) { res.status(400).json({ error: 'L’assemblée n’est pas ouverte' }); return; }
  const remote = req.body?.remote === true;
  if (remote && !a.hybrid) { res.status(403).json({ error: 'Cette assemblée ne se suit pas à distance' }); return; }
  if (!remote) {
    if (!a.codeCheckIn) { res.status(403).json({ error: 'Demande à l’organisateur de te pointer présent·e' }); return; }
    if (String(req.body?.code ?? '').trim() !== a.checkInCode) { res.status(400).json({ error: 'Code incorrect : regarde le code affiché dans la salle' }); return; }
  }
  await prisma.assemblyAttendance.upsert({
    where: { assemblyId_userId: { assemblyId: a.id, userId: req.userId! } },
    update: { remote }, create: { assemblyId: a.id, userId: req.userId!, remote },
  });
  res.json({ ok: true });
});

// PUT /:id/assembly/attendance/:userId { present, remote? } — l'organisateur pointe
router.put('/:id/assembly/attendance/:userId', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  const a = ctx.assembly;
  if (!a.openedAt || a.closedAt) { res.status(400).json({ error: 'L’assemblée n’est pas ouverte' }); return; }
  const { members } = await circleVoters(ctx.plan.circleId, []);
  if (!members.some(m => m.id === req.params.userId)) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  if (req.body?.present === false) await prisma.assemblyAttendance.deleteMany({ where: { assemblyId: a.id, userId: req.params.userId } });
  else await prisma.assemblyAttendance.upsert({
    where: { assemblyId_userId: { assemblyId: a.id, userId: req.params.userId } },
    update: { remote: req.body?.remote === true }, create: { assemblyId: a.id, userId: req.params.userId, remote: req.body?.remote === true, checkedById: req.userId! },
  });
  res.json({ ok: true });
});

router.post('/:id/assembly/close', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (!ctx.assembly.openedAt || ctx.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée n’est pas ouverte' }); return; }
  if (await prisma.assemblyItem.count({ where: { assemblyId: ctx.assembly.id, status: 'open' } })) { res.status(400).json({ error: 'Un vote est encore ouvert : clos-le d’abord' }); return; }
  await prisma.assembly.update({ where: { id: ctx.assembly.id }, data: { closedAt: new Date() } });
  res.json({ ok: true });
  await notifyMembers(req, ctx, '✅ L’assemblée est close. Merci à toutes et à tous !', { notWatching: true, only: ctx.assembly.attendances.map(x => x.userId) });
  sendPvToCreator(ctx.plan).catch(e => console.error('[assembly pv]', e));
});

// Rouvrir une assemblée close par erreur
router.post('/:id/assembly/reopen', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id, { manage: true }); if (!ctx) return;
  if (!ctx.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée n’est pas close' }); return; }
  await prisma.assembly.update({ where: { id: ctx.assembly.id }, data: { closedAt: null } });
  res.json({ ok: true });
});

// Procès-verbal envoyé au créateur du Plan à la clôture (le Plan sera supprimé après sa date)
async function sendPvToCreator(plan: PlanLite) {
  const creator = await prisma.user.findUnique({ where: { id: plan.creatorId }, select: { email: true, emailVerified: true, firstName: true, pseudo: true } });
  if (!creator?.email || !creator.emailVerified) return;
  const pdf = await buildAssemblyPvPdf(plan.id);
  if (!pdf) return;
  const { resend, FROM_EMAIL } = await import('../lib/mailer');
  const r = await resend.emails.send({
    from: FROM_EMAIL, to: creator.email,
    subject: `Procès-verbal — ${plan.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Procès-verbal de « ${escapeHtml(plan.title)} »</h2>
        <p>Bonjour ${escapeHtml(creator.firstName ?? creator.pseudo)},<br>l'assemblée est close. Voici le procès-verbal en pièce jointe (PDF) : présents, excusés, procurations, quorum, résultats des votes et des élections.</p>
        <p>Pense à le relire, à le faire signer et à le conserver : le Plan sera supprimé automatiquement après sa date de fin. Tu peux aussi le télécharger à nouveau depuis l'onglet Assemblée tant que le Plan existe.</p>
      </div>`,
    attachments: [{ filename: pdf.filename, content: pdf.buffer }],
  });
  if (r.error) console.error('[assembly pv email]', r.error);
}

// Votes ------------------------------------------------------------------------------------------------------

router.post('/assembly/items/:itemId/open', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (!c.assembly.openedAt || c.assembly.closedAt) { res.status(400).json({ error: 'Ouvre d’abord l’assemblée' }); return; }
  if (c.item.kind === 'info') { res.status(400).json({ error: 'Ce point est une information, sans vote' }); return; }
  if (c.item.status !== 'pending') { res.status(400).json({ error: 'Ce point a déjà été voté' }); return; }
  if (c.item.kind === 'election' && c.item.candidates.length === 0) { res.status(400).json({ error: 'Ajoute d’abord les candidats' }); return; }
  if (await prisma.assemblyItem.count({ where: { assemblyId: c.assembly.id, status: 'open' } })) { res.status(400).json({ error: 'Un autre vote est en cours : clos-le d’abord' }); return; }
  const r = await rights(c);
  if (r.represented === 0) { res.status(400).json({ error: 'Personne n’est pointé présent : pointe d’abord les présents' }); return; }
  await prisma.assemblyItem.update({ where: { id: c.item.id }, data: { status: 'open', openedAt: new Date(), eligibleVotes: r.represented } });
  res.json({ ok: true });
  await notifyMembers(req, c, `🗳️ Vote ouvert : ${c.item.title}`, { type: 'assembly_vote', only: [...r.mandates.keys()] });
});

// POST /assembly/items/:itemId/vote { votes: [{ onBehalfOfId, choice?, candidateIds? }] }
router.post('/assembly/items/:itemId/vote', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { write: true }); if (!c) return;
  if (c.item.status !== 'open') { res.status(400).json({ error: 'Le vote n’est pas ouvert' }); return; }
  const r = await rights(c);
  const mine = r.mandates.get(req.userId!) ?? [];
  if (!mine.length) { res.status(403).json({ error: r.voterIds.includes(req.userId!) ? 'Pointe d’abord ta présence pour voter' : 'Tu ne fais pas partie des votants' }); return; }
  const votes: any[] = Array.isArray(req.body?.votes) ? req.body.votes : [];
  if (!votes.length) { res.status(400).json({ error: 'Aucun vote' }); return; }
  const candidateIds = new Set(c.item.candidates.map(x => x.id));
  const rows: { onBehalfOfId: string; choice: string | null; candidateIds: string[] }[] = [];
  for (const v of votes) {
    if (!mine.includes(v?.onBehalfOfId) || rows.some(x => x.onBehalfOfId === v.onBehalfOfId)) { res.status(403).json({ error: 'Tu ne peux pas voter pour cette personne' }); return; }
    if (c.item.kind === 'vote') {
      if (!(VOTE_CHOICES as readonly string[]).includes(v.choice)) { res.status(400).json({ error: 'Choisis oui, non ou abstention' }); return; }
      rows.push({ onBehalfOfId: v.onBehalfOfId, choice: v.choice, candidateIds: [] });
    } else {
      const ids: string[] = Array.isArray(v.candidateIds) ? [...new Set<string>(v.candidateIds.filter((x: unknown) => typeof x === 'string'))] : [];
      if (ids.some(id => !candidateIds.has(id))) { res.status(400).json({ error: 'Candidat inconnu' }); return; }
      if (ids.length > (c.item.seats ?? 1)) { res.status(400).json({ error: `${c.item.seats ?? 1} nom${(c.item.seats ?? 1) > 1 ? 's' : ''} maximum` }); return; }
      rows.push({ onBehalfOfId: v.onBehalfOfId, choice: null, candidateIds: ids });
    }
  }
  try {
    await prisma.$transaction(async tx => {
      for (const row of rows) {
        // « Qui a voté » ; au bulletin secret, sans le choix
        await tx.assemblyVoter.create({ data: { itemId: c.item.id, userId: req.userId!, onBehalfOfId: row.onBehalfOfId, choice: c.item.secret ? null : row.choice, candidateIds: c.item.secret ? [] : row.candidateIds } });
      }
      // Bulletins anonymes, mélangés
      for (const row of [...rows].sort(() => Math.random() - 0.5)) await tx.assemblyBallot.create({ data: { itemId: c.item.id, choice: row.choice, candidateIds: row.candidateIds } });
    });
  } catch (e: any) {
    if (e?.code === 'P2002') { res.status(409).json({ error: 'Déjà voté' }); return; }
    throw e;
  }
  res.json({ ok: true });
});

router.post('/assembly/items/:itemId/close', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.item.status !== 'open') { res.status(400).json({ error: 'Le vote n’est pas ouvert' }); return; }
  const ballots = await prisma.assemblyBallot.findMany({ where: { itemId: c.item.id } });
  let summary: string;
  if (c.item.kind === 'vote') summary = resultText(c.item, countVotes(ballots));
  else {
    const r = electionResult(c.item.candidates.map(x => x.id), ballots, c.item.seats ?? 1);
    if (r.elected.length) await prisma.assemblyCandidate.updateMany({ where: { id: { in: r.elected } }, data: { elected: true } });
    const names = c.item.candidates.filter(x => r.elected.includes(x.id)).map(x => x.name);
    summary = `${names.length ? `Élu${names.length > 1 ? 's' : ''} : ${names.join(', ')}` : 'Personne d’élu'}${r.tie ? ' — égalité à départager' : ''}`;
  }
  await prisma.assemblyItem.update({ where: { id: c.item.id }, data: { status: 'closed', closedAt: new Date() } });
  res.json({ ok: true });
  await notifyMembers(req, c, `🗳️ ${c.item.title} : ${summary}`, { notWatching: true, only: c.assembly.attendances.map(x => x.userId) });
});

// Annuler un vote ouvert (erreur de saisie) : les voix sont effacées, le point redevient « à voter »
router.post('/assembly/items/:itemId/reset', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.assembly.closedAt) { res.status(400).json({ error: 'L’assemblée est close' }); return; }
  await prisma.$transaction([
    prisma.assemblyVoter.deleteMany({ where: { itemId: c.item.id } }),
    prisma.assemblyBallot.deleteMany({ where: { itemId: c.item.id } }),
    prisma.assemblyCandidate.updateMany({ where: { itemId: c.item.id }, data: { elected: false } }),
    prisma.assemblyItem.update({ where: { id: c.item.id }, data: { status: 'pending', openedAt: null, closedAt: null, eligibleVotes: null, tacitAdopted: null } }),
  ]);
  res.json({ ok: true });
});

// POST /assembly/items/:itemId/tacit { adopted? , candidateIds? } — sans scrutin (acclamation, élection tacite)
router.post('/assembly/items/:itemId/tacit', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (!c.assembly.openedAt || c.assembly.closedAt) { res.status(400).json({ error: 'Ouvre d’abord l’assemblée' }); return; }
  if (c.item.status !== 'pending') { res.status(400).json({ error: 'Ce point a déjà été voté' }); return; }
  if (c.item.kind === 'vote') {
    await prisma.assemblyItem.update({ where: { id: c.item.id }, data: { status: 'tacit', tacitAdopted: req.body?.adopted !== false, closedAt: new Date() } });
  } else if (c.item.kind === 'election') {
    const ids: string[] = Array.isArray(req.body?.candidateIds) ? req.body.candidateIds : [];
    const valid = c.item.candidates.filter(x => ids.includes(x.id)).map(x => x.id);
    if (!valid.length) { res.status(400).json({ error: 'Choisis les personnes élues' }); return; }
    await prisma.assemblyCandidate.updateMany({ where: { id: { in: valid } }, data: { elected: true } });
    await prisma.assemblyItem.update({ where: { id: c.item.id }, data: { status: 'tacit', closedAt: new Date() } });
  } else { res.status(400).json({ error: 'Ce point est une information, sans vote' }); return; }
  res.json({ ok: true });
});

// POST /assembly/items/:itemId/elect { candidateIds } — départager une égalité
router.post('/assembly/items/:itemId/elect', async (req: AuthRequest, res) => {
  const c = await itemCtx(req, res, req.params.itemId, { manage: true }); if (!c) return;
  if (c.item.kind !== 'election' || c.item.status !== 'closed') { res.status(400).json({ error: 'Rien à départager' }); return; }
  const ballots = await prisma.assemblyBallot.findMany({ where: { itemId: c.item.id } });
  const r = electionResult(c.item.candidates.map(x => x.id), ballots, c.item.seats ?? 1);
  const ids: string[] = Array.isArray(req.body?.candidateIds) ? req.body.candidateIds : [];
  const free = (c.item.seats ?? 1) - r.elected.length;
  if (!r.tie || ids.length !== free || ids.some(id => !r.tiedIds.includes(id))) { res.status(400).json({ error: `Choisis ${free} personne${free > 1 ? 's' : ''} parmi les ex æquo` }); return; }
  await prisma.assemblyCandidate.updateMany({ where: { id: { in: ids } }, data: { elected: true } });
  res.json({ ok: true });
});

// GET /:id/assembly/pv — procès-verbal (organisateur et secrétaire), projet tant que l'assemblée n'est pas close
router.get('/:id/assembly/pv', async (req: AuthRequest, res) => {
  const ctx = await load(req, res, req.params.id); if (!ctx) return;
  if (!ctx.manager && ctx.assembly.secretaryId !== req.userId) { res.status(403).json({ error: 'Réservé à l’organisateur et au ou à la secrétaire' }); return; }
  const pdf = await buildAssemblyPvPdf(ctx.plan.id);
  if (!pdf) { res.status(404).json({ error: 'Introuvable' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
});

export default router;
