import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evly-storage-'));
process.env.STORAGE_DIR = dir;

describe('stockage local des fichiers', async () => {
  const sharp = (await import('sharp')).default;
  const { storeFile, readStored, thumbnail, destroyFiles } = await import('./storage');
  let png: Buffer;
  beforeAll(async () => { png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#ea5a2b' } }).png().toBuffer(); });

  it('enregistre, relit, réduit puis efface (avec les miniatures)', async () => {
    const s = await storeFile(png, 'plan_1', 'image/png', 'image');
    expect(s.url).toMatch(/^local:plan_1\/[0-9a-f-]+\.png$/);
    const att = { id: 'a1', ...s, mimeType: 'image/png' };
    expect((await readStored(att)).equals(png)).toBe(true);
    const thumb = await thumbnail(att, 300);
    expect(thumb?.type).toBe('image/png');
    expect((await sharp(thumb!.buffer).metadata()).width).toBe(300);
    expect(fs.readdirSync(path.join(dir, 'plan_1'))).toHaveLength(2); // original + miniature en cache
    await destroyFiles([att]);
    expect(fs.existsSync(path.join(dir, 'plan_1'))).toBe(false);
  });

  it('refuse un chemin qui sort du dossier', async () => {
    await expect(readStored({ url: 'local:../../etc/passwd', publicId: 'x', resourceType: 'raw' })).rejects.toThrow();
  });
});
