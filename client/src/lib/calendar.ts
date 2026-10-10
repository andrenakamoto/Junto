import { Capacitor } from '@capacitor/core';
import api from '../services/api';
import { saveFile } from './saveFile';
import { publicOrigin } from './siteUrl';

// « Agenda » d'un Plan.
// - Apps Android / iPhone : ouvre directement l'écran « Nouvel événement » de l'agenda du téléphone,
//   déjà rempli (aucune autorisation demandée : on n'écrit pas nous-mêmes dans l'agenda).
// - Site, ou si l'agenda ne s'ouvre pas : fichier .ics (téléchargé, ou menu de partage dans les apps).
// Mêmes heures que le .ics du serveur (lib/ical.ts) : fin du Plan, ou 2 h après le début.
type CalendarPlan = { id: string; title: string; description?: string | null; location?: string | null; eventDate?: string | null; endDate: string };

export async function addPlanToCalendar(plan: CalendarPlan): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
      const end = new Date(plan.endDate).getTime();
      const start = plan.eventDate ? new Date(plan.eventDate).getTime() : end;
      const link = `${publicOrigin()}/dashboard?planId=${plan.id}`;
      await CapacitorCalendar.createEventWithPrompt({
        title: plan.title,
        location: plan.location ?? undefined,
        startDate: start,
        endDate: end > start ? end : start + 2 * 60 * 60 * 1000,
        isAllDay: !plan.eventDate,
        description: [plan.description?.trim(), link].filter(Boolean).join('\n\n'),
        url: link,
      });
      return;
    } catch (e) {
      console.warn('[agenda] écran natif indisponible, fichier .ics', e);
    }
  }
  const res = await api.get(`/plans/${plan.id}/ical`, { responseType: 'blob' });
  await saveFile(res.data, `${plan.title.replace(/[^a-z0-9]/gi, '_')}.ics`, plan.title);
}
