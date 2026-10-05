import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { touchUser } from '../lib/activity';

export interface AuthRequest extends Request {
  userId?: string;
  pseudo?: string;
  isAdmin?: boolean;
}

type SessionPayload = { userId: string; pseudo: string; isAdmin?: boolean };

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
    return { userId: p.userId, pseudo: p.pseudo, isAdmin: p.isAdmin === true };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Token invalide' }); return; }
    // Réponse sans compte (lib/lightGuest.ts) : réservée aux routes /api/invite
    if (payload.light) {
      res.status(401).json({ error: 'Crée ton compte EvLY pour continuer' });
      return;
    }
    req.userId = payload.userId;
    req.pseudo = payload.pseudo;
    req.isAdmin = payload.isAdmin;
    touchUser(payload.userId);
    next();
  }
}
