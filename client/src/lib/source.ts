// Provenance des visiteurs (campagnes, serveur : lib/funnel.ts) : un lien evly.ch/…?src=instagram compte une visite pour
// cette source (une fois par session de navigation) et la garde 30 jours sur l'appareil ; jointe à l'inscription
// (sourceField), elle compte une inscription pour la source. Rien d'autre n'est envoyé, aucun identifiant.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
export const SOURCES = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'email', 'affiche', 'partenaire'] as const;
const KEY = 'evly_src';
const KEEP_MS = 30 * 864e5;

export function captureSource() {
  try {
    const src = new URLSearchParams(window.location.search).get('src');
    if (!src || !(SOURCES as readonly string[]).includes(src)) return;
    localStorage.setItem(KEY, JSON.stringify({ src, at: Date.now() }));
    const once = `evly_src_counted_${src}`;
    if (sessionStorage.getItem(once)) return;
    sessionStorage.setItem(once, '1');
    const url = `${API_BASE}/stats/visit?page=src_${src}`;
    if (!(navigator.sendBeacon && navigator.sendBeacon(url))) fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  } catch { /* stockage indisponible : pas de suivi */ }
}

// À joindre au corps de /auth/register et /auth/google
export function sourceField(): { src?: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { src: string; at: number } | null;
    return saved && Date.now() - saved.at < KEEP_MS ? { src: saved.src } : {};
  } catch { return {}; }
}
