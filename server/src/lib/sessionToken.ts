import jwt from 'jsonwebtoken';

// Jeton de connexion (2026-11-18). Il durait 7 jours sans jamais être prolongé : les personnes qui utilisent l'app chaque jour
// devaient se reconnecter toutes les semaines. Il dure maintenant 30 jours et se renouvelle tout seul (requireAuth) : au-delà
// d'un jour d'âge, la réponse porte un nouveau jeton dans l'en-tête X-Session-Token, que le client garde. On n'est donc
// déconnecté qu'après 30 jours sans ouvrir l'app.
export const SESSION_TTL = '30d';
export const SESSION_RENEW_AFTER_S = 24 * 3600;
export const SESSION_HEADER = 'X-Session-Token';

// `sv` = numéro de session du compte (lib/sessions.ts) : « Se déconnecter de tous les appareils » l'augmente
export function makeToken(user: { id: string; pseudo: string; isAdmin: boolean; sessionVersion: number }) {
  return jwt.sign(
    { userId: user.id, pseudo: user.pseudo, isAdmin: user.isAdmin, sv: user.sessionVersion },
    process.env.JWT_SECRET!,
    { expiresIn: SESSION_TTL }
  );
}
