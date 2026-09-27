import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSocket } from '../lib/socket';

// Écoute un événement temps réel ; le handler le plus récent est toujours utilisé
// (pas besoin de lister ses dépendances).
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const { token } = useAuth();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => { socket.off(event, listener); };
  }, [token, event]);
}
