const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;

// Photos de profil et de Cercle (serveur : lib/photos.ts). Adresse publique, impossible à deviner, en cache
// longue durée : une nouvelle photo a une nouvelle clé. Démo : clés « demo/… » = fichiers de public/demo.
export function photoUrl(key: string, small = false): string {
  if (key.startsWith('demo/')) return `/${key}`;
  return `${API_BASE}/photos/${key}${small ? '-s' : ''}.jpg`;
}

// Recadrage : taille de l'image envoyée (le serveur la refait à 512 × 512 ou 1200 × 600)
export const CROP_OUTPUT: Record<1 | 2, [number, number]> = { 1: [1024, 1024], 2: [1600, 800] };
