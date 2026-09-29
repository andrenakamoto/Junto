import rateLimit from 'express-rate-limit';

// Tentatives de connexion : limite stricte, par IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie dans quelques minutes.' },
});

// Inscription / setup admin : évite la création massive de comptes
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie plus tard.' },
});

// Emails (reset password, vérification) : évite le spam d'un email
export const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes, réessaie dans quelques minutes.' },
});

// Compteur de visites des pages publiques : au-delà, les rechargements en
// rafale d'une même connexion ne gonflent plus le total (rien n'est stocké)
export const visitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req, res) => { res.status(204).end(); },
});
