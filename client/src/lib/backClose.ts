import { useEffect, useRef } from 'react';

// Bouton retour du téléphone (Android) : ferme d'abord la fenêtre ouverte au premier plan (Inviter, réglages,
// photo en grand, roue…), avant que le tableau de bord ne remonte Plan → Plans → Cercles. Chaque fenêtre
// s'inscrit dans une pile pendant qu'elle est affichée ; NativeChrome appelle closeTopOverlay() en premier.
const stack: { close: () => void }[] = [];

export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function useBackClose(onClose: () => void, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const entry = { close: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
