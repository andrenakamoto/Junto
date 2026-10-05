// Texte saisi par les utilisateurs (titre de Plan, nom de Cercle, pseudo, lieu…) inséré dans le
// HTML d'un email : toujours échappé, sinon un membre pourrait y glisser un faux lien ou bouton.
export function escapeHtml(text: string | null | undefined): string {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
