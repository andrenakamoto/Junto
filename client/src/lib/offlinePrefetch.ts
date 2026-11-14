import api from '../services/api';
import { blobPut } from './offlineCache';
import { mediaUrl } from './media';
import { isDemo } from './demo';
import type { Plan } from '../types';

// « Mes prochains Plans » toujours dans le téléphone (2026-11-14) : pour chaque Plan en cours ou qui commence dans les
// 3 prochains jours, auquel la personne a répondu « Je suis in » ou « Peut-être », les rubriques utiles le jour J sont
// chargées d'avance (et donc gardées par offlineCache) : fiche, chat, « En bref », trajets, transports publics, tâches,
// déroulé, planning, matériel, dépenses, et l'affiche. Au plus une fois toutes les 30 minutes par Plan.

const WINDOW_MS = 3 * 86400_000;
const EVERY_MS = 30 * 60_000;
const KEY = 'evly_offline_prefetch';

function lastRuns(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveRun(planId: string) {
  try {
    const runs = lastRuns(); runs[planId] = Date.now();
    for (const [id, at] of Object.entries(runs)) if (Date.now() - at > WINDOW_MS * 2) delete runs[id];
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch { /* rien */ }
}

let running = false;
export async function prefetchUpcoming(plans: Plan[], userId: string | undefined) {
  if (running || !userId || isDemo()) return;
  const now = Date.now();
  const runs = lastRuns();
  const due = plans.filter(p => {
    const start = p.eventDate ? new Date(p.eventDate).getTime() : new Date(p.endDate).getTime();
    const end = new Date(p.endDate).getTime();
    const mine = p.members?.find(m => m.userId === userId);
    return end > now && start - now < WINDOW_MS && !!mine && mine.rsvp !== 'out' && now - (runs[p.id] ?? 0) > EVERY_MS;
  });
  if (!due.length) return;
  running = true;
  try {
    for (const p of due) {
      const get = (url: string, params?: Record<string, unknown>) => api.get(url, { params }).then(r => r.data).catch(() => null);
      const full: Plan | null = await get(`/plans/${p.id}`);
      if (!full) continue;
      const off = (f: string) => (full.disabledFeatures ?? []).includes(f as any);
      const on = (f: string) => (full.enabledFeatures ?? []).includes(f as any);
      const jobs: Promise<unknown>[] = [get(`/plans/${p.id}/summary`)];
      if (!off('chat')) jobs.push(get(`/plans/${p.id}/messages`, { all: 1 }));
      if (!off('trajets')) jobs.push(get(`/rides/plan/${p.id}`), get(`/plans/${p.id}/transit`));
      if (!off('depenses')) jobs.push(get(`/plans/${p.id}/expenses`));
      if (on('taches')) jobs.push(get(`/plans/${p.id}/tasks`));
      if (on('deroule')) jobs.push(get(`/plans/${p.id}/program`));
      if (on('benevoles')) jobs.push(get(`/plans/${p.id}/shifts`));
      if (on('materiel')) jobs.push(get(`/plans/${p.id}/equipment`));
      if (on('mystere')) jobs.push(get(`/plans/${p.id}/mystery`));
      await Promise.all(jobs);
      // Affiche du Plan (« affiche-… »), en image gardée
      const poster = (full.attachments ?? []).find(a => a.name.startsWith('affiche-') && a.mimeType.startsWith('image/'));
      if (poster && full.mediaToken) {
        try {
          const res = await fetch(mediaUrl(poster.id, full.mediaToken, 1200));
          if (res.ok) blobPut(`poster:${poster.id}`, await res.blob());
        } catch { /* hors ligne : tant pis */ }
      }
      saveRun(p.id);
    }
    // Liste des Plans de leurs Cercles (pour y naviguer sans réseau)
    await Promise.all([...new Set(due.map(p => p.circleId).filter(Boolean))].map(id => api.get(`/circles/${id}/plans`).catch(() => null)));
  } finally { running = false; }
}
