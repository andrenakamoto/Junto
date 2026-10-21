import { useEffect, useState } from 'react';

// État de la connexion au serveur, pour expliquer un écran vide sans réseau (OfflineBanner) et tout
// recharger quand elle revient. « Hors ligne » = le téléphone n'a pas de réseau, ou une requête n'a reçu
// aucune réponse (serveur injoignable) ; la moindre réponse du serveur, même une erreur, remet « en ligne ».

const RETRY_MS = 5000;
const listeners = new Set<(offline: boolean) => void>();
let offline = typeof navigator !== 'undefined' && navigator.onLine === false;
let timer: number | undefined;

function healthUrl(): string {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  return api.replace(/\/api\/?$/, '') + '/health';
}

export function isOffline() { return offline; }

function set(next: boolean) {
  if (next === offline) return;
  offline = next;
  listeners.forEach(l => l(offline));
  // Retour du réseau : les écrans rechargent ce qu'ils n'ont pas pu charger
  if (!offline) window.dispatchEvent(new Event('evly-online'));
  window.clearTimeout(timer);
  if (offline) timer = window.setTimeout(probe, RETRY_MS);
}

export function markOnline() { set(false); }
export function markOffline() { set(true); }

// Vérifie le serveur (route publique /health) ; recommence toutes les 5 s tant qu'il ne répond pas
export async function probe(): Promise<boolean> {
  window.clearTimeout(timer);
  try {
    const ctrl = new AbortController();
    const stop = window.setTimeout(() => ctrl.abort(), 4000);
    await fetch(healthUrl(), { cache: 'no-store', signal: ctrl.signal });
    window.clearTimeout(stop);
    set(false);
    return true;
  } catch {
    offline = true;
    listeners.forEach(l => l(offline));
    timer = window.setTimeout(probe, RETRY_MS);
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set(true));
  window.addEventListener('online', () => { probe(); });
  if (offline) timer = window.setTimeout(probe, RETRY_MS);
}

export function useOffline(): boolean {
  const [value, setValue] = useState(offline);
  useEffect(() => {
    setValue(offline);
    listeners.add(setValue);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

// Appelle fn à chaque retour de la connexion
export function useOnReconnect(fn: () => void) {
  useEffect(() => {
    window.addEventListener('evly-online', fn);
    return () => window.removeEventListener('evly-online', fn);
  }, [fn]);
}
