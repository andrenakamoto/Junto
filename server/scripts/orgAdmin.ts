/* eslint-disable no-console */
// Recours d'EvLY en cas de blocage entre les administrateurs d'une Organisation (demande écrite à info@evly.ch) :
// nommer ou retirer un administrateur sans vote. À lancer SUR LE SERVEUR, seulement après avoir vérifié la demande.
//
//   cd /srv/evly/app/server && . /etc/evly/database.env
//   npx ts-node --transpile-only scripts/orgAdmin.ts list "<nom de l'Organisation>"
//   npx ts-node --transpile-only scripts/orgAdmin.ts add|remove "<nom de l'Organisation>" <pseudo> --confirm
//
// Chaque changement est inscrit dans l'historique de l'Organisation (« Support EvLY » : actorId vide). On ne retire jamais le
// dernier administrateur.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const [action, orgName, pseudo] = process.argv.slice(2);
const confirm = process.argv.includes('--confirm');

(async () => {
  if (!['list', 'add', 'remove'].includes(action) || !orgName) { console.log('Usage : list|add|remove "<Organisation>" [pseudo] [--confirm]'); return; }
  const orgs = await prisma.organisation.findMany({ where: { name: { equals: orgName, mode: 'insensitive' } }, select: { id: true, name: true } });
  if (orgs.length !== 1) { console.log(orgs.length ? 'Plusieurs Organisations portent ce nom :' : 'Organisation introuvable', orgs); return; }
  const org = orgs[0];
  const members = await prisma.organisationMember.findMany({ where: { organisationId: org.id }, select: { userId: true, isAdmin: true, isDirection: true, adminSince: true, user: { select: { pseudo: true, firstName: true, email: true } } } });
  if (action === 'list') {
    for (const m of members) console.log(`${m.isAdmin ? 'ADMIN ' : '      '}${m.isDirection ? 'direction ' : '          '}@${m.user.pseudo} ${m.user.firstName ?? ''} <${m.user.email ?? '—'}> ${m.adminSince ? 'depuis ' + m.adminSince.toISOString().slice(0, 10) : ''}`);
    const log = await prisma.organisationAdminLog.findMany({ where: { organisationId: org.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    console.log('\nHistorique :'); for (const l of log) console.log(l.createdAt.toISOString().slice(0, 16), l.action, l.actorId ?? 'support', '→', l.targetId);
    return;
  }
  const target = members.find(m => m.user.pseudo.toLowerCase() === (pseudo ?? '').toLowerCase());
  if (!target) { console.log('Cette personne ne fait pas partie de l’Organisation'); return; }
  if (action === 'remove' && members.filter(m => m.isAdmin).length < 2) { console.log('C’est le dernier administrateur : en nommer un autre d’abord'); return; }
  console.log(`${action === 'add' ? 'Nommer' : 'Retirer'} @${target.user.pseudo} comme administrateur de « ${org.name} »`);
  if (!confirm) { console.log('(aucun changement : ajouter --confirm)'); return; }
  await prisma.organisationMember.update({ where: { organisationId_userId: { organisationId: org.id, userId: target.userId } },
    data: action === 'add' ? { isAdmin: true, adminSince: new Date() } : { isAdmin: false, adminSince: null } });
  if (action === 'remove') await prisma.organisationAdminRemoval.deleteMany({ where: { organisationId: org.id, targetId: target.userId } });
  await prisma.organisationAdminLog.create({ data: { organisationId: org.id, action: action === 'add' ? 'named' : 'removed', actorId: null, targetId: target.userId } });
  console.log('Fait.');
})().finally(() => prisma.$disconnect());
