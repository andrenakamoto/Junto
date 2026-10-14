import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { execFile } from 'child_process';
import sharp from 'sharp';
import prisma from './prisma';

// Fichiers des Plans (photos, documents, messages vocaux), stockés sur le disque du serveur en Suisse
// (STORAGE_DIR, /srv/evly/files en production) depuis la migration chez Infomaniak (2026-10). Remplace
// Cloudinary : miniatures faites par sharp, conversion des messages vocaux en MP3 par ffmpeg (iPhone ne lit
// pas le WebM d'Android), les deux gardées en cache à côté du fichier. Attachment.url vaut « local:<chemin> » ;
// une ancienne adresse https (Cloudinary, avant scripts/migrateFilesToLocal.ts) reste lisible telle quelle.
// L'adresse ne sort jamais du serveur : les fichiers passent par /api/attachments/:id/view|download.

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));
const LOCAL = 'local:';

export type FileKind = 'image' | 'video' | 'raw';
type Stored = { id?: string; url: string; publicId: string; resourceType: string; mimeType?: string };

const isLocal = (url: string) => url.startsWith(LOCAL);

// Chemin absolu d'un fichier, sans jamais sortir de STORAGE_DIR
function absolute(rel: string): string {
  const p = path.resolve(STORAGE_DIR, rel);
  if (!p.startsWith(STORAGE_DIR + path.sep)) throw new Error('Chemin de fichier invalide');
  return p;
}

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/heic': '.heic',
  'image/heif': '.heif', 'image/avif': '.avif', 'application/pdf': '.pdf', 'audio/webm': '.webm', 'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/aac': '.aac', 'audio/wav': '.wav',
};

// Enregistre un fichier envoyé : <planId>/<uuid>.<ext>
export async function storeFile(buffer: Buffer, planId: string, mimeType: string, kind: FileKind) {
  const rel = `${planId.replace(/[^a-z0-9_-]/gi, '')}/${crypto.randomUUID()}${EXT[mimeType] ?? ''}`;
  await fs.mkdir(path.dirname(absolute(rel)), { recursive: true });
  await fs.writeFile(absolute(rel), buffer, { mode: 0o640 });
  return { url: LOCAL + rel, publicId: rel, resourceType: kind };
}

// Lecture d'une adresse https (anciens fichiers Cloudinary, script de migration)
export function fetchBuffer(url: string, depth = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (depth > 5) { reject(new Error('Trop de redirections')); return; }
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } }, upstream => {
      const code = upstream.statusCode ?? 0;
      if (code >= 300 && code < 400 && upstream.headers.location) {
        upstream.resume();
        fetchBuffer(upstream.headers.location, depth + 1).then(resolve, reject);
        return;
      }
      if (code >= 400) { upstream.resume(); reject(new Error(`HTTP ${code}`)); return; }
      const chunks: Buffer[] = [];
      const enc = upstream.headers['content-encoding'];
      let stream: NodeJS.ReadableStream = upstream;
      if (enc === 'gzip') stream = upstream.pipe(zlib.createGunzip());
      else if (enc === 'br') stream = upstream.pipe(zlib.createBrotliDecompress());
      else if (enc === 'deflate') stream = upstream.pipe(zlib.createInflate());
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

// Contenu d'origine d'un fichier
export async function readStored(att: Stored): Promise<Buffer> {
  return isLocal(att.url) ? fs.readFile(absolute(att.url.slice(LOCAL.length))) : fetchBuffer(att.url);
}

async function cached(file: string, make: () => Promise<Buffer>): Promise<Buffer> {
  try { return await fs.readFile(file); } catch { /* pas encore en cache */ }
  const out = await make();
  await fs.writeFile(file, out, { mode: 0o640 }).catch(() => {});
  return out;
}

// Miniature d'une image (largeur 64–1600 px), même format que l'original (JPEG pour le reste).
// null si l'image ne peut pas être réduite (format non pris en charge) : on sert alors l'original.
export async function thumbnail(att: Stored, width: number): Promise<{ buffer: Buffer; type: string } | null> {
  if (!isLocal(att.url) || att.resourceType !== 'image') return null;
  const w = Math.min(Math.max(Math.round(width), 64), 1600);
  const src = absolute(att.url.slice(LOCAL.length));
  const png = att.mimeType === 'image/png';
  try {
    const buffer = await cached(`${src}.w${w}${png ? '.png' : '.jpg'}`, () => {
      const img = sharp(src, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true });
      return (png ? img.png() : img.jpeg({ quality: 80, mozjpeg: true })).toBuffer();
    });
    return { buffer, type: png ? 'image/png' : 'image/jpeg' };
  } catch (e) {
    console.error('[miniature]', att.id, (e as Error).message);
    return null;
  }
}

// Message vocal en MP3 (lisible sur iPhone comme sur Android)
export async function voiceMp3(att: Stored): Promise<Buffer> {
  if (!isLocal(att.url)) return fetchBuffer(att.url.replace(/\.[a-z0-9]+$/i, '.mp3')); // ancien fichier Cloudinary
  const src = absolute(att.url.slice(LOCAL.length));
  return cached(`${src}.mp3`, () => new Promise<Buffer>((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', src, '-vn', '-codec:a', 'libmp3lame', '-q:a', '5', '-f', 'mp3', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 30 * 1024 * 1024, timeout: 60_000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout as Buffer)));
  }));
}

// Efface des fichiers (et leurs miniatures / MP3 en cache). Au mieux possible : un échec est journalisé
// mais ne bloque pas la suppression en base. Les anciens fichiers Cloudinary sont laissés tels quels
// (tous rapatriés en Suisse par scripts/migrateFilesToLocal.ts).
export async function destroyFiles(files: Stored[]) {
  await Promise.all(files.filter(f => isLocal(f.url)).map(async f => {
    try {
      const src = absolute(f.url.slice(LOCAL.length));
      const dir = path.dirname(src);
      const base = path.basename(src);
      for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
        if (name === base || name.startsWith(base + '.')) await fs.rm(path.join(dir, name), { force: true });
      }
      await fs.rmdir(dir).catch(() => {}); // dossier du Plan supprimé s'il est vide
    } catch (e) {
      console.error('[fichier supprimé]', f.id, (e as Error).message);
    }
  }));
}

// À appeler AVANT de supprimer des Plans en base (après, les lignes Attachment ont disparu)
export async function purgePlanFiles(planIds: string[]) {
  if (planIds.length === 0) return;
  const files = await prisma.attachment.findMany({
    where: { planId: { in: planIds } },
    select: { id: true, url: true, publicId: true, resourceType: true },
  });
  await destroyFiles(files);
}

export async function purgeCircleFiles(circleId: string) {
  const plans = await prisma.plan.findMany({ where: { circleId }, select: { id: true } });
  await purgePlanFiles(plans.map(p => p.id));
  // Photo du Cercle (lib/photos.ts) : même dossier STORAGE_DIR/photos
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { photoKey: true } });
  if (circle?.photoKey && /^[0-9a-f-]{36}$/.test(circle.photoKey)) {
    await Promise.all(['', '-s'].map(s => fs.rm(path.join(STORAGE_DIR, 'photos', `${circle.photoKey}${s}.jpg`), { force: true })));
  }
}
