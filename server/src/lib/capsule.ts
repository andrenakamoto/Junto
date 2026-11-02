import fs from 'fs/promises';
import path from 'path';
import prisma from './prisma';
import { notifyUser } from './push';
import { STORAGE_DIR } from './storage';

// Capsule temporelle (2026-11-02). Pendant ou après un Plan, chacun dépose un souvenir (mot, photo, message vocal) ; personne
// ne voit les dépôts des autres. Fin des dépôts → la capsule est scellée ; à la date choisie, elle s'ouvre pour tout le groupe,
// puis elle est effacée 30 jours après (exception aux 24 h de vie d'un Plan, expliquée dans la politique de confidentialité).
// Elle survit au Plan : rattachée au Cercle, titre recopié, personnes qui la verront dans `audienceIds`.

export const CAPSULE_TEXT_MAX = 1000;
export const CAPSULE_DEPOSITS_PER_PERSON = 10;
export const CAPSULE_MAX_BYTES = 200 * 1024 * 1024;
export const CAPSULE_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const CAPSULE_VOICE_MAX_BYTES = 6 * 1024 * 1024;
export const CAPSULE_VOICE_MAX_SECONDS = 120;
export const CAPSULE_DEPOSIT_DAYS = 7;          // dépôts jusqu'à 7 jours après la fin du Plan
export const CAPSULE_KEEP_AFTER_OPEN_MS = 30 * 24 * 3600e3;
const DAY = 24 * 3600e3;

// Fin des dépôts : 7 jours après la fin du Plan (au plus tôt, 7 jours après la création de la capsule)
export function depositDeadline(planEnd: Date, now = new Date()): Date {
  return new Date(Math.max(planEnd.getTime(), now.getTime()) + CAPSULE_DEPOSIT_DAYS * DAY);
}

// Ouverture « dans 1 an » : un an jour pour jour après le début du Plan (au plus tôt, un jour après la fin des dépôts)
export function oneYearAfter(planStart: Date, depositUntil: Date): Date {
  const d = new Date(planStart); d.setFullYear(d.getFullYear() + 1);
  return new Date(Math.max(d.getTime(), depositUntil.getTime() + DAY));
}

// Date d'ouverture : au moins un jour après la fin des dépôts, au plus un an après (2026-11-02 : « 1 an ou une date dans
// l'année ») ; null si invalide
export function parseOpenAt(v: unknown, depositUntil: Date): Date | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const max = new Date(depositUntil); max.setFullYear(max.getFullYear() + 1);
  if (d.getTime() < depositUntil.getTime() + DAY || d > max) return null;
  return d;
}

export type CapsuleStage = 'open_for_deposits' | 'sealed' | 'opened';
export function capsuleStage(c: { depositUntil: Date; openAt: Date; openedAt: Date | null }, now = new Date()): CapsuleStage {
  if (c.openedAt || c.openAt <= now) return 'opened';
  if (c.depositUntil <= now) return 'sealed';
  return 'open_for_deposits';
}

// Effacement prévu : 30 jours après l'ouverture
export const capsuleExpiresAt = (c: { openAt: Date; openedAt: Date | null }) => new Date((c.openedAt ?? c.openAt).getTime() + CAPSULE_KEEP_AFTER_OPEN_MS);

const dmy = (d: Date) => new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' }).format(d);

// Fichiers d'une capsule : STORAGE_DIR/capsules/<capsuleId>/
export const capsuleDir = (capsuleId: string) => path.join(STORAGE_DIR, 'capsules', capsuleId.replace(/[^a-z0-9]/gi, ''));
export function capsuleFile(fileKey: string): string {
  const p = path.resolve(STORAGE_DIR, 'capsules', fileKey);
  if (!p.startsWith(path.join(STORAGE_DIR, 'capsules') + path.sep)) throw new Error('Chemin de fichier invalide');
  return p;
}
export async function removeCapsuleFiles(capsuleIds: string[]) {
  for (const id of capsuleIds) await fs.rm(capsuleDir(id), { recursive: true, force: true }).catch(e => console.error('[capsule fichiers]', id, e.message));
}
export async function removeDepositFiles(fileKeys: (string | null)[]) {
  for (const k of fileKeys) if (k) await fs.rm(capsuleFile(k), { force: true }).catch(() => {});
}

function notifyAll(io: any, c: { id: string; circleId: string; title: string; audienceIds: string[] }, preview: string) {
  for (const userId of c.audienceIds) notifyUser(io, userId, { type: 'capsule', circleId: c.circleId, capsuleId: c.id, planTitle: c.title, preview });
}

// Personnes qui verront la capsule tant que le Plan existe : ses participants (sans « Je passe »), la personne qui l'a créée et
// celles qui ont déposé. Recalculée chaque heure : le Plan est supprimé 24 h après sa fin, alors que les dépôts durent 7 jours.
async function currentAudience(c: { id: string; planId: string | null; audienceIds: string[]; createdById: string | null }): Promise<string[]> {
  if (!c.planId) return c.audienceIds;
  const [members, depositors] = await Promise.all([
    prisma.planMember.findMany({ where: { planId: c.planId, rsvp: { not: 'out' }, user: { isLight: false } }, select: { userId: true } }),
    prisma.capsuleDeposit.findMany({ where: { capsuleId: c.id }, select: { userId: true }, distinct: ['userId'] }),
  ]);
  return [...new Set([...(c.createdById ? [c.createdById] : []), ...members.map(m => m.userId), ...depositors.map(d => d.userId)])];
}

