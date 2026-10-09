// Places d'un Plan à participants limités. Une place = une réponse « Je suis in » ou « Peut-être » (un
// « Je passe » libère la sienne). Même règle que le serveur (server/src/lib/waitlist.ts).
type PlacesPlan = { maxParticipants?: number | null; members: { userId: string; rsvp: string }[]; waitlist?: { userId: string }[] };

export const occupiedPlaces = (plan: PlacesPlan) => plan.members.filter(m => m.rsvp !== 'out').length;

export const isPlanFull = (plan: PlacesPlan) => plan.maxParticipants != null && occupiedPlaces(plan) >= plan.maxParticipants;

export const placesLeft = (plan: PlacesPlan) => (plan.maxParticipants != null ? Math.max(0, plan.maxParticipants - occupiedPlaces(plan)) : null);

// Position sur la liste d'attente (1 = premier), null si la personne n'y est pas
export function waitlistPosition(plan: PlacesPlan, userId?: string): number | null {
  const i = (plan.waitlist ?? []).findIndex(w => w.userId === userId);
  return i < 0 ? null : i + 1;
}
