// « Mes contacts » : les personnes avec qui on partage au moins un Cercle (hors Cercle personnel
// « Mes Plans »). Rien de nouveau n'est révélé : chacun voit déjà ces personnes dans ses Cercles
// (prénom et @pseudo, jamais le nom de famille). Les personnes masquées n'apparaissent pas.

export interface ContactCircle { id: string; name: string; color: string | null }
export interface Contact {
  id: string;
  pseudo: string;
  firstName: string | null;
  circles: ContactCircle[];
}

interface MemberRow {
  user: { id: string; pseudo: string; firstName: string | null };
  circle: ContactCircle;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' });
const nameOf = (c: { pseudo: string; firstName: string | null }) => c.firstName?.trim() || c.pseudo;

// Une ligne par personne, ses Cercles en commun triés par nom ; personnes triées par prénom (sinon pseudo)
export function groupContacts(rows: MemberRow[], me: string, hidden: Set<string> = new Set()): Contact[] {
  const byId = new Map<string, Contact>();
  for (const { user, circle } of rows) {
    if (user.id === me || hidden.has(user.id)) continue;
    let c = byId.get(user.id);
    if (!c) { c = { id: user.id, pseudo: user.pseudo, firstName: user.firstName, circles: [] }; byId.set(user.id, c); }
    if (!c.circles.some(x => x.id === circle.id)) c.circles.push({ id: circle.id, name: circle.name, color: circle.color });
  }
  const list = [...byId.values()];
  for (const c of list) c.circles.sort((a, b) => collator.compare(a.name, b.name));
  return list.sort((a, b) => collator.compare(nameOf(a), nameOf(b)) || collator.compare(a.pseudo, b.pseudo));
}
