import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import prisma from './prisma';
import { STORAGE_DIR } from './storage';

// Suivi de l'espace (panneau admin) : base de données, fichiers (photos, documents, messages vocaux, photos de profil
// et de Cercle), sauvegardes locales et disque du serveur. Rien n'est calculé en continu : seulement à l'ouverture du panneau.
const BACKUP_DIR = process.env.BACKUP_DIR || '/srv/evly/backups';

// Taille d'un dossier en octets (du), 0 s'il n'existe pas
function folderSize(dir: string): Promise<number> {
  return new Promise(resolve => {
    execFile('du', ['-sk', dir], { timeout: 20_000 }, (err, out) => {
      if (err) { resolve(0); return; }
      resolve((Number(out.split(/\s+/)[0]) || 0) * 1024);
    });
  });
}

export async function storageStats() {
  const [db, files, photos, backups, disk, attachments] = await Promise.all([
    prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`.then(r => Number(r[0]?.size ?? 0)).catch(() => 0),
    folderSize(STORAGE_DIR),
    folderSize(path.join(STORAGE_DIR, 'photos')),
    folderSize(BACKUP_DIR),
    fs.statfs(STORAGE_DIR).then(s => ({ total: s.blocks * s.bsize, free: s.bavail * s.bsize })).catch(() => null),
    prisma.attachment.aggregate({ _count: true, _sum: { size: true } }),
  ]);
  return {
    database: db,
    files,
    photos,
    backups,
    disk,
    attachments: { count: attachments._count, size: attachments._sum.size ?? 0 },
    at: new Date().toISOString(),
  };
}
