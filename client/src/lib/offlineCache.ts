// Consultation sans réseau (2026-11-14) : la dernière réponse des écrans principaux (Cercles, Plans, fiche d'un Plan,
// chat, « En bref », tâches, Jour J, trajets…) est gardée dans le téléphone (IndexedDB) et resservie quand le serveur
// ne répond pas. Rien n'est écrit hors ligne. Les données sont rangées par compte (identifiant tiré du jeton), effacées
// à la déconnexion et au bout de 21 jours. Le client API (services/api.ts) s'en sert ; prefetchUpcoming enregistre
// d'avance les Plans des prochains jours.

const DB = 'evly-offline';
const STORE = 'responses';
const BLOBS = 'blobs';
const MAX_AGE_MS = 21 * 86400_000;
const MAX_ENTRIES = 600;

// Réponses gardées (chemin sans /api, sans paramètres)
const CACHEABLE = [
  /^\/auth\/me$/, /^\/circles$/, /^\/circles\/[^/]+\/plans$/, /^\/circles\/[^/]+\/polls$/, /^\/circles\/polls\/[^/]+$/,
  /^\/plans$/, /^\/plans\/(?!guest-invite|seen)[^/]+$/,
  /^\/plans\/[^/]+\/(messages|summary|tasks|program|shifts|expenses|transit|equipment|ideas|matches|wheels|santa|killer|pot|teams|words|mystery)$/,
  /^\/rides\/plan\/[^/]+$/, /^\/circle-chat\/[^/]+$/, /^\/capsules\/(mine|plan\/[^/]+)$/,
  /^\/photos\/people$/, /^\/mutes$/, /^\/contacts$/, /^\/organisations\/mine$/, /^\/moderation\/blocks$/, /^\/circles\/invitations\/mine$/,
];

export function isCacheable(method: string | undefined, url: string | undefined, params?: Record<string, unknown>, responseType?: string) {
  if ((method ?? 'get').toLowerCase() !== 'get' || !url || (responseType && responseType !== 'json')) return false;
  const path = url.split('?')[0];
  // « Messages précédents » de la discussion : pas gardés
  if (params && 'before' in params) return false;
  return CACHEABLE.some(r => r.test(path));
}

// Compte connecté, d'après le jeton (pas de mémoire sans compte)
function accountId(): string | null {
  try {
    const tok = localStorage.getItem('estelle_token');
    if (!tok) return null;
    const payload = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch { return null; }
}

export function cacheKey(url: string, params?: Record<string, unknown>): string | null {
  const id = accountId();
  if (!id) return null;
  const path = url.split('?')[0];
  const query = new URLSearchParams(url.split('?')[1] ?? '');
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null) query.set(k, String(v));
  const sorted = [...query.entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${id}|${path}${sorted.length ? '?' + new URLSearchParams(sorted).toString() : ''}`;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
        req.result.createObjectStore(BLOBS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise(resolve => {
    try {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => resolve(undefined);
      t.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

interface Entry { data: unknown; at: number }

export function cachePut(key: string, data: unknown) {
  tx(STORE, 'readwrite', s => s.put({ data, at: Date.now() } as Entry, key)).catch(() => {});
}

export async function cacheGet(key: string): Promise<Entry | null> {
  const e = await tx<Entry>(STORE, 'readonly', s => s.get(key));
  if (!e || Date.now() - e.at > MAX_AGE_MS) return null;
  return e;
}

// Images gardées (affiches des prochains Plans)
export function blobPut(key: string, blob: Blob) {
  const id = accountId();
  if (id) tx(BLOBS, 'readwrite', s => s.put({ data: blob, at: Date.now() }, `${id}|${key}`)).catch(() => {});
}
export async function blobGet(key: string): Promise<Blob | null> {
  const id = accountId();
  if (!id) return null;
  const e = await tx<{ data: Blob; at: number }>(BLOBS, 'readonly', s => s.get(`${id}|${key}`));
  return e && Date.now() - e.at < MAX_AGE_MS ? e.data : null;
}

// Déconnexion, suppression du compte, jeton refusé : tout est effacé
export function clearOfflineCache() {
  tx(STORE, 'readwrite', s => s.clear()).catch(() => {});
  tx(BLOBS, 'readwrite', s => s.clear()).catch(() => {});
  try { localStorage.removeItem('evly_offline_prefetch'); } catch { /* rien */ }
}

// Ménage au démarrage : entrées trop anciennes, et les plus anciennes au-delà de MAX_ENTRIES
async function prune() {
  const d = await db();
  if (!d) return;
  for (const store of [STORE, BLOBS]) {
    try {
      const rows: { key: IDBValidKey; at: number }[] = [];
      await new Promise<void>(resolve => {
        const t = d.transaction(store, 'readwrite');
        const cur = t.objectStore(store).openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          const at = (c.value as Entry).at ?? 0;
          if (Date.now() - at > MAX_AGE_MS) c.delete(); else rows.push({ key: c.key, at });
          c.continue();
        };
        t.oncomplete = () => resolve();
        t.onerror = () => resolve();
      });
      const limit = store === STORE ? MAX_ENTRIES : 40;
      if (rows.length > limit) {
        const old = rows.sort((a, b) => a.at - b.at).slice(0, rows.length - limit);
        await tx(store, 'readwrite', s => { old.forEach(r => s.delete(r.key)); });
      }
    } catch { /* rien */ }
  }
}
if (typeof window !== 'undefined') window.setTimeout(() => { prune(); }, 8000);

// ───── Infos affichées sans réseau : date de la plus ancienne réponse resservie depuis la coupure
let servedSince: number | null = null;
const listeners = new Set<(at: number | null) => void>();
export function noteServedFromCache(at: number) {
  if (servedSince === null || at < servedSince) { servedSince = at; listeners.forEach(l => l(servedSince)); }
}
export function resetServedFromCache() { servedSince = null; listeners.forEach(l => l(null)); }
export function onServedFromCache(l: (at: number | null) => void) { listeners.add(l); l(servedSince); return () => { listeners.delete(l); }; }
