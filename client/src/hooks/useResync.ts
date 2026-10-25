import { useEffect, useRef } from 'react';

// Rattrapage après une absence : retour dans l'app ou sur l'onglet, reconnexion du temps réel, retour du réseau.
// DashboardPage émet `evly-resync` (refreshAll) ; les écrans qui chargent leurs propres données et ne suivent que des
// signaux temps réel s'y abonnent, sinon ce qui s'est passé pendant que l'app dormait n'apparaît pas (sondage de dates
// visible sur la carte du Cercle mais absent du Cercle, 2026-10-25).
export const RESYNC_EVENT = 'evly-resync';
export const requestResync = () => window.dispatchEvent(new Event(RESYNC_EVENT));

export function useResync(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = () => ref.current();
    window.addEventListener(RESYNC_EVENT, on);
    return () => window.removeEventListener(RESYNC_EVENT, on);
  }, []);
}
