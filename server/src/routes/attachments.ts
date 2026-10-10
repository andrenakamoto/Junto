import { Router } from 'express';
import multer from 'multer';
import { fixUploadedFileName } from '../lib/fileName';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import jwt from 'jsonwebtoken';
import archiver from 'archiver';
import prisma from '../lib/prisma';
import { getPlanAccess } from '../lib/planAccess';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { cloudinary } from '../lib/cloudinary';
import { verifyMediaToken } from '../lib/mediaToken';
import { FEATURE_DISABLED_ERROR } from '../lib/settings';
import { broadcastWrites, resolveAttachmentWrite } from '../lib/realtime';
import { messageInclude } from '../lib/messageInclude';
import { withPlainContent } from '../lib/messageCrypto';

const router = Router();

// Types affichables directement par /view (images classiques, PDF) ; SVG exclu (peut contenir du script)
const SAFE_INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'application/pdf']);
// /download accepte aussi un token query param (mobile), et /view un jeton média :
// ces routes vérifient leur jeton elles-mêmes, donc exclues du middleware global
router.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('/download') && req.query.token) return next();
  if (req.method === 'GET' && req.path.endsWith('/view') && req.query.t) return next();
  return (requireAuth as any)(req, res, next);
});
router.use(broadcastWrites(resolveAttachmentWrite));

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

    const access = await getPlanAccess(req.userId!, plan.id);
    if (!access?.canView) { res.status(403).json({ error: 'Accès refusé' }); return; }
    // Photo d'une proposition de match (?via=match) : propre au match, indépendante des « Photos et fichiers »
    const viaMatch = req.query.via === 'match';
    // Photo d'une question de quiz (?via=quiz) : propre au quiz, nommée « quiz-… » par l'app (masquée d'Infos)
    const viaQuiz = req.query.via === 'quiz' && plan.enabledFeatures.includes('quiz');
    // Document de l'ordre du jour d'une assemblée (?via=assemblee) : possible même sans « Photos et fichiers »
    const viaAssembly = req.query.via === 'assemblee' && plan.enabledFeatures.includes('assemblee');
    if (!viaMatch && !viaQuiz && !viaAssembly && plan.disabledFeatures.includes('fichiers')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }

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
    // Envoi depuis le chat (?via=chat) : photos et messages vocaux uniquement, chat actif
    const viaChat = req.query.via === 'chat';
    const isVoice = viaChat && req.file.mimetype.startsWith('audio/');
    if (viaQuiz && !isImageMime) { res.status(400).json({ error: 'Seules les photos sont acceptées' }); return; }
    if (viaMatch) {
      if (!isImageMime) { res.status(400).json({ error: 'Seules les photos sont acceptées' }); return; }
      if (plan.disabledFeatures.includes('votes')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
    }
    if (viaChat) {
      if (!isImageMime && !isVoice) { res.status(400).json({ error: 'Seules les photos et les messages vocaux peuvent être envoyés dans le chat' }); return; }
      if (plan.disabledFeatures.includes('chat')) { res.status(403).json({ error: FEATURE_DISABLED_ERROR }); return; }
    }
    // Messages vocaux → resource_type 'video' (Cloudinary range l'audio avec la vidéo), pour
    // pouvoir les servir convertis en MP3, lisible partout (iPhone ne lit pas le WebM d'Android)
    const result = await streamUpload(req.file.buffer, {
      folder: `estelle/${req.params.planId}`,
      resource_type: isImageMime ? 'image' : isVoice ? 'video' : 'raw',
      use_filename: false,
    });

    const attachment = await prisma.attachment.create({
      data: {
        planId:       req.params.planId,
        name:         fixUploadedFileName(req.file.originalname),
        url:          result.secure_url,
        publicId:     result.public_id,
        resourceType: result.resource_type,
        mimeType:     req.file.mimetype.split(';')[0].trim(),
        size:         req.file.size,
        uploadedBy:   req.pseudo!,
      },
    });

    const { url: _url, publicId: _publicId, ...safe } = attachment;
    res.json(safe);
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
      if (code >= 400) {
        upstream.resume();
        reject(new Error(`HTTP ${code}`));
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

    const access = await getPlanAccess(req.userId!, plan.id);
    if (!access?.canView) { res.status(403).json({ error: 'Accès refusé' }); return; }

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

    const access = await getPlanAccess(req.userId!, plan.id);
    if (!access?.canView) { res.status(403).json({ error: 'Accès refusé' }); return; }

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

    const access = await getPlanAccess(req.userId, plan.id);
    if (!access?.canView) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const photos = await prisma.attachment.findMany({
      where: { planId: plan.id, mimeType: { startsWith: 'image/' }, matchOption: null, NOT: [{ name: { startsWith: 'match-' } }, { name: { startsWith: 'quiz-' } }] },
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

// GET /api/attachments/:id/view?t=<jeton média>[&w=400] — affiche un fichier du Plan sans
// jamais exposer son adresse Cloudinary au navigateur. `w` : miniature (images seulement).
router.get('/:id/view', async (req, res) => {
  try {
    const payload = verifyMediaToken(String(req.query.t || ''));
    if (!payload) { res.status(401).json({ error: 'Lien expiré, recharge la page' }); return; }

    const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!att || att.planId !== payload.planId) { res.status(404).json({ error: 'Fichier introuvable' }); return; }

    const width = Number(req.query.w);
    let buffer: Buffer | null = null;
    // Message vocal (?format=mp3) : converti en MP3 par Cloudinary
    const voice = req.query.format === 'mp3' && att.resourceType === 'video' && att.mimeType.startsWith('audio/') && /\.[a-z0-9]+$/i.test(att.url);
    if (voice) {
      buffer = await fetchBuffer(att.url.replace(/\.[a-z0-9]+$/i, '.mp3'));
      if (buffer.length === 0) { res.status(502).json({ error: 'Fichier indisponible' }); return; }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'inline; filename="message-vocal.mp3"');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Length', buffer.length.toString());
      res.end(buffer);
      return;
    }
    if (width > 0 && att.resourceType === 'image' && att.mimeType.startsWith('image/') && att.url.includes('/upload/')) {
      const w = Math.min(Math.max(Math.round(width), 64), 1600);
      buffer = await fetchBuffer(att.url.replace('/upload/', `/upload/c_limit,w_${w},q_auto/`)).catch(() => null);
    }
    if (!buffer || buffer.length === 0) buffer = await fetchBuffer(att.url);
    if (buffer.length === 0) { res.status(502).json({ error: 'Fichier indisponible' }); return; }

    const encoded = encodeURIComponent(att.name).replace(/'/g, '%27');
    // Affiché « en page » seulement pour les images classiques et les PDF. Le reste (HTML, SVG, XML…)
    // est forcé en téléchargement : sinon un fichier piégé s'ouvrirait comme une page du domaine de l'API.
    const inline = SAFE_INLINE_TYPES.has((att.mimeType || '').toLowerCase());
    res.setHeader('Content-Type', inline ? att.mimeType : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (inline && att.mimeType.startsWith('image/')) res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  } catch (e) {
    console.error('[attachment view]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de l\'affichage' });
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

    const access = await getPlanAccess(req.userId!, plan.id);
    if (!access?.canView) { res.status(403).json({ error: 'Accès refusé' }); return; }

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
    res.setHeader('X-Content-Type-Options', 'nosniff');
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

    // La personne qui a mis le fichier (à tout moment) ou le créateur du Plan
    const canDelete = att.uploadedBy.toLowerCase() === (req.pseudo ?? '').toLowerCase() || plan.creatorId === req.userId;
    if (!canDelete) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const linked = await prisma.message.findUnique({ where: { attachmentId: att.id }, select: { id: true } });
    await cloudinary.uploader.destroy(att.publicId, { resource_type: att.resourceType as any });
    await prisma.attachment.delete({ where: { id: req.params.id } });

    res.json({ deleted: true });
    // Photo envoyée dans le chat : le message reste, affiché « Photo retirée » chez tout le monde
    if (linked) {
      const message = await prisma.message.findUnique({ where: { id: linked.id }, include: messageInclude });
      if (message) req.app.get('io')?.to(`plan:${att.planId}`).emit('message-updated', withPlainContent(message));
    }
  } catch (e) {
    console.error('[attachment delete]', e);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