// Scellage (à la fin des dépôts, ou plus tôt par le créateur) : on fige les personnes qui verront l'ouverture
export async function sealCapsule(io: any, id: string, now = new Date()): Promise<boolean> {
  const c = await prisma.timeCapsule.findUnique({ where: { id }, include: { _count: { select: { deposits: true } } } });
  if (!c || c.sealedAt) return false;
  const audience = await currentAudience(c);
  const claimed = await prisma.timeCapsule.updateMany({ where: { id, sealedAt: null }, data: { sealedAt: now, depositUntil: c.depositUntil < now ? c.depositUntil : now, audienceIds: audience } });
  if (claimed.count && c._count.deposits) notifyAll(io, { ...c, audienceIds: audience }, `🔒 La capsule « ${c.title} » est scellée jusqu’au ${dmy(c.openAt)}`);
  return claimed.count > 0;
}

// Création : les participants sont prévenus qu'ils peuvent déposer
export function notifyCreated(io: any, c: { id: string; circleId: string; title: string; audienceIds: string[]; depositUntil: Date }, authorId: string) {
  const preview = `⏳ Capsule temporelle pour « ${c.title} » : dépose un souvenir avant le ${dmy(c.depositUntil)}`;
  for (const userId of c.audienceIds) if (userId !== authorId) notifyUser(io, userId, { type: 'capsule', circleId: c.circleId, capsuleId: c.id, planTitle: c.title, preview, actorId: authorId });
}

// Tâche horaire (protégée comme les autres) : tenir l'audience à jour, rappeler la veille de la fin des dépôts, sceller,
// rappeler une semaine avant l'ouverture, ouvrir, effacer 30 jours après l'ouverture
export async function capsuleTick(io: any) {
  try {
    const now = new Date();
    for (const c of await prisma.timeCapsule.findMany({ where: { sealedAt: null, planId: { not: null }, depositUntil: { gt: now } } })) {
      const audience = await currentAudience(c);
      if (audience.length !== c.audienceIds.length || audience.some(u => !c.audienceIds.includes(u))) await prisma.timeCapsule.update({ where: { id: c.id }, data: { audienceIds: audience } });
    }
    // Dernier jour pour déposer : rappel aux personnes qui n'ont encore rien déposé
    for (const c of await prisma.timeCapsule.findMany({ where: { sealedAt: null, depositReminderSentAt: null, depositUntil: { gt: now, lte: new Date(now.getTime() + DAY) } }, include: { deposits: { select: { userId: true } } } })) {
      const claimed = await prisma.timeCapsule.updateMany({ where: { id: c.id, depositReminderSentAt: null }, data: { depositReminderSentAt: now } });
      if (!claimed.count) continue;
      const done = new Set(c.deposits.map(d => d.userId));
      for (const userId of c.audienceIds) if (!done.has(userId)) {
        notifyUser(io, userId, { type: 'capsule', circleId: c.circleId, capsuleId: c.id, planTitle: c.title, preview: `⏳ Dernier jour pour déposer un souvenir dans la capsule « ${c.title} »` });
      }
    }
    for (const c of await prisma.timeCapsule.findMany({ where: { sealedAt: null, depositUntil: { lte: now } }, select: { id: true } })) await sealCapsule(io, c.id, now);
    // Rappel une semaine avant l'ouverture
    for (const c of await prisma.timeCapsule.findMany({ where: { reminderSentAt: null, openedAt: null, sealedAt: { not: null }, openAt: { lte: new Date(now.getTime() + 7 * DAY), gt: now } } })) {
      const claimed = await prisma.timeCapsule.updateMany({ where: { id: c.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (claimed.count) notifyAll(io, c, `⏳ La capsule « ${c.title} » s’ouvre dans 7 jours`);
    }
    // Ouverture
    for (const c of await prisma.timeCapsule.findMany({ where: { openedAt: null, openAt: { lte: now } }, include: { _count: { select: { deposits: true } } } })) {
      const claimed = await prisma.timeCapsule.updateMany({ where: { id: c.id, openedAt: null }, data: { openedAt: now } });
      if (claimed.count && c._count.deposits) notifyAll(io, c, `🎁 La capsule « ${c.title} » est ouverte !`);
    }
    // Effacement 30 jours après l'ouverture
    const gone = await prisma.timeCapsule.findMany({ where: { openedAt: { lt: new Date(now.getTime() - CAPSULE_KEEP_AFTER_OPEN_MS) } }, select: { id: true } });
    if (gone.length) {
      await removeCapsuleFiles(gone.map(g => g.id));
      await prisma.timeCapsule.deleteMany({ where: { id: { in: gone.map(g => g.id) } } });
    }
  } catch (e) {
    console.error('[capsule]', e);
  }
}
