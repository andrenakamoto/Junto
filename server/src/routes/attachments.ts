import { Router } from 'express';
import multer from 'multer';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import jwt from 'jsonwebtoken';
import archiver from 'archiver';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
// /download accepte aussi un token query param (mobile), donc exclu du middleware global
router.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('/download') && req.query.token) return next();
  return (requireAuth as any)(req, res, next);
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const PLAN_ATTACHMENTS_LIMIT = 100 * 1024 * 1024; // 100 MB cumulés par plan

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

    const { _sum } = await prisma.attachment.aggregate({
      where: { planId: req.params.planId },
      _sum: { size: true },
    });
    const currentTotal = _sum.size ?? 0;
    if (currentTotal + req.file.size > PLAN_ATTACHMENTS_LIMIT) {
      const remainingMb = Math.max(0, (PLAN_ATTACHMENTS_LIMIT - currentTotal) / (1024 * 1024));
      res.status(400).json({
        error: `Limite de 100 Mo de pièces jointes atteinte pour ce plan (il reste ${remainingMb.toFixed(1)} Mo).`,
      });
      return;
    }

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

// GET /api/attachments/:id/download-token — génère un token court (2 min) pour téléchargement mobile
router.get('/:id/download-token', async (req: AuthRequest, res) => {
  try {
    const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!att) { res.status(404).json({ error: 'Pièce jointe introuvable' }); return; }

    const plan = await prisma.plan.findUnique({ where: { id: att.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const isMember = await prisma.circleMember.findUnique({
      where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
    });
    if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const token = jwt.sign(
      { attachmentId: req.params.id, userId: req.userId },
      process.env.JWT_SECRET!,
      { expiresIn: '2m' },
    );
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la génération du token' });
  }
});

// GET /api/attachments/plans/:planId/photos-token — token court (2 min) pour le ZIP des photos sur mobile
router.get('/plans/:planId/photos-token', async (req: AuthRequest, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const isMember = await prisma.circleMember.findUnique({
      where: { userId_circleId: { userId: req.userId!, circleId: plan.circleId } },
    });
    if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const token = jwt.sign(
      { planId: plan.id, userId: req.userId, purpose: 'photos' },
      process.env.JWT_SECRET!,
      { expiresIn: '2m' },
    );
    res.json({ token });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la génération du token' });
  }
});

function uniqueZipEntryName(name: string, used: Set<string>): string {
  const safe = name.replace(/[/\\]/g, '_') || 'photo.jpg';
  if (!used.has(safe.toLowerCase())) { used.add(safe.toLowerCase()); return safe; }
  const dot = safe.lastIndexOf('.');
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let i = 2;
  while (used.has(`${base} (${i})${ext}`.toLowerCase())) i++;
  const candidate = `${base} (${i})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// GET /api/attachments/plans/:planId/photos/download — ZIP de toutes les photos du Plan
// Accepte Bearer header (web) ou ?token= query param (mobile), comme /:id/download
router.get('/plans/:planId/photos/download', async (req: AuthRequest, res) => {
  try {
    if (!req.userId && req.query.token) {
      try {
        const payload = jwt.verify(req.query.token as string, process.env.JWT_SECRET!) as {
          planId?: string;
          userId: string;
          purpose?: string;
        };
        if (payload.purpose !== 'photos' || payload.planId !== req.params.planId) {
          res.status(403).json({ error: 'Token invalide pour ce Plan' }); return;
        }
        req.userId = payload.userId;
      } catch {
        res.status(401).json({ error: 'Token expiré ou invalide' }); return;
      }
    }
    if (!req.userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

    const plan = await prisma.plan.findUnique({ where: { id: req.params.planId } });
    if (!plan) { res.status(404).json({ error: 'Plan introuvable' }); return; }

    const isMember = await prisma.circleMember.findUnique({
      where: { userId_circleId: { userId: req.userId, circleId: plan.circleId } },
    });
    if (!isMember) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const photos = await prisma.attachment.findMany({
      where: { planId: plan.id, mimeType: { startsWith: 'image/' } },
      orderBy: { createdAt: 'asc' },
    });
    if (photos.length === 0) { res.status(404).json({ error: 'Aucune photo dans ce Plan' }); return; }

    const zipName = `${plan.title.replace(/[/\\:*?"<>|]/g, '_')} - photos.zip`;
    const encoded = encodeURIComponent(zipName).replace(/'/g, '%27');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);

    // store: les JPEG/PNG sont déjà compressés, recompresser ne fait que coûter du CPU
    const archive = archiver('zip', { store: true });
    archive.on('error', (err) => {
      console.error('[photos zip]', err);
      res.destroy(err);
    });
    archive.pipe(res);

    const used = new Set<string>();
    for (const photo of photos) {
      try {
        const buffer = await fetchBuffer(photo.url);
        if (buffer.length === 0) continue;
        archive.append(buffer, { name: uniqueZipEntryName(photo.name, used) });
      } catch (e) {
        console.error('[photos zip] fetch', photo.id, e);
      }
    }
    await archive.finalize();
  } catch (e) {
    console.error('[photos zip]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la création du ZIP' });
    else res.destroy();
  }
});

// GET /api/attachments/:id/download — proxy le fichier pour forcer le téléchargement
// Accepte Bearer header (web) ou ?token= query param (mobile, navigateur système)
router.get('/:id/download', async (req: AuthRequest, res) => {
  try {
    // Auth via query token (mobile) si pas de Bearer header
    if (!req.userId && req.query.token) {
      try {
        const payload = jwt.verify(req.query.token as string, process.env.JWT_SECRET!) as {
          attachmentId: string;
          userId: string;
        };
        if (payload.attachmentId !== req.params.id) {
          res.status(403).json({ error: 'Token invalide pour cette pièce jointe' }); return;
        }
        req.userId = payload.userId;
      } catch {
        res.status(401).json({ error: 'Token expiré ou invalide' }); return;
      }
    }

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
