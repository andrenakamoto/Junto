process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:55432/evly_test';
const { PrismaClient } = require('@prisma/client'); const jwt = require('jsonwebtoken'); const { io } = require('socket.io-client'); const fs = require('fs');
const prisma = new PrismaClient(); const API = 'http://localhost:3999/api'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = async (m, p, b, t) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b && JSON.stringify(b) }); const d = await r.json().catch(() => null); if (r.status >= 400) console.error('!!', m, p, r.status, d); return d; };
const at = (days, h, min = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, min, 0, 0); return d.toISOString(); };
(async () => {
  await prisma.user.create({ data: { pseudo: 'admin_demo', email: 'admin@demo.test', emailVerified: true, isAdmin: true, acceptedTermsVersion: 99 } });
  const people = [['alex', 'Alex'], ['lea_m', 'Léa'], ['tom_b', 'Tom'], ['julie_r', 'Julie'], ['noah_p', 'Noah'], ['emma_v', 'Emma'], ['lucas_d', 'Lucas'], ['chloe_s', 'Chloé'], ['max_g', 'Maxime']];
  const U = {};
  for (const [pseudo, firstName] of people) U[pseudo] = await prisma.user.create({ data: { pseudo, firstName, email: `${pseudo}@exemple.test`, emailVerified: true, acceptedTermsVersion: 99 } });
  const T = Object.fromEntries(Object.entries(U).map(([k, u]) => [k, jwt.sign({ userId: u.id, pseudo: u.pseudo }, 'test-secret')]));
  // Cercle 1 : la jeunesse
  const jeu = await prisma.circle.create({ data: { name: 'Jeunesse de Montvert', description: 'Soirées, lotos, sorties et girons 🎉', code: 'MONTVE', color: '#f43f5e', creatorId: U.lea_m.id,
    members: { create: Object.values(U).map(u => ({ userId: u.id, role: u.pseudo === 'lea_m' ? 'admin' : u.pseudo === 'alex' ? 'organizer' : 'member' })) } } });
  // Cercle 2 : les copains (Alex créateur)
  const cop = await prisma.circle.create({ data: { name: 'Les copains', description: 'Apéros, anniversaires et week-ends', code: 'COPAIN', color: '#06b6d4', creatorId: U.alex.id,
    members: { create: ['alex', 'tom_b', 'julie_r', 'emma_v', 'noah_p'].map(p => ({ userId: U[p].id, role: p === 'alex' ? 'admin' : 'member' })) } } });
  const mk = (c, t, body) => call('POST', `/circles/${c.id}/plans`, body, T[t]);
  const raclette = await mk(jeu, 'lea_m', { title: 'Soirée raclette du comité', description: 'On prépare le loto autour d’une bonne raclette 🧀', eventDate: at(3, 19), endDate: at(4, 2), location: 'Local de la jeunesse' });
  const ski = await mk(jeu, 'tom_b', { title: 'Sortie ski à Crans-Montana', description: 'Journée ski + fondue à midi ⛷️', eventDate: at(10, 7, 30), endDate: at(10, 22), location: 'Parking de la salle communale',
    importantInfo: 'Départ 7 h 30 précises — on n’attend personne !\nForfait : 45 CHF, à prendre sur place.\nPrévoir pique-nique ou 20 CHF pour la fondue.', maxParticipants: 16 });
  const loto = await mk(jeu, 'max_g', { title: 'Loto annuel', description: 'Montage de la salle dès 14 h, loto à 20 h', eventDate: at(17, 14), endDate: at(17, 23, 59), location: 'Grande salle de Montvert', enabledFeatures: ['benevoles'] });
  // Planning des bénévoles du loto (Alex, organisateur du Cercle, peut gérer les postes)
  const shift = (title, h0, h1, needed, note) => call('POST', `/plans/${loto.id}/shifts`, { title, needed, note, startsAt: at(17, h0), endsAt: at(17, h1) }, T.max_g);
  const sMontage = await shift('Montage de la salle', 14, 17, 4, 'Tables, chaises et sono');
  const sCaisse = await shift('Caisse et vente des cartes', 19, 23, 2, null);
  const sBuvette = await shift('Buvette', 19, 23, 3, 'Tablier fourni');
  const sRange = await shift('Rangement', 23, 24, 4, null);
  for (const [s, who] of [[sMontage, ['lea_m', 'tom_b', 'max_g']], [sCaisse, ['emma_v']], [sBuvette, ['lea_m', 'noah_p']], [sRange, ['tom_b']]])
    for (const p of who) await call('POST', `/plans/shifts/${s.id}/signup`, {}, T[p]);
  const apero = await mk(cop, 'alex', { title: 'Apéro au bord du lac', description: 'Chacun amène un truc à partager 🍹', eventDate: at(2, 18, 30), endDate: at(3, 1), location: 'Plage de Géronde, Sierre' });
  // Rendez-vous qui se répète chaque semaine
  const foot = await mk(cop, 'tom_b', { title: 'Foot de la semaine', description: 'Match amical, tout niveau. Prévoir un t-shirt clair et un foncé.', eventDate: at(4, 19), endDate: at(4, 21), location: 'Terrain synthétique de Montvert', recurrence: 'weekly' });
  const anniv = await mk(cop, 'alex', { title: 'Anniversaire surprise de Tom 🎂', description: 'Chut ! Tom ne voit pas ce Plan. On se retrouve 30 min avant pour tout préparer.', eventDate: at(12, 19, 30), endDate: at(13, 2), location: 'Chez Julie',
    excludedUserIds: [U.tom_b.id], importantInfo: 'Arriver à 19 h au plus tard, Tom arrive à 19 h 30.\nCagnotte cadeau : 20 CHF par personne.', enabledFeatures: ['cagnotte'] });
  for (const [p, plan, rsvp] of [['alex', raclette, 'in'], ['tom_b', raclette, 'in'], ['julie_r', raclette, 'in'], ['noah_p', raclette, 'in'], ['emma_v', raclette, 'in'], ['lucas_d', raclette, 'in'], ['chloe_s', raclette, 'maybe'],
    ['alex', ski, 'in'], ['lea_m', ski, 'in'], ['julie_r', ski, 'in'], ['noah_p', ski, 'in'], ['emma_v', ski, 'in'], ['chloe_s', ski, 'in'], ['lucas_d', ski, 'maybe'], ['max_g', ski, 'out'],
    ['alex', loto, 'maybe'], ['lea_m', loto, 'in'], ['tom_b', loto, 'in'], ['emma_v', loto, 'in'],
    ['tom_b', apero, 'in'], ['julie_r', apero, 'in'], ['emma_v', apero, 'maybe'],
    ['julie_r', anniv, 'in'], ['emma_v', anniv, 'in'], ['noah_p', anniv, 'maybe'],
    ['alex', foot, 'in'], ['julie_r', foot, 'in'], ['noah_p', foot, 'in'], ['emma_v', foot, 'maybe']]) {
    await call('POST', `/plans/${plan.id}/join`, {}, T[p]);
    if (rsvp !== 'in') await call('PUT', `/plans/${plan.id}/rsvp`, { rsvp }, T[p]);
  }
  const sock = {}; for (const p of ['tom_b', 'julie_r', 'noah_p', 'emma_v', 'lea_m', 'lucas_d']) sock[p] = io('http://localhost:3999', { auth: { token: T[p] }, transports: ['websocket'] });
  await sleep(1000);
  const said = [];
  const say = async (p, planId, content, extra = {}) => { const got = new Promise(res => sock.lea_m.once('message', res)); sock[p].emit('send-message', { planId, content, ...extra }); await sleep(400); return got; };
  const upload = async (planId, who, file) => { const f = new FormData(); f.append('file', new Blob([fs.readFileSync(__dirname + '/' + file)], { type: 'image/png' }), file); return (await fetch(`${API}/attachments/plans/${planId}?via=chat`, { method: 'POST', headers: { Authorization: `Bearer ${T[who]}` }, body: f })).json(); };
  // Chat du ski (Léa doit être dans la room pour recevoir les messages)
  sock.lea_m.emit('join-plan', ski.id); await sleep(300);
  const m1 = await say('tom_b', ski.id, 'Les pistes sont ouvertes, ça s’annonce top ce weekend ! ☀️');
  const ph = await upload(ski.id, 'julie_r', 'montagne.png');
  const m2 = await say('julie_r', ski.id, 'La vue depuis le sommet l’an passé 😍', { attachmentId: ph.id });
  const m3 = await say('noah_p', ski.id, 'Qui a des chaînes à neige ? 🚗');
  await say('emma_v', ski.id, 'Moi ! Je prends ma voiture, il me reste 2 places', { parentId: m3.id });
  await say('lea_m', ski.id, 'Parfait, je réserve la fondue pour midi 🫕');
  for (const [p, mid, e] of [['noah_p', m1.id, '🔥'], ['emma_v', m1.id, '🔥'], ['lea_m', m2.id, '😍'], ['tom_b', m2.id, '😍'], ['noah_p', m2.id, '👍']]) { sock[p].emit('toggle-reaction', { messageId: mid, emoji: e }); await sleep(200); }
  sock.lea_m.emit('leave-plan', ski.id);
  // Chat de la raclette
  sock.lea_m.emit('join-plan', raclette.id); await sleep(300);
  await say('lea_m', raclette.id, 'J’ai réservé le local de 18 h à minuit 🔑');
  await say('julie_r', raclette.id, 'Je passe à la fromagerie samedi matin, je prends 3 kg ?');
  await say('lucas_d', raclette.id, 'Parfait ! Je m’occupe des boissons 🍻');
  sock.lea_m.emit('leave-plan', raclette.id);
  // Apéro au lac (photo)
  const ph2 = await upload(apero.id, 'tom_b', 'lac.png');
  sock.tom_b.emit('join-plan', apero.id); await sleep(300);
  sock.tom_b.emit('send-message', { planId: apero.id, content: 'Le coucher de soleil de la dernière fois 🌅', attachmentId: ph2.id }); await sleep(400);
  sock.julie_r.emit('send-message', { planId: apero.id, content: 'J’amène des chips et du sirop !' }); await sleep(400);
  // Covoiturage ski
  const r1 = await call('POST', `/rides/plan/${ski.id}`, { departure: 'Montvert, place du village', seats: 4, departureAt: at(10, 7, 30), note: 'Retour vers 18 h' }, T.lea_m);
  const r2 = await call('POST', `/rides/plan/${ski.id}`, { departure: 'Gare de Sierre', seats: 3, departureAt: at(10, 7, 15) }, T.emma_v);
  await call('POST', `/rides/${r1.id}/join`, {}, T.julie_r); await call('POST', `/rides/${r1.id}/join`, {}, T.noah_p);
  await call('POST', `/rides/plan/${ski.id}/request`, { fromLocation: 'Sion' }, T.chloe_s);
  // Sondage dans le Plan ski
  await call('POST', `/plans/${ski.id}/polls`, { question: 'À midi : fondue ou pique-nique ?', options: ['Fondue au restaurant', 'Pique-nique sur les pistes'], anonymous: false }, T.tom_b);
  // Dépenses + qui apporte quoi (raclette)
  const members = ['alex', 'lea_m', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lucas_d'].map(p => U[p].id);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Fromage à raclette (3 kg)', amount: 86.4, currency: 'CHF', splitWith: members }, T.julie_r);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Pommes de terre et cornichons', amount: 18.9, currency: 'CHF', splitWith: members }, T.tom_b);
  await call('POST', `/plans/${raclette.id}/expenses`, { description: 'Boissons', amount: 54, currency: 'CHF', splitWith: members }, T.lucas_d);
  for (const [label, who] of [['Appareils à raclette', 'noah_p'], ['Charcuterie', 'emma_v'], ['Vin blanc', null], ['Desserts', 'lea_m']]) {
    const it = await call('POST', `/plans/${raclette.id}/items`, { label }, T.lea_m);
    if (who) await call('PUT', `/plans/items/${it.id}/claim`, {}, T[who]);
  }
  for (const label of ['Chips et apéritifs', 'Boissons fraîches', 'Glacière']) await call('POST', `/plans/${apero.id}/items`, { label }, T.alex);
  // Sondage de dates (jeunesse)
  const poll = await call('POST', `/circles/${jeu.id}/polls`, { question: 'Assemblée générale de printemps', options: [
    { label: 'Vendredi', eventDate: at(20, 19, 30) }, { label: 'Samedi', eventDate: at(21, 10) }, { label: 'Mardi', eventDate: at(24, 19, 30) }] }, T.lea_m);
  const [o1, o2, o3] = poll.options;
  for (const [p, os] of [['lea_m', [o1, o2]], ['tom_b', [o1]], ['julie_r', [o1, o3]], ['noah_p', [o1, o2]], ['emma_v', [o2]], ['lucas_d', [o1]]]) for (const o of os) await call('POST', `/circles/polls/options/${o.id}/vote`, {}, T[p]);
  await call('POST', `/circles/polls/${poll.id}/messages`, { content: 'Le vendredi m’arrange mieux, je peux réserver la salle 👍' }, T.tom_b);
  // Alex a déjà tout vu, sauf quelques nouveautés (pastilles)
  // Père Noël secret entre copains : tirage déjà fait (Alex organise), envies, messages anonymes
  const noel = await mk(cop, 'alex', { title: 'Noël entre copains 🎄', description: 'Repas de Noël et échange de cadeaux. Chacun apporte un plat !', eventDate: at(14, 19), endDate: at(15, 2), location: 'Chez Emma', enabledFeatures: ['pere_noel'] });
  for (const p of ['tom_b', 'julie_r', 'emma_v', 'noah_p']) await call('POST', `/plans/${noel.id}/join`, {}, T[p]);
  await call('PUT', `/plans/${noel.id}/santa`, { budget: '30 CHF', exclusions: [[U.julie_r.id, U.noah_p.id]] }, T.alex);
  for (const [p, body] of [['tom_b', { text: 'Un jeu de société, du chocolat noir. Pas de chaussettes 😅' }], ['julie_r', { text: 'Un livre (polar ou roman), une jolie tasse, du thé' }],
    ['emma_v', { noWish: true }], ['noah_p', { text: 'Des écouteurs sans fil ou un bonnet (taille M)' }]]) await call('PUT', `/plans/${noel.id}/santa/wish`, body, T[p]);
  await call('POST', `/plans/${noel.id}/santa/draw`, {}, T.alex);
  const santaPairs = await prisma.secretSantaPair.findMany({ where: { planId: noel.id } });
  const pk = Object.fromEntries(Object.entries(U).map(([k, u]) => [u.id, k]));
  const alexReceiver = pk[santaPairs.find(p => p.giverId === U.alex.id).receiverId];
  const alexSanta = pk[santaPairs.find(p => p.receiverId === U.alex.id).giverId];
  await call('POST', `/plans/${noel.id}/santa/messages`, { to: 'santa', content: 'Coucou mon Père Noël secret 🎅 J’ai mis ma liste d’envies à jour !' }, T[alexReceiver]);
  await call('POST', `/plans/${noel.id}/santa/messages`, { to: 'receiver', content: 'Hello ! Tu préfères le sucré ou le salé ? 🎅' }, T[alexSanta]);
  for (const p of ['tom_b', 'julie_r']) if (p !== alexReceiver) await call('PUT', `/plans/${noel.id}/santa/ready`, { ready: true }, T[p]);
  for (const plan of [raclette, ski, loto, apero, anniv, foot, noel]) await prisma.planMember.updateMany({ where: { planId: plan.id, userId: U.alex.id }, data: { seen: { chat: new Date(Date.now() - 864e5).toISOString() } } });
  // Cagnotte de l'anniversaire surprise de Tom (Alex organise)
  await call('PUT', `/plans/${anniv.id}/pot`, { forWhom: 'Tom', target: '200', suggested: '20', currency: 'CHF', payInfo: 'Twint au 079 123 45 67 (Alex), ou en espèces le soir même' }, T.alex);
  await call('PUT', `/plans/${anniv.id}/pot/pledge`, { amount: '20' }, T.julie_r);
  await call('PUT', `/plans/${anniv.id}/pot/pledge`, { amount: '30' }, T.emma_v);
  await call('PUT', `/plans/${anniv.id}/pot/pledge`, { amount: '20' }, T.noah_p);
  await call('PUT', `/plans/${anniv.id}/pot/pledge/paid`, { paid: true }, T.julie_r);
  await call('PUT', `/plans/${anniv.id}/pot/pledges/${U.julie_r.id}`, { received: true }, T.alex);
  await call('PUT', `/plans/${anniv.id}/pot/pledge/paid`, { paid: true }, T.emma_v);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Un baptême de parapente', price: '170' }, T.julie_r);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Le nouveau maillot du FC Sion', url: 'https://www.fc-sion.ch', price: '110' }, T.emma_v);
  await call('POST', `/plans/${anniv.id}/pot/ideas`, { text: 'Une box dégustation de bières', price: '60' }, T.noah_p);
  const ideas = await call('GET', `/plans/${anniv.id}/pot`, null, T.alex);
  const para = ideas.ideas.find(i => i.text.includes('parapente'));
  await call('POST', `/plans/${anniv.id}/pot/ideas/${para.id}/vote`, {}, T.noah_p);
  // Killer au chalet (Alex organise) : partie en cours, une élimination déjà faite
  const chalet = await mk(cop, 'alex', { title: 'Week-end au chalet 🏔️', description: 'Deux jours entre copains, raclette et partie de Killer tout le week-end 🔪', eventDate: at(6, 18), endDate: at(8, 18), location: 'Chalet des Mayens, Nax', enabledFeatures: ['killer'] });
  for (const p of ['tom_b', 'julie_r', 'emma_v', 'noah_p']) await call('POST', `/plans/${chalet.id}/join`, {}, T[p]);
  await call('PUT', `/plans/${chalet.id}/killer`, { objects: ['une cuillère en bois', 'un bouchon de liège', 'une carte de jass', 'un gant de cuisine', 'une pive', 'un caquelon'], places: ['dans la cuisine', 'sur la terrasse', 'près de la cheminée', 'dans l’escalier', 'devant le chalet'] }, T.alex);
  await call('POST', `/plans/${chalet.id}/killer/start`, {}, T.alex);
  const kp = await prisma.killerPlayer.findMany({ where: { planId: chalet.id } });
  const alexTarget = kp.find(p => p.userId === U.alex.id).targetId;
  // Un joueur qui ne vise ni Alex ni sa cible élimine la sienne
  const hunter = kp.find(p => p.userId !== U.alex.id && p.targetId !== U.alex.id && p.targetId !== alexTarget && p.userId !== alexTarget) ?? kp.find(p => p.userId !== U.alex.id && p.targetId !== U.alex.id);
  const pseudoOf = id => Object.keys(U).find(k => U[k].id === id);
  await call('POST', `/plans/${chalet.id}/killer/claim`, {}, T[pseudoOf(hunter.userId)]);
  await call('POST', `/plans/${chalet.id}/killer/answer`, { confirm: true }, T[pseudoOf(hunter.targetId)]);
  // Tournoi de pétanque de la jeunesse (Alex, organisateur du Cercle, saisit les scores)
  const petanque = await mk(jeu, 'lea_m', { title: 'Tournoi de pétanque 🥇', description: 'Doublettes tirées au sort, championnat sur l’après-midi. Grillades ensuite !', eventDate: at(9, 14), endDate: at(9, 22), location: 'Place de la Fontaine, Montvert', enabledFeatures: ['equipes'] });
  for (const p of ['alex', 'tom_b', 'julie_r', 'noah_p', 'emma_v', 'lucas_d', 'chloe_s', 'max_g']) await call('POST', `/plans/${petanque.id}/join`, {}, T[p]);
  await call('PUT', `/plans/${petanque.id}/teams`, { teamCount: 4 }, T.lea_m);
  await call('POST', `/plans/${petanque.id}/teams/draw`, {}, T.lea_m);
  await call('POST', `/plans/${petanque.id}/teams/tournament`, { format: 'league' }, T.lea_m);
  const tour = await call('GET', `/plans/${petanque.id}/teams`, null, T.lea_m);
  for (const [i, m] of tour.matches.filter(m => m.round <= 2).entries()) await call('PUT', `/plans/${petanque.id}/teams/matches/${m.id}`, { homeScore: [13, 9, 13, 13][i], awayScore: [7, 13, 11, 4][i] }, T.lea_m);
  fs.writeFileSync(__dirname + '/ids.json', JSON.stringify({ alex: T.alex, alexId: U.alex.id, circles: [jeu.id, cop.id], plans: [raclette.id, ski.id, loto.id, apero.id, anniv.id, foot.id, noel.id, chalet.id, petanque.id], santaPlans: [noel.id], killerPlans: [chalet.id], teamPlans: [petanque.id], potPlans: [anniv.id], pollId: poll.id }));
  Object.values(sock).forEach(s => s.close());
  console.log('ok'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
