// Parcours d'inscription : compteurs anonymes (serveur : lib/funnel.ts, route /stats/visit).
// Un +1 sur le total du jour, sans cookie ni identifiant. `onceKey` : une seule fois par
// session de navigation pour la même chose (par exemple, un même Plan partagé deux fois).
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;

export type ClientFunnelStep = 'funnel_cta_signup' | 'funnel_cta_express' | 'funnel_express_shared';

export function countStep(step: ClientFunnelStep, onceKey?: string) {
  try {
    if (onceKey) {
      const k = `evly_step_${step}_${onceKey}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    }
  } catch { /* stockage indisponible : on compte quand même */ }
  const url = `${API_BASE}/stats/visit?page=${step}`;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url)) return;
  } catch { /* on retombe sur fetch */ }
  fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
}
