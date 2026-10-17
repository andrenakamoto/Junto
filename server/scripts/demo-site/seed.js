// Données fictives de la démo du site (/demo), à lancer sur une BASE JETABLE (voir LISEZMOI.md).
// Refaite le 2026-10-17 : 7 Cercles, un par type d'utilisateur, et des Plans qui montrent toutes les fonctions.
// Alex (la personne de la démo) est membre de tous les Cercles.
process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:55432/evly_test';
const { PrismaClient } = require('@prisma/client'); const jwt = require('jsonwebtoken'); const { io } = require('socket.io-client'); const fs = require('fs');
const prisma = new PrismaClient(); const API = 'http://localhost:3999/api'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = async (m, p, b, t) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b && JSON.stringify(b) }); const d = await r.json().catch(() => null); if (r.status >= 400) console.error('!!', m, p, r.status, d); return d; };
const at = (days, h, min = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, min, 0, 0); return d.toISOString(); };
const ANNONCE_OFF = ['chat', 'trajets', 'votes', 'depenses'];

(async () => {
  await prisma.user.create({ data: { pseudo: 'admin_demo', email: 'admin@demo.test', emailVerified: true, isAdmin: true, acceptedTermsVersion: 99 } });
  const people = [['alex', 'Alex'], ['lea_m', 'Léa'], ['tom_b', 'Tom'], ['julie_r', 'Julie'], ['noah_p', 'Noah'], ['emma_v', 'Emma'], ['lucas_d', 'Lucas'], ['chloe_s', 'Chloé'], ['max_g', 'Maxime'],
    ['sarah_k', 'Sarah'], ['marc_l', 'Marc'], ['ines_b', 'Inès'], ['karim_a', 'Karim'], ['nadia_f', 'Nadia'], ['paul_r', 'Paul'], ['zoe_m', 'Zoé'],
    ['sofia_g', 'Sofia'], ['hugo_t', 'Hugo'], ['manon_c', 'Manon'], ['yann_k', 'Yann'], ['elena_r', 'Elena'], ['marco_p', 'Marco'], ['sophie_d', 'Sophie'],
    ['pierre_r', 'Pierre'], ['monique_r', 'Monique'], ['nathalie_r', 'Nathalie'], ['leo_r', 'Léo']];
  const U = {};
  for (const [pseudo, firstName] of people) U[pseudo] = await prisma.user.create({ data: { pseudo, firstName, email: `${pseudo}@exemple.test`, emailVerified: true, acceptedTermsVersion: 99 } });
  const T = Object.fromEntries(Object.entries(U).map(([k, u]) => [k, jwt.sign({ userId: u.id, pseudo: u.pseudo }, 'test-secret')]));
  const pseudoOf = id => Object.keys(U).find(k => U[k].id === id);

  // Cercles (créés directement : les adhésions passeraient sinon par un vote). Discussion ouverte partout.
  let code = 0;
  const circle = (name, description, color, creator, members, organizers = []) => prisma.circle.create({ data: {
    name, description, color, code: `DEMO${++code}X`, creatorId: U[creator].id, chatMode: 'open',
    members: { create: [creator, ...members].map(p => ({ userId: U[p].id, role: p === creator ? 'admin' : organizers.includes(p) ? 'organizer' : 'member' })) } } });
  const danse = await circle('Studio Danse Arc-en-Ciel', 'Cours de salsa, bachata et hip-hop pour adultes et ados 💃', '#ec4899', 'ines_b',
    ['alex', 'sofia_g', 'hugo_t', 'manon_c', 'yann_k', 'elena_r', 'marco_p', 'chloe_s', 'lucas_d', 'lea_m', 'emma_v']);
  const boxe = await circle('Boxing Club du Rhône', 'Boxe anglaise, cours débutants et compétition 🥊', '#f43f5e', 'karim_a',
    ['alex', 'noah_p', 'tom_b', 'max_g', 'yann_k', 'sofia_g', 'marc_l', 'hugo_t', 'lucas_d'], ['marc_l']);
  const jeu = await circle('Association Jeunesse de Montvert', 'Soirées, lotos, sorties et girons 🎉', '#f59e0b', 'lea_m',
    ['alex', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lucas_d', 'chloe_s', 'max_g'], ['alex']);
  const col = await circle('Best collègues', 'Pauses café, afterworks et sorties d’équipe ☕', '#8b5cf6', 'sarah_k',
    ['alex', 'marc_l', 'paul_r', 'zoe_m', 'sophie_d']);
  const fam = await circle('Famille Rochat', 'Anniversaires, Noël et vacances en famille 🏡', '#10b981', 'julie_r',
    ['alex', 'pierre_r', 'monique_r', 'nathalie_r', 'leo_r']);
  const cop = await circle('Les copains', 'Apéros, anniversaires et week-ends', '#06b6d4', 'alex',
    ['tom_b', 'emma_v', 'noah_p', 'lucas_d', 'chloe_s', 'julie_r']);
  const evt = await circle('Team events', 'Le comité qui organise la fête du village et la course 🎪', '#14b8a6', 'nadia_f',
    ['alex', 'paul_r', 'zoe_m', 'hugo_t', 'lea_m', 'emma_v'], ['alex']);

  const mk = (c, who, body) => call('POST', `/circles/${c.id}/plans`, body, T[who]);
  const join = async (plan, list) => { for (const entry of list) { const [p, rsvp] = Array.isArray(entry) ? entry : [entry, 'in']; await call('POST', `/plans/${plan.id}/join`, {}, T[p]); if (rsvp !== 'in') await call('PUT', `/plans/${plan.id}/rsvp`, { rsvp }, T[p]); } };
  const upload = async (planId, who, file, via) => { const f = new FormData(); f.append('file', new Blob([fs.readFileSync(__dirname + '/' + file)], { type: 'image/png' }), file); return (await fetch(`${API}/attachments/plans/${planId}${via ? `?via=${via}` : ''}`, { method: 'POST', headers: { Authorization: `Bearer ${T[who]}` }, body: f })).json(); };
  const items = async (plan, who, list) => { for (const [label, taker, quantity] of list) { const it = await call('POST', `/plans/${plan.id}/items`, { label, quantity }, T[who]); if (taker) await call('PUT', `/plans/items/${it.id}/claim`, {}, T[taker]); } };
  const guests = async (plan, who, list) => { const { token } = await call('POST', `/plans/${plan.id}/guest-link`, {}, T[who]); for (const [firstName, rsvp] of list) await call('POST', `/invite/${token}/respond`, { firstName, rsvp }); };

  // ───────── Studio Danse Arc-en-Ciel (Inès, professeure) ─────────
  const salsa = await mk(danse, 'ines_b', { title: 'Salsa débutants 💃', description: 'Cours hebdomadaire, 1 h 30. Pas besoin de venir en couple, on tourne les partenaires.', eventDate: at(3, 19), endDate: at(3, 20, 30),
    location: 'Studio Arc-en-Ciel, rue des Lilas 12', recurrence: 'weekly', maxParticipants: 8 });
  await join(salsa, ['sofia_g', 'hugo_t', 'manon_c', 'yann_k', 'elena_r', 'marco_p', 'chloe_s']);
  for (const p of ['lucas_d', 'emma_v', 'alex']) await call('POST', `/plans/${salsa.id}/waitlist`, {}, T[p]);
  const bachata = await mk(danse, 'ines_b', { title: 'Bachata intermédiaire', description: 'Figures et musicalité. Niveau : 1 an de bachata ou plus.', eventDate: at(4, 20), endDate: at(4, 21, 30),
    location: 'Studio Arc-en-Ciel, rue des Lilas 12', recurrence: 'weekly', maxParticipants: 12 });
  await join(bachata, ['sofia_g', 'hugo_t', 'manon_c', 'yann_k', 'elena_r', 'marco_p', 'lea_m', 'alex']);
  const couples = await call('POST', `/plans/${bachata.id}/polls`, { question: 'Pour équilibrer les couples : tu es…', options: ['Homme', 'Femme'], anonymous: false }, T.ines_b);
  for (const [p, i] of [['hugo_t', 0], ['yann_k', 0], ['marco_p', 0], ['sofia_g', 1], ['manon_c', 1], ['elena_r', 1], ['lea_m', 1]]) await call('POST', `/plans/polls/${couples.options[i].id}/vote`, {}, T[p]);
  const stage = await mk(danse, 'ines_b', { title: 'Stage hip-hop du week-end', description: 'Deux jours pour apprendre une chorégraphie complète, ouverts dès 14 ans.', eventDate: at(13, 10), endDate: at(14, 17),
    location: 'Studio Arc-en-Ciel, grande salle', importantInfo: 'Tenue souple et baskets propres pour la salle.\nPique-nique pour samedi midi.\nPetit spectacle dimanche à 16 h 30 : les familles sont bienvenues !' });
  await join(stage, ['manon_c', 'hugo_t', 'chloe_s', 'emma_v', ['alex', 'maybe']]);
  await upload(stage.id, 'ines_b', 'programme-stage.png');
  const gala = await mk(danse, 'ines_b', { title: 'Gala de fin d’année ✨', description: 'Le spectacle de tous les cours du studio. Entrée libre, chapeau à la sortie.', eventDate: at(30, 20), endDate: at(30, 23, 30),
    location: 'Salle des fêtes de Montvert', maxParticipants: 150, disabledFeatures: ANNONCE_OFF, membersVisibility: 'managers' });
  await upload(gala.id, 'ines_b', 'affiche-gala.png', 'affiche');
  await join(gala, ['sofia_g', 'hugo_t', 'manon_c', 'elena_r', 'marco_p', 'lea_m', 'emma_v', 'alex']);

  // ───────── Boxing Club du Rhône (Karim, entraîneur) ─────────
  const boxing = await mk(boxe, 'karim_a', { title: 'Entraînement boxe anglaise 🥊', description: 'Échauffement, technique, sac et sparring léger. Gants et protège-dents obligatoires.', eventDate: at(2, 18), endDate: at(2, 19, 30),
    location: 'Salle du Bord-de-l’Eau', recurrence: 'weekly', maxParticipants: 14 });
  await join(boxing, ['noah_p', 'tom_b', 'max_g', 'yann_k', 'sofia_g', 'hugo_t', 'alex', ['lucas_d', 'maybe']]);
  const trophee = await mk(boxe, 'karim_a', { title: 'Trophée du Rhône 🏆', description: 'Notre tournoi amateur : 24 combats sur deux jours. On a besoin de vous pour l’organisation !', eventDate: at(20, 8), endDate: at(21, 20),
    location: 'Salle omnisport du Bord-de-l’Eau', enabledFeatures: ['benevoles'], importantInfo: 'Bénévoles : t-shirt du club fourni, rendez-vous à l’entrée des artistes.\nRepas offert aux bénévoles à midi.' });
  await upload(trophee.id, 'karim_a', 'affiche-boxe.png', 'affiche');
  const tShift = (title, d, h0, h1, needed, note) => call('POST', `/plans/${trophee.id}/shifts`, { title, needed, note, startsAt: at(20 + d, h0), endsAt: at(20 + d, h1) }, T.karim_a);
  await tShift('Pesée des boxeurs', 0, 8, 9, 0, 'Programme : pesée officielle');
  const tRing = await tShift('Montage du ring', 0, 7, 9, 4, 'Gants de travail fournis');
  const tAccueil = await tShift('Accueil et billetterie', 0, 9, 13, 2, null);
  const tBuvette = await tShift('Buvette', 0, 11, 18, 3, 'Tablier du club fourni');
  const tJuges = await tShift('Table des juges et chronométrage', 1, 9, 18, 2, 'Formation de 15 min le matin');
  const tRange = await tShift('Démontage et rangement', 1, 17, 20, 5, null);
  for (const [s, who] of [[tRing, ['karim_a', 'noah_p', 'max_g']], [tAccueil, ['sofia_g']], [tBuvette, ['tom_b', 'hugo_t']], [tJuges, ['marc_l', 'yann_k']], [tRange, ['noah_p']]])
    for (const p of who) await call('POST', `/plans/shifts/${s.id}/signup`, {}, T[p]);
  // Assemblée générale du club : ouverte, comptes adoptés, vote en cours — Alex vote pour lui et pour Yann (procuration)
  const agBoxe = await mk(boxe, 'karim_a', { title: 'Assemblée générale 2026', description: 'AG ordinaire du club. Verrée offerte après la séance 🥂', eventDate: at(0, 19, 30), endDate: at(6, 23),
    location: 'Club-house du Boxing Club', enabledFeatures: ['assemblee'] });
  await join(agBoxe, ['alex', 'noah_p', 'tom_b', 'max_g', 'sofia_g', 'marc_l', 'hugo_t', 'lucas_d', ['yann_k', 'out']]);
  const AGB = `/plans/${agBoxe.id}/assembly`;
  await call('PUT', AGB, { quorumMode: 'count', quorumValue: 6, codeCheckIn: true, secretaryId: U.marc_l.id }, T.karim_a);
  const agbItem = async body => (await call('POST', `${AGB}/items`, body, T.karim_a)).id;
  const bRapport = await agbItem({ title: 'Rapport du président', kind: 'info', description: 'Bilan de la saison : 3 titres régionaux, 12 nouveaux membres et un Trophée record.' });
  const bComptes = await agbItem({ title: 'Approbation des comptes 2025-2026', kind: 'vote', majority: 'simple', description: 'Bénéfice de 2 380 CHF, surtout grâce au Trophée du Rhône.' });
  const bGants = await agbItem({ title: 'Achat de gants pour l’école de boxe : 1 500 CHF', kind: 'vote', majority: 'simple', secret: true, description: 'Proposition du comité : renouveler le matériel des débutants.' });
  const bComite = await agbItem({ title: 'Élection du comité', kind: 'election', seats: 2, description: 'Deux sièges à repourvoir.' });
  await agbItem({ title: 'Divers', kind: 'info' });
  for (const p of ['noah_p', 'sofia_g', 'max_g']) await call('POST', `/plans/assembly/items/${bComite}/candidates`, { userId: U[p].id }, T.karim_a);
  await call('POST', `${AGB}/proxy`, { holderId: U.alex.id }, T.yann_k);
  await call('POST', `${AGB}/convoke`, {}, T.karim_a);
  await call('POST', `${AGB}/open`, {}, T.karim_a);
  for (const p of ['karim_a', 'alex', 'noah_p', 'tom_b', 'max_g', 'sofia_g', 'marc_l', 'hugo_t', 'lucas_d']) await call('PUT', `${AGB}/attendance/${U[p].id}`, { present: true }, T.karim_a);
  await call('PUT', `/plans/assembly/items/${bRapport}/notes`, { notes: 'Le président remercie les entraîneurs et les bénévoles du Trophée. Applaudissements.' }, T.marc_l);
  await call('POST', `/plans/assembly/items/${bComptes}/open`, {}, T.karim_a);
  for (const [p, ch] of [['karim_a', 'yes'], ['noah_p', 'yes'], ['tom_b', 'yes'], ['max_g', 'yes'], ['sofia_g', 'yes'], ['marc_l', 'yes'], ['hugo_t', 'abstain'], ['lucas_d', 'yes']]) await call('POST', `/plans/assembly/items/${bComptes}/vote`, { votes: [{ onBehalfOfId: U[p].id, choice: ch }] }, T[p]);
  await call('POST', `/plans/assembly/items/${bComptes}/vote`, { votes: [{ onBehalfOfId: U.alex.id, choice: 'yes' }, { onBehalfOfId: U.yann_k.id, choice: 'yes' }] }, T.alex);
  await call('POST', `/plans/assembly/items/${bComptes}/close`, {}, T.karim_a);
  await call('POST', `/plans/assembly/items/${bGants}/open`, {}, T.karim_a);
  for (const [p, ch] of [['karim_a', 'yes'], ['noah_p', 'yes'], ['tom_b', 'no'], ['sofia_g', 'yes']]) await call('POST', `/plans/assembly/items/${bGants}/vote`, { votes: [{ onBehalfOfId: U[p].id, choice: ch }] }, T[p]);

  // ───────── Association Jeunesse de Montvert (Léa présidente, Alex organisateur) ─────────
  const petanque = await mk(jeu, 'lea_m', { title: 'Tournoi de pétanque 🥇', description: 'Doublettes tirées au sort, championnat sur l’après-midi. Grillades ensuite !', eventDate: at(9, 14), endDate: at(9, 22),
    location: 'Place de la Fontaine, Montvert', enabledFeatures: ['equipes'] });
  await join(petanque, ['alex', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lucas_d', 'chloe_s', 'max_g']);
  await call('PUT', `/plans/${petanque.id}/teams`, { teamCount: 4 }, T.lea_m);
  await call('POST', `/plans/${petanque.id}/teams/draw`, {}, T.lea_m);
  await call('POST', `/plans/${petanque.id}/teams/tournament`, { format: 'league' }, T.lea_m);
  const tour = await call('GET', `/plans/${petanque.id}/teams`, null, T.lea_m);
  for (const [i, m] of tour.matches.filter(m => m.round <= 2).entries()) await call('PUT', `/plans/${petanque.id}/teams/matches/${m.id}`, { homeScore: [13, 9, 13, 13][i], awayScore: [7, 13, 11, 4][i] }, T.lea_m);
  // Soirée quiz : Léa anime, la partie est terminée (podium)
  const quiz = await mk(jeu, 'lea_m', { title: 'Soirée quiz au village 🧠', description: 'Quiz sur la Suisse en équipe… ou tout seul ! Questions sur l’écran de la salle, réponses sur le téléphone.', eventDate: at(1, 20), endDate: at(1, 23, 30),
    location: 'Café du Commerce, Montvert', enabledFeatures: ['quiz'] });
  await join(quiz, ['alex', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lucas_d']);
  await call('POST', `/plans/${quiz.id}/quiz/edit`, {}, T.lea_m);
  const QUESTIONS = [
    ['Quel est le plus haut sommet de Suisse ?', ['Le Cervin', 'La Pointe Dufour', 'La Jungfrau', 'L’Eiger'], 1],
    ['Combien de cantons compte la Suisse ?', ['23', '24', '26', '28'], 2],
    ['Dans quelle ville se trouve le Jet d’eau ?', ['Lausanne', 'Genève', 'Neuchâtel', 'Montreux'], 1],
    ['Quel fromage fait-on fondre pour la raclette ?', ['Le gruyère', 'L’emmental', 'Le fromage à raclette', 'La tête de moine'], 2],
    ['En quelle année a été fondée la Confédération ?', ['1291', '1515', '1848', '1291 et 1848'], 0],
  ];
  for (const [text, options, correctIndex] of QUESTIONS) await call('POST', `/plans/${quiz.id}/quiz/questions`, { text, options, correctIndex }, T.lea_m);
  const answersBy = { alex: [1, 2, 1, 2, 0], tom_b: [0, 2, 1, 2, 2], julie_r: [1, 2, 1, 0, 0], noah_p: [1, 1, 1, 2, 0], emma_v: [1, 2, 1, 2, 3], lucas_d: [3, 2, 0, 2, 0] };
  const order = { alex: 2, tom_b: 0, julie_r: 1, noah_p: 3, emma_v: 4, lucas_d: 5 };
  await call('POST', `/plans/${quiz.id}/quiz/start`, {}, T.lea_m);
  const qs = await prisma.quizQuestion.findMany({ where: { planId: quiz.id }, orderBy: { position: 'asc' } });
  for (const [i, q] of qs.entries()) {
    await sleep(3300);
    for (const p of Object.keys(answersBy).sort((a, b) => order[a] - order[b])) { await call('POST', `/plans/${quiz.id}/quiz/answer`, { questionId: q.id, option: answersBy[p][i] }, T[p]); await sleep(250); }
    await sleep(300);
    await call('POST', `/plans/${quiz.id}/quiz/next`, {}, T.lea_m);
  }
  // Week-end à Europa-Park (date choisie par un sondage) : places limitées, dépenses en CHF, covoiturage
  const europa = await mk(jeu, 'tom_b', { title: 'Week-end à Europa-Park 🎢', description: 'La date a été choisie avec le sondage du Cercle. Deux jours de parc, nuit à l’hôtel du parc.', eventDate: at(25, 6, 30), endDate: at(26, 21),
    location: 'Europa-Park, Rust (Allemagne)', maxParticipants: 9, importantInfo: 'Carte d’identité obligatoire (on passe la frontière).\nDépart 6 h 30 du parking de la salle communale.' });
  await join(europa, ['alex', 'julie_r', 'noah_p', 'emma_v', 'lucas_d', 'chloe_s', ['max_g', 'maybe']]);
  const euroMembers = ['tom_b', 'alex', 'julie_r', 'noah_p', 'emma_v', 'lucas_d', 'chloe_s'].map(p => U[p].id);
  await call('POST', `/plans/${europa.id}/expenses`, { description: 'Billets 2 jours (7 personnes)', amount: 1043, currency: 'CHF', splitWith: euroMembers }, T.tom_b);
  await call('POST', `/plans/${europa.id}/expenses`, { description: 'Hôtel, 3 chambres', amount: 690, currency: 'CHF', splitWith: euroMembers }, T.julie_r);
  await call('POST', `/plans/${europa.id}/expenses`, { description: 'Essence et vignette', amount: 145.5, currency: 'CHF', splitWith: euroMembers }, T.noah_p);
  const er1 = await call('POST', `/rides/plan/${europa.id}`, { departure: 'Montvert, parking de la salle communale', seats: 4, departureAt: at(25, 6, 30), note: 'Pause café à Bâle' }, T.noah_p);
  await call('POST', `/rides/plan/${europa.id}`, { departure: 'Gare de Sion', seats: 3, departureAt: at(25, 6, 15) }, T.julie_r);
  for (const p of ['tom_b', 'emma_v']) await call('POST', `/rides/${er1.id}/join`, {}, T[p]);
  await call('POST', `/rides/plan/${europa.id}/request`, { fromLocation: 'Sierre' }, T.chloe_s);
  // Assemblée générale de printemps : convoquée, pas encore ouverte (ordre du jour, procurations)
  const agJeu = await mk(jeu, 'lea_m', { title: 'Assemblée générale de printemps', description: 'Ordre du jour ci-dessous. Si tu ne peux pas venir, donne ta procuration dans l’app.', eventDate: at(18, 19, 30), endDate: at(18, 23),
    location: 'Salle communale de Montvert', enabledFeatures: ['assemblee'] });
  await join(agJeu, ['alex', 'tom_b', 'julie_r', 'noah_p', ['emma_v', 'maybe'], ['max_g', 'out']]);
  const AGJ = `/plans/${agJeu.id}/assembly`;
  await call('PUT', AGJ, { quorumMode: 'percent', quorumValue: 50, secretaryId: U.julie_r.id }, T.lea_m);
  for (const body of [{ title: 'Accueil et liste de présence', kind: 'info' }, { title: 'Rapport de la présidente', kind: 'info', description: 'Bilan de l’hiver : loto, sortie ski et soirée quiz.' },
    { title: 'Budget de la fête du village', kind: 'vote', majority: 'simple', description: 'Proposition : 3 000 CHF, à partager avec la Team events.' },
    { title: 'Nouveau caissier ou nouvelle caissière', kind: 'election', seats: 1 }, { title: 'Divers', kind: 'info' }]) await call('POST', `${AGJ}/items`, body, T.lea_m);
  await call('POST', `${AGJ}/proxy`, { holderId: U.julie_r.id }, T.max_g);
  await call('POST', `${AGJ}/convoke`, {}, T.lea_m);

  // ───────── Best collègues (Sarah) ─────────
  const afterwork = await mk(col, 'alex', { title: 'Afterwork de fin de mois 🍻', description: 'On fête la fin du projet ! Le lieu se choisit avec le match dans l’onglet Votes 👇', eventDate: at(5, 18), endDate: at(5, 23, 30), location: 'À choisir avec le match' });
  await join(afterwork, ['sarah_k', 'marc_l', 'zoe_m', ['paul_r', 'maybe']]);
  const bar = await call('POST', `/plans/${afterwork.id}/matches`, { question: 'Où va-t-on pour l’afterwork ?', options: [
    { label: 'Rooftop de la gare', note: 'Cocktails et vue sur les toits' }, { label: 'Brasserie artisanale', note: 'Bières locales et planchettes' },
    { label: 'Bowling & burgers', note: 'Deux pistes à réserver' }, { label: 'Karaoké', note: 'Pour finir en chanson 🎤' }] }, T.sarah_k);
  const bopts = await prisma.matchOption.findMany({ where: { matchId: bar.id } });
  for (const [who, likes] of [['sarah_k', ['Rooftop', 'Brasserie']], ['marc_l', ['Brasserie', 'Bowling']], ['zoe_m', ['Rooftop', 'Brasserie', 'Karaoké']], ['paul_r', ['Brasserie', 'Bowling']]])
    for (const o of bopts) await call('POST', `/plans/matches/options/${o.id}/swipe`, { like: likes.some(l => o.label.startsWith(l)) }, T[who]);
  const depart = await mk(col, 'sarah_k', { title: 'Pot de départ de Sophie 🥂', description: 'Chut ! Sophie ne voit pas ce Plan. Petit discours, apéro et cadeau commun.', eventDate: at(8, 17), endDate: at(8, 20),
    location: 'Cafétéria du 3e étage', excludedUserIds: [U.sophie_d.id], enabledFeatures: ['cagnotte'], importantInfo: 'Sophie pense que c’est une réunion d’équipe à 17 h : soyez là à 16 h 50 !' });
  await join(depart, ['marc_l', 'paul_r', 'zoe_m', 'alex']);
  await call('PUT', `/plans/${depart.id}/pot`, { forWhom: 'Sophie', target: '150', suggested: '20', currency: 'CHF', payInfo: 'Twint à Sarah, ou en espèces dans l’enveloppe du bureau 12' }, T.sarah_k);
  for (const [p, amount] of [['marc_l', '25'], ['zoe_m', '20'], ['paul_r', '20']]) await call('PUT', `/plans/${depart.id}/pot/pledge`, { amount }, T[p]);
  await call('PUT', `/plans/${depart.id}/pot/pledge/paid`, { paid: true }, T.marc_l);
  await call('PUT', `/plans/${depart.id}/pot/pledges/${U.marc_l.id}`, { received: true }, T.sarah_k);
  await call('POST', `/plans/${depart.id}/pot/ideas`, { text: 'Un cours de cuisine thaï pour deux', price: '140' }, T.zoe_m);
  await call('POST', `/plans/${depart.id}/pot/ideas`, { text: 'Une plante géante pour son nouveau bureau 🌿', price: '90' }, T.paul_r);
  const noelBureau = await mk(col, 'sarah_k', { title: 'Repas de Noël d’équipe 🎄', description: 'Repas au restaurant puis échange de cadeaux du Père Noël secret (budget 25 CHF).', eventDate: at(22, 19), endDate: at(22, 23, 30),
    location: 'Restaurant du Moléson, Gruyères', enabledFeatures: ['pere_noel'] });
  await join(noelBureau, ['alex', 'marc_l', 'paul_r', 'zoe_m', 'sophie_d']);
  const resto = await call('POST', `/plans/${noelBureau.id}/polls`, { question: 'Fondue ou menu de Noël ?', options: ['Fondue moitié-moitié', 'Menu de Noël (3 plats)'], anonymous: false }, T.sarah_k);
  for (const [p, i] of [['marc_l', 0], ['zoe_m', 0], ['paul_r', 1], ['sophie_d', 0]]) await call('POST', `/plans/polls/${resto.options[i].id}/vote`, {}, T[p]);
  await call('PUT', `/plans/${noelBureau.id}/santa`, { budget: '25 CHF' }, T.sarah_k);
  for (const [p, body] of [['marc_l', { text: 'Un bon café en grains, ou un mug rigolo' }], ['paul_r', { noWish: true }], ['zoe_m', { text: 'Des chaussettes de Noël (si si) et du chocolat' }], ['sophie_d', { text: 'Un livre de cuisine' }], ['sarah_k', { text: 'Une plante facile à garder en vie 🪴' }]])
    await call('PUT', `/plans/${noelBureau.id}/santa/wish`, body, T[p]);
  await call('POST', `/plans/${noelBureau.id}/santa/draw`, {}, T.sarah_k);
  const nr1 = await call('POST', `/rides/plan/${noelBureau.id}`, { departure: 'Bureau, parking P2', seats: 3, departureAt: at(22, 18, 15), note: 'Retour vers 23 h 30' }, T.marc_l);
  await call('POST', `/rides/${nr1.id}/join`, {}, T.zoe_m);
  await call('POST', `/rides/plan/${noelBureau.id}/request`, { fromLocation: 'Gare de Fribourg' }, T.paul_r);
  const bowling = await call('POST', `/circles/${col.id}/polls`, { question: 'Sortie bowling', options: [
    { label: 'Jeudi', eventDate: at(12, 18, 30) }, { label: 'Vendredi', eventDate: at(13, 18, 30) }, { label: 'Mardi', eventDate: at(17, 18, 30) }] }, T.zoe_m);
  for (const [p, os] of [['zoe_m', [0, 1]], ['marc_l', [1]], ['sarah_k', [1, 2]], ['paul_r', [0, 1]]]) for (const i of os) await call('POST', `/circles/polls/options/${bowling.options[i].id}/vote`, {}, T[p]);

  // ───────── Famille Rochat (Julie) ─────────
  const mamie = await mk(fam, 'julie_r', { title: 'Les 80 ans de Mamie 🎂', description: 'Chut ! Mamie ne voit pas ce Plan. Grand repas surprise chez Nathalie, avec toute la famille.', eventDate: at(11, 12), endDate: at(11, 20),
    location: 'Chez Nathalie, chemin des Vergers 3', excludedUserIds: [U.monique_r.id], importantInfo: 'Pierre amène Mamie à 12 h : soyez tous là à 11 h 30 !\nOn garde les voitures derrière la maison.' });
  await join(mamie, ['pierre_r', 'nathalie_r', 'leo_r', 'alex']);
  await items(mamie, 'julie_r', [['Gâteau d’anniversaire', 'nathalie_r'], ['Album photo souvenir', 'julie_r'], ['Bouquet de fleurs', null], ['Champagne', 'alex', '3 bouteilles'], ['Bougies 8 et 0', 'leo_r']]);
  const ph = await upload(mamie.id, 'pierre_r', 'lac.png', 'chat');
  const sock = {}; for (const p of ['chloe_s', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lea_m', 'lucas_d', 'pierre_r', 'nathalie_r', 'leo_r', 'ines_b', 'karim_a', 'sofia_g', 'nadia_f', 'paul_r', 'zoe_m', 'sarah_k', 'marc_l', 'hugo_t']) sock[p] = io('http://localhost:3999', { auth: { token: T[p] }, transports: ['websocket'] });
  await sleep(1200);
  const chat = async (planId, listener, lines) => {
    sock[listener].emit('join-plan', planId); await sleep(300);
    const out = [];
    for (const [p, content, extra] of lines) { const got = new Promise(res => sock[listener].once('message', res)); sock[p].emit('send-message', { planId, content, ...(extra || {}) }); out.push(await got); await sleep(300); }
    sock[listener].emit('leave-plan', planId); return out;
  };
  const react = async list => { for (const [p, mid, e] of list) { sock[p].emit('toggle-reaction', { messageId: mid, emoji: e }); await sleep(200); } };
  const mm = await chat(mamie.id, 'julie_r', [
    ['pierre_r', 'Le coucher de soleil où on avait fêté ses 70 ans 🌅 Je l’imprime pour l’album', { attachmentId: ph.id }],
    ['nathalie_r', 'Je fais son gâteau préféré : forêt-noire 🍒'],
    ['leo_r', 'J’ai préparé une playlist avec ses chansons des années 60 🎶'],
  ]);
  await react([['julie_r', mm[0].id, '❤️'], ['nathalie_r', mm[0].id, '❤️'], ['alex', mm[1].id, '😋']].filter(([p]) => sock[p]));
  const noelFam = await mk(fam, 'julie_r', { title: 'Noël en famille 🎄', description: 'Réveillon chez Papi et Mamie, comme chaque année.', eventDate: at(24, 18), endDate: at(25, 14),
    location: 'Chez Papi et Mamie, Montvert' });
  await join(noelFam, ['pierre_r', 'monique_r', 'nathalie_r', 'leo_r', 'alex']);
  await items(noelFam, 'monique_r', [['Dinde aux marrons', 'monique_r'], ['Bûche de Noël', 'nathalie_r'], ['Vin rouge', 'pierre_r', '6 bouteilles'], ['Fromages', null], ['Papillotes', 'leo_r']]);
  const famMembers = ['julie_r', 'pierre_r', 'monique_r', 'nathalie_r', 'leo_r', 'alex'].map(p => U[p].id);
  await call('POST', `/plans/${noelFam.id}/expenses`, { description: 'Sapin de Noël', amount: 65, currency: 'CHF', splitWith: famMembers }, T.pierre_r);
  await call('POST', `/plans/${noelFam.id}/expenses`, { description: 'Courses du réveillon', amount: 238.4, currency: 'CHF', splitWith: famMembers }, T.julie_r);
  const wheel = await call('POST', `/plans/${noelFam.id}/wheels`, { question: 'Qui fait la vaisselle ?', excludedUserIds: [U.monique_r.id], noRepeat: true }, T.leo_r);
  await call('POST', `/plans/wheels/${wheel.id}/spin`, {}, T.nathalie_r);
  const tessin = await mk(fam, 'pierre_r', { title: 'Vacances au Tessin ☀️', description: 'Une semaine tous ensemble au bord du Lac Majeur.', eventDate: at(40, 8), endDate: at(46, 18),
    location: 'Locarno', importantInfo: 'On y va en train par les Centovalli : le plus beau trajet de Suisse !\nCrème solaire et maillot de bain.' });
  await join(tessin, ['julie_r', 'nathalie_r', 'leo_r', 'alex', ['monique_r', 'maybe']]);
  const dodo = await call('POST', `/plans/${tessin.id}/polls`, { question: 'Où dort-on ?', options: ['Maison de vacances à Ascona', 'Hôtel au bord du lac'], anonymous: false }, T.pierre_r);
  for (const [p, i] of [['pierre_r', 0], ['julie_r', 0], ['nathalie_r', 1], ['leo_r', 0]]) await call('POST', `/plans/polls/${dodo.options[i].id}/vote`, {}, T[p]);
  // Transports publics : le trajet en train (horaires fictifs, le serveur de test n'a pas de clé OJP)
  const leg = (kind, line, direction, from, to, platform, dep, arr, walkMinutes = null) => ({ kind, line, direction, from, to, platform, departureAt: dep, arrivalAt: arr, walkMinutes });
  const trip = (day, h, m, legs) => ({ departureAt: legs[0].departureAt, arrivalAt: legs[legs.length - 1].arrivalAt, minutes: Math.round((new Date(legs[legs.length - 1].arrivalAt) - new Date(legs[0].departureAt)) / 60000), transfers: legs.filter(l => l.kind !== 'walk').length - 1, legs });
  const tessinTrip = (h0, m0) => { const t = (dh, dm) => at(40, h0 + dh, m0 + dm); return trip(40, h0, m0, [
    leg('train', 'IR 90', 'Brig', 'Genève', 'Brig', '4', t(0, 0), t(2, 33)),
    leg('train', 'RE', 'Domodossola', 'Brig', 'Domodossola', '1', t(2, 42), t(3, 12)),
    leg('train', 'R', 'Locarno', 'Domodossola', 'Locarno', null, t(3, 26), t(5, 13)),
  ]); };
  const tessinConns = { go: [tessinTrip(4, 39), tessinTrip(5, 39), tessinTrip(6, 39)], last: null };
  await call('PUT', `/plans/${tessin.id}/transit/me`, { from: { id: '8501008', name: 'Genève' }, to: { id: '8505300', name: 'Locarno' } }, T.pierre_r);
  await call('POST', `/plans/${tessin.id}/transit/groups`, { connection: tessinConns.go[2], note: 'On se retrouve devant le kiosque du quai 4 ☕' }, T.pierre_r);
  const grp = await prisma.transitGroup.findFirst({ where: { planId: tessin.id } });
  for (const p of ['nathalie_r', 'leo_r']) await call('POST', `/plans/transit-groups/${grp.id}/join`, {}, T[p]);
  await call('PUT', `/plans/${tessin.id}/transit/me`, { from: { id: '8501008', name: 'Genève' }, to: { id: '8505300', name: 'Locarno' } }, T.alex);

  // ───────── Les copains (Alex) ─────────
  const raclette = await mk(cop, 'tom_b', { title: 'Raclette chez Tom 🧀', description: 'Soirée raclette avant l’hiver ! Tom s’occupe du fromage, chacun amène quelque chose.', eventDate: at(3, 19), endDate: at(4, 1),
    location: 'Chez Tom, rue du Bourg 8, Sierre' });
  await join(raclette, ['alex', 'emma_v', 'noah_p', 'lucas_d', 'julie_r', ['chloe_s', 'maybe']]);
  const copMembers = ['tom_b', 'alex', 'emma_v', 'noah_p', 'lucas_d', 'julie_r'].map(p => U[p].id);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Fromage à raclette (3 kg)', amount: 86.4, currency: 'CHF', splitWith: copMembers }, T.tom_b);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Pommes de terre et cornichons', amount: 18.9, currency: 'CHF', splitWith: copMembers }, T.emma_v);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Boissons', amount: 54, currency: 'CHF', splitWith: copMembers }, T.lucas_d);
  await items(raclette, 'tom_b', [['Appareils à raclette', 'noah_p', '2'], ['Charcuterie', 'emma_v'], ['Vin blanc', null, '4 bouteilles'], ['Desserts', 'julie_r']]);
  const rr = await call('POST', `/rides/plan/${raclette.id}`, { departure: 'Gare de Sion', seats: 3, departureAt: at(3, 18, 20), note: 'Retour vers minuit' }, T.emma_v);
  await call('POST', `/rides/${rr.id}/join`, {}, T.lucas_d);
  await call('POST', `/rides/plan/${raclette.id}/request`, { fromLocation: 'Martigny' }, T.julie_r);
  const ph2 = await upload(raclette.id, 'tom_b', 'montagne.png', 'chat');
  const rm = await chat(raclette.id, 'emma_v', [
    ['tom_b', 'La vue depuis chez moi ce matin, la neige arrive ❄️', { attachmentId: ph2.id }],
    ['emma_v', 'Trop beau 😍 J’amène la charcuterie !'],
    ['noah_p', 'Qui a un deuxième appareil à raclette ?'],
    ['lucas_d', 'Moi, je l’amène 👍'],
    ['julie_r', 'Je cherche une place depuis Martigny, quelqu’un passe par là ? 🚗'],
  ]);
  await react([['emma_v', rm[0].id, '😍'], ['noah_p', rm[0].id, '😍'], ['tom_b', rm[3].id, '🙏']]);
  // Week-end au chalet : Killer et mot piège (Alex organise)
  const chalet = await mk(cop, 'alex', { title: 'Week-end au chalet 🏔️', description: 'Deux jours entre copains, raclette et partie de Killer tout le week-end 🔪', eventDate: at(6, 18), endDate: at(8, 18), location: 'Chalet des Mayens, Nax', enabledFeatures: ['killer', 'mot_piege'] });
  await join(chalet, ['tom_b', 'julie_r', 'emma_v', 'noah_p']);
  await call('PUT', `/plans/${chalet.id}/killer`, { objects: ['une cuillère en bois', 'un bouchon de liège', 'une carte de jass', 'un gant de cuisine', 'une pive', 'un caquelon'], places: ['dans la cuisine', 'sur la terrasse', 'près de la cheminée', 'dans l’escalier', 'devant le chalet'] }, T.alex);
  await call('POST', `/plans/${chalet.id}/killer/start`, {}, T.alex);
  const kp = await prisma.killerPlayer.findMany({ where: { planId: chalet.id } });
  const alexTarget = kp.find(p => p.userId === U.alex.id).targetId;
  const hunter = kp.find(p => p.userId !== U.alex.id && p.targetId !== U.alex.id && p.targetId !== alexTarget && p.userId !== alexTarget) ?? kp.find(p => p.userId !== U.alex.id && p.targetId !== U.alex.id);
  await call('POST', `/plans/${chalet.id}/killer/claim`, {}, T[pseudoOf(hunter.userId)]);
  await call('POST', `/plans/${chalet.id}/killer/answer`, { confirm: true }, T[pseudoOf(hunter.targetId)]);
  await call('PUT', `/plans/${chalet.id}/words`, { levels: ['facile', 'moyen'], customWords: ['caquelon', 'Nax', 'télécabine'], endsAt: at(8, 12) }, T.alex);
  await call('POST', `/plans/${chalet.id}/words/start`, {}, T.alex);
  for (let i = 0; i < 2; i++) {
    const wp = await prisma.wordPlayer.findMany({ where: { planId: chalet.id, eliminatedAt: null } });
    const h = wp.find(p => p.userId !== U.alex.id && p.targetId !== U.alex.id);
    if (!h) break;
    await call('POST', `/plans/${chalet.id}/words/claim`, {}, T[pseudoOf(h.userId)]);
    await call('POST', `/plans/${chalet.id}/words/answer`, { confirm: true }, T[pseudoOf(h.targetId)]);
  }
  // Concert au bord du lac : des amis d'amis répondent sans compte, dernier retour en transports publics
  const concert = await mk(cop, 'emma_v', { title: 'Concert au bord du lac 🎸', description: 'Concert gratuit en plein air. Invitez qui vous voulez avec le lien, pas besoin de compte pour répondre !', eventDate: at(15, 20), endDate: at(16, 0, 30),
    location: 'Parc des Eaux-Vives, Genève' });
  await join(concert, ['alex', 'noah_p', 'chloe_s', ['tom_b', 'maybe']]);
  await guests(concert, 'emma_v', [['Sam', 'in'], ['Lina', 'in'], ['Bastien', 'maybe']]);
  const concertConns = {
    go: [0, 15, 30].map(m => trip(15, 19, m, [leg('walk', null, null, 'Ton adresse', 'Genève, Plainpalais', null, at(15, 19, m), at(15, 19, m + 4), 4), leg('tram', 'Tram 12', 'Moillesulaz', 'Genève, Plainpalais', 'Genève, Rive', 'B', at(15, 19, m + 6), at(15, 19, m + 14)), leg('bus', 'Bus 2', 'Genève-Plage', 'Genève, Rive', 'Genève, Eaux-Vives-Plage', 'C', at(15, 19, m + 18), at(15, 19, m + 24))])),
    last: trip(16, 0, 52, [leg('walk', null, null, 'Parc des Eaux-Vives', 'Genève, Eaux-Vives-Plage', null, at(16, 0, 46), at(16, 0, 52), 6), leg('bus', 'Bus N4', 'Plainpalais', 'Genève, Eaux-Vives-Plage', 'Genève, Plainpalais', null, at(16, 0, 52), at(16, 1, 9))]),
  };
  await call('PUT', `/plans/${concert.id}/transit/me`, { from: { id: '8587057', name: 'Genève, Plainpalais' }, to: { id: '8587387', name: 'Genève, Eaux-Vives-Plage' } }, T.alex);
  // Noël entre copains : Père Noël secret, tirage déjà fait (Alex organise)
  const noel = await mk(cop, 'alex', { title: 'Noël entre copains 🎁', description: 'Repas de Noël et échange de cadeaux. Chacun apporte un plat !', eventDate: at(14, 19), endDate: at(15, 2), location: 'Chez Emma', enabledFeatures: ['pere_noel'] });
  await join(noel, ['tom_b', 'julie_r', 'emma_v', 'noah_p']);
  await call('PUT', `/plans/${noel.id}/santa`, { budget: '30 CHF', exclusions: [[U.julie_r.id, U.noah_p.id]] }, T.alex);
  for (const [p, body] of [['tom_b', { text: 'Un jeu de société, du chocolat noir. Pas de chaussettes 😅' }], ['julie_r', { text: 'Un livre (polar ou roman), une jolie tasse, du thé' }],
    ['emma_v', { noWish: true }], ['noah_p', { text: 'Des écouteurs sans fil ou un bonnet (taille M)' }]]) await call('PUT', `/plans/${noel.id}/santa/wish`, body, T[p]);
  await call('POST', `/plans/${noel.id}/santa/draw`, {}, T.alex);
  const santaPairs = await prisma.secretSantaPair.findMany({ where: { planId: noel.id } });
  const alexReceiver = pseudoOf(santaPairs.find(p => p.giverId === U.alex.id).receiverId);
  const alexSanta = pseudoOf(santaPairs.find(p => p.receiverId === U.alex.id).giverId);
  await call('POST', `/plans/${noel.id}/santa/messages`, { to: 'santa', content: 'Coucou mon Père Noël secret 🎅 J’ai mis ma liste d’envies à jour !' }, T[alexReceiver]);
  await call('POST', `/plans/${noel.id}/santa/messages`, { to: 'receiver', content: 'Hello ! Tu préfères le sucré ou le salé ? 🎅' }, T[alexSanta]);
  for (const p of ['tom_b', 'julie_r']) if (p !== alexReceiver) await call('PUT', `/plans/${noel.id}/santa/ready`, { ready: true }, T[p]);
  // Anniversaire surprise de Tom : Tom ne le voit pas, cagnotte (Alex organise)
  const anniv = await mk(cop, 'alex', { title: 'Anniversaire surprise de Tom 🎂', description: 'Chut ! Tom ne voit pas ce Plan. On se retrouve 30 min avant pour tout préparer.', eventDate: at(12, 19, 30), endDate: at(13, 2), location: 'Chez Julie',
    excludedUserIds: [U.tom_b.id], importantInfo: 'Arriver à 19 h au plus tard, Tom arrive à 19 h 30.\nCagnotte cadeau : 20 CHF par personne.', enabledFeatures: ['cagnotte'] });
  await join(anniv, ['julie_r', 'emma_v', ['noah_p', 'maybe'], 'lucas_d']);
  await call('PUT', `/plans/${anniv.id}/pot`, { forWhom: 'Tom', target: '200', suggested: '20', currency: 'CHF', payInfo: 'Twint au 079 123 45 67 (Alex), ou en espèces le soir même' }, T.alex);
  for (const [p, amount] of [['julie_r', '20'], ['emma_v', '30'], ['noah_p', '20']]) await call('PUT', `/plans/${anniv.id}/pot/pledge`, { amount }, T[p]);
  await call('PUT', `/plans/${anniv.id}/pot/pledge/paid`, { paid: true }, T.julie_r);
  await call('PUT', `/plans/${anniv.id}/pot/pledges/${U.julie_r.id}`, { received: true }, T.alex);
  await call('PUT', `/plans/${anniv.id}/pot/pledge/paid`, { paid: true }, T.emma_v);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Un baptême de parapente', price: '170' }, T.julie_r);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Le maillot de son équipe de foot', price: '110' }, T.emma_v);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Une box dégustation de bières', price: '60' }, T.noah_p);
  const pot = await call('GET', `/plans/${anniv.id}/pot`, null, T.alex);
  await call('POST', `/plans/${anniv.id}/pot/ideas/${pot.ideas.find(i => i.text.includes('parapente')).id}/vote`, {}, T.noah_p);

  // ───────── Team events (Nadia, Alex organisateur) ─────────
  const fete = await mk(evt, 'alex', { title: 'Fête du village de Montvert 🎪', description: 'Organisée avec l’Association Jeunesse de Montvert : marché, grillades, concert de la fanfare et démonstration de danse.', eventDate: at(32, 11), endDate: at(32, 23, 59),
    location: 'Place de la Fontaine, Montvert', enabledFeatures: ['benevoles'], extraCircleIds: [jeu.id], importantInfo: 'Bénévoles : rendez-vous à 9 h à l’accueil pour le montage.\nGilet orange fourni.' });
  await upload(fete.id, 'alex', 'affiche-fete.png', 'affiche');
  await join(fete, ['nadia_f', 'paul_r', 'zoe_m', 'lea_m', 'tom_b', 'julie_r', 'emma_v', ['hugo_t', 'maybe']]);
  const fShift = (title, h0, h1, needed, note) => call('POST', `/plans/${fete.id}/shifts`, { title, needed, note, startsAt: at(32, h0), endsAt: at(32, h1) }, T.alex);
  await fShift('Concert de la fanfare', 17, 18, 0, 'Programme');
  const fMontage = await fShift('Montage des stands', 9, 11, 6, 'Tentes et tables au local des pompiers');
  const fGrill = await fShift('Stand grillades', 11, 15, 3, null);
  const fBuv = await fShift('Buvette', 15, 20, 4, 'Caisse : Paul');
  const fRange = await fShift('Rangement de la place', 22, 24, 6, null);
  for (const [s, who] of [[fMontage, ['nadia_f', 'paul_r', 'tom_b']], [fGrill, ['lea_m', 'julie_r']], [fBuv, ['zoe_m', 'paul_r', 'emma_v']], [fRange, ['nadia_f']]])
    for (const p of who) await call('POST', `/plans/shifts/${s.id}/signup`, {}, T[p]);
  const reunion = await mk(evt, 'nadia_f', { title: 'Réunion du comité', description: 'Dernière réunion avant la fête : stands, bénévoles, budget. Le plan du site est dans Infos.', eventDate: at(4, 19), endDate: at(4, 21),
    location: 'Salle de la Tour, Montvert' });
  await join(reunion, ['alex', 'paul_r', 'zoe_m', 'lea_m', ['hugo_t', 'out']]);
  await upload(reunion.id, 'nadia_f', 'plan-du-site.png');
  await chat(reunion.id, 'nadia_f', [
    ['nadia_f', 'J’ai mis le plan du site dans Infos, dites-moi si on garde la buvette près de la fontaine 🗺️'],
    ['paul_r', 'Ça me va. Il faudra une rallonge électrique de plus pour les grillades'],
    ['zoe_m', 'Je m’occupe des affiches dans les commerces du village 📌'],
  ]);
  const course = await mk(evt, 'nadia_f', { title: 'Course populaire des 10 km 🏃', description: 'Course ouverte à tous, départ place de l’école. Inscription par le lien, avec ou sans compte EvLY.', eventDate: at(45, 9, 30), endDate: at(45, 13),
    location: 'Place de l’école, Montvert', maxParticipants: 12, disabledFeatures: ANNONCE_OFF, membersVisibility: 'managers', importantInfo: 'Retrait des dossards dès 8 h 30.\nInscription : 20 CHF, à payer sur place.' });
  await upload(course.id, 'nadia_f', 'affiche-course.png', 'affiche');
  await join(course, ['paul_r', 'lea_m', 'emma_v', 'alex']);
  await guests(course, 'nadia_f', [['Bastien', 'in'], ['Laura', 'in'], ['Mehdi', 'in'], ['Anna', 'in'], ['Rémy', 'in'], ['Inès', 'in'], ['Jonas', 'in']]);
  for (const p of ['zoe_m', 'hugo_t']) await call('POST', `/plans/${course.id}/waitlist`, {}, T[p]);
  const nextMeeting = await call('POST', `/circles/${evt.id}/polls`, { question: 'Réunion bilan après la fête', options: [
    { label: 'Lundi', eventDate: at(35, 19) }, { label: 'Mercredi', eventDate: at(37, 19) }] }, T.nadia_f);
  for (const [p, os] of [['nadia_f', [0, 1]], ['paul_r', [1]], ['zoe_m', [1]]]) for (const i of os) await call('POST', `/circles/polls/options/${nextMeeting.options[i].id}/vote`, {}, T[p]);

  // Chats de quelques Plans
  await chat(boxing.id, 'karim_a', [
    ['karim_a', 'Ce soir : travail au sac et sparring léger. Protège-dents obligatoire 🥊'],
    ['noah_p', 'Je ramène les cordes à sauter du club'],
  ]);
  await chat(bachata.id, 'ines_b', [
    ['ines_b', 'Il manque des hommes pour équilibrer les couples : répondez au sondage et invitez vos amis ! 🕺'],
    ['sofia_g', 'Mon frère veut essayer, je l’amène jeudi 😊'],
  ]);
  await chat(afterwork.id, 'sarah_k', [
    ['sarah_k', 'Super idée ! J’ai mis 4 propositions dans le match, à vous de jouer 😄'],
    ['marc_l', 'Je peux réserver dès qu’on a le lieu, j’ai le numéro de la brasserie 📞'],
    ['zoe_m', 'On part ensemble du bureau à 17 h 45 ?'],
  ]);
  await chat(europa.id, 'tom_b', [
    ['tom_b', 'Billets achetés ! J’ai mis la dépense, chacun me rembourse quand il peut 🎢'],
    ['emma_v', 'Je réserve ma place dans la voiture de Noah 🚗'],
  ]);

  await chat(quiz.id, 'lea_m', [
    ['lea_m', 'Bravo à tous, et surtout à @alex pour la victoire 🏆'],
    ['tom_b', 'Revanche le mois prochain 😤'],
  ]);
  await chat(tessin.id, 'pierre_r', [
    ['pierre_r', 'J’ai proposé le train de 6 h 39 dans Trajets : on passe par les Centovalli 🚞'],
    ['leo_r', 'Trop bien, je prends le jeu de cartes pour le trajet 🃏'],
    ['nathalie_r', 'Pour le logement, votez dans l’onglet Votes avant dimanche !'],
  ]);
  await chat(concert.id, 'emma_v', [
    ['emma_v', 'J’ai partagé le lien à Sam et Lina, ils ont répondu sans créer de compte 🎉'],
    ['noah_p', 'On se retrouve devant la buvette à 19 h 45 ?'],
    ['chloe_s', 'Le dernier bus de nuit est à 0 h 52, c’est dans Trajets 🌙'],
  ]);
  await chat(fete.id, 'nadia_f', [
    ['nadia_f', 'Il manque encore du monde pour le montage et le rangement, inscrivez-vous dans Planning 🙏'],
    ['lea_m', 'La jeunesse s’occupe du stand grillades, comme l’an passé 🍔'],
    ['paul_r', 'Je tiens la caisse de la buvette 💰'],
  ]);
  await chat(agBoxe.id, 'karim_a', [
    ['karim_a', 'Les comptes et le rapport sont dans l’onglet Assemblée. À ce soir !'],
    ['sofia_g', 'Je serai là, j’amène les gâteaux pour la verrée 🍰'],
  ]);
  await chat(trophee.id, 'karim_a', [
    ['karim_a', 'Le planning est en ligne : merci de vous inscrire dans l’onglet Planning 🥊'],
    ['tom_b', 'Je prends la buvette le samedi 🍺'],
  ]);
  // La soirée a eu lieu hier : Plan « Terminé », en lecture seule jusqu'à sa suppression
  await prisma.plan.update({ where: { id: quiz.id }, data: { eventDate: new Date(at(-1, 20)), endDate: new Date(at(0, 0, 30)) } });
  // Alex a presque tout vu ; quelques nouveautés restent (pastilles)
  const all = [salsa, bachata, stage, gala, boxing, trophee, agBoxe, petanque, quiz, europa, agJeu, afterwork, depart, noelBureau, mamie, noelFam, tessin, raclette, chalet, concert, noel, anniv, fete, reunion, course];
  for (const plan of all) await prisma.planMember.updateMany({ where: { planId: plan.id, userId: U.alex.id }, data: { seen: { chat: new Date(Date.now() - 864e5).toISOString() } } });
  // Mode silencieux : l'entraînement (rendez-vous de chaque semaine) en silence
  await call('PUT', '/mutes', { planId: boxing.id, muted: true }, T.alex);

  fs.writeFileSync(__dirname + '/ids.json', JSON.stringify({
    alex: T.alex, alexId: U.alex.id, tom: T.tom_b,
    circles: [danse.id, boxe.id, jeu.id, col.id, fam.id, cop.id, evt.id],
    plans: all.map(p => p.id),
    santaPlans: [noel.id, noelBureau.id], matchPlans: [afterwork.id], matchViewers: { [afterwork.id]: T.sarah_k },
    wheelPlans: [noelFam.id], assemblyPlans: [agBoxe.id, agJeu.id], killerPlans: [chalet.id], wordPlans: [chalet.id], teamPlans: [petanque.id],
    potPlans: [anniv.id, depart.id], quizPlans: [quiz.id], transitPlans: { [tessin.id]: tessinConns, [concert.id]: concertConns },
  }));
  Object.values(sock).forEach(s => s.close());
  console.log('ok'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
