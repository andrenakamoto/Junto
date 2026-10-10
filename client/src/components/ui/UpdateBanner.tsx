import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Détecte une nouvelle mise en ligne : le script principal de la page servie par Vercel
// change de nom (empreinte) à chaque build. Vérifié toutes les 5 min et au retour sur l'onglet.
const CHECK_EVERY_MS = 5 * 60 * 1000;
const BUNDLE_RE = /\/assets\/index-[\w-]+\.js/;

function loadedBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return script ? new URL(script.src).pathname : null;
}

export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const current = loadedBundle();
    if (!current) return; // développement local (vite) : pas de build
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const html = await fetch('/', { cache: 'no-store' }).then(r => r.text());
        const latest = html.match(BUNDLE_RE)?.[0];
        if (latest && latest !== current) setAvailable(true);
      } catch { /* hors ligne : on réessaiera */ }
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 border border-slate-700">
        <RefreshCw size={16} className="text-indigo-400 flex-shrink-0" />
        <p className="text-sm flex-1">{t('ui.update.available')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
        >
          {t('ui.update.reload')}
        </button>
      </div>
    </div>
  );
}
