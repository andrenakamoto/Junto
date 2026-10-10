import api from '../services/api';
import { saveFile } from './saveFile';
import { t } from '../i18n';

// Récapitulatif PDF d'un Plan (serveur : lib/planRecap.ts), réservé au créateur du Plan et aux
// gestionnaires du Cercle (plan.canRecap). Site : téléchargement ; apps : menu de partage.
export async function downloadPlanRecap(plan: { id: string; title: string }) {
  const res = await api.get(`/plans/${plan.id}/recap`, { responseType: 'blob' });
  const name = `${plan.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)} - ${t('plan.infos.recapFile')}.pdf`;
  await saveFile(res.data, name, t('plan.infos.recapTitle', { title: plan.title }));
}
