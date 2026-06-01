import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  next();
}
