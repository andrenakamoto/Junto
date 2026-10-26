import { useEffect, useRef } from 'react';

// Appui long sur écran tactile (photo d'un chat → réactions, 2026-10-26) : `handlers` à poser sur l'élément, `consumed()` dans son
// onClick pour ignorer le clic qui suit un appui long (sinon la photo s'ouvrirait aussi). Le menu du téléphone (enregistrer
// l'image…) est bloqué sur l'élément.
export function useLongPress(onLong: () => void, ms = 450) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const cb = useRef(onLong);
  cb.current = onLong;
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  return {
    handlers: {
      onTouchStart: () => {
        fired.current = false; clear();
        timer.current = window.setTimeout(() => { fired.current = true; navigator.vibrate?.(15); cb.current(); }, ms);
      },
      onTouchEnd: clear, onTouchMove: clear, onTouchCancel: clear,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      style: { WebkitTouchCallout: 'none' } as React.CSSProperties,
    },
    consumed: () => { const f = fired.current; fired.current = false; return f; },
  };
}
