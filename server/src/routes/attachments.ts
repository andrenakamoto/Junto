import { Router } from 'express';
import multer from 'multer';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
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

    // Les images → resource_type 'image' (optimisation CDN)
    // PDF, Word, Excel, etc. → resource_type 'raw' (fichier brut, téléchargeable directement)
    const isImageMime = req.file.mimetype.startsWith('image/');
    const result = await streamUpload(req.file.buffer, {
      folder: `estelle/${req.params.planId}`,
      resource_type: isImageMime ? 'image' : 'raw',
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

function fetchBuffer(url: string, depth = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (depth > 5) { reject(new Error('Trop de redirections')); return; }
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } }, (upstream) => {
      const code = upstream.statusCode ?? 0;
      if (code >= 300 && code < 400 && upstream.headers.location) {
        upstream.resume();
        fetchBuffer(upstream.headers.location, depth + 1).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      const enc = upstream.headers['content-encoding'];
      let stream: NodeJS.ReadableStream = upstream;
      if (enc === 'gzip')    stream = upstream.pipe(zlib.createGunzip());
      else if (enc === 'br') stream = upstream.pipe(zlib.createBrotliDecompress());
      else if (enc === 'deflate') stream = upstream.pipe(zlib.createInflate());
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    }).on('error', reject);
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

    // Pour les PDFs anciens stockés comme 'image', ajouter fl_attachment aide le CDN
    // à renvoyer le fichier brut plutôt qu'une image convertie
    let fetchUrl = att.url;
    if (att.resourceType === 'image' && att.url.includes('/upload/') && !att.url.includes('/upload/fl_attachment/')) {
      fetchUrl = att.url.replace('/upload/', '/upload/fl_attachment/');
    }

    const buffer = await fetchBuffer(fetchUrl);

    if (buffer.length === 0) {
      res.status(502).json({
        error: 'Fichier introuvable chez Cloudinary (0 octets). Supprimez cette pièce jointe et ré-uploadez-la.',
      });
      return;
    }

    const encoded = encodeURIComponent(att.name).replace(/'/g, '%27');
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  } catch (e) {
    console.error('[attachment download]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors du téléchargement', details: String(e) });
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
