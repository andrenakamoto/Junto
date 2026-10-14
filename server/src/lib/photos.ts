import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import prisma from './prisma';
import { STORAGE_DIR } from './storage';

// Photos de profil et photos de Cercle (2026-10-14). Stockées sur le serveur en Suisse, dans STORAGE_DIR/photos :
// <clé>.jpg (grande) et <clé>-s.jpg (miniature). Le client les recadre déjà ; le serveur les refait quand même en
// JPEG à taille fixe, ce qui retire toutes les métadonnées (EXIF, position GPS des photos de téléphone).
// La clé est un uuid impossible à deviner : l'image est servie sans connexion (GET /api/photos/<clé>.jpg),
// en cache longue durée. Une nouvelle photo = une nouvelle clé ; l'ancienne est effacée du disque.

export type PhotoKind = 'avatar' | 'circle';

const SIZES: Record<PhotoKind, { big: [number, number]; small: [number, number] }> = {
  avatar: { big: [512, 512], small: [160, 160] },
  circle: { big: [1200, 600], small: [480, 240] },
};

const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isPhotoKey = (key: unknown): key is string => typeof key === 'string' && KEY_RE.test(key);

const DIR = path.join(STORAGE_DIR, 'photos');
export const photoFile = (key: string, small = false) => path.join(DIR, `${key}${small ? '-s' : ''}.jpg`);

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// Refait l'image envoyée aux deux tailles ; lève une erreur si ce n'est pas une image lisible
export async function savePhoto(buffer: Buffer, kind: PhotoKind): Promise<string> {
  const key = crypto.randomUUID();
  const { big, small } = SIZES[kind];
  const render = ([w, h]: [number, number]) => sharp(buffer, { limitInputPixels: 50_000_000 })
    .rotate() // orientation EXIF appliquée avant que les métadonnées ne disparaissent
    .resize(w, h, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const [b, s] = await Promise.all([render(big), render(small)]);
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(photoFile(key), b, { mode: 0o640 });
  await fs.writeFile(photoFile(key, true), s, { mode: 0o640 });
  return key;
}

export async function deletePhoto(key: string | null | undefined) {
  if (!isPhotoKey(key)) return;
  await Promise.all([fs.rm(photoFile(key), { force: true }), fs.rm(photoFile(key, true), { force: true })]);
}

// Personnes qu'on côtoie (Cercle ou Plan en commun) et qui ont une photo : { pseudo: clé }, soi-même compris
export async function avatarsSeenBy(userId: string): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: {
      avatarKey: { not: null },
      OR: [
        { id: userId },
        { memberships: { some: { circle: { members: { some: { userId } } } } } },
        { planMemberships: { some: { plan: { members: { some: { userId } } } } } },
      ],
    },
    select: { pseudo: true, avatarKey: true },
  });
  return Object.fromEntries(users.map(u => [u.pseudo, u.avatarKey!]));
}

// Peut-on voir (donc signaler) la photo de ce compte ou de ce Cercle ?
export async function canSeePhotoOf(kind: string, targetId: string, userId: string): Promise<string | null> {
  if (kind === 'user') {
    if (targetId === userId) return null;
    const u = await prisma.user.findFirst({
      where: {
        id: targetId,
        OR: [
          { memberships: { some: { circle: { members: { some: { userId } } } } } },
          { planMemberships: { some: { plan: { members: { some: { userId } } } } } },
        ],
      },
      select: { avatarKey: true },
    });
    return u?.avatarKey ?? null;
  }
  if (kind === 'circle') {
    const c = await prisma.circle.findFirst({ where: { id: targetId, members: { some: { userId } } }, select: { photoKey: true } });
    return c?.photoKey ?? null;
  }
  return null;
}
