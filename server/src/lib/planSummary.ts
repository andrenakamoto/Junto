// Synthèse d'un Plan vue par une personne (bouton « En bref » de la carte et de la fiche du Plan,
// routes/planSummary.ts). Réservée aux participants « Je suis in » et « Peut-être ». Chaque bloc ne
// concerne que la personne (son trajet, ce qu'elle apporte, ses comptes…) ; le client n'affiche que
// les blocs présents et fabrique le texte (4 langues, et « Copier le résumé »).

export type Person = { id: string; pseudo: string; firstName: string | null };
export const personName = (u?: Person | null) => (u ? u.firstName ?? u.pseudo : '?');

export type RideSummary =
  | { role: 'driver'; seatsFree: number; passengers: number; departure: string; departureAt: string | null }
  | { role: 'passenger'; driver: string; departure: string; departureAt: string | null }
  | { role: 'searching'; from: string }
  | { role: 'none'; offers: { driver: string; seatsFree: number }[] };

// Mon trajet : conducteur, passager, en recherche, ou places proposées par d'autres
export function rideSummary(
  rides: { driverId: string; driver: Person; departure: string; departureAt: Date | null; seats: number; passengers: { userId: string }[] }[],
  requests: { userId: string; fromLocation: string }[],
  userId: string,
): RideSummary | null {
  const mine = rides.find(r => r.driverId === userId);
  if (mine) return { role: 'driver', seatsFree: Math.max(mine.seats - mine.passengers.length, 0), passengers: mine.passengers.length, departure: mine.departure, departureAt: mine.departureAt?.toISOString() ?? null };
  const aboard = rides.find(r => r.passengers.some(p => p.userId === userId));
  if (aboard) return { role: 'passenger', driver: personName(aboard.driver), departure: aboard.departure, departureAt: aboard.departureAt?.toISOString() ?? null };
  const request = requests.find(r => r.userId === userId);
  if (request) return { role: 'searching', from: request.fromLocation };
  const offers = rideOffers(rides);
  return offers.length ? { role: 'none', offers } : null;
}

// Places libres proposées par les conducteurs (aussi dans le texte « Copier le résumé »)
export function rideOffers(rides: { driver: Person; seats: number; passengers: unknown[] }[]) {
  return rides
    .map(r => ({ driver: personName(r.driver), seatsFree: r.seats - r.passengers.length }))
    .filter(o => o.seatsFree > 0)
    .sort((a, b) => b.seatsFree - a.seatsFree);
}

// « Qui apporte quoi » : ce que j'apporte, et ce que personne n'a encore pris
// (BringItem.claimedBy contient le pseudo de la personne, pas son id)
export function bringSummary(items: { label: string; quantity: string | null; claimedBy: string | null }[], pseudo: string) {
  const label = (i: { label: string; quantity: string | null }) => (i.quantity ? `${i.label} (${i.quantity})` : i.label);
  const mine = items.filter(i => i.claimedBy === pseudo).map(label);
  const missing = items.filter(i => !i.claimedBy).map(label);
  return mine.length || missing.length ? { mine, missing } : null;
}

// Mes comptes : ce que je dois et ce qu'on me doit (virements suggérés, devise par devise)
export function moneySummary(
  byCurrency: { currency: string; transfers: { fromUserId: string; toUserId: string; amount: number }[] }[],
  userId: string,
  nameOf: (id: string) => string,
) {
  if (!byCurrency.length) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  const owe = byCurrency.flatMap(c => c.transfers.filter(t => t.fromUserId === userId).map(t => ({ to: nameOf(t.toUserId), amount: round(t.amount), currency: c.currency })));
  const owed = byCurrency.flatMap(c => c.transfers.filter(t => t.toUserId === userId).map(t => ({ from: nameOf(t.fromUserId), amount: round(t.amount), currency: c.currency })));
  return { owe, owed };
}

// Sondages du Plan auxquels je n'ai pas encore répondu
export function unansweredPolls(polls: { options: { votes: { userId: string }[] }[] }[], userId: string): number {
  return polls.filter(p => !p.options.some(o => o.votes.some(v => v.userId === userId))).length;
}

// Matchs ouverts où il me reste des cartes à jouer
export function pendingMatches(
  matches: { closedAt: Date | null; deadline: Date | null; options: { id: string }[]; swipes: { optionId: string; userId: string }[] }[],
  userId: string,
  now = new Date(),
): number {
  return matches.filter(m => {
    if (m.closedAt || (m.deadline && m.deadline < now) || !m.options.length) return false;
    const done = new Set(m.swipes.filter(s => s.userId === userId).map(s => s.optionId));
    return m.options.some(o => !done.has(o.id));
  }).length;
}
