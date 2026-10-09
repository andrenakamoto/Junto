/* eslint-disable no-console */
// Compte de démonstration pour la vérification des apps par Apple et Google.
//
//   cd server && DEMO_PASSWORD='…' npx ts-node --transpile-only scripts/demoAccount.ts --confirm
//
// Écrit dans la base de PRODUCTION (DATABASE_URL de server/.env) et passe par l'API de
// production pour le contenu (messages chiffrés, notifications, pastilles comme dans l'app).
// Relançable : supprime puis recrée tout le contenu de démonstration. À relancer avant chaque
// soumission aux stores : les Plans disparaissent à leur date de fin.
//
// Comptes : « camille_evly » (Camille Démo, info@evly.ch, le compte donné aux vérificateurs) et
// quatre membres fictifs sans email (julie_morel, tom_favre, lea_rochat, pierre_dubois), tous avec
// DEMO_PASSWORD. Ils ne voient que leurs deux Cercles de démonstration.
// (Anciens pseudos demo_* de la première version : supprimés aussi au nettoyage.)
const LEGACY = ['demo_evly', 'demo_julie', 'demo_tom', 'demo_lea', 'demo_pierre'];
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

const API = process.env.DEMO_API_URL || 'https://junto-production-8ded.up.railway.app';
const PASSWORD = process.env.DEMO_PASSWORD;
const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const PEOPLE = [
  { pseudo: 'camille_evly', firstName: 'Camille', lastName: 'Démo', email: 'info@evly.ch' },
  { pseudo: 'julie_morel', firstName: 'Julie', lastName: 'Morel' },
  { pseudo: 'tom_favre', firstName: 'Tom', lastName: 'Favre' },
  { pseudo: 'lea_rochat', firstName: 'Léa', lastName: 'Rochat' },
  { pseudo: 'pierre_dubois', firstName: 'Pierre', lastName: 'Dubois' },
] as const;
type Who = typeof PEOPLE[number]['pseudo'];

