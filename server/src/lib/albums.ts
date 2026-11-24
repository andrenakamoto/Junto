import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from './prisma';
import { notifyUser } from './push';
import { STORAGE_DIR } from './storage';
import { APP_URL } from './mailer';

// Album souvenir d'une soirée (2026-11-23, demande de l'utilisateur, pour sa soirée d'entreprise) : chacun y met ses photos par un
// lien ou un QR code, sans compte ni app. L'album survit au Plan et reste visible 7 jours après la fin de la soirée.
// Photos seulement (pas de vidéos). Fichiers : STORAGE_DIR/albums/<albumId>/<clé>.jpg et <clé>-s.jpg (miniature).

export const ALBUM_KEEP_MS = 7 * 24 * 3600e3;           // 7 jours après la fin de la soirée
export const ALBUM_NOTICE_MS = 3 * 24 * 3600e3;         // prévenir 3 jours avant l'effacement
export const ALBUM_MAX_PHOTOS = 600;                    // par album
export const ALBUM_MAX_PER_DEVICE = 60;                 // par personne (appareil)
export const ALBUM_UPLOAD_MAX_BYTES = 11 * 1024 * 1024; // fichier reçu (l'app réduit déjà la photo ; nginx : 12 Mo)
export const ALBUM_PHOTO_SIZE = 2048;                   // grand côté de la photo gardée
export const ALBUM_THUMB_SIZE = 480;
export const ALBUM_NAME_MAX = 30;

/** Adresse publique d'un album (page /album du site). */
export const albumUrl = (token: string) => `${APP_URL}/album?t=${encodeURIComponent(token)}`;

/** Album encore ouvert d'un Plan, pour les résumés (récapitulatif PDF, « En bref », email de fin) ; null s'il n'y en a pas. */
export async function planAlbumInfo(planId: string, now = new Date()) {
  const a = await prisma.photoAlbum.findUnique({ where: { planId }, select: { token: true, expiresAt: true, _count: { select: { photos: { where: { hidden: false } } } } } });
  if (!a || a.expiresAt <= now) return null;
  return { token: a.token, url: albumUrl(a.token), expiresAt: a.expiresAt, photos: a._count.photos };
}

export const expiresFor = (eventEnd: Date) => new Date(eventEnd.getTime() + ALBUM_KEEP_MS);

/** Lien public : 24 caractères impossibles à deviner. */
export const newAlbumToken = () => crypto.randomBytes(18).toString('base64url');

/** Jeton d'un album dans une adresse : lettres, chiffres, - et _ seulement. */
export const isAlbumToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);

/** Identifiant d'appareil (gardé dans le navigateur) : sert à retirer ses propres photos et à compter ses cœurs. */
export const parseDeviceId = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null);

/** Prénom affiché sous la photo (1 à 30 caractères, espaces nettoyés). */
export function parseAuthorName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= ALBUM_NAME_MAX ? s : null;
}

export const albumDir = (albumId: string) => path.join(STORAGE_DIR, 'albums', albumId.replace(/[^a-z0-9]/gi, ''));
export function albumFile(albumId: string, key: string, thumb = false): string {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('Clé de photo invalide');
  return path.join(albumDir(albumId), `${key}${thumb ? '-s' : ''}.jpg`);
}
export async function removeAlbumDir(albumId: string) { await fs.rm(albumDir(albumId), { recursive: true, force: true }).catch(() => {}); }
export async function removeAlbumPhotoFiles(albumId: string, key: string) {
  await Promise.all([albumFile(albumId, key), albumFile(albumId, key, true)].map(f => fs.rm(f, { force: true }).catch(() => {})));
}

/** Participants d'un Plan avec un compte, qui viennent (ou peut-être) : ceux qu'on prévient. */
export async function planAudience(planId: string): Promise<string[]> {
  const m = await prisma.planMember.findMany({ where: { planId, rsvp: { in: ['in', 'maybe'] }, user: { isLight: false } }, select: { userId: true } });
  return m.map(x => x.userId);
}

/**
 * Tâche horaire (gated comme les autres crons) : suit le Plan tant qu'il existe (date de fin, participants),
 * prévient 3 jours avant l'effacement, puis efface l'album (fichiers d'abord).
 */
export async function albumTick(io: any, now = new Date()) {
  try {
    const live = await prisma.photoAlbum.findMany({ where: { planId: { not: null } }, include: { plan: { select: { id: true, endDate: true } } } });
    for (const a of live) {
      if (!a.plan) continue;
      const audienceIds = await planAudience(a.plan.id);
      const eventEnd = a.plan.endDate, expiresAt = expiresFor(eventEnd);
      const changed = eventEnd.getTime() !== a.eventEnd.getTime() || audienceIds.join() !== a.audienceIds.join();
      if (changed) await prisma.photoAlbum.update({ where: { id: a.id }, data: { eventEnd, expiresAt, audienceIds, ...(expiresAt > a.expiresAt ? { noticeSentAt: null } : {}) } });
    }
    // Prévenir 3 jours avant l'effacement (une seule fois)
    const soon = await prisma.photoAlbum.findMany({ where: { noticeSentAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + ALBUM_NOTICE_MS) } } });
    for (const a of soon) {
      const claimed = await prisma.photoAlbum.updateMany({ where: { id: a.id, noticeSentAt: null }, data: { noticeSentAt: now } });
      if (!claimed.count) continue;
      const photos = await prisma.albumPhoto.count({ where: { albumId: a.id, hidden: false } });
      if (!photos) continue;
      for (const userId of a.audienceIds) notifyUser(io, userId, { type: 'album', albumToken: a.token, planTitle: a.title, circleId: a.circleId, preview: `📸 L’album « ${a.title} » sera effacé dans 3 jours : télécharge tes photos` });
    }
    // Effacement
    const gone = await prisma.photoAlbum.findMany({ where: { expiresAt: { lte: now } }, select: { id: true } });
    for (const a of gone) {
      await removeAlbumDir(a.id);
      await prisma.photoAlbum.delete({ where: { id: a.id } }).catch(() => {});
    }
  } catch (e) {
    console.error('[albumTick]', e);
  }
}
