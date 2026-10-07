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

// Message vocal : servi converti en MP3 (lisible sur iPhone comme sur Android)
export function voiceUrl(attachmentId: string, token: string | undefined): string {
  const params = new URLSearchParams({ t: token ?? '', format: 'mp3' });
  return `${API_BASE}/attachments/${attachmentId}/view?${params.toString()}`;
}

// Durée enregistrée dans le nom du fichier vocal (« vocal-23s.webm »)
export function voiceSeconds(name: string): number | null {
  const m = /^vocal-(\d+)s/.exec(name);
  return m ? Number(m[1]) : null;
}

export const isVoiceNote = (a: { name: string; mimeType: string }) => a.mimeType.startsWith('audio/') && a.name.startsWith('vocal-');
