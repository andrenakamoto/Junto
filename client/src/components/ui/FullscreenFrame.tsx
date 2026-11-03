import { useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { t } from '../../i18n';
import { closeTopOverlay, useBackClose } from '../../lib/backClose';

// Plein écran d'une rubrique (2026-11-03 : Tâches et Jour J, comme la projection des Idées). Le cadre ne fait que changer
// de classes : le contenu n'est pas recréé, filtres et rubriques ouvertes restent tels quels. Fermé par le bouton, Échap
// ou le bouton retour Android ; sur ordinateur, le navigateur passe aussi en plein écran (refusé : la fenêtre reste normale).
export function FullscreenFrame({ full, onClose, title, children }: { full: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useBackClose(onClose, full);
  useEffect(() => {
    if (!full) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTopOverlay(); };
    window.addEventListener('keydown', h);
    if (window.matchMedia('(hover: hover)').matches) document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener('keydown', h);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [full]);
  return (
    <div className={full ? 'fixed inset-0 z-[70] bg-slate-50 flex flex-col' : 'contents'}
      style={full ? { paddingTop: 'var(--sa-top, 0px)', paddingBottom: 'var(--sa-bottom, 0px)' } : undefined}>
      {full && (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <p className="text-lg font-bold text-slate-800 truncate flex-1 min-w-0">{title}</p>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700">
            <Minimize2 size={16} />{t('ui.fullscreen.exit')}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

// Bouton « Plein écran » à placer en tête de la rubrique
export function FullscreenButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
      <Maximize2 size={14} />{t('ui.fullscreen.open')}
    </button>
  );
}
