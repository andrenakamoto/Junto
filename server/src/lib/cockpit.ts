import prisma from './prisma';
import { visiblePlansWhere } from './planAccess';
import { pollExpiresAt } from './pollExpiry';
import { decryptMessage } from './messageCrypto';
import { orgPermissions } from './orgPermissions';
import { chatSince } from './circleChat';
import { findConflicts } from './equipment';

// Cockpit d'une Organisation (2026-11-13) : direction et administrateurs voient en un coup d'œil ce qui demande une
// action, ce qui arrive dans les 14 jours, la santé de chaque équipe, les annonces, les tâches en retard et les
// paiements des fournisseurs. Seulement des Plans que la personne voit déjà (surprises et Plans réservés exclus) ;
// des chiffres par équipe, jamais de suivi individuel (« qui est inactif »). Sert aussi au résumé hebdomadaire
// envoyé par email (lib/cockpitDigest.ts).

const DAY = 86_400_000;
export const AGENDA_DAYS = 14;
export const LOW_ANSWER_DAYS = 7;

export type TeamStatus = 'ok' | 'watch' | 'quiet';

// Pastille d'une équipe : rouge (« calme ») sans Plan à venir ni activité depuis 3 semaines ; orange sans activité
// depuis 2 semaines, ou si moins de la moitié des membres répondent aux Plans à venir ; vert sinon.
export function teamStatus(input: { upcoming: number; lastActivityAt: Date | null; responseRate: number | null }, now = new Date()): TeamStatus {
  const idle = input.lastActivityAt ? (now.getTime() - input.lastActivityAt.getTime()) / DAY : Infinity;
  if (input.upcoming === 0 && idle > 21) return 'quiet';
  if (idle > 14 || (input.responseRate !== null && input.responseRate < 0.5)) return 'watch';
  return 'ok';
}

// Membres d'un Plan qui n'ont pas encore répondu : public du Plan (membres de ses Cercles) moins les personnes à qui il
// est caché, celles qui ont répondu et celles sur la liste d'attente
export function pendingIds(audience: Iterable<string>, excluded: Set<string>, answered: Set<string>, waiting: Set<string>): string[] {
  const out: string[] = [];
  for (const id of new Set(audience)) if (!excluded.has(id) && !answered.has(id) && !waiting.has(id)) out.push(id);
  return out;
}

// Échéance « AAAA-MM-JJ » dépassée (heure suisse)
export function isOverdue(dueDate: string | null, today: string): boolean {
  return !!dueDate && dueDate < today;
}

export const zurichDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);

export async function canSeeCockpit(organisationId: string, userId: string): Promise<boolean> {
  const me = await prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId, userId } } });
  return !!me && (me.isAdmin || me.isDirection);
}

