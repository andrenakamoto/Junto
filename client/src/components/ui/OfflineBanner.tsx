import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { probe, useOffline } from '../../lib/connection';

// Bandeau en haut de l'écran quand EvLY n'arrive pas à joindre le serveur (pas de réseau, serveur
// injoignable) : sans lui, un écran resté vide ne dit pas pourquoi. Bref « Connexion rétablie » au retour.
export function OfflineBanner() {
  const offline = useOffline();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [back, setBack] = useState(false);
  const wasOffline = useRef(offline);

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
      <div className="mx-auto mt-2 w-[calc(100%-1rem)] max-w-md pointer-events-auto">
        {offline ? (
          <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 border border-slate-700">
            <WifiOff size={18} className="text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t('ui.offline.title')}</p>
              <p className="text-xs text-slate-300">{t('ui.offline.text')}</p>
            </div>
            <button
              onClick={retry}
              disabled={checking}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {checking ? t('ui.offline.checking') : t('ui.offline.retry')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl shadow-lg px-4 py-2">
            <Wifi size={16} />
            <p className="text-sm font-semibold">{t('ui.offline.back')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
