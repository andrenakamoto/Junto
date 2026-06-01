import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  pseudo?: string;
  isAdmin?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      pseudo: string;
      isAdmin: boolean;
    };
    req.userId = payload.userId;
    req.pseudo = payload.pseudo;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}
