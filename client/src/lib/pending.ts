// Actions en cours (2026-11-03) : nombre de requêtes d'écriture qui attendent le serveur, pour la barre ActivityBar.
// Les envois automatiques, que personne n'a déclenchés d'un toucher, ne comptent pas.
const AUTOMATIC = [/\/seen$/, /\/seen-all$/, /^\/?push\/token/, /^\/?auth\/locale/, /^\/?stats\//];

let count = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach(l => l(count));

export function isTracked(method: string | undefined, url: string | undefined): boolean {
  const m = (method ?? 'get').toLowerCase();
  if (m === 'get' || m === 'head' || m === 'options') return false;
  return !AUTOMATIC.some(r => r.test((url ?? '').split('?')[0]));
}
export function startPending() { count++; emit(); }
export function endPending() { count = Math.max(0, count - 1); emit(); }
export function onPending(l: (n: number) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
