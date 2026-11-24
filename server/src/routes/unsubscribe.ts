import { Router } from 'express';
import prisma from '../lib/prisma';
import { readUnsubscribeToken } from '../lib/unsubscribe';

// Désinscription en un clic (lib/unsubscribe.ts), publique : le jeton signé suffit.
// GET /api/unsubscribe/info?t=  → ce que le lien désinscrit (pour la page /desinscription du site)
// POST /api/unsubscribe?t=      → désinscrit (bouton de la page, et bouton « Se désabonner » des messageries, RFC 8058)
const router = Router();

async function describe(t: unknown) {
  const tok = readUnsubscribeToken(t);
  if (!tok) return null;
  if (tok.kind === 'digest') {
    const u = await prisma.user.findUnique({ where: { id: tok.userId }, select: { weeklyDigestEnabled: true } });
    return u ? { ...tok, kind: 'digest' as const, active: u.weeklyDigestEnabled, organisation: null } : null;
  }
  const organisationId = tok.kind.slice('cockpit:'.length);
  const row = await prisma.organisationMember.findUnique({
    where: { organisationId_userId: { organisationId, userId: tok.userId } },
    select: { cockpitDigest: true, organisation: { select: { name: true } } },
  });
  return row ? { ...tok, kind: 'cockpit' as const, organisationId, active: row.cockpitDigest, organisation: row.organisation.name } : null;
}

router.get('/info', async (req, res) => {
  const d = await describe(req.query.t);
  if (!d) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  res.json({ kind: d.kind, active: d.active, organisation: d.organisation });
});

router.post('/', async (req, res) => {
  const d = await describe(req.query.t ?? req.body?.t);
  if (!d) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  if (d.kind === 'digest') {
    await prisma.user.update({ where: { id: d.userId }, data: { weeklyDigestEnabled: false } });
  } else {
    await prisma.organisationMember.update({
      where: { organisationId_userId: { organisationId: d.organisationId, userId: d.userId } },
      data: { cockpitDigest: false },
    });
  }
  res.json({ ok: true, kind: d.kind, organisation: d.organisation });
});

export default router;
