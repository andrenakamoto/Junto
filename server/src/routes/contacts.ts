import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { groupContacts } from '../lib/contacts';
import { isCircleManager } from '../lib/circleRoles';

// « Mes contacts » (lib/contacts.ts) : liste des personnes avec qui on partage un Cercle, et fiche d'une personne
const router = Router();
router.use(requireAuth);

const userSelect = { id: true, pseudo: true, firstName: true } as const;
const circleSelect = { id: true, name: true, color: true } as const;

async function myCircleIds(userId: string): Promise<string[]> {
  const rows = await prisma.circleMember.findMany({
    where: { userId, circle: { isPersonal: false } },
    select: { circleId: true },
  });
  return rows.map(r => r.circleId);
}

async function hiddenBy(userId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return new Set(rows.map(r => r.blockedId));
}

// GET /api/contacts[?circleId=…] — mes contacts ; avec circleId (un de mes Cercles), seulement ceux qui n'en font
// pas encore partie, avec `invited` si une invitation à ce Cercle les attend déjà (fenêtre « Inviter »)
router.get('/', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const circleIds = await myCircleIds(me);
  const rows = circleIds.length === 0 ? [] : await prisma.circleMember.findMany({
    where: { circleId: { in: circleIds }, user: { isLight: false } },
    select: { user: { select: userSelect }, circle: { select: circleSelect } },
  });
  let contacts = groupContacts(rows, me, await hiddenBy(me));

  const forCircle = typeof req.query.circleId === 'string' ? req.query.circleId : null;
  if (!forCircle) { res.json(contacts); return; }
  if (!circleIds.includes(forCircle)) { res.status(403).json({ error: 'Accès refusé' }); return; }
  const [members, invites] = await Promise.all([
    prisma.circleMember.findMany({ where: { circleId: forCircle }, select: { userId: true } }),
    prisma.circleInvitation.findMany({ where: { circleId: forCircle }, select: { inviteeId: true } }),
  ]);
  const inCircle = new Set(members.map(m => m.userId));
  const invited = new Set(invites.map(i => i.inviteeId));
  contacts = contacts.filter(c => !inCircle.has(c.id));
  res.json(contacts.map(c => ({ ...c, invited: invited.has(c.id) })));
});

// GET /api/contacts/:userId — fiche d'une personne : Cercles en commun, Plans à venir en commun, et mes Cercles
// où l'inviter. Pour quelqu'un qui n'est pas un contact (invité d'un Plan…), seulement les Plans en commun.
router.get('/:userId', async (req: AuthRequest, res) => {
  const me = req.userId!;
  const other = req.params.userId;
  if (other === me) { res.json({ contact: false, circles: [], plans: [], invitable: [] }); return; }

  const myCircles = await prisma.circleMember.findMany({
    where: { userId: me, circle: { isPersonal: false } },
    select: { circle: { select: { ...circleSelect, members: { where: { userId: other }, select: { userId: true } } } } },
  });
  const byName = (x: { name: string }, y: { name: string }) => x.name.localeCompare(y.name, 'fr', { sensitivity: 'base' });
  const shared = myCircles.filter(m => m.circle.members.length > 0).map(m => ({ id: m.circle.id, name: m.circle.name, color: m.circle.color })).sort(byName);
  const contact = shared.length > 0;

  // Plans à venir où l'on est tous les deux (sans « Je passe »). Pas les Plans à liste réservée (Mode annonce) :
  // la présence de l'autre y est cachée, sauf à l'organisation (créateur du Plan ou gestionnaire du Cercle).
  const plans = await prisma.plan.findMany({
    where: {
      endDate: { gt: new Date() },
      exclusions: { none: { userId: me } },
      AND: [
        { members: { some: { userId: me, rsvp: { not: 'out' } } } },
        { members: { some: { userId: other, rsvp: { not: 'out' } } } },
      ],
    },
    select: { id: true, title: true, eventDate: true, endDate: true, circleId: true, creatorId: true, membersVisibility: true },
    orderBy: [{ eventDate: 'asc' }, { endDate: 'asc' }],
    take: 30,
  });
  const visible: typeof plans = [];
  for (const p of plans) {
    if (p.membersVisibility === 'managers' && p.creatorId !== me && !(await isCircleManager(me, p.circleId))) continue;
    visible.push(p);
  }

  // Mes Cercles où la personne n'est pas encore (seulement pour un contact) ; `invited` si une invitation l'attend
  let invitable: { id: string; name: string; color: string | null; invited: boolean }[] = [];
  if (contact) {
    const candidates = myCircles.filter(m => m.circle.members.length === 0).map(m => m.circle).sort(byName);
    const invites = await prisma.circleInvitation.findMany({
      where: { inviteeId: other, circleId: { in: candidates.map(c => c.id) } },
      select: { circleId: true },
    });
    const pending = new Set(invites.map(i => i.circleId));
    invitable = candidates.map(c => ({ id: c.id, name: c.name, color: c.color, invited: pending.has(c.id) }));
  }

  res.json({
    contact,
    circles: shared,
    plans: visible.slice(0, 10).map(({ id, title, eventDate, endDate, circleId }) => ({ id, title, eventDate, endDate, circleId })),
    invitable,
  });
});

export default router;
