import { demoPhotoUrl, isDemo } from './demo';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;

// Adresse d'affichage d'une pièce jointe : jamais l'URL Cloudinary, toujours via le serveur
// avec le jeton média du Plan. `width` : miniature (images seulement).
export function mediaUrl(attachmentId: string, token: string | undefined, width?: number): string {
  if (isDemo()) return demoPhotoUrl(attachmentId);
  const params = new URLSearchParams({ t: token ?? '' });
  if (width) params.set('w', String(width));
  return `${API_BASE}/attachments/${attachmentId}/view?${params.toString()}`;
}
