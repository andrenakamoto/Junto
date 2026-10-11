// Rapatrie sur le disque du serveur (STORAGE_DIR) les fichiers encore chez Cloudinary (migration Infomaniak,
// 2026-10). À lancer une fois sur le serveur, en tant qu'evly :
//   cd /srv/evly/app/server && set -a && . /etc/evly/database.env && set +a && \
//   STORAGE_DIR=/srv/evly/files npx ts-node --transpile-only scripts/migrateFilesToLocal.ts [--confirm]
// Sans --confirm : liste seulement. Les fichiers restent chez Cloudinary (supprimés avec le compte).
import prisma from '../src/lib/prisma';
import { fetchBuffer, storeFile, FileKind } from '../src/lib/storage';

(async () => {
  const confirm = process.argv.includes('--confirm');
  const files = await prisma.attachment.findMany({ where: { NOT: { url: { startsWith: 'local:' } } } });
  console.log(`${files.length} fichier(s) encore chez Cloudinary${confirm ? '' : ' (aperçu, --confirm pour copier)'}`);
  let ok = 0;
  for (const f of files) {
    try {
      const buffer = await fetchBuffer(f.url);
      if (buffer.length === 0) throw new Error('fichier vide');
      if (!confirm) { console.log('  à copier :', f.id, f.mimeType, buffer.length, 'octets'); continue; }
      const kind = (['image', 'video', 'raw'].includes(f.resourceType) ? f.resourceType : 'raw') as FileKind;
      const stored = await storeFile(buffer, f.planId, f.mimeType, kind);
      await prisma.attachment.update({ where: { id: f.id }, data: { url: stored.url, publicId: stored.publicId } });
      ok++;
      console.log('  copié :', f.id, buffer.length, 'octets');
    } catch (e) {
      console.error('  ÉCHEC :', f.id, (e as Error).message);
    }
  }
  if (confirm) console.log(`${ok}/${files.length} copié(s)`);
  await prisma.$disconnect();
})();
