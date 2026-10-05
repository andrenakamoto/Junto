import { Capacitor } from '@capacitor/core';
import api from '../services/api';

// Toutes les photos d'un Plan dans un ZIP. Apps : ouvert dans le navigateur du téléphone (lien
// signé temporaire) ; site : téléchargement direct. Partagé par l'onglet Infos et la barre
// d'actions de la page principale du Plan (téléphone).
export async function downloadPlanPhotos(plan: { id: string; title: string }) {
  if (Capacitor.isNativePlatform()) {
    const { data } = await api.get(`/attachments/plans/${plan.id}/photos-token`);
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
    window.open(`${base}/attachments/plans/${plan.id}/photos/download?token=${data.token}`, '_system');
    return;
  }
  const res = await api.get(`/attachments/plans/${plan.id}/photos/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.title.replace(/[/\\:*?"<>|]/g, '_')} - photos.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function planImageCount(plan: { attachments?: { mimeType: string }[] }) {
  return (plan.attachments ?? []).filter(a => a.mimeType.startsWith('image/')).length;
}
