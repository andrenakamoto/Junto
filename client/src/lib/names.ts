// Nom affiché aux autres membres : le prénom seul (le nom de famille n'est visible que par la
// personne elle-même et par l'administrateur). null pour les comptes sans prénom.
export function displayName(user: { firstName?: string | null }): string | null {
  return user.firstName || null;
}

// « Prénom Nom » — réservé au panneau admin
export function fullName(user: { firstName?: string | null; lastName?: string | null }): string | null {
  if (!user.firstName) return null;
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
}
