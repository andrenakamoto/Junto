import jwt from 'jsonwebtoken';

// Jeton d'affichage des photos/fichiers d'un Plan. Une balise <img> ne peut pas
// envoyer l'en-tête Authorization : le jeton passe en paramètre d'URL. Il n'est
// délivré qu'à ceux qui peuvent voir le Plan (GET /api/plans/:id), pour 12 h.
const TTL = '12h';

export function mintMediaToken(planId: string, userId: string): string {
  return jwt.sign({ planId, userId, purpose: 'media' }, process.env.JWT_SECRET!, { expiresIn: TTL });
}

export function verifyMediaToken(token: string): { planId: string; userId: string } | null {
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as { planId?: string; userId?: string; purpose?: string };
    if (p.purpose !== 'media' || !p.planId || !p.userId) return null;
    return { planId: p.planId, userId: p.userId };
  } catch {
    return null;
  }
}
