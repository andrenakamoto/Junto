import prisma from './prisma';

// Secret Santa en ligne sans compte : essayé puis abandonné le 2026-11-17 à la demande de l'utilisateur (tout tenait à un lien,
// risque de faux tirages, et les personnes n'allaient pas dans l'app). Les tables OnlineSanta / OnlineSantaPerson restent en base,
// vides : ce nettoyage horaire efface les tirages qui y seraient encore (prénoms, emails, envies).
export async function deleteExpiredOnlineSantas() {
  try {
    await prisma.onlineSanta.deleteMany({});
  } catch (e) {
    console.error('[santa online cleanup]', e);
  }
}
