const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;

// Photos de profil et de Cercle (serveur : lib/photos.ts). Adresse publique, impossible à deviner, en cache
// longue durée : une nouvelle photo a une nouvelle clé. Démo : clés « demo/… » = fichiers de public/demo.
export function photoUrl(key: string, small = false): string {
  if (key.startsWith('demo/')) return `/${key}`;
  return `${API_BASE}/photos/${key}${small ? '-s' : ''}.jpg`;
}

// Taille la plus grande du recadrage envoyé (la partie choisie de la photo, sans agrandissement) : 1024 px pour un profil,
// 3200 × 1600 pour un Cercle (2026-11-15 : la photo d'un Cercle s'ouvre en grand, 1600 × 800 la rendait floue)
export const CROP_OUTPUT: Record<1 | 2, [number, number]> = { 1: [1024, 1024], 2: [3200, 1600] };
// Photo de Cercle ou de profil en grande taille (visionneuse) ; anciennes photos : le serveur renvoie la taille normale
export const largePhotoUrl = (key: string) => photoUrl(key).replace(/\.jpg$/, '-l.jpg');
