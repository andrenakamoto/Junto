import prisma from './prisma';
import { resend, FROM_EMAIL, APP_URL } from './mailer';
import { decryptMessage, encryptMessage } from './messageCrypto';

// Signaler un message et masquer une personne (exigence des stores pour les apps où les
// utilisateurs échangent du contenu : Apple 1.2, Google « contenu généré par les utilisateurs »).
//
// - Signalement : copie chiffrée du message (MessageReport), alerte email aux administrateurs
//   (sans le contenu) à info@evly.ch, traitement dans le panneau admin (supprimer le message ou classer).
// - Masquage (UserBlock) : les messages de la personne masquée ne sont plus affichés à celle
//   qui l'a masquée (filtrage côté client avec user.blockedUserIds) et elle ne lui envoie plus
//   de notifications (notifyUser, lib/push.ts). La personne masquée n'en sait rien.

export const REPORT_REASON_MAX = 500;

export type ReportTarget =
  | { kind: 'plan'; messageId: string; planId: string; pollId: null; authorId: string; content: string; deletedAt: Date | null }
  | { kind: 'poll'; messageId: string; planId: null; pollId: string; authorId: string; content: string; deletedAt: Date | null };

// Message signalable par userId : il doit pouvoir le voir (membre du Plan, ou membre du Cercle
// non exclu du sondage), et ne pas en être l'auteur
export async function findReportTarget(kind: unknown, messageId: unknown, userId: string): Promise<ReportTarget | null> {
  if (typeof messageId !== 'string') return null;
  if (kind === 'plan') {
    const m = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, planId: true, authorId: true, content: true, deletedAt: true } });
    if (!m || m.authorId === userId) return null;
    const member = await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId: m.planId } } });
    return member ? { kind, messageId: m.id, planId: m.planId, pollId: null, authorId: m.authorId, content: m.content, deletedAt: m.deletedAt } : null;
  }
  if (kind === 'poll') {
    const m = await prisma.circlePollMessage.findUnique({
      where: { id: messageId },
      select: { id: true, authorId: true, content: true, deletedAt: true, poll: { select: { id: true, circleId: true, exclusions: { where: { userId }, select: { userId: true } } } } },
    });
    if (!m || m.authorId === userId || m.poll.exclusions.length > 0) return null;
    const member = await prisma.circleMember.findUnique({ where: { userId_circleId: { userId, circleId: m.poll.circleId } } });
    return member ? { kind, messageId: m.id, planId: null, pollId: m.poll.id, authorId: m.authorId, content: m.content, deletedAt: m.deletedAt } : null;
  }
  return null;
}

export async function createReport(target: ReportTarget, reporterId: string, reason: string | null) {
  const report = await prisma.messageReport.upsert({
    where: { reporterId_kind_messageId: { reporterId, kind: target.kind, messageId: target.messageId } },
    create: {
      kind: target.kind, messageId: target.messageId, planId: target.planId, pollId: target.pollId,
      // Le texte stocké est déjà chiffré (enc1:…) ; un ancien message en clair est chiffré ici
      content: target.content.startsWith('enc1:') ? target.content : encryptMessage(decryptMessage(target.content)),
      reason, reporterId, authorId: target.authorId,
    },
    update: { reason, resolvedAt: null, resolution: null },
  });
  notifyAdmins().catch(e => console.error('[report email]', e));
  return report;
}

// Alerte de signalement : une seule adresse (pas les comptes administrateurs)
const REPORTS_EMAIL = process.env.REPORTS_EMAIL || 'info@evly.ch';

async function notifyAdmins() {
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to: REPORTS_EMAIL,
    subject: 'Nouveau signalement sur EvLY',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Un message a été signalé</h2>
        <p>Un membre a signalé un message. Ouvre le panneau admin pour le lire et décider de la suite.</p>
        <a href="${APP_URL}/admin" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Ouvrir le panneau admin
        </a>
      </div>`,
  });
  if (r.error) console.error('[report email]', r.error);
}

export async function isBlockedBy(recipientId: string, actorId: string): Promise<boolean> {
  if (recipientId === actorId) return false;
  const block = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: recipientId, blockedId: actorId } } });
  return !!block;
}

export async function blockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return rows.map(r => r.blockedId);
}
