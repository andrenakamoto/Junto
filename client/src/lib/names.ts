// « Prénom Nom » quand il est connu (comptes créés avant l'ajout du prénom : null)
export function fullName(user: { firstName?: string | null; lastName?: string | null }): string | null {
  if (!user.firstName) return null;
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
}
