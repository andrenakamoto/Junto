// Saison de la campagne Secret Santa (6 novembre → 25 décembre) : page de connexion et site d'accueil
export const santaSeason = (d = new Date()) => (d.getMonth() === 10 && d.getDate() >= 6) || (d.getMonth() === 11 && d.getDate() <= 25);
