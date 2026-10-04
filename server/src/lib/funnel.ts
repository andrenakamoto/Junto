import prisma from './prisma';
import { visitDay } from './pageVisits';

// Parcours d'inscription : totaux anonymes par jour (table PageVisit, comme le compteur de la
// page Découvrir) — ni cookie, ni IP, ni identifiant. Affiché dans le panneau admin
// (GET /admin/funnel). Les étapes « client » arrivent par POST /api/stats/visit?page=… ;
// les autres sont comptées par le serveur (countFunnel).
export const FUNNEL_STEPS = [
  { page: 'decouvrir', label: 'Visites de la page Découvrir' },
  { page: 'funnel_cta_signup', label: 'Clic « Créer mon compte » (page Découvrir)' },
  { page: 'funnel_cta_express', label: 'Clic « Organiser une sortie »' },
  { page: 'funnel_demo', label: 'Démo ouverte' },
  { page: 'funnel_express_created', label: 'Plan express créé' },
  { page: 'funnel_express_shared', label: 'Lien d’un Plan express partagé' },
  { page: 'funnel_register', label: 'Inscription envoyée' },
  { page: 'funnel_verified', label: 'Email validé' },
  { page: 'funnel_first_plan', label: 'Premier Plan créé (avec compte)' },
] as const;

// Étapes envoyées par le site (clics), acceptées par /api/stats/visit
export const CLIENT_FUNNEL_PAGES = ['funnel_cta_signup', 'funnel_cta_express', 'funnel_express_shared', 'funnel_demo'] as const;

export type ServerFunnelStep = 'funnel_express_created' | 'funnel_register' | 'funnel_verified' | 'funnel_first_plan';

export function countFunnel(page: ServerFunnelStep) {
  const day = visitDay();
  prisma.pageVisit.upsert({
    where: { page_day: { page, day } },
    create: { page, day, count: 1 },
    update: { count: { increment: 1 } },
  }).catch(e => console.error('[funnel]', e));
}
