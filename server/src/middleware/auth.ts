import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { touchUser } from '../lib/activity';
import { isSessionCurrent } from '../lib/sessions';
import { makeToken, SESSION_HEADER, SESSION_RENEW_AFTER_S } from '../lib/sessionToken';

export interface AuthRequest extends Request {
  userId?: string;
  pseudo?: string;
  isAdmin?: boolean;
}

type SessionPayload = { userId: string; pseudo: string; isAdmin?: boolean; iat?: number; sv?: number };

// Jeton de connexion (routes/auth.ts makeToken) — et rien d'autre. Les autres jetons signés avec
// la même clé ont un usage précis et ne doivent JAMAIS ouvrir une session : jeton d'affichage des
// photos (`purpose: 'media'`, présent dans l'adresse de chaque image), jetons de téléchargement
// (`purpose`, `attachmentId`), réponse sans compte (`light`). Partagé avec le socket.
export function verifySessionToken(token: string): (SessionPayload & { light?: false }) | { light: true } | null {
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    if (p.light) return { light: true };
    if (p.purpose !== undefined || p.attachmentId !== undefined || p.planId !== undefined) return null;
    if (typeof p.userId !== 'string' || typeof p.pseudo !== 'string') return null;
    return { userId: p.userId, pseudo: p.pseudo, isAdmin: p.isAdmin === true, iat: typeof p.iat === 'number' ? p.iat : undefined, sv: typeof p.sv === 'number' ? p.sv : undefined };
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Non authentifié', code: 'SESSION' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) { res.status(401).json({ error: 'Token invalide', code: 'SESSION' }); return; }
  // Réponse sans compte (lib/lightGuest.ts) : réservée aux routes /api/invite
  if (payload.light) {
    res.status(401).json({ error: 'Crée ton compte EvLY pour continuer' });
    return;
  }
  // Sessions fermées (« Se déconnecter de tous les appareils », mot de passe changé) ou compte supprimé
  try {
    if (!(await isSessionCurrent(payload.userId, payload.sv))) { res.status(401).json({ error: 'Session expirée', code: 'SESSION' }); return; }
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
    return;
  }
  req.userId = payload.userId;
  req.pseudo = payload.pseudo;
  req.isAdmin = payload.isAdmin;
  touchUser(payload.userId);
  // Session glissante (lib/sessionToken.ts) : un jeton de plus d'un jour est remplacé par un neuf
  if (!payload.iat || Date.now() / 1000 - payload.iat > SESSION_RENEW_AFTER_S) {
    res.setHeader(SESSION_HEADER, makeToken({ id: payload.userId, pseudo: payload.pseudo, isAdmin: payload.isAdmin === true, sessionVersion: payload.sv ?? 0 }));
  }
  next();
}
