// Places d'un Plan à participants limités. Une place = une réponse « Je suis in » ou « Peut-être » (un
// « Je passe » libère la sienne). Même règle que le serveur (server/src/lib/waitlist.ts).
// Une réponse occupe autant de places que de personnes qui viennent avec elle (accompagnants, `partySize`).
type PlacesPlan = { maxParticipants?: number | null; members: { userId: string; rsvp: string; partySize?: number }[]; waitlist?: { userId: string }[]; participantCount?: number };

const size = (m: { partySize?: number }) => Math.max(1, m.partySize ?? 1);

// Liste des participants masquée (Mode annonce) : le serveur donne seulement le nombre de places prises
export const occupiedPlaces = (plan: PlacesPlan) => plan.participantCount ?? plan.members.reduce((n, m) => n + (m.rsvp === 'out' ? 0 : size(m)), 0);

// Personnes qui viennent (« Je suis in »), accompagnants compris
export const comingCount = (members: { rsvp: string; partySize?: number }[]) => members.reduce((n, m) => n + (m.rsvp === 'in' ? size(m) : 0), 0);

export const isPlanFull = (plan: PlacesPlan) => plan.maxParticipants != null && occupiedPlaces(plan) >= plan.maxParticipants;

export const placesLeft = (plan: PlacesPlan) => (plan.maxParticipants != null ? Math.max(0, plan.maxParticipants - occupiedPlaces(plan)) : null);

// Position sur la liste d'attente (1 = premier), null si la personne n'y est pas
export function waitlistPosition(plan: PlacesPlan, userId?: string): number | null {
  const i = (plan.waitlist ?? []).findIndex(w => w.userId === userId);
  return i < 0 ? null : i + 1;
}
