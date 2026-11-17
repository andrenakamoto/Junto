import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { drawPairs, pairKey } from '../lib/secretSanta';
import { parseSantaInput, santaExpiry } from '../lib/santaOnline';
import { encryptMessage, decryptMessage } from '../lib/messageCrypto';
import { parseLocale, requestLocale, type Locale } from '../lib/i18n';
import { mail, intlLocale } from '../lib/emailText';
import { resend, FROM_EMAIL, APP_URL } from '../lib/mailer';
import { countFunnel } from '../lib/funnel';

// Secret Santa en ligne, gratuit et sans compte (2026-11-17, lib/santaOnline.ts). Routes publiques :
//  POST   /                      créer et tirer au sort (lien d'organisateur + un lien secret par participant)
//  GET    /o/:adminToken         vue de l'organisateur : liens, qui a ouvert (jamais qui offre à qui)
//  POST   /o/:adminToken/email   envoyer les liens par email (participants avec une adresse)
//  DELETE /o/:adminToken         tout effacer
//  GET    /p/:token              vue d'un participant : la personne à qui il offre, ses envies
//  PUT    /p/:token/wishes       sa liste d'envies
const router = Router();

const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skipFailedRequests: true,
  message: { error: 'Tu as déjà créé plusieurs tirages aujourd’hui. Réessaie demain, ou crée ton compte EvLY.' },
});
const actionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop d’envois : réessaie dans une heure.' },
});

const newToken = () => crypto.randomBytes(18).toString('base64url');
const tokenOf = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{10,64}$/.test(v) ? v : null);
const NOT_FOUND = 'Ce tirage n’existe plus (il est effacé 30 jours après l’échange)';
const wishesOf = (stored: string | null) => (stored ? decryptMessage(stored) : '');

