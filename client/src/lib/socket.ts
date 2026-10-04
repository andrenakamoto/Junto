import { io, Socket } from 'socket.io-client';
import { demoSocket, isDemo } from './demo';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  // Démo sans compte : faux temps réel en mémoire (lib/demo.ts)
  if (isDemo()) return demoSocket as unknown as Socket;
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', { auth: { token } });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
