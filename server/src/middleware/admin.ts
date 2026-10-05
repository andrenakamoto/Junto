import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../lib/prisma';

// Droits d'administrateur vérifiés en base à chaque requête : le jeton de connexion dure 7 jours,
// un administrateur retiré (ou un compte supprimé) ne doit pas garder l'accès jusque-là.
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } }) : null;
  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  req.isAdmin = true;
  next();
}
