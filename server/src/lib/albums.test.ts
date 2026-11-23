import { describe, expect, it } from 'vitest';
import { expiresFor, isAlbumToken, newAlbumToken, parseAuthorName, parseDeviceId, albumFile } from './albums';

describe('album souvenir', () => {
  it('garde l’album 7 jours après la fin de la soirée', () => {
    expect(expiresFor(new Date('2026-12-05T02:00:00Z')).toISOString()).toBe('2026-12-12T02:00:00.000Z');
  });
  it('fabrique un lien impossible à deviner, et le reconnaît', () => {
    const t = newAlbumToken();
    expect(t).toHaveLength(24);
    expect(isAlbumToken(t)).toBe(true);
    expect(newAlbumToken()).not.toBe(t);
    expect(isAlbumToken('../etc/passwd')).toBe(false);
    expect(isAlbumToken({ not: '' })).toBe(false);
  });
  it('vérifie le prénom et l’appareil', () => {
    expect(parseAuthorName('  Léa   M. ')).toBe('Léa M.');
    expect(parseAuthorName('')).toBeNull();
    expect(parseAuthorName('x'.repeat(31))).toBeNull();
    expect(parseAuthorName(42)).toBeNull();
    expect(parseDeviceId('abcDEF123_-abcdef0')).toBe('abcDEF123_-abcdef0');
    expect(parseDeviceId('court')).toBeNull();
    expect(parseDeviceId('a b c d e f g h i j k')).toBeNull();
  });
  it('refuse une clé de fichier qui sortirait du dossier', () => {
    expect(() => albumFile('abc', '../../x')).toThrow();
    expect(albumFile('abc', '11111111-2222-3333-4444-555555555555', true)).toMatch(/albums\/abc\/11111111-2222-3333-4444-555555555555-s\.jpg$/);
  });
});
