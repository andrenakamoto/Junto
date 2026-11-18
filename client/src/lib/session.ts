// Jeton de session (localStorage `estelle_token`). Remplacé sans changer de compte après « Se déconnecter de tous les
// appareils » ou un changement de mot de passe (serveur lib/sessions.ts) : AuthContext compare les comptes, pas les jetons.
export function replaceSessionToken(token: unknown) {
  if (typeof token !== 'string' || !token) return;
  try { localStorage.setItem('estelle_token', token); } catch { /* stockage indisponible */ }
}

// Session fermée par le serveur (autre appareil, mot de passe changé, compte supprimé) : retour à la connexion
let ending = false;
export function endSession() {
  if (ending) return;
  ending = true;
  try { localStorage.removeItem('estelle_token'); } catch { /* rien */ }
  window.location.assign('/auth');
}
