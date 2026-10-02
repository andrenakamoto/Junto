// Réponse à un Plan sans compte (serveur : lib/lightGuest.ts) : le jeton « invité léger » est
// gardé sur l'appareil, à part de la session normale (estelle_token). Envoyé à la connexion
// et à l'inscription pour que les réponses déjà données passent sur le compte.
const KEY = 'evly_light_token';

export function getLightToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setLightToken(token: string) {
  try { localStorage.setItem(KEY, token); } catch { /* stockage indisponible */ }
}

export function clearLightToken() {
  try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}

// À joindre au corps des requêtes /auth/login, /auth/register, /auth/google
export function lightTokenField(): { lightToken?: string } {
  const token = getLightToken();
  return token ? { lightToken: token } : {};
}
