// Compteur anonyme des visites des pages publiques : un total par jour et par
// page, rien d'autre (ni cookie, ni IP, ni identifiant). Les robots sont écartés.

export const TRACKED_PAGES = ['decouvrir', 'brochure'] as const;

// Fichiers téléchargés via GET /api/stats/go/:page (compte, puis redirige vers le fichier)
export const TRACKED_FILES: Record<string, string> = {
  brochure: 'https://www.evly.ch/fichiers/evly-associations-entreprises.pdf',
};

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|curl|wget|python|axios|node-fetch/i;

export function isBot(userAgent: string | undefined): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

// Jour civil à Genève (une visite à 00:30 heure suisse compte pour ce jour-là),
// renvoyé à minuit UTC pour la colonne DATE
export function visitDay(now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${ymd}T00:00:00Z`);
}

// Série continue des `days` derniers jours (jours sans visite à 0), du plus ancien au plus récent
export function fillDays(rows: { day: Date; count: number }[], days: number, today = visitDay()): { day: string; count: number }[] {
  const byDay = new Map(rows.map(r => [r.day.toISOString().slice(0, 10), r.count]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  return out;
}
