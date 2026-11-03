import { useEffect, useState } from 'react';
import { onPending } from '../../lib/pending';

// Fine barre corail en haut de l'écran pendant qu'une action attend le serveur (lib/pending.ts) : un retour visuel pour
// tous les boutons, même ceux qui n'ont pas leur propre état « en cours ». Affichée seulement au-delà de 150 ms.
export function ActivityBar() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    return onPending(n => {
      window.clearTimeout(timer);
      if (n > 0) timer = window.setTimeout(() => setBusy(true), 150);
      else setBusy(false);
    });
  }, []);
  if (!busy) return null;
  return (
    <div className="fixed left-0 right-0 z-[10000] h-[3px] overflow-hidden pointer-events-none" style={{ top: 'var(--sa-top, 0px)' }} role="progressbar" aria-busy="true">
      <div className="h-full w-1/3 bg-indigo-500 rounded-full" style={{ animation: 'evlyActivity 1s ease-in-out infinite' }} />
      <style>{'@keyframes evlyActivity { from { transform: translateX(-100%) } to { transform: translateX(300%) } }'}</style>
    </div>
  );
}