// Date à J+n, à l'heure suisse indiquée (approximation UTC+1/+2 suffisante pour une démo)
function day(n: number, hour: number, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour - 2, minute, 0, 0);
  return d.toISOString();
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Ajoute --confirm : ce script écrit dans la base de production.');
  if (!PASSWORD || PASSWORD.length < 10) throw new Error('DEMO_PASSWORD manquant (10 caractères minimum).');
  console.log('Base :', (process.env.DATABASE_URL ?? '').replace(/\/\/.*@/, '//***@'), '| API :', API);

  // 1. Nettoyage de la démo précédente (Cercles créés par les comptes de démo, puis comptes)
  const old = await prisma.user.findMany({ where: { pseudo: { in: [...PEOPLE.map(p => p.pseudo), ...LEGACY] } }, select: { id: true } });
  const oldIds = old.map(u => u.id);
  if (oldIds.length) {
    await prisma.circle.deleteMany({ where: { creatorId: { in: oldIds } } });
    await prisma.plan.deleteMany({ where: { creatorId: { in: oldIds } } });
    await prisma.user.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`Ancienne démo supprimée (${oldIds.length} comptes)`);
  }

  // 2. Comptes (email validé, conditions acceptées, notifications par push uniquement)
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids = {} as Record<Who, string>;
  for (const p of PEOPLE) {
    const u = await prisma.user.create({
      data: {
        pseudo: p.pseudo, firstName: p.firstName, lastName: p.lastName, password: hash,
        email: 'email' in p ? p.email : null, emailVerified: true, status: 'approved',
        acceptedTermsVersion: 4, notificationChannel: 'push', weeklyDigestEnabled: false,
      },
    });
    ids[p.pseudo] = u.id;
  }

  // 3. Sessions via l'API de production
  const tokens = {} as Record<Who, string>;
  for (const p of PEOPLE) {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: p.pseudo, password: PASSWORD }),
    });
    if (!r.ok) throw new Error(`Connexion ${p.pseudo} : ${r.status} ${await r.text()}`);
    tokens[p.pseudo] = (await r.json()).token;
  }
  async function call(who: Who, method: string, path: string, body?: unknown) {
    const r = await fetch(`${API}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[who]}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`${who} ${method} ${path} : ${r.status} ${JSON.stringify(data)}`);
    return data;
  }
  async function say(who: Who, planId: string, lines: string[]) {
    const socket = io(API, { auth: { token: tokens[who] }, transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => { socket.on('connect', () => resolve()); socket.on('connect_error', reject); });
    for (const content of lines) { socket.emit('send-message', { planId, content }); await sleep(400); }
    socket.disconnect();
  }

  // 4. Cercles (créés directement : les adhésions passeraient sinon par un vote)
  const amis = await prisma.circle.create({
    data: {
      name: 'Les amis du lundi', code: `DEMO${Date.now().toString(36).toUpperCase().slice(-4)}`,
      description: 'Le Cercle des copains de la coloc : apéros, sorties et week-ends.',
      color: '#f43f5e', creatorId: ids.camille_evly,
      members: { create: [
        { userId: ids.camille_evly, role: 'admin' }, { userId: ids.julie_morel, role: 'organizer' },
        { userId: ids.tom_favre, role: 'member' }, { userId: ids.lea_rochat, role: 'member' }, { userId: ids.pierre_dubois, role: 'member' },
      ] },
    },
  });
  const velo = await prisma.circle.create({
    data: {
      name: 'Club vélo Les Rayons', code: `DEMV${Date.now().toString(36).toUpperCase().slice(-4)}`,
      description: 'Sorties route et gravel autour de Genève, tous niveaux.',
      color: '#10b981', creatorId: ids.pierre_dubois,
      members: { create: [
        { userId: ids.pierre_dubois, role: 'admin' }, { userId: ids.camille_evly, role: 'member' }, { userId: ids.tom_favre, role: 'member' },
      ] },
    },
  });

  // 5. Plans, réponses, chat, liste « qui apporte quoi », dépenses, covoiturage, sondages
  const raclette = await call('tom_favre', 'POST', `/circles/${amis.id}/plans`, {
    title: 'Raclette chez Tom', location: 'Chemin des Vignes 4, Lausanne',
    description: 'Soirée raclette avant l\'hiver 🧀\nTom s\'occupe du fromage, chacun amène une bouteille.',
    eventDate: day(12, 19), endDate: day(12, 23, 59),
  });
  for (const who of ['camille_evly', 'julie_morel', 'lea_rochat'] as Who[]) await call(who, 'POST', `/plans/${raclette.id}/join`);
  await call('lea_rochat', 'PUT', `/plans/${raclette.id}/rsvp`, { rsvp: 'maybe' });
  await say('tom_favre', raclette.id, ['Qui est chaud pour la raclette ? 🧀']);
  await say('julie_morel', raclette.id, ['Moi ! J\'amène le dessert 🍰']);
  await say('camille_evly', raclette.id, ['Je suis in, et j\'ai 3 places dans la voiture depuis Genève 🚗']);
  await say('lea_rochat', raclette.id, ['Peut-être, je confirme jeudi !']);
  await call('julie_morel', 'POST', `/plans/${raclette.id}/items`, { label: 'Dessert' });
  await call('tom_favre', 'POST', `/plans/${raclette.id}/items`, { label: 'Pain et cornichons' });
  await call('tom_favre', 'POST', `/plans/${raclette.id}/expenses`, {
    description: 'Fromage à raclette (1,5 kg)', amount: 54.6, currency: 'CHF',
    splitWith: [ids.tom_favre, ids.camille_evly, ids.julie_morel, ids.lea_rochat],
  });
  await call('camille_evly', 'POST', `/rides/plan/${raclette.id}`, { departure: 'Genève, gare Cornavin', departureAt: day(12, 18), seats: 3, note: 'Retour vers minuit' });
  await call('lea_rochat', 'POST', `/rides/plan/${raclette.id}/request`, { fromLocation: 'Nyon' });

  const ski = await call('camille_evly', 'POST', `/circles/${amis.id}/plans`, {
    title: 'Week-end ski à Verbier', location: 'Verbier', maxParticipants: 8,
    description: 'Deux jours de ski avec la bande. On réserve le logement dès qu\'on est au complet.',
    eventDate: day(30, 9), endDate: day(31, 18),
  });
  for (const who of ['julie_morel', 'pierre_dubois'] as Who[]) await call(who, 'POST', `/plans/${ski.id}/join`);
  const lodging = await call('camille_evly', 'POST', `/plans/${ski.id}/polls`, { question: 'Chalet ou hôtel ?', options: ['Chalet', 'Hôtel'], anonymous: false });
  const chalet = lodging.options?.[0]?.id;
  if (chalet) for (const who of ['julie_morel', 'pierre_dubois'] as Who[]) await call(who, 'POST', `/plans/polls/${chalet}/vote`);
  await say('pierre_dubois', ski.id, ['Je prends mes skis de rando aussi ⛷️']);

  const resto = await call('julie_morel', 'POST', `/circles/${amis.id}/polls`, {
    question: 'Resto de fin de mois ?',
    options: [{ label: 'Jeudi soir', eventDate: day(20, 19) }, { label: 'Vendredi soir', eventDate: day(21, 19) }, { label: 'Samedi midi', eventDate: day(22, 12) }],
  });

  const [jeudi, vendredi] = resto.options ?? [];
  const votes: [Who, { id: string } | undefined][] = [
    ['julie_morel', jeudi], ['julie_morel', vendredi], ['tom_favre', vendredi], ['lea_rochat', vendredi], ['pierre_dubois', jeudi],
  ];
  for (const [who, option] of votes) if (option) await call(who, 'POST', `/circles/polls/options/${option.id}/vote`);
  await call('tom_favre', 'POST', `/circles/polls/${resto.id}/messages`, { content: 'Vendredi pour moi, jeudi je bosse tard 🙏' });

  const salève = await call('pierre_dubois', 'POST', `/circles/${velo.id}/plans`, {
    title: 'Sortie du dimanche — tour du Salève', location: 'Parking de Collonges-sous-Salève',
    description: '65 km, 1100 m de dénivelé. Allure tranquille, pause café à mi-parcours ☕',
    eventDate: day(16, 8, 30), endDate: day(16, 13),
  });
  for (const who of ['camille_evly', 'tom_favre'] as Who[]) await call(who, 'POST', `/plans/${salève.id}/join`);
  await say('pierre_dubois', salève.id, ['Prévoyez une chambre à air de rechange 🚴']);

  console.log('Démo prête : pseudo camille_evly (ou info@evly.ch) — mot de passe : DEMO_PASSWORD');
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
