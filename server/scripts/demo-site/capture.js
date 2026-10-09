const fs = require('fs'); const I = require('./ids.json');
const API = 'http://localhost:3999/api'; const OUT = process.argv[2];
const get = async p => { const r = await fetch(API + p, { headers: { Authorization: `Bearer ${I.alex}` } }); if (!r.ok) { console.error('!!', p, r.status); return null; } return r.json(); };
(async () => {
  const fx = {};
  const take = async p => { const d = await get(p); if (d !== null) fx[`GET ${p}`] = d; return d; };
  for (const p of ['/auth/me', '/circles', '/plans', '/circles/invitations/mine', '/suggestions/mine', '/moderation/blocks', '/push/devices', '/invitations/status', '/mutes']) await take(p);
  for (const c of I.circles) { await take(`/circles/${c}/plans`); const polls = await take(`/circles/${c}/polls`); await take(`/circles/${c}/history`);
    for (const pl of polls || []) { await take(`/circles/polls/${pl.id}`); await take(`/circles/polls/${pl.id}/messages`); } }
  let photos = 0;
  for (const id of I.plans) {
    const plan = await take(`/plans/${id}`);
    const msgs = await take(`/plans/${id}/messages`);
    for (const m of (msgs?.messages ?? msgs ?? [])) if (m._count?.replies) await take(`/plans/messages/${m.id}/replies`);
    await take(`/rides/plan/${id}`); await take(`/plans/${id}/expenses`); await take(`/plans/${id}/shifts`);
    if ((I.santaPlans || []).includes(id)) await take(`/plans/${id}/santa`);
    if ((I.killerPlans || []).includes(id)) await take(`/plans/${id}/killer`);
    if ((I.matchPlans || []).includes(id)) {
      await take(`/plans/${id}/matches`);
      // Vue complète d'un joueur qui a fini (Tom), pour simuler les résultats quand Alex a joué
      const r = await fetch(`${API}/plans/${id}/matches`, { headers: { Authorization: `Bearer ${I.tom}` } });
      if (r.ok) fx[`DEMO_FULL /plans/${id}/matches`] = await r.json();
    }
    if ((I.wheelPlans || []).includes(id)) await take(`/plans/${id}/wheels`);
    if ((I.wordPlans || []).includes(id)) await take(`/plans/${id}/words`);
    if ((I.teamPlans || []).includes(id)) await take(`/plans/${id}/teams`);
    if ((I.potPlans || []).includes(id)) await take(`/plans/${id}/pot`);
    for (const a of plan?.attachments ?? []) {
      const r = await fetch(`${API}/attachments/${a.id}/view?t=${plan.mediaToken}`);
      fs.writeFileSync(`${OUT}/photos/${a.id}.png`, Buffer.from(await r.arrayBuffer())); photos++;
    }
  }
  fs.writeFileSync(`${OUT}/data.json`, JSON.stringify({ capturedAt: new Date().toISOString(), userId: I.alexId, fixtures: fx }));
  console.log(Object.keys(fx).length, 'réponses,', photos, 'photos');
})();