export async function buildCockpit(organisationId: string, userId: string, now = new Date()) {
  const [organisation, me] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true, name: true, roles: { select: { id: true, kind: true } } } }),
    prisma.organisationMember.findUnique({ where: { organisationId_userId: { organisationId, userId } } }),
  ]);
  if (!organisation || !me) return null;
  const circles = await prisma.circle.findMany({
    where: { organisationId },
    orderBy: [{ orgPosition: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, color: true, orgKind: true, createdAt: true },
  });
  const circleIds = circles.map(c => c.id);
  const circleName = new Map(circles.map(c => [c.id, c.name]));
  const responsibleRoles = new Set(organisation.roles.filter(r => r.kind === 'responsible' || r.kind === 'direction').map(r => r.id));

  const members = await prisma.circleMember.findMany({
    where: { circleId: { in: circleIds } },
    select: { circleId: true, userId: true, joinedAt: true, orgRoleId: true, orgIntegrated: true, role: true, user: { select: { isLight: true } } },
  });
  const membersOf = new Map<string, typeof members>();
  for (const m of members) membersOf.set(m.circleId, [...(membersOf.get(m.circleId) ?? []), m]);

  // Plans à venir que la personne voit, dans les Cercles de l'Organisation
  const plans = await prisma.plan.findMany({
    where: {
      AND: [visiblePlansWhere(userId), { OR: [{ circleId: { in: circleIds } }, { extraCircles: { some: { circleId: { in: circleIds } } } }] }],
      endDate: { gt: now },
    },
    orderBy: [{ eventDate: 'asc' }, { endDate: 'asc' }],
    select: {
      id: true, title: true, eventDate: true, endDate: true, circleId: true, maxParticipants: true, enabledFeatures: true, kind: true,
      membersVisibility: true, createdAt: true,
      extraCircles: { select: { circleId: true } },
      exclusions: { select: { userId: true } },
      members: { select: { userId: true, rsvp: true, partySize: true } },
      waitlist: { select: { userId: true } },
      volunteerShifts: { where: { doneAt: null, needed: { gt: 0 } }, select: { needed: true, _count: { select: { signups: true } } } },
    },
  });

  const agenda: any[] = [];
  const lowAnswers: any[] = [];
  const perCircle = new Map<string, { upcoming: number; answered: number; audience: number }>();
  for (const p of plans) {
    const planCircles = [p.circleId, ...p.extraCircles.map(e => e.circleId)].filter(id => circleName.has(id));
    const audience = planCircles.flatMap(id => (membersOf.get(id) ?? []).filter(m => !m.user.isLight).map(m => m.userId));
    const excluded = new Set(p.exclusions.map(e => e.userId));
    const answered = new Set(p.members.map(m => m.userId));
    const pending = pendingIds(audience, excluded, answered, new Set(p.waitlist.map(w => w.userId))).length;
    const reach = new Set(audience.filter(id => !excluded.has(id))).size;
    const answeredInAudience = new Set(audience.filter(id => answered.has(id))).size;
    for (const id of planCircles) {
      const s = perCircle.get(id) ?? { upcoming: 0, answered: 0, audience: 0 };
      s.upcoming += 1;
      const inCircle = (membersOf.get(id) ?? []).filter(m => !m.user.isLight && !excluded.has(m.userId));
      s.audience += inCircle.length;
      s.answered += inCircle.filter(m => answered.has(m.userId)).length;
      perCircle.set(id, s);
    }
    const start = p.eventDate ?? p.endDate;
    const coming = p.members.reduce((n, m) => n + (m.rsvp === 'in' ? Math.max(1, m.partySize) : 0), 0);
    const occupied = p.members.reduce((n, m) => n + (m.rsvp === 'out' ? 0 : Math.max(1, m.partySize)), 0);
    const shiftsMissing = p.volunteerShifts.reduce((n, s) => n + Math.max(0, s.needed - s._count.signups), 0);
    if (start.getTime() <= now.getTime() + AGENDA_DAYS * DAY) {
      agenda.push({
        id: p.id, title: p.title, eventDate: p.eventDate, endDate: p.endDate, circleId: p.circleId, circleName: circleName.get(p.circleId) ?? null,
        circles: planCircles.length, coming, maybe: p.members.filter(m => m.rsvp === 'maybe').length,
        max: p.maxParticipants, occupied, waitlist: p.waitlist.length, pending, shiftsMissing,
        assembly: p.enabledFeatures.includes('assemblee'), full: p.maxParticipants !== null && occupied >= p.maxParticipants,
      });
    }
    // Plan proche où la moitié du public n'a pas encore répondu
    if (start.getTime() <= now.getTime() + LOW_ANSWER_DAYS * DAY && reach >= 4 && pending * 2 >= reach && p.membersVisibility !== 'managers') {
      lowAnswers.push({ planId: p.id, title: p.title, circleId: p.circleId, circleName: circleName.get(p.circleId) ?? null, eventDate: p.eventDate, pending, answered: answeredInAudience });
    }
  }

  // Dernière activité par Cercle : message de la Discussion, activité d'un Plan, Plan créé, arrivée d'un membre
  const [lastMessages, lastPlanActivity] = await Promise.all([
    prisma.circleMessage.groupBy({ by: ['circleId'], where: { circleId: { in: circleIds } }, _max: { createdAt: true } }),
    prisma.planActivity.findMany({ where: { plan: { OR: [{ circleId: { in: circleIds } }, { extraCircles: { some: { circleId: { in: circleIds } } } }] } }, select: { at: true, plan: { select: { circleId: true, createdAt: true } } } }),
  ]);
  const last = new Map<string, Date>();
  const bump = (id: string, d: Date | null | undefined) => { if (d && (!last.has(id) || d > last.get(id)!)) last.set(id, d); };
  for (const m of lastMessages) bump(m.circleId, m._max.createdAt);
  for (const a of lastPlanActivity) { bump(a.plan.circleId, a.at); bump(a.plan.circleId, a.plan.createdAt); }
  for (const p of plans) bump(p.circleId, p.createdAt);
  for (const m of members) if (!m.orgIntegrated) bump(m.circleId, m.joinedAt);

  const teams = circles.map(c => {
    const list = (membersOf.get(c.id) ?? []).filter(m => !m.user.isLight && !m.orgIntegrated);
    const s = perCircle.get(c.id);
    const responseRate = s && s.audience > 0 ? s.answered / s.audience : null;
    const lastActivityAt = last.get(c.id) ?? null;
    return {
      id: c.id, name: c.name, color: c.color, orgKind: c.orgKind,
      members: list.length,
      newMembers: list.filter(m => now.getTime() - m.joinedAt.getTime() < 30 * DAY).length,
      upcoming: s?.upcoming ?? 0,
      lastActivityAt,
      responseRate: responseRate === null ? null : Math.round(responseRate * 100),
      status: teamStatus({ upcoming: s?.upcoming ?? 0, lastActivityAt, responseRate }, now),
    };
  });

  // À traiter
  const [joinRequests, polls] = await Promise.all([
    prisma.circleJoinRequest.findMany({
      where: { circleId: { in: circleIds } }, orderBy: { createdAt: 'asc' },
      select: { id: true, circleId: true, createdAt: true, user: { select: { pseudo: true, firstName: true } } },
    }),
    prisma.circlePoll.findMany({
      where: { circleId: { in: circleIds }, resolvedAt: null, exclusions: { none: { userId } } },
      select: { id: true, circleId: true, question: true, createdAt: true, options: { select: { eventDate: true } } },
    }),
  ]);
  const pollsEnding = polls
    .map(p => ({ id: p.id, circleId: p.circleId, circleName: circleName.get(p.circleId) ?? null, question: p.question, expiresAt: pollExpiresAt(p.createdAt, p.options.map(o => o.eventDate)) }))
    .filter(p => p.expiresAt > now && p.expiresAt.getTime() - now.getTime() < 3 * DAY)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  const teamCircles = circles.filter(c => c.orgKind === 'team');
  const noRole = teamCircles
    .map(c => ({ circleId: c.id, circleName: c.name, count: (membersOf.get(c.id) ?? []).filter(m => !m.user.isLight && !m.orgIntegrated && !m.orgRoleId && m.role !== 'admin').length }))
    .filter(x => x.count > 0);
  const noResponsible = teamCircles
    .filter(c => !(membersOf.get(c.id) ?? []).some(m => !m.orgIntegrated && m.orgRoleId && responsibleRoles.has(m.orgRoleId)))
    .map(c => ({ circleId: c.id, circleName: c.name }));

  // Annonces récentes de l'Organisation (tous auteurs), regroupées
  const announcementRows = await prisma.circleMessage.findMany({
    where: { announcementId: { not: null }, deletedAt: null, createdAt: { gt: chatSince('org') }, circleId: { in: circleIds } },
    orderBy: { createdAt: 'desc' }, take: 200,
    select: { announcementId: true, content: true, createdAt: true, circleId: true, author: { select: { pseudo: true } } },
  });
  const announcements = new Map<string, { announcementId: string; content: string; createdAt: Date; author: string; circleIds: string[] }>();
  for (const r of announcementRows) {
    const a = announcements.get(r.announcementId!) ?? { announcementId: r.announcementId!, content: decryptMessage(r.content).slice(0, 160), createdAt: r.createdAt, author: r.author.pseudo, circleIds: [] };
    a.circleIds.push(r.circleId);
    announcements.set(r.announcementId!, a);
  }
  const communication = [...announcements.values()].slice(0, 5).map(a => ({
    announcementId: a.announcementId, content: a.content, createdAt: a.createdAt, author: a.author,
    circles: a.circleIds.map(id => circleName.get(id)).filter(Boolean),
    reach: new Set(a.circleIds.flatMap(id => (membersOf.get(id) ?? []).filter(m => !m.user.isLight).map(m => m.userId))).size,
  }));

  // Tâches en retard des Plans visibles
  const planIds = plans.map(p => p.id);
  const planTitle = new Map(plans.map(p => [p.id, p.title]));
  const planCircle = new Map(plans.map(p => [p.id, p.circleId]));
  const today = zurichDay(now);
  const openTasks = await prisma.planTask.findMany({
    where: { planId: { in: planIds }, status: { not: 'done' }, dueDate: { not: null, lt: today } },
    orderBy: { dueDate: 'asc' }, select: { id: true, planId: true, title: true, dueDate: true },
  });
  const tasks = { overdue: openTasks.length, items: openTasks.slice(0, 6).map(t => ({ ...t, planTitle: planTitle.get(t.planId) ?? '', circleId: planCircle.get(t.planId) ?? '' })) };

  // Paiements des fournisseurs dans les 7 jours (ou en retard) : administrateurs et droit « voir les montants »
  let suppliers: any[] | null = null;
  if (me.isAdmin || (await orgPermissions(userId, organisationId)).has('see_money')) {
    const soon = zurichDay(new Date(now.getTime() + 7 * DAY));
    const rows = await prisma.planSupplier.findMany({
      where: { planId: { in: planIds }, onHold: false, OR: [{ depositDue: { not: null, lte: soon }, depositPaidAt: null, depositAmount: { not: null } }, { balanceDue: { not: null, lte: soon }, balancePaidAt: null, balanceAmount: { not: null } }] },
      select: { id: true, planId: true, currency: true, depositAmount: true, depositDue: true, depositPaidAt: true, balanceAmount: true, balanceDue: true, balancePaidAt: true, supplier: { select: { name: true } } },
    });
    suppliers = [];
    for (const r of rows) {
      if (r.depositDue && !r.depositPaidAt && r.depositAmount !== null && r.depositDue <= soon) suppliers.push({ planId: r.planId, circleId: planCircle.get(r.planId) ?? '', planTitle: planTitle.get(r.planId) ?? '', name: r.supplier.name, kind: 'deposit', due: r.depositDue, amount: r.depositAmount, currency: r.currency, late: r.depositDue < today });
      if (r.balanceDue && !r.balancePaidAt && r.balanceAmount !== null && r.balanceDue <= soon) suppliers.push({ planId: r.planId, circleId: planCircle.get(r.planId) ?? '', planTitle: planTitle.get(r.planId) ?? '', name: r.supplier.name, kind: 'balance', due: r.balanceDue, amount: r.balanceAmount, currency: r.currency, late: r.balanceDue < today });
    }
    suppliers.sort((a, b) => a.due.localeCompare(b.due));
  }

  // Matériel de l'Organisation : pas encore rendu après la fin, conflits de réservation à venir, en réparation
  const gear = await prisma.equipmentItem.findMany({
    where: { organisationId, archivedAt: null },
    select: { id: true, name: true, quantity: true, status: true, bookings: { where: { returnedAt: null }, select: { id: true, quantity: true, startsAt: true, endsAt: true, returnedAt: true, takenAt: true, planId: true, planTitle: true, circleId: true, takenBy: { select: { pseudo: true, firstName: true } } } } },
  });
  const equipment = gear.length === 0 ? null : {
    items: gear.length,
    late: gear.flatMap(i => i.bookings.filter(b => b.takenAt && b.endsAt < now).map(b => ({
      bookingId: b.id, itemName: i.name, quantity: b.quantity, endsAt: b.endsAt, planId: b.planId, planTitle: b.planTitle, circleId: b.circleId,
      holder: b.takenBy ? (b.takenBy.firstName ? `${b.takenBy.firstName} (@${b.takenBy.pseudo})` : `@${b.takenBy.pseudo}`) : null,
    }))).sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime()),
    conflicts: gear.flatMap(i => findConflicts(i, i.bookings, now).map(c => ({
      itemId: i.id, itemName: i.name, shortBy: c.shortBy, startsAt: c.bookings[0].startsAt,
      plans: c.bookings.map(b => ({ planId: b.planId, planTitle: b.planTitle, circleId: b.circleId, quantity: b.quantity })),
    }))).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    repair: gear.filter(i => i.status !== 'ok').map(i => ({ id: i.id, name: i.name, status: i.status })),
  };

  return {
    organisation: { id: organisation.id, name: organisation.name },
    equipment,
    isAdmin: me.isAdmin,
    digest: me.cockpitDigest,
    myCircleIds: members.filter(m => m.userId === userId).map(m => m.circleId),
    todo: { joinRequests: joinRequests.map(r => ({ ...r, circleName: circleName.get(r.circleId) ?? null })), noRole, noResponsible, pollsEnding, lowAnswers },
    agenda,
    teams,
    communication,
    tasks,
    suppliers,
  };
}

export type Cockpit = NonNullable<Awaited<ReturnType<typeof buildCockpit>>>;