router.post('/', createLimiter, async (req, res) => {
  const parsed = parseSantaInput(req.body);
  if ('error' in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { title, budget, exchangeDate, people, exclusions } = parsed.data;
  const ids = people.map((_, i) => String(i));
  const pairs = drawPairs(ids, new Set(exclusions.map(([a, b]) => pairKey(String(a), String(b)))), () => crypto.randomInt(1_000_000) / 1_000_000);
  if (!pairs) { res.status(400).json({ error: 'Impossible de faire un tirage avec ces exclusions : retires-en une' }); return; }
  const locale = requestLocale(req);
  const santa = await prisma.onlineSanta.create({
    data: {
      adminToken: newToken(), title, budget, exchangeDate, locale, expiresAt: santaExpiry(exchangeDate),
      people: { create: people.map((p, i) => ({ position: i, token: newToken(), name: p.name, email: p.email })) },
    },
    include: { people: { orderBy: { position: 'asc' } } },
  });
  // Chaque personne reçoit l'id de la personne à qui elle offre
  const byPos = santa.people;
  await prisma.$transaction(byPos.map((p, i) => prisma.onlineSantaPerson.update({ where: { id: p.id }, data: { receiverId: byPos[Number(pairs.get(String(i)))].id } })));
  countFunnel('funnel_santa_online_created');
  if (req.body?.sendEmails === true) sendLinks(santa.id, null).catch(e => console.error('[santa online email]', e));
  res.json({ adminToken: santa.adminToken });
});

router.get('/o/:adminToken', actionLimiter, async (req, res) => {
  const token = tokenOf(req.params.adminToken);
  const santa = token ? await prisma.onlineSanta.findUnique({ where: { adminToken: token }, include: { people: { orderBy: { position: 'asc' } } } }) : null;
  if (!santa) { res.status(404).json({ error: NOT_FOUND }); return; }
  res.json({
    title: santa.title, budget: santa.budget, exchangeDate: santa.exchangeDate, expiresAt: santa.expiresAt,
    // Jamais « qui offre à qui » : seulement les liens à transmettre et qui les a ouverts
    people: santa.people.map(p => ({
      id: p.id, name: p.name, hasEmail: !!p.email, token: p.token, opened: !!p.openedAt,
      wishes: !!p.wishes || p.noWish, emailSentAt: p.emailSentAt,
    })),
  });
});

router.delete('/o/:adminToken', actionLimiter, async (req, res) => {
  const token = tokenOf(req.params.adminToken);
  const { count } = token ? await prisma.onlineSanta.deleteMany({ where: { adminToken: token } }) : { count: 0 };
  if (!count) { res.status(404).json({ error: NOT_FOUND }); return; }
  res.json({ ok: true });
});

router.post('/o/:adminToken/email', emailLimiter, async (req, res) => {
  const token = tokenOf(req.params.adminToken);
  const santa = token ? await prisma.onlineSanta.findUnique({ where: { adminToken: token }, select: { id: true } }) : null;
  if (!santa) { res.status(404).json({ error: NOT_FOUND }); return; }
  const personId = typeof req.body?.personId === 'string' ? req.body.personId : null;
  const sent = await sendLinks(santa.id, personId);
  res.json({ sent });
});

// Liens secrets envoyés par email (une seule fois par personne, ou de nouveau après 10 minutes pour une personne précise)
async function sendLinks(santaId: string, personId: string | null): Promise<number> {
  const santa = await prisma.onlineSanta.findUnique({ where: { id: santaId }, include: { people: { orderBy: { position: 'asc' } } } });
  if (!santa) return 0;
  const locale: Locale = parseLocale(santa.locale) ?? 'fr';
  const m = mail(locale);
  const organizer = santa.people[0]?.name ?? '';
  let sent = 0;
  for (const p of santa.people) {
    if (!p.email || (personId && p.id !== personId)) continue;
    if (p.emailSentAt && (!personId || Date.now() - p.emailSentAt.getTime() < 10 * 60 * 1000)) continue;
    const vars = { name: p.name, organizer, title: santa.title };
    const link = `${APP_URL}/secret-santa?p=${p.token}`;
    const details = [
      santa.exchangeDate ? m.t('santaOnline.date', { date: new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(santa.exchangeDate) }) : '',
      santa.budget ? m.t('santaOnline.budget', { budget: santa.budget }) : '',
    ].filter(Boolean).map(s => `<p style="margin:4px 0;color:#475569">${s}</p>`).join('');
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>${m.t('santaOnline.title', vars)}</h2>
        <p>${m.t('santaOnline.text', vars)}</p>
        ${details}
        <p style="margin-top:20px"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${m.t('santaOnline.button')}</a></p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">${m.t('santaOnline.footer', vars)}</p>
      </div>`;
    const result = await resend.emails.send({ from: FROM_EMAIL, to: p.email, subject: m.s('santaOnline.subject', vars), html });
    if (result.error) { console.error('[santa online email]', result.error.message); continue; }
    await prisma.onlineSantaPerson.update({ where: { id: p.id }, data: { emailSentAt: new Date() } });
    sent++;
  }
  return sent;
}

router.get('/p/:token', actionLimiter, async (req, res) => {
  const token = tokenOf(req.params.token);
  const me = token ? await prisma.onlineSantaPerson.findUnique({ where: { token }, include: { santa: { select: { title: true, budget: true, exchangeDate: true, _count: { select: { people: true } } } } } }) : null;
  if (!me) { res.status(404).json({ error: NOT_FOUND }); return; }
  const receiver = me.receiverId ? await prisma.onlineSantaPerson.findUnique({ where: { id: me.receiverId } }) : null;
  if (!me.openedAt) {
    await prisma.onlineSantaPerson.update({ where: { id: me.id }, data: { openedAt: new Date() } });
    countFunnel('funnel_santa_online_opened');
  }
  res.json({
    title: me.santa.title, budget: me.santa.budget, exchangeDate: me.santa.exchangeDate, count: me.santa._count.people,
    me: { name: me.name, wishes: wishesOf(me.wishes), noWish: me.noWish },
    receiver: receiver ? { name: receiver.name, wishes: wishesOf(receiver.wishes), noWish: receiver.noWish } : null,
  });
});

router.put('/p/:token/wishes', actionLimiter, async (req, res) => {
  const token = tokenOf(req.params.token);
  const me = token ? await prisma.onlineSantaPerson.findUnique({ where: { token }, select: { id: true } }) : null;
  if (!me) { res.status(404).json({ error: NOT_FOUND }); return; }
  const raw = typeof req.body?.wishes === 'string' ? req.body.wishes.trim().slice(0, 1000) : '';
  const noWish = req.body?.noWish === true && !raw;
  await prisma.onlineSantaPerson.update({ where: { id: me.id }, data: { wishes: raw ? encryptMessage(raw) : null, noWish } });
  res.json({ ok: true });
});

export default router;
