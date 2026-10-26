import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import prisma from '../prisma';
import { STORAGE_DIR } from '../storage';

// Images des événements de Découvrir (Eventfrog, 2026-10-26). Règle d'Eventfrog : jamais d'adresse de leurs images dans l'app,
// une copie chez nous, avec le crédit fourni. Seulement pour les 14 prochains jours (ce que Découvrir montre), réduites à 600 px
// de large ; une nouvelle image = une nouvelle clé (cache 1 an), l'ancienne est effacée, les fichiers sans événement aussi.
const DIR = path.join(STORAGE_DIR, 'discover', 'img');
export const IMAGE_HORIZON_MS = 14 * 24 * 3600e3;
const MAX_BYTES = 12 * 1024 * 1024;
export const isImageKey = (k: string) => /^[0-9a-f-]{36}$/.test(k);
export const imageFile = (key: string) => path.join(DIR, `${key}.jpg`);

export interface SourceImage { url: string; credit: string | null }

async function download(url: string): Promise<Buffer> {
  if (!/^https:\/\//i.test(url)) throw new Error('adresse refusée');
  const res = await fetch(url, { headers: { 'User-Agent': 'EvLY/1.0 (info@evly.ch)' }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('image trop lourde');
  return sharp(buf, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 600, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true }).toBuffer(); // refaite par sharp : plus aucune métadonnée
}

// `images` : identifiant chez la source → image d'origine et crédit, pour les événements des 14 prochains jours
export async function syncEventImages(sourceId: string, images: Map<string, SourceImage>) {
  await fs.mkdir(DIR, { recursive: true });
  const rows = (await prisma.discoverEvent.findMany({
    where: { sourceId },
    select: { id: true, externalId: true, imageKey: true, imageSource: true, imageCredit: true },
  })).filter(r => images.has(r.externalId));
  let added = 0, failed = 0;
  const queue = rows.filter(r => { const img = images.get(r.externalId)!; return r.imageSource !== img.url || r.imageCredit !== img.credit; });
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const img = images.get(r.externalId)!;
      try {
        if (r.imageSource === img.url && r.imageKey) {
          await prisma.discoverEvent.update({ where: { id: r.id }, data: { imageCredit: img.credit } });
          continue;
        }
        const key = randomUUID();
        await fs.writeFile(imageFile(key), await download(img.url));
        await prisma.discoverEvent.update({ where: { id: r.id }, data: { imageKey: key, imageSource: img.url, imageCredit: img.credit } });
        if (r.imageKey) await fs.rm(imageFile(r.imageKey), { force: true });
        added++;
      } catch { failed++; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // Fichiers dont l'événement n'existe plus (retiré par la source, passé)
  const used = new Set((await prisma.discoverEvent.findMany({ where: { imageKey: { not: null } }, select: { imageKey: true } })).map(r => r.imageKey!));
  for (const f of await fs.readdir(DIR)) {
    const key = f.replace(/\.jpg$/, '');
    if (!used.has(key)) await fs.rm(path.join(DIR, f), { force: true });
  }
  return { added, failed };
}
