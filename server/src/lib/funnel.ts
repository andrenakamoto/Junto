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
  { page: 'pere_noel', label: 'Visites de la page Père Noël secret' },
  { page: 'funnel_cta_santa', label: 'Clic « Organiser mon Père Noël secret »' },
  { page: 'funnel_demo', label: 'Démo ouverte' },
  { page: 'funnel_express_created', label: 'Plan express créé' },
  { page: 'funnel_express_shared', label: 'Lien d’un Plan express partagé' },
  { page: 'funnel_register', label: 'Inscription envoyée' },
  { page: 'funnel_verified', label: 'Email validé' },
  { page: 'funnel_first_plan', label: 'Premier Plan créé (avec compte)' },
] as const;

// Étapes envoyées par le site (clics), acceptées par /api/stats/visit
export const CLIENT_FUNNEL_PAGES = ['funnel_cta_signup', 'funnel_cta_express', 'funnel_express_shared', 'funnel_demo', 'pere_noel', 'funnel_cta_santa'] as const;

// Provenance des visiteurs (campagnes) : lien evly.ch/…?src=instagram. Le site compte une visite par source et par
// session (POST /stats/visit?page=src_<source>), garde la source sur l'appareil 30 jours (client/src/lib/source.ts) et
// la joint à l'inscription : le serveur compte alors src_<source>_signup. Liste fermée : rien d'autre n'est enregistré.
export const SOURCES = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'email', 'affiche', 'partenaire'] as const;
export const SOURCE_LABELS: Record<typeof SOURCES[number], string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', whatsapp: 'WhatsApp', email: 'Emails', affiche: 'Affiches et flyers', partenaire: 'Partenaires',
};
export const SOURCE_VISIT_PAGES = SOURCES.map(s => `src_${s}`);
const isSource = (v: unknown): v is typeof SOURCES[number] => typeof v === 'string' && (SOURCES as readonly string[]).includes(v);

// Inscription venue d'une campagne (champ `src` du corps de /auth/register et /auth/google)
export function countSourceSignup(src: unknown) {
  if (isSource(src)) bump(`src_${src}_signup`);
}

export type ServerFunnelStep = 'funnel_express_created' | 'funnel_register' | 'funnel_verified' | 'funnel_first_plan';

export function countFunnel(page: ServerFunnelStep) {
  bump(page);
}

function bump(page: string) {
  const day = visitDay();
  prisma.pageVisit.upsert({
    where: { page_day: { page, day } },
    create: { page, day, count: 1 },
    update: { count: { increment: 1 } },
  }).catch(e => console.error('[funnel]', e));
}
