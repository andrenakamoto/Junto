import axios from 'axios';
import { demoAdapter, isDemo } from '../lib/demo';
import { currentLang } from '../i18n';
import { markOffline, markOnline } from '../lib/connection';
import { endPending, isTracked, startPending } from '../lib/pending';
import { endSession } from '../lib/session';
import { clearOfflineCache, cacheGet, cacheKey, cachePut, isCacheable, noteServedFromCache, resetServedFromCache } from '../lib/offlineCache';
import { t } from '../i18n';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });

api.interceptors.request.use((config) => {
  // Action déclenchée par la personne : barre « en cours » (ActivityBar), démo comprise
  if (isTracked(config.method, config.url)) { startPending(); (config as any)._tracked = true; }
  // Démo sans compte : rien ne part au serveur (lib/demo.ts)
  if (isDemo()) { config.adapter = demoAdapter; return config; }
  // Langue des réponses du serveur (messages d'erreur…) pour les personnes sans compte ; avec un compte,
  // le serveur utilise la langue enregistrée
  config.headers['Accept-Language'] = currentLang();
  const token = localStorage.getItem('estelle_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Écran gardé pour la consultation sans réseau : on n'attend pas indéfiniment un réseau très faible
  if (token && isCacheable(config.method, config.url, config.params, config.responseType) && !config.timeout) config.timeout = 12000;
  return config;
});

// Connexion : une réponse, même une erreur, prouve que le serveur répond ; aucune réponse = hors ligne
// (lib/connection.ts, bandeau OfflineBanner)
// Consultation sans réseau (lib/offlineCache.ts) : chaque réponse d'un écran principal est gardée dans le téléphone ;
// sans réponse du serveur, la dernière version gardée est resservie (`fromCache`), et une écriture explique pourquoi
// elle n'a pas pu se faire.
api.interceptors.response.use(
  (res) => {
    if ((res.config as any)?._tracked) endPending();
    if (!isDemo()) {
      markOnline(); resetServedFromCache();
      // Session glissante (serveur lib/sessionToken.ts) : jeton renouvelé, gardé seulement s'il remplace celui qui a été
      // envoyé (pas après une déconnexion ou un changement de compte pendant la requête)
      const renewed = res.headers?.['x-session-token'];
      const sent = String(res.config.headers?.Authorization ?? '').replace(/^Bearer /, '');
      if (typeof renewed === 'string' && renewed && sent && localStorage.getItem('estelle_token') === sent) {
        try { localStorage.setItem('estelle_token', renewed); } catch { /* stockage plein : l'ancien jeton reste valable */ }
      }
      const c = res.config;
      if (res.status === 200 && localStorage.getItem('estelle_token') && isCacheable(c.method, c.url, c.params, c.responseType)) {
        const key = cacheKey(c.url!, c.params);
        if (key) cachePut(key, res.data);
      }
    }
    return res;
  },
  async (err) => {
    if (err?.config?._tracked) endPending();
    if (isDemo() || axios.isCancel(err)) return Promise.reject(err);
    if (err?.response) {
      markOnline();
      // Session fermée ailleurs (« Se déconnecter de tous les appareils », mot de passe changé) : retour à la connexion,
      // seulement si le jeton refusé est encore celui de l'appareil
      const sent = String(err.config?.headers?.Authorization ?? '').replace(/^Bearer /, '');
      if (err.response.status === 401 && err.response.data?.code === 'SESSION' && sent && localStorage.getItem('estelle_token') === sent) {
        clearOfflineCache();
        endSession();
      }
      return Promise.reject(err);
    }
    markOffline();
    const c = err?.config;
    if (c && isCacheable(c.method, c.url, c.params, c.responseType)) {
      const key = cacheKey(c.url, c.params);
      const hit = key ? await cacheGet(key) : null;
      if (hit) {
        noteServedFromCache(hit.at);
        return { data: hit.data, status: 200, statusText: 'OK', headers: {}, config: c, request: null, fromCache: true, cachedAt: hit.at };
      }
    }
    // Écriture sans réseau : message clair à la place d'une erreur vide (les écrans affichent err.response.data.error)
    if (c && (c.method ?? 'get').toLowerCase() !== 'get') {
      err.response = { status: 0, data: { error: t('ui.offline.cantWrite') }, headers: {}, config: c, statusText: '' };
      err.offline = true;
    }
    return Promise.reject(err);
  },
);

export default api;
