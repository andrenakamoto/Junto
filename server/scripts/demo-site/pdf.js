// PDF de l'assemblée de la démo (procès-verbal et récapitulatif du Plan, 4 langues), servis par la démo depuis
// client/public/demo/pdf. À lancer APRÈS seed.js, sur la même base jetable et le même serveur de test (voir LISEZMOI.md) :
// joue l'assemblée jusqu'au bout (budget voté, élection du comité, notes, clôture) puis télécharge les PDF.
//   NODE_PATH=$PWD/node_modules node scripts/demo-site/pdf.js ../client/public/demo/pdf
// Attention : l'assemblée est close ensuite ; relancer seed.js avant capture.js (la démo garde une assemblée ouverte).
process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:55432/evly_test';
const { PrismaClient } = require('@prisma/client'); const jwt = require('jsonwebtoken'); const fs = require('fs');
const prisma = new PrismaClient(); const API = 'http://localhost:3999/api';
const I = require('./ids.json');
(async () => {
  const users = await prisma.user.findMany({ select: { id: true, pseudo: true } });
  const U = Object.fromEntries(users.map(u => [u.pseudo, u])); const T = p => jwt.sign({ userId: U[p].id, pseudo: p }, 'test-secret');
  const call = async (m, path, who, b) => { const r = await fetch(API + path, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T(who)}` }, body: b && JSON.stringify(b) }); const d = await r.json().catch(() => null); if (r.status >= 400) console.error('!!', m, path, r.status, d); return d; };
  const planId = I.showcase.assemblee[0];
  let st = await call('GET', `/plans/${planId}/assembly`, 'lea_m');
  const item = t => st.items.find(i => i.title.startsWith(t));
  const budget = item('Budget'), election = item('Élection'), divers = item('Divers');
  await call('POST', `/plans/assembly/items/${budget.id}/vote`, 'alex', { votes: [{ onBehalfOfId: U.alex.id, choice: 'yes' }, { onBehalfOfId: U.yann_k.id, choice: 'yes' }] });
  for (const [p, ch] of [['julie_r', 'yes'], ['emma_v', 'yes'], ['lucas_d', 'yes'], ['chloe_s', 'yes'], ['max_g', 'no'], ['zoe_m', 'yes']]) await call('POST', `/plans/assembly/items/${budget.id}/vote`, p, { votes: [{ onBehalfOfId: U[p].id, choice: ch }] });
  await call('PUT', `/plans/assembly/items/${budget.id}/notes`, 'julie_r', { notes: 'Le comité présentera le programme détaillé de la fête en mai.' });
  await call('POST', `/plans/assembly/items/${budget.id}/close`, 'lea_m');
  await call('POST', `/plans/assembly/items/${election.id}/open`, 'lea_m');
  const C = Object.fromEntries(election.candidates.map(c => [c.name, c.id]));
  const ballots = [['alex', 'alex', ['Emma', 'Noah']], ['alex', 'yann_k', ['Emma', 'Noah']], ['lea_m', 'lea_m', ['Emma', 'Maxime']], ['tom_b', 'tom_b', ['Noah', 'Emma']],
    ['julie_r', 'julie_r', ['Emma', 'Noah']], ['noah_p', 'noah_p', ['Emma', 'Maxime']], ['emma_v', 'emma_v', ['Noah', 'Maxime']], ['lucas_d', 'lucas_d', ['Emma']],
    ['chloe_s', 'chloe_s', ['Emma', 'Noah']], ['max_g', 'max_g', ['Maxime', 'Emma']], ['nadia_f', 'nadia_f', ['Noah', 'Emma']], ['paul_r', 'paul_r', ['Emma', 'Noah']], ['zoe_m', 'zoe_m', ['Noah', 'Maxime']]];
  const byVoter = {};
  for (const [who, forWho, names] of ballots) (byVoter[who] ??= []).push({ onBehalfOfId: U[forWho].id, candidateIds: names.map(n => C[n]) });
  for (const [who, votes] of Object.entries(byVoter)) await call('POST', `/plans/assembly/items/${election.id}/vote`, who, { votes });
  await call('PUT', `/plans/assembly/items/${election.id}/notes`, 'julie_r', { notes: 'Emma et Noah acceptent leur élection. Applaudissements.' });
  await call('POST', `/plans/assembly/items/${election.id}/close`, 'lea_m');
  await call('PUT', `/plans/assembly/items/${divers.id}/notes`, 'julie_r', { notes: 'La sortie à ski aura lieu en février. Prochaine assemblée au printemps 2027.' });
  await call('POST', `/plans/${planId}/assembly/close`, 'lea_m');
  // Heures plausibles pour une assemblée du soir (sinon celles du script)
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { eventDate: true } });
  await prisma.assembly.update({ where: { planId }, data: { openedAt: new Date(plan.eventDate.getTime() + 5 * 60000), closedAt: new Date(plan.eventDate.getTime() + 110 * 60000) } });
  st = await call('GET', `/plans/${planId}/assembly`, 'lea_m');
  console.log('assemblée', st.status, st.items.map(i => `${i.title.slice(0, 20)}:${i.status}${i.result?.elected ? ' élus ' + i.result.elected : ''}`).join(' | '));
  const out = process.argv[2];
  for (const lang of ['fr', 'de', 'it', 'en']) for (const [kind, path] of [['pv', `/plans/${planId}/assembly/pv`], ['recap', `/plans/${planId}/recap`]]) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${T('lea_m')}`, 'Accept-Language': lang } });
    if (!r.ok) { console.error('!!', kind, lang, r.status); continue; }
    fs.writeFileSync(`${out}/assemblee-${kind}-${lang}.pdf`, Buffer.from(await r.arrayBuffer()));
  }
  console.log('ok'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
