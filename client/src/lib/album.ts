// Album souvenir d'une soirée (serveur : routes/albums.ts). Ouvert à qui a le lien, sans compte : l'appareil reçoit un identifiant
// (pour retirer ses propres photos et compter ses cœurs) et le prénom est retenu, dans le navigateur seulement.
import { publicOrigin } from './siteUrl';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
const DEVICE_KEY = 'evly_album_device';
const NAME_KEY = 'evly_album_name';

export type AlbumPhoto = { id: string; key: string; width: number; height: number; author: string; createdAt: string; hidden: boolean; likes: number; liked: boolean; mine: boolean };
export type AlbumView = {
  id: string; title: string; token: string; eventEnd: string; expiresAt: string; planId: string | null; canManage: boolean;
  photoCount: number; contributorCount: number; myCount: number; maxPerDevice: number; full: boolean; photos: AlbumPhoto[];
};
export type OwnAlbum = { id: string; token: string; expiresAt: string; title: string; photoCount: number };

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };

export function albumDevice(): string {
  let id = safeGet(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const b = new Uint8Array(18); crypto.getRandomValues(b);
    id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    safeSet(DEVICE_KEY, id);
  }
  return id;
}
export const albumName = () => safeGet(NAME_KEY) ?? '';
export const saveAlbumName = (n: string) => safeSet(NAME_KEY, n.trim());

export const albumLink = (token: string) => `${publicOrigin()}/album?t=${encodeURIComponent(token)}`;
export const albumPhotoUrl = (token: string, key: string, thumb = false) => `${API_BASE}/albums/files/${token}/${key}${thumb ? '-s' : ''}.jpg`;
export const albumZipUrl = (token: string) => `${API_BASE}/albums/public/${token}/zip`;

/**
 * Photo réduite dans le téléphone avant l'envoi (2048 px, JPEG) : beaucoup plus rapide sur le réseau d'une salle pleine.
 * Si le navigateur ne sait pas la lire (format rare), on envoie l'original : le serveur s'en charge.
 */
export async function shrinkPhoto(file: File, max = 2048): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}
