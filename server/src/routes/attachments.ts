import { Router } from 'express';
import multer from 'multer';
import https from 'https';
import http from 'http';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth as any);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function streamUpload(buffer: Buffer, options: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err, result) => (result ? resolve(result) : reject(err)),
    );
    stream.end(buffer);
  });
}

// POST /api/attachments/plans/:planId  — upload
router.post('/plans/:planId', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Fichier manquant' }); return; }

    const plan = await prisma.plan.findUnique({ where: { id: req.params.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const isMember = await prisma.circleMember.findUnique({
      where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
    });
    if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const result = await streamUpload(req.file.buffer, {
      folder: `estelle/${req.params.planId}`,
      resource_type: 'auto',
      use_filename: false,
    });

    const attachment = await prisma.attachment.create({
      data: {
        planId:       req.params.planId,
        name:         req.file.originalname,
        url:          result.secure_url,
        publicId:     result.public_id,
        resourceType: result.resource_type,
        mimeType:     req.file.mimetype,
        size:         req.file.size,
        uploadedBy:   req.pseudo!,
      },
    });

    res.json(attachment);
  } catch (e) {
    console.error('[attachment upload]', e);
    res.status(500).json({ error: "Erreur lors de l'envoi du fichier" });
  }
});

function proxyFetch(url: string, mimeType: string, filename: string, res: any, depth = 0): void {
  if (depth > 5) { res.status(502).json({ error: 'Trop de redirections' }); return; }
  const proto = url.startsWith('https') ? https : http;
  proto.get(url, { headers: { 'Accept-Encoding': 'identity' } }, (upstream) => {
    // Suivre les redirections (301/302/307/308)
    if ((upstream.statusCode ?? 0) >= 300 && (upstream.statusCode ?? 0) < 400 && upstream.headers.location) {
      upstream.resume();
      return proxyFetch(upstream.headers.location, mimeType, filename, res, depth + 1);
    }
    const encoded = encodeURIComponent(filename).replace(/'/g, '%27');
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    upstream.pipe(res);
  }).on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'Impossible de récupérer le fichier' });
  });
}

// GET /api/attachments/:id/download — proxy le fichier pour forcer le téléchargement
router.get('/:id/download', async (req: AuthRequest, res) => {
  try {
    const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!att) { res.status(404).json({ error: 'Pièce jointe introuvable' }); return; }

    const plan = await prisma.plan.findUnique({ where: { id: att.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const isMember = await prisma.circleMember.findUnique({
      where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
    });
    if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

    proxyFetch(att.url, att.mimeType, att.name, res);
  } catch (e) {
    console.error('[attachment download]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!att) { res.status(404).json({ error: 'Pièce jointe introuvable' }); return; }

    const plan = await prisma.plan.findUnique({ where: { id: att.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const canDelete = att.uploadedBy === req.pseudo || plan.creatorId === req.userId;
    if (!canDelete) { res.status(403).json({ error: 'Accès refusé' }); return; }

    await cloudinary.uploader.destroy(att.publicId, { resource_type: att.resourceType as any });
    await prisma.attachment.delete({ where: { id: req.params.id } });

    res.json({ deleted: true });
  } catch (e) {
    console.error('[attachment delete]', e);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
