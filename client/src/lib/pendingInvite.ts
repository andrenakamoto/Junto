// Invitation à un Plan ouverte avant d'être connecté : on la garde pour y revenir
// après la connexion — y compris après une inscription avec validation d'email.
const KEY = 'evly_pending_plan_invite';

export function savePendingInvite(token: string) {
  try { localStorage.setItem(KEY, token); } catch { /* stockage indisponible */ }
}

export function getPendingInvite(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}
