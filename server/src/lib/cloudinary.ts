import { v2 as cloudinary } from 'cloudinary';
import prisma from './prisma';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

type StoredFile = { id: string; publicId: string; resourceType: string };

// Efface les fichiers chez Cloudinary. Sans cet appel, supprimer une ligne
// Attachment (ou un Plan en cascade) laisse le fichier en ligne indéfiniment.
// Au mieux possible : un échec est journalisé mais ne bloque pas la suppression en base.
export async function destroyFiles(files: StoredFile[]) {
  await Promise.all(files.map(async f => {
    try {
      await cloudinary.uploader.destroy(f.publicId, { resource_type: f.resourceType as any, invalidate: true });
    } catch (e) {
      console.error('[cloudinary destroy]', f.id, e);
    }
  }));
}

// À appeler AVANT de supprimer des Plans en base (après, les lignes Attachment ont disparu)
export async function purgePlanFiles(planIds: string[]) {
  if (planIds.length === 0) return;
  const files = await prisma.attachment.findMany({
    where: { planId: { in: planIds } },
    select: { id: true, publicId: true, resourceType: true },
  });
  await destroyFiles(files);
}

export async function purgeCircleFiles(circleId: string) {
  const plans = await prisma.plan.findMany({ where: { circleId }, select: { id: true } });
  await purgePlanFiles(plans.map(p => p.id));
}
