import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { probe, useOffline } from '../../lib/connection';
import { onServedFromCache } from '../../lib/offlineCache';
import { intlLocale } from '../../i18n';

// Bandeau en haut de l'écran quand EvLY n'arrive pas à joindre le serveur (pas de réseau, serveur
// injoignable) : sans lui, un écran resté vide ne dit pas pourquoi. Bref « Connexion rétablie » au retour.
export function OfflineBanner() {
  const offline = useOffline();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [back, setBack] = useState(false);
  const wasOffline = useRef(offline);
  // Écrans resservis depuis le téléphone (lib/offlineCache.ts) : date de la plus ancienne info affichée
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  useEffect(() => onServedFromCache(setCachedAt), []);
  // Réduit en pastille pour consulter l'app sans que le bandeau cache le haut de l'écran
  const [small, setSmall] = useState(false);
  useEffect(() => { if (!offline) setSmall(false); }, [offline]);
  // Les infos gardées s'affichent : le bandeau se réduit seul après quelques secondes
  useEffect(() => {
    if (!offline || !cachedAt) return;
    const id = window.setTimeout(() => setSmall(true), 6000);
    return () => window.clearTimeout(id);
  }, [offline, cachedAt]);

  useEffect(() => {
    if (wasOffline.current && !offline) {
      setBack(true);
      const timer = window.setTimeout(() => setBack(false), 2500);
      wasOffline.current = offline;
      return () => window.clearTimeout(timer);
    }
    wasOffline.current = offline;
  }, [offline]);

  async function retry() {
    setChecking(true);
    await probe();
    setChecking(false);
  }

  if (!offline && !back) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[70] pointer-events-none" style={{ paddingTop: 'var(--sa-top)' }} role="status" aria-live="polite">
      <div className={`mx-auto mt-2 w-[calc(100%-1rem)] max-w-md ${small && offline ? 'flex' : ''}`}>
        {offline && small ? (
          <button onClick={() => setSmall(false)} className="pointer-events-auto ml-auto mr-2 flex items-center gap-1.5 bg-slate-900 text-white rounded-full shadow-xl px-3 py-1.5 border border-slate-700 text-xs font-semibold">
            <WifiOff size={13} className="text-amber-400" />{t('ui.offline.title')}
          </button>
        ) : offline ? (
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 border border-slate-700">
            <WifiOff size={18} className="text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t('ui.offline.title')}</p>
              <p className="text-xs text-slate-300">{cachedAt
                ? t('ui.offline.cached', { date: new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(cachedAt)) })
                : t('ui.offline.text')}</p>
            </div>
            {cachedAt && (
              <button onClick={() => setSmall(true)} aria-label={t('common.close')} className="p-1 text-slate-400 hover:text-white flex-shrink-0"><ChevronUp size={18} /></button>
            )}
            <button
              onClick={retry}
              disabled={checking}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {checking ? t('ui.offline.checking') : t('ui.offline.retry')}
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl shadow-lg px-4 py-2">
            <Wifi size={16} />
            <p className="text-sm font-semibold">{t('ui.offline.back')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
