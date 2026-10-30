import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { currentLang, t as tr } from '../i18n';
import { BIG_CITIES, norm } from './discover';

// Démo sans compte (/demo) : tout tourne dans le navigateur. Les données (public/demo/data.json)
// sont de vraies réponses du serveur, enregistrées une fois sur une base jetable avec des
// personnes et des Cercles fictifs (Alex et 7 Cercles : danse, boxe, jeunesse, collègues, famille, copains, events). Les dates
// sont décalées pour rester à venir. Les actions (répondre, écrire, voter, prendre une place,
// ajouter une dépense…) ne modifient qu'une copie en mémoire : rien n'est envoyé au serveur, et
// tout disparaît en quittant ou en rechargeant la page.
//
// Branchements : services/api.ts (adapter axios), lib/socket.ts (faux temps réel),
// AuthContext (session « démo »), lib/media.ts (photos locales).

const FLAG = 'evly_demo';
export const DEMO_TOKEN = 'demo';
const NOT_IN_DEMO = tr('ui.demoApi.notInDemo');

export function isDemo(): boolean {
  try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; }
}

// `focus` : démo resserrée sur un exemple (/demo?voir=amis, pere-noel, organisation… : clés de DEMO_SHOWCASE dans data.json,
// écrites par server/scripts/demo-site/seed.js) ; sans, la démo complète
const FOCUS = 'evly_demo_focus';
export function startDemo(focus?: string) {
  try {
    sessionStorage.setItem(FLAG, '1');
    if (focus) sessionStorage.setItem(FOCUS, focus); else sessionStorage.removeItem(FOCUS);
  } catch { /* stockage indisponible */ }
}
const demoFocus = () => { try { return sessionStorage.getItem(FOCUS); } catch { return null; } };

export function exitDemo(to = '/auth') {
  try { sessionStorage.removeItem(FLAG); } catch { /* stockage indisponible */ }
  window.location.replace(to);
}

type Fixtures = Record<string, any>;
let fixtures: Fixtures | null = null;
let me: { id: string; pseudo: string; firstName: string } = { id: '', pseudo: '', firstName: '' };
let loading: Promise<void> | null = null;

let texts: Record<string, string> = {};
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const shiftDay = (d: string, delta: number) => new Date(Date.parse(`${d}T12:00:00Z`) + delta).toISOString().slice(0, 10);

// Décale toutes les dates du nombre de jours écoulés depuis l'enregistrement et traduit les textes
// de la démo (public/demo/i18n.json, généré par scripts/demo-i18n.py ; absent = français)
function shiftDates(value: any, delta: number, texts: Record<string, string> = {}): any {
  if (typeof value === 'string') return ISO.test(value) ? new Date(new Date(value).getTime() + delta).toISOString() : texts[value] ?? value;
  if (Array.isArray(value)) return value.map(v => shiftDates(v, delta, texts));
  if (value && typeof value === 'object') {
    const out: any = {};
    // Échéances des tâches (« AAAA-MM-JJ ») : décalées comme les dates
    for (const [k, v] of Object.entries(value)) out[k] = k === 'dueDate' && typeof v === 'string' && DAY.test(v) ? shiftDay(v, delta) : shiftDates(v, delta, texts);
    return out;
  }
  return value;
}

export function loadDemo(): Promise<void> {
  if (!loading) {
    const lang = currentLang();
    loading = Promise.all([
      fetch('/demo/data.json', { cache: 'no-cache' }).then(r => r.json()),
      lang === 'fr' ? Promise.resolve(null) : fetch('/demo/i18n.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => null),
    ])
      .then(([data, i18n]) => {
        // Décalage en jours entiers : les heures restent rondes (19:00, pas 19:04)
        const delta = Math.floor((Date.now() - new Date(data.capturedAt).getTime()) / 864e5) * 864e5;
        texts = i18n?.[lang] ?? {};
        fixtures = shiftDates(data.fixtures, delta, texts);
        const u = fixtures!['GET /auth/me'];
        me = { id: u.id, pseudo: u.pseudo, firstName: u.firstName };
        const focus = demoFocus();
        if (focus) focusOnPlan(focus);
      });
  }
  return loading;
}

// Démo resserrée (/demo?voir=…) : un seul Cercle, celui de l'exemple, avec ce seul Plan ; ni discussion du Cercle, ni dispo,
// ni sondage (le Cercle change de code : ni la discussion ni les dispos ne s'y attachent). Père Noël secret (campagne de Noël) :
// le Cercle devient « La famille », le Plan « Noël en famille 🎁 », sans Trajets, Votes ni Dépenses.
export const FOCUS_CIRCLE_CODE = 'DEMO-FOCUS';
function focusOnPlan(key: string) {
  const f = fixtures!;
  const planId = (f.DEMO_SHOWCASE as Record<string, [string, string]> | undefined)?.[key]?.[0];
  const focused = planId ? f[`GET /plans/${planId}`] : null;
  if (!focused) return;
  const circle = (f['GET /circles'] as any[]).find(c => c.id === focused.circleId);
  if (!circle) return;
  const christmas = key === 'pere-noel';
  const title = christmas ? texts['Noël en famille 🎁'] ?? 'Noël en famille 🎁' : focused.title;
  const adjust = (p: any) => christmas ? { ...p, title, disabledFeatures: ['trajets', 'votes', 'depenses'] } : p;
  // Carte du Cercle : 1 Plan, et c'est lui le prochain événement
  const next = (circle.plans ?? [])[0];
  f['GET /circles'] = [{ ...circle, code: FOCUS_CIRCLE_CODE, photoKey: circle.photoKey ?? `demo/circles/${circle.code}.svg`, _count: { ...circle._count, plans: 1 },
    plans: next ? [Object.fromEntries(Object.keys(next).map(k => [k, k === 'title' ? title : focused[k] ?? next[k]]))] : [],
    ...(christmas ? { name: texts['La famille'] ?? 'La famille', description: texts['Noël, anniversaires et vacances ensemble 🎄'] ?? 'Noël, anniversaires et vacances ensemble 🎄' } : {}) }];
  f[`GET /plans/${focused.id}`] = adjust(focused);
  f[`GET /circles/${circle.id}/plans`] = ((f[`GET /circles/${circle.id}/plans`] ?? []) as any[]).filter(p => p.id === focused.id).map(adjust);
  f['GET /plans'] = ((f['GET /plans'] ?? []) as any[]).filter(p => p.id === focused.id)
    .map(p => ({ ...adjust(p), circle: p.circle ? { ...p.circle, name: f['GET /circles'][0].name } : p.circle }));
  f[`GET /circles/${circle.id}/polls`] = [];
}

export function demoUser() {
  return fixtures?.['GET /auth/me'] ?? null;
}

export function demoPhotoUrl(attachmentId: string) {
  return `/demo/photos/${attachmentId}.png`;
}

// ─── Faux temps réel ──────────────────────────────────────────────────────────

type Listener = (payload: any) => void;
const listeners = new Map<string, Set<Listener>>();

function fire(event: string, payload: any) {
  window.setTimeout(() => listeners.get(event)?.forEach(l => l(payload)), 30);
}

// Après une action : les écrans se rechargent comme avec le vrai serveur (plan-updated…)
function changed(planId?: string, circleId?: string) {
  if (planId) fire('plan-updated', { planId });
  const touched = planId ? touchActivity(planId) : undefined;
  if (circleId || touched) fire('circle-updated', { circleId: circleId ?? touched });
}

// Ordre des listes (dernière activité d'abord) : une action remonte le Plan et son Cercle
function touchActivity(planId: string): string | undefined {
  const circleId = fixtures?.[`GET /plans/${planId}`]?.circleId;
  if (!circleId) return undefined;
  const at = now();
  const inCircle = (fixtures![`GET /circles/${circleId}/plans`] as any[] | undefined)?.find(p => p.id === planId);
  if (inCircle) inCircle.lastActivityAt = at;
  const circle = (fixtures!['GET /circles'] as any[]).find(c => c.id === circleId);
  if (circle) circle.lastActivityAt = at;
  return circleId;
}

let counter = 0;
const newId = (prefix: string) => `demo-${prefix}-${Date.now().toString(36)}-${counter++}`;
const now = () => new Date().toISOString();
const meRef = () => ({ id: me.id, pseudo: me.pseudo });

export const demoSocket = {
  connected: true,
  id: 'demo-socket',
  on(event: string, l: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(l);
    // Quelques membres « en ligne » pour l'indicateur de présence
    if (event === 'presence-snapshot') {
      loadDemo().then(() => {
        const ids = (fixtures!['GET /circles'] as any[]).flatMap(c => c.members?.map((m: any) => m.userId) ?? []);
        fire('presence-snapshot', [...new Set(ids)].filter(id => id !== me.id).slice(0, 3));
      });
    }
    return demoSocket;
  },
  off(event: string, l?: Listener) {
    if (l) listeners.get(event)?.delete(l); else listeners.delete(event);
    return demoSocket;
  },
  once(event: string, l: Listener) {
    const wrap = (p: any) => { demoSocket.off(event, wrap); l(p); };
    return demoSocket.on(event, wrap);
  },
  emit(event: string, payload: any) {
    loadDemo().then(() => handleSocket(event, payload));
    return demoSocket;
  },
  disconnect() { return demoSocket; },
  connect() { return demoSocket; },
};

function messageList(planId: string): any[] {
  const key = `GET /plans/${planId}/messages`;
  if (!fixtures![key]) fixtures![key] = [];
  return fixtures![key];
}

function findMessage(id: string): any | null {
  for (const [k, v] of Object.entries(fixtures!)) {
    if (!/\/messages$|\/replies$/.test(k) || !Array.isArray(v)) continue;
    const m = v.find((x: any) => x.id === id);
    if (m) return m;
  }
  return null;
}

function handleSocket(event: string, p: any) {
  if (event === 'send-message') {
    const content = typeof p.content === 'string' ? p.content.trim() : '';
    if (!content) return;
    if (touchActivity(p.planId)) fire('circle-updated', { circleId: plan(p.planId).circleId });
    const msg = {
      id: newId('msg'), content, createdAt: now(), editedAt: null, deletedAt: null,
      authorId: me.id, planId: p.planId, parentId: p.parentId ?? null, attachmentId: null, attachment: null,
      author: meRef(), reactions: [], _count: { replies: 0 },
    };
    if (p.parentId) {
      const key = `GET /plans/messages/${p.parentId}/replies`;
      (fixtures![key] ??= []).push(msg);
      const parent = findMessage(p.parentId);
      if (parent) parent._count = { replies: (parent._count?.replies ?? 0) + 1 };
    } else {
      messageList(p.planId).push(msg);
    }
    fire('message', msg);
  } else if (event === 'toggle-reaction') {
    const m = findMessage(p.messageId);
    if (!m) return;
    const mine = m.reactions.find((r: any) => r.userId === me.id && r.emoji === p.emoji);
    m.reactions = mine
      ? m.reactions.filter((r: any) => r !== mine)
      : [...m.reactions, { id: newId('re'), emoji: p.emoji, createdAt: now(), userId: me.id, messageId: m.id, user: meRef() }];
    fire('reactions-updated', { messageId: m.id, reactions: m.reactions });
  } else if (event === 'edit-message') {
    const m = findMessage(p.messageId);
    if (!m || m.authorId !== me.id) return;
    m.content = p.content; m.editedAt = now();
    fire('message-updated', m);
  } else if (event === 'delete-message') {
    const m = findMessage(p.messageId);
    if (!m || m.authorId !== me.id) return;
    m.content = ''; m.deletedAt = now(); m.attachment = null;
    fire('message-updated', m);
  }
}

// ─── Faux serveur (adapter axios) ─────────────────────────────────────────────

class DemoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// « Je suis dispo » de la démo : deux copains libres ce soir dans « Les copains » (Alex fait le 3e et peut lancer un Plan)
let demoDispo: Map<string, any[]> | null = null;
function dispoOf(circleId: string): any[] {
  if (!demoDispo) {
    demoDispo = new Map();
    const copains = (fixtures!['GET /circles'] as any[]).find(c => c.code === 'DEMO6X');
    if (copains) {
      const end = new Date(); end.setDate(end.getDate() + (end.getHours() < 4 ? 0 : 1)); end.setHours(4, 0, 0, 0);
      const others = (copains.members ?? []).filter((x: any) => x.userId !== me.id).slice(0, 2);
      const tags = [['apero'], ['apero', 'manger']];
      const notes = [texts['Partant pour un verre en ville'] ?? 'Partant pour un verre en ville', null];
      demoDispo.set(copains.id, others.map((x: any, i: number) => ({
        slot: 'tonight', tags: tags[i], note: notes[i], createdAt: new Date(Date.now() - (i + 1) * 40 * 60000).toISOString(), expiresAt: end.toISOString(),
        user: { id: x.userId, pseudo: x.user.pseudo, firstName: x.user.firstName ?? null },
      })));
    }
  }
  if (!demoDispo.has(circleId)) demoDispo.set(circleId, []);
  return demoDispo.get(circleId)!;
}

// « Mes contacts » de la démo, calculés d'après les Cercles et les Plans en mémoire
function demoContacts(circleId?: string) {
  const circles = (fixtures!['GET /circles'] as any[]).filter(c => !c.isPersonal);
  const byId = new Map<string, any>();
  for (const c of circles) for (const mbr of c.members ?? []) {
    if (mbr.userId === me.id) continue;
    const p = byId.get(mbr.userId) ?? { id: mbr.userId, pseudo: mbr.user.pseudo, firstName: mbr.user.firstName ?? null, circles: [] };
    p.circles.push({ id: c.id, name: c.name, color: c.color ?? null });
    byId.set(mbr.userId, p);
  }
  const col = new Intl.Collator('fr', { sensitivity: 'base' });
  let list = [...byId.values()].sort((a, b) => col.compare(a.firstName || a.pseudo, b.firstName || b.pseudo));
  list.forEach(p => p.circles.sort((a: any, b: any) => col.compare(a.name, b.name)));
  if (circleId) {
    const inCircle = new Set((circles.find(c => c.id === circleId)?.members ?? []).map((x: any) => x.userId));
    list = list.filter(p => !inCircle.has(p.id)).map(p => ({ ...p, invited: false }));
  }
  return list;
}

function demoPerson(userId: string) {
  const circles = (fixtures!['GET /circles'] as any[]).filter(c => !c.isPersonal);
  const has = (c: any, id: string) => (c.members ?? []).some((x: any) => x.userId === id);
  const shared = circles.filter(c => has(c, userId)).map(c => ({ id: c.id, name: c.name, color: c.color ?? null }));
  const seen = new Set<string>();
  const plans: any[] = [];
  for (const c of circles) for (const p of (fixtures![`GET /circles/${c.id}/plans`] ?? []) as any[]) {
    if (seen.has(p.id) || new Date(p.endDate).getTime() < Date.now() || p.membersVisibility === 'managers') continue;
    const both = [me.id, userId].every(id => (p.members ?? []).some((x: any) => x.userId === id && x.rsvp !== 'out'));
    if (both) { seen.add(p.id); plans.push({ id: p.id, title: p.title, eventDate: p.eventDate, endDate: p.endDate, circleId: p.circleId }); }
  }
  plans.sort((a, b) => new Date(a.eventDate ?? a.endDate).getTime() - new Date(b.eventDate ?? b.endDate).getTime());
  return {
    contact: shared.length > 0,
    circles: shared,
    plans: plans.slice(0, 10),
    invitable: shared.length ? circles.filter(c => !has(c, userId)).map(c => ({ id: c.id, name: c.name, color: c.color ?? null, invited: false })) : [],
  };
}

function plan(id: string) {
  const p = fixtures![`GET /plans/${id}`];
  if (!p) throw new DemoError(404, 'Plan introuvable');
  return p;
}

// « En bref » (GET /plans/:id/summary) : même calcul que le serveur (server/src/lib/planSummary.ts),
// à partir des données de la démo, pour suivre les actions du visiteur (trajet, cagnotte, postes…)
function demoSummary(id: string) {
  const p = plan(id);
  const mine = p.members.find((m: any) => m.userId === me.id);
  if (!mine || mine.rsvp === 'out') throw new DemoError(403, 'Le résumé est réservé aux participants');
  const on = (f: string) => !(p.disabledFeatures ?? []).includes(f);
  const optional = (f: string) => (p.enabledFeatures ?? []).includes(f);
  const nameOf = (uid: string) => { const u = p.members.find((m: any) => m.userId === uid)?.user; return u ? u.firstName ?? u.pseudo : '?'; };
  const counts = { in: 0, maybe: 0, out: 0, waitlist: p.waitlist?.length ?? 0 };
  for (const m of p.members) counts[m.rsvp === 'maybe' ? 'maybe' : m.rsvp === 'out' ? 'out' : 'in']++;
  const rides: any[] = on('trajets') ? fixtures![`GET /rides/plan/${id}`]?.rides ?? [] : [];
  const requests: any[] = on('trajets') ? fixtures![`GET /rides/plan/${id}`]?.requests ?? [] : [];
  const offers = rides.map(r => ({ driver: nameOf(r.driverId), seatsFree: r.seats - r.passengers.length })).filter(o => o.seatsFree > 0).sort((a, b) => b.seatsFree - a.seatsFree);
  const driving = rides.find(r => r.driverId === me.id);
  const aboard = rides.find(r => r.passengers.some((x: any) => x.userId === me.id));
  const request = requests.find(r => r.userId === me.id);
  const ride = driving ? { role: 'driver', seatsFree: Math.max(driving.seats - driving.passengers.length, 0), passengers: driving.passengers.length, departure: driving.departure, departureAt: driving.departureAt }
    : aboard ? { role: 'passenger', driver: nameOf(aboard.driverId), departure: aboard.departure, departureAt: aboard.departureAt }
    : request ? { role: 'searching', from: request.fromLocation }
    : offers.length ? { role: 'none', offers } : null;
  const items: any[] = on('depenses') ? p.items ?? [] : [];
  const label = (i: any) => (i.quantity ? `${i.label} (${i.quantity})` : i.label);
  const bringMine = items.filter(i => i.claimedBy === me.pseudo).map(label);
  const bringMissing = items.filter(i => !i.claimedBy).map(label);
  const exp = on('depenses') ? fixtures![`GET /plans/${id}/expenses`] : null;
  const transfers: any[] = exp?.suggestedTransfers ?? [];
  const money = exp && (exp.expenses?.length || exp.reimbursements?.length) ? {
    owe: transfers.filter(t => t.fromUserId === me.id).map(t => ({ to: nameOf(t.toUserId), amount: t.amount, currency: t.currency })),
    owed: transfers.filter(t => t.toUserId === me.id).map(t => ({ from: nameOf(t.fromUserId), amount: t.amount, currency: t.currency })),
  } : null;
  const pot = optional('cagnotte') ? fixtures![`GET /plans/${id}/pot`] : null;
  const pledge = pot?.myPledge;
  const shifts: any[] = optional('benevoles') ? (fixtures![`GET /plans/${id}/shifts`]?.shifts ?? []).filter((sh: any) => sh.signups.some((x: any) => x.userId === me.id)) : [];
  const polls: any[] = on('votes') ? p.polls ?? [] : [];
  const matches: any[] = on('votes') ? fixtures![`GET /plans/${id}/matches`] ?? [] : [];
  return {
    plan: { id: p.id, title: p.title, eventDate: p.eventDate, endDate: p.endDate, location: p.location, importantInfo: (p.importantInfo ?? '').split('\n').map((l: string) => l.trim()).find(Boolean) ?? null },
    myRsvp: mine.rsvp,
    counts,
    ride,
    rideOffers: offers,
    bring: bringMine.length || bringMissing.length ? { mine: bringMine, missing: bringMissing } : null,
    money,
    pot: pot && !pot.closed ? { forWhom: pot.forWhom, currency: pot.currency, amount: pledge?.amount ?? null, status: !pledge ? 'none' : pledge.received ? 'received' : pledge.declaredPaid ? 'paid' : 'pledged' } : null,
    shifts: shifts.map(sh => ({ title: sh.title, startsAt: sh.startsAt, endsAt: sh.endsAt })),
    todo: {
      polls: polls.filter(pl => !pl.options.some((o: any) => o.votes.some((v: any) => v.userId === me.id))).length,
      matches: matches.filter(m => !m.closed && m.isPlayer !== false && (m.deck?.length ?? 0) > 0).length,
    },
    photos: (p.attachments ?? []).filter((a: any) => String(a.mimeType).startsWith('image/') && !/^(match|quiz)-/.test(a.name)).length,
  };
}

// Copies d'un même Plan dans les listes (/plans, /circles/:id/plans)
function planCopies(id: string): any[] {
  const out: any[] = [];
  for (const [k, v] of Object.entries(fixtures!)) {
    if (Array.isArray(v) && (k === 'GET /plans' || /^GET \/circles\/[^/]+\/plans$/.test(k))) {
      const p = v.find((x: any) => x.id === id);
      if (p) out.push(p);
    }
  }
  return out;
}

function findShift(shiftId: string): { planId: string; list: any; shift: any } | null {
  for (const [k, v] of Object.entries(fixtures!)) {
    const mm = k.match(/^GET \/plans\/([^/]+)\/shifts$/);
    const shift = mm && v?.shifts?.find((x: any) => x.id === shiftId);
    if (shift) return { planId: mm![1], list: v, shift };
  }
  return null;
}

function setRsvp(planId: string, rsvp: string) {
  const p = plan(planId);
  for (const target of [p, ...planCopies(planId)]) {
    const m = target.members?.find((x: any) => x.userId === me.id);
    if (m) m.rsvp = rsvp;
  }
  if (rsvp === 'out') {
    leaveRides(planId);
    for (const sh of fixtures![`GET /plans/${planId}/shifts`]?.shifts ?? []) sh.signups = sh.signups.filter((x: any) => x.userId !== me.id);
  }
}

function rides(planId: string) {
  return (fixtures![`GET /rides/plan/${planId}`] ??= { rides: [], requests: [] });
}

function leaveRides(planId: string) {
  const r = rides(planId);
  r.rides = r.rides.filter((x: any) => x.driverId !== me.id);
  for (const ride of r.rides) ride.passengers = ride.passengers.filter((x: any) => x.userId !== me.id);
  r.requests = r.requests.filter((x: any) => x.userId !== me.id);
}

// Soldes par devise : même calcul que le serveur (server/src/lib/expenses.ts)
function recomputeExpenses(planId: string) {
  const data = fixtures![`GET /plans/${planId}/expenses`];
  const members: { userId: string; user: { pseudo: string } }[] = plan(planId).members;
  const ids = members.map(m => m.userId);
  const currencies = (['CHF', 'EUR'] as const).filter(c => data.expenses.some((e: any) => e.currency === c) || data.reimbursements.some((r: any) => r.currency === c));
  const byCurrency = currencies.map(currency => {
    const balance = new Map<string, number>(ids.map(id => [id, 0]));
    for (const e of data.expenses.filter((x: any) => x.currency === currency)) {
      const parts = e.splitWith.length ? e.splitWith.map((s: any) => s.userId) : ids;
      for (const id of parts) balance.set(id, (balance.get(id) ?? 0) - e.amount / parts.length);
      balance.set(e.paidById, (balance.get(e.paidById) ?? 0) + e.amount);
    }
    for (const r of data.reimbursements.filter((x: any) => x.currency === currency)) {
      balance.set(r.fromUserId, (balance.get(r.fromUserId) ?? 0) + r.amount);
      balance.set(r.toUserId, (balance.get(r.toUserId) ?? 0) - r.amount);
    }
    const creditors = [...balance].filter(([, b]) => b > 0.01).map(([id, b]) => ({ id, amount: b })).sort((a, b) => b.amount - a.amount);
    const debtors = [...balance].filter(([, b]) => b < -0.01).map(([id, b]) => ({ id, amount: -b })).sort((a, b) => b.amount - a.amount);
    const transfers: any[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].amount, creditors[j].amount);
      if (amount > 0.01) transfers.push({ fromUserId: debtors[i].id, toUserId: creditors[j].id, amount: Math.round(amount * 100) / 100 });
      debtors[i].amount -= amount; creditors[j].amount -= amount;
      if (debtors[i].amount <= 0.01) i++;
      if (creditors[j].amount <= 0.01) j++;
    }
    return { currency, balance, transfers };
  });
  const pseudoOf = (id: string) => members.find(m => m.userId === id)?.user.pseudo;
  data.balances = members.map(m => ({
    userId: m.userId, pseudo: m.user.pseudo,
    amounts: byCurrency.map(c => ({ currency: c.currency, balance: Math.round((c.balance.get(m.userId) ?? 0) * 100) / 100 })),
  }));
  data.suggestedTransfers = byCurrency.flatMap(c => c.transfers.map(t => ({ ...t, currency: c.currency, fromPseudo: pseudoOf(t.fromUserId), toPseudo: pseudoOf(t.toUserId) })));
}

function circlePoll(pollId: string) {
  const p = fixtures![`GET /circles/polls/${pollId}`];
  if (!p) throw new DemoError(404, 'Sondage introuvable');
  return p;
}

// Les listes de sondages du Cercle gardent la même copie que le détail
function syncPollLists(poll: any) {
  const key = `GET /circles/${poll.circleId}/polls`;
  const list = fixtures![key];
  if (Array.isArray(list)) fixtures![key] = list.map((p: any) => p.id === poll.id ? poll : p);
}

function createPlan(circleId: string, body: any) {
  const template = (fixtures![`GET /circles/${circleId}/plans`] as any[])?.[0];
  const detailTemplate = template ? plan(template.id) : null;
  const id = newId('plan');
  const member = { userId: me.id, planId: id, rsvp: 'in', joinedAt: now(), seen: {}, user: { ...meRef(), firstName: me.firstName }, isGuest: false };
  const base = {
    id, title: String(body.title ?? '').trim() || 'Nouveau Plan', description: String(body.description ?? ''),
    eventDate: body.eventDate ?? null, endDate: body.endDate ?? new Date(Date.now() + 2 * 864e5).toISOString(),
    location: body.location || null, archived: false, createdAt: now(), reminderSentAt: null,
    maxParticipants: body.maxParticipants ? Number(body.maxParticipants) : null,
    deletionMode: body.deletionMode ?? 'vote', disabledFeatures: body.disabledFeatures ?? [], editMode: body.editMode ?? 'creator',
    importantInfo: body.importantInfo?.trim() || null, importantInfoMode: body.importantInfoMode ?? 'creator',
    // Réglages récents (Plans spécifiques, « Qui voit ce Plan ? », règles) : gardés comme le vrai serveur
    kind: body.kind ?? null, enabledFeatures: Array.isArray(body.enabledFeatures) ? body.enabledFeatures : [],
    recurrence: body.recurrence ?? null, recurrenceUntil: body.recurrenceUntil ?? null,
    visibility: body.visibility ?? 'hidden', surprise: body.surprise ?? true,
    membersVisibility: body.membersVisibility ?? 'all', filesMode: body.filesMode ?? 'all',
    guestInviteMode: body.guestInviteMode ?? 'managers', allowCirclePlans: body.allowCirclePlans ?? true,
    creatorId: me.id, circleId, creator: meRef(), members: [member], unseen: [], unseenAt: null,
  };
  const detail = {
    ...(detailTemplate ?? {}), ...base,
    items: [], polls: [], attachments: [], changeLogs: [], exclusions: [], deleteVotes: [], viewerIsGuest: false, mediaToken: 'demo',
  };
  fixtures![`GET /plans/${id}`] = detail;
  fixtures![`GET /plans/${id}/messages`] = [];
  fixtures![`GET /rides/plan/${id}`] = { rides: [], requests: [] };
  fixtures![`GET /plans/${id}/expenses`] = { defaultCurrency: 'CHF', expenses: [], reimbursements: [], balances: [], suggestedTransfers: [] };
  if (base.enabledFeatures.includes('pere_noel')) startDemoSanta(id, circleId, base);
  const listEntry = { ...(template ?? {}), ...base, _count: { messages: 0 } };
  for (const key of [`GET /circles/${circleId}/plans`, 'GET /plans']) {
    const list = fixtures![key];
    if (Array.isArray(list)) list.push(key === 'GET /plans' ? { ...listEntry, circle: fixtures!['GET /circles'].find((c: any) => c.id === circleId) } : listEntry);
  }
  return detail;
}

// Amis fictifs qui rejoignent un Cercle créé dans la démo (comme après l'envoi du lien d'invitation) : ceux des « copains »
const DEMO_FRIENDS = ['tom_b', 'emma_v', 'noah_p', 'chloe_s', 'julie_r'];
function demoFriends() {
  const seen = new Map<string, any>();
  for (const c of fixtures!['GET /circles'] as any[]) for (const m of c.members ?? []) if (DEMO_FRIENDS.includes(m.user.pseudo)) seen.set(m.user.pseudo, m.user);
  return DEMO_FRIENDS.map(p => seen.get(p)).filter(Boolean);
}
function friendsJoinCircle(circleId: string) {
  demoFriends().forEach((u, i) => window.setTimeout(() => {
    const circle = (fixtures!['GET /circles'] as any[]).find(c => c.id === circleId);
    if (!circle || circle.members.some((m: any) => m.userId === u.id)) return;
    circle.members.push({ userId: u.id, circleId, role: 'member', joinedAt: now(), user: u });
    changed(undefined, circleId);
  }, 2500 + i * 900));
}

// Père Noël secret d'un Plan créé dans la démo : les membres du Cercle répondent « Je suis in » et notent leurs envies,
// le tirage se fait pour de vrai (en mémoire), puis le Père Noël d'Alex lui écrit
function santaWishes(): string[] { return tr('ui.demoApi.santaWishes').split('|'); }
function startDemoSanta(planId: string, circleId: string, p: any) {
  const key = `GET /plans/${planId}/santa`;
  fixtures![key] = {
    budget: null, drawn: false, revealed: false, canManage: true, canReveal: false, revealEndsPlan: p.kind === 'pere_noel',
    eventDate: p.eventDate, endDate: p.endDate,
    participants: [{ id: me.id, pseudo: me.pseudo, firstName: me.firstName, wishStatus: 'pending' }],
    myWish: '', myNoWish: false, exclusions: [], me: null, santa: null, readyCount: 0, pairCount: 0, unpaired: [], reveal: null,
    _wishes: {} as Record<string, string>,
  };
  const others = () => ((fixtures!['GET /circles'] as any[]).find(c => c.id === circleId)?.members ?? [])
    .filter((m: any) => m.userId !== me.id).slice(0, 5).map((m: any) => m.user);
  // Les amis arrivent un par un (y compris ceux qui rejoignent le Cercle juste après sa création)
  [0, 1, 2, 3, 4].forEach(i => window.setTimeout(() => {
    const st = fixtures![key]; const detail = fixtures![`GET /plans/${planId}`];
    const u = others()[i];
    if (!u || !st || !detail || st.drawn || st.participants.some((x: any) => x.id === u.id)) return;
    const wish = i === 2 ? '' : santaWishes()[i % santaWishes().length];
    st._wishes[u.id] = wish;
    st.participants.push({ id: u.id, pseudo: u.pseudo, firstName: u.firstName, wishStatus: wish ? 'wish' : 'none' });
    detail.members.push({ userId: u.id, planId, rsvp: 'in', joinedAt: now(), seen: {}, user: u, isGuest: false });
    changed(planId, circleId);
  }, 6000 + i * 1500));
}
function drawDemoSanta(planId: string) {
  const st = fixtures![`GET /plans/${planId}/santa`];
  if (st.participants.length < 3) throw new DemoError(400, tr('ui.demoApi.santaMin'));
  // Un seul grand cercle ; la personne qu'Alex gâte a noté des envies (plus parlant dans la démo)
  const others = st.participants.filter((x: any) => x.id !== me.id).sort(() => Math.random() - 0.5);
  const first = Math.max(0, others.findIndex((x: any) => st._wishes[x.id]));
  const receiver = others.splice(first, 1)[0];
  st.drawn = true; st.pairCount = st.participants.length;
  st.me = {
    receiver: { id: receiver.id, pseudo: receiver.pseudo, firstName: receiver.firstName },
    receiverWish: st._wishes[receiver.id] ?? '', receiverWishStatus: receiver.wishStatus, giftReady: false, withReceiver: [],
  };
  st.santa = { withSanta: [] };
  // Le Père Noël d'Alex se manifeste quelques secondes après le tirage
  window.setTimeout(() => {
    st.santa.withSanta.push({ id: newId('santa'), mine: false, content: tr('ui.demoApi.santaHello'), createdAt: now() });
    changed(planId);
  }, 5000);
}

// Killer : la cible d'Alex confirme son élimination ; Alex reprend une mission (cible encore en jeu,
// objet et lieu de la partie). Dernier en jeu : fin de partie et palmarès.
const demoKillerKills = new Map<string, string>(); // victime → auteur (éliminations faites dans la démo)
function killerConfirm(planId: string) {
  const st = fixtures![`GET /plans/${planId}/killer`];
  if (!st?.me?.claimed || !st.me.mission) return;
  const victimId = st.me.mission.target.id;
  const victim = st.players.find((p: any) => p.user.id === victimId);
  if (victim) { victim.alive = false; victim.eliminatedAt = now(); }
  demoKillerKills.set(victimId, me.id);
  st.me.kills += 1; st.me.claimed = false;
  st.aliveCount = st.players.filter((p: any) => p.alive).length;
  const others = st.players.filter((p: any) => p.alive && p.user.id !== me.id);
  const pick = (l: any[]) => l[Math.floor(Math.random() * l.length)];
  if (!others.length) {
    st.ended = true; st.me.mission = null;
    st.winner = st.players.find((p: any) => p.user.id === me.id)?.user ?? null;
    const byId = new Map(st.players.map((p: any) => [p.user.id, p.user]));
    for (const p of st.players) {
      p.kills = p.user.id === me.id ? st.me.kills : 0;
      p.eliminatedBy = p.alive ? null : byId.get(demoKillerKills.get(p.user.id) ?? '') ?? null;
    }
    // Les éliminations d'avant la démo : attribuées à un autre joueur (données fictives)
    for (const p of st.players) if (!p.alive && !p.eliminatedBy) {
      const author = st.players.find((x: any) => x.user.id !== me.id && x.user.id !== p.user.id);
      if (author) { p.eliminatedBy = author.user; author.kills += 1; }
    }
    st.players.sort((a: any, b: any) => b.kills - a.kills);
  } else {
    st.me.mission = { target: pick(others).user, object: pick(st.objects ?? [tr('ui.demoApi.defaultObject')]), place: pick(st.places ?? [tr('ui.demoApi.defaultPlace')]) };
  }
  changed(planId);
  fire('notification', { id: newId('n'), type: 'killer', planId, planTitle: plan(planId).title, circleId: plan(planId).circleId, preview: st.ended ? tr('ui.demoApi.killerWon') : tr('ui.demoApi.killerNext') });
}

// Match de groupe : retrouver un match (par proposition ou par id) et la vue complète enregistrée
function findDemoMatch(optionId?: string, matchId?: string): { planId: string; match: any; full: any } | null {
  for (const k of Object.keys(fixtures!)) {
    const mm = k.match(/^GET \/plans\/([^/]+)\/matches$/);
    if (!mm) continue;
    const fullList = fixtures![`DEMO_FULL /plans/${mm[1]}/matches`] as any[] | undefined;
    for (const match of fixtures![k] as any[]) {
      const full = fullList?.find(f => f.id === match.id);
      if (!full) continue;
      if (matchId ? match.id === matchId : full.results?.some((r: any) => r.id === optionId)) return { planId: mm[1], match, full };
    }
  }
  return null;
}
// Alex a fini : résultats = ceux des copains + les « oui » d'Alex ; oui de tous = match
function revealDemoMatch(planId: string, match: any, full: any) {
  const likes = new Set<string>(match.myLikes);
  match.results = full.results.map((r: any) => ({
    ...r, canDelete: false,
    yes: r.yes + (likes.has(r.id) ? 1 : 0), no: r.no + (likes.has(r.id) ? 0 : 1),
    likers: r.likers ? [...r.likers, ...(likes.has(r.id) ? ['Alex'] : [])] : undefined,
  })).sort((a: any, b: any) => b.yes - a.yes || a.no - b.no);
  match.finishedCount = match.playerCount; match.allFinished = true;
  match.matchedIds = match.results.filter((r: any) => r.yes === match.playerCount).map((r: any) => r.id);
  for (const r of match.results.filter((x: any) => match.matchedIds.includes(x.id))) {
    fire('notification', { id: newId('n'), type: 'match', planId, planTitle: plan(planId).title, circleId: plan(planId).circleId, preview: tr('ui.demoApi.match', { label: r.label }) });
  }
}

// Assemblée : retrouver un point de l'ordre du jour enregistré
function findDemoAssemblyItem(itemId: string): { planId: string; st: any; item: any } | null {
  for (const k of Object.keys(fixtures!)) {
    const mm = k.match(/^GET \/plans\/([^/]+)\/assembly$/);
    const item = mm && fixtures![k].items.find((i: any) => i.id === itemId);
    if (item) return { planId: mm![1], st: fixtures![k], item };
  }
  return null;
}

// Qui s'y colle ? : retrouver une roue enregistrée et recalculer qui est dessus (comme lib/wheel.ts)
function findDemoWheel(wheelId: string): { planId: string; wheel: any } | null {
  for (const k of Object.keys(fixtures!)) {
    const mm = k.match(/^GET \/plans\/([^/]+)\/wheels$/);
    const wheel = mm && fixtures![k].wheels.find((w: any) => w.id === wheelId);
    if (wheel) return { planId: mm![1], wheel };
  }
  return null;
}
function refreshDemoWheel(wheel: any) {
  const winners = new Set(wheel.spins.map((s: any) => s.winner.id));
  for (const p of wheel.participants) p.alreadyDrawn = wheel.noRepeat && winners.has(p.id);
  wheel.candidates = wheel.participants.filter((p: any) => !p.excluded && !p.alreadyDrawn).map((p: any) => ({ id: p.id, name: p.name }));
}

// Le mot piège : la cible confirme, Alex marque un point et reçoit une nouvelle mission
const DEMO_WORDS = tr('ui.demoApi.words').split(',');
function wordConfirm(planId: string) {
  const st = fixtures![`GET /plans/${planId}/words`];
  if (!st?.me?.claimed || !st.me.mission) return;
  const previous = st.me.mission.target?.id;
  st.me.points += 1; st.me.claimed = false;
  const others = st.ranking.filter((r: any) => r.user.id !== me.id && r.user.id !== previous);
  const pickOne = (l: any[]) => l[Math.floor(Math.random() * l.length)];
  st.me.mission = { target: pickOne(others.length ? others : st.ranking.filter((r: any) => r.user.id !== me.id)).user, word: pickOne(DEMO_WORDS.filter(w => w !== st.me.mission.word)) };
  bumpWordRanking(st);
  changed(planId);
  fire('notification', { id: newId('n'), type: 'words', planId, planTitle: plan(planId).title, circleId: plan(planId).circleId, preview: tr('ui.demoApi.wordOk') });
}
function bumpWordRanking(st: any) {
  const mine = st.ranking.find((r: any) => r.user.id === me.id);
  if (mine) mine.points = st.me.points;
  st.ranking.sort((a: any, b: any) => b.points - a.points);
}

// Championnat : même classement que le serveur (3 / 1 / 0, différence, buts marqués)
function recomputeStandings(st: any) {
  const t = new Map<string, any>(st.teams.map((x: any) => [x.id, { teamId: x.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0 }]));
  for (const m of st.matches) {
    if (m.homeScore == null || m.awayScore == null) continue;
    const h = t.get(m.homeId), a = t.get(m.awayId);
    if (!h || !a) continue;
    h.played++; a.played++; h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore; a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.points += 3; } else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.points += 3; } else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  st.standings = [...t.values()].map(s => ({ ...s, diff: s.goalsFor - s.goalsAgainst })).sort((x, y) => y.points - x.points || y.diff - x.diff || y.goalsFor - x.goalsFor);
  st.championId = st.matches.every((m: any) => m.homeScore != null) ? st.standings[0]?.teamId ?? null : null;
}

const DEMO_AVATARS = ['alex', 'lea_m', 'tom_b', 'chloe_s', 'emma_v', 'lucas_d', 'noah_p', 'julie_r', 'sarah_k', 'marc_l', 'nadia_f', 'zoe_m',
  'sofia_g', 'hugo_t', 'yann_k', 'sophie_d', 'pierre_r', 'monique_r', 'nathalie_r', 'leo_r'];

// Discussion des Cercles (démo) : ouverte dans les 4 Cercles, en mémoire. Cercles reconnus par leur code
// (server/scripts/demo-site/seed.js), les noms étant traduits.
const CIRCLE_CHATS: Record<string, [string, string, number, [string, string][]?][]> = {
  DEMO3X: [ // Association Jeunesse de Montvert
    ['lea_m', 'Merci à tous pour la soirée quiz, c’était génial ! 🧠🏆', 10, [['🎉', 'tom_b'], ['🎉', 'emma_v'], ['❤️', 'julie_r']]],
    ['nadia_f', 'Les affiches de la fête sont prêtes, je les dépose dans les commerces 📌', 6, [['🙏', 'paul_r']]],
    ['tom_b', 'Il reste une place pour Europa-Park, qui la veut ? 🎢', 3],
    ['chloe_s', 'Moi peut-être, je confirme demain !', 2],
  ],
  DEMO4X: [ // Best collègues
    ['zoe_m', 'J’ai lancé un sondage pour la sortie bowling 🎳', 20, [['👍', 'marc_l']]],
    ['paul_r', 'Il y a des croissants à la cafétéria, servez-vous 🥐', 1, [['😍', 'sarah_k'], ['🙏', 'zoe_m']]],
  ],
  DEMO5X: [ // Famille Rochat
    ['pierre_r', 'Vous avez vu la photo du petit Léo à son match ? Quel but ! ⚽', 28, [['❤️', 'julie_r'], ['❤️', 'nathalie_r']]],
    ['nathalie_r', 'Qui peut garder le chat la semaine prochaine ? 🐱', 6],
    ['julie_r', 'Moi ! Je passe le chercher samedi', 5],
  ],
  DEMO6X: [ // Les copains
    ['tom_b', 'Quelqu’un a vu le nouveau resto thaï près de la gare ? 🍜', 26, [['👍', 'emma_v']]],
    ['emma_v', 'Oui ! Il paraît que le pad thaï est top', 25],
    ['julie_r', 'On y va un soir la semaine prochaine ?', 3, [['❤️', 'tom_b'], ['❤️', 'noah_p']]],
    ['noah_p', 'Chaud pour jeudi 😄 @alex tu viens ?', 1],
  ],
};
const demoChats = new Map<string, { mode: 'open' | 'announce'; seen: boolean; messages: any[] }>();
// Photos des Cercles : illustrations liées à chaque Cercle (public/demo/circles, client/scripts/demo-circles.py)
const DEMO_CIRCLE_PHOTOS = new Set(['DEMO3X', 'DEMO4X', 'DEMO5X', 'DEMO6X']);

function chatOf(circleId: string) {
  if (demoChats.size === 0) {
    const ago = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    for (const c of fixtures!['GET /circles'] as any[]) {
      const lines = CIRCLE_CHATS[c.code];
      if (!lines) continue;
      const userOf = (pseudo: string) => c.members.find((x: any) => x.user.pseudo === pseudo)?.user ?? meRef();
      demoChats.set(c.id, { mode: 'open', seen: c.code === 'DEMO4X', messages: lines.map(([pseudo, content, h, reactions = []]) => {
        const u = userOf(pseudo);
        return { id: `demo-cm-${Math.random().toString(36).slice(2)}`, circleId: c.id, author: { id: u.id, pseudo: u.pseudo, firstName: u.firstName ?? null },
          content: texts[content] ?? content, imageKey: null, createdAt: ago(h), editedAt: null, deletedAt: null,
          reactions: reactions.map(([emoji, who]) => ({ emoji, userId: userOf(who).id })) };
      }) });
    }
  }
  return demoChats.get(circleId);
}

// Liste d'attente (Plan complet) : s'inscrire ou se retirer, en mémoire
function setWaitlist(planId: string, join: boolean) {
  for (const target of [plan(planId), ...planCopies(planId)]) {
    const list = (target.waitlist ??= []) as any[];
    const i = list.findIndex(w => w.userId === me.id);
    if (join && i < 0) list.push({ userId: me.id, createdAt: now(), user: { id: me.id, pseudo: me.pseudo, firstName: me.firstName } });
    if (!join && i >= 0) list.splice(i, 1);
  }
}

// Transports publics : correspondances fictives enregistrées (seed.js), arrêts proposés à la saisie
const DEMO_STOPS = ['Genève', 'Genève, Plainpalais', 'Genève, Rive', 'Genève, Eaux-Vives-Plage', 'Lausanne', 'Sion', 'Sierre', 'Brig', 'Locarno', 'Ascona, Posta', 'Montvert, Poste'];
function transitOf(planId: string) {
  const st = fixtures![`GET /plans/${planId}/transit`];
  if (!st) throw new DemoError(403, NOT_IN_DEMO);
  return st;
}

// Découvrir (démo) : événements et lieux fictifs, dates calculées à partir d'aujourd'hui (rien n'est envoyé au serveur)
function demoDiscover(region: string) {
  const at = (days: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const ev = (id: string, title: string, place: string, city: string, category: string, days: number, h: number, extra: Record<string, unknown> = {}) => ({
    id: `demo-ev-${region}-${id}`, title, place, city, category, family: false, priceText: null, status: 'scheduled',
    startAt: at(days, h), endAt: null, multiDay: false, dateLabel: null, url: 'https://www.evly.ch/demo', sourceId: 'demo', ...extra,
  });
  const city = region === 'la' ? 'Lausanne' : region === 'vs' ? 'Sion' : 'Genève';
  const events = [
    ev('1', 'Soirée salsa cubaine', 'Le Patio', city, 'danse', 0, 21, { priceText: 'CHF 15' }),
    ev('2', 'Quiz musical au bar', 'Café du Lac', city, 'jeux', 1, 20),
    ev('3', 'Concert jazz en trio', 'La Cave bleue', city, 'concert', 2, 20, { priceText: 'CHF 25' }),
    ev('4', 'Atelier poterie parents-enfants', 'Atelier Terre & Feu', city, 'atelier', 3, 14, { family: true, priceText: 'CHF 30 par duo' }),
    ev('5', 'Stand-up : plateau découverte', 'Le Rire Club', city, 'theatre', 4, 20, { status: 'full' }),
    ev('6', 'Course populaire des feuilles mortes', 'Parc du Belvédère', city, 'sport', 5, 10, { family: true, priceText: 'Gratuit' }),
    ev('7', 'Soirée années 2000', 'Club Neon', city, 'soiree', 5, 23),
    ev('8', 'Exposition « Lumières d’automne »', 'Galerie du Vieux-Port', city, 'expo', 0, 10, { multiDay: true, endAt: at(20, 18) }),
  ];
  const place = (id: string, name: string, kind: string, family = true) => ({ id: `demo-pl-${region}-${id}`, name, kind, city, website: 'https://www.evly.ch/demo', family, sourceId: 'demo' });
  const places = [place('1', 'Escape Room du Moulin', 'escape', false), place('2', 'Bowling des Étoiles', 'bowling'), place('3', 'Jump Park', 'trampoline'), place('4', 'Musée des Jouets', 'musee')];
  return { region, from: at(0, 0), until: at(14, 0), events, places, sources: [{ id: 'demo', name: 'Démo', type: 'manual', attribution: 'Exemples fictifs (démo)', license: null, licenseUrl: null }] };
}

function route(method: string, path: string, body: any): any {
  const key = `${method} ${path}`;
  let m: RegExpMatchArray | null;

  // Découvrir
  if (path === '/discover/localities' && method === 'GET') {
    const q = norm(body?.q ?? '');
    return q.length < 2 ? [] : BIG_CITIES.filter(c => norm(c.name).includes(q)).map(c => ({ kind: 'locality', ...c, canton: '' }));
  }
  if (path === '/discover' && method === 'GET') {
    // Lieu choisi : la ville fictive la plus proche (Genève, Lausanne ou Sion)
    const lat = Number(body?.lat), lon = Number(body?.lon);
    const region = body?.region ?? (!Number.isFinite(lat) ? 'ge' : lon > 7 ? 'vs' : lat > 46.43 ? 'la' : 'ge');
    return demoDiscover(region);
  }
  // « Je suis dispo »
  if ((m = path.match(/^\/availability\/circles\/([^/]+)$/))) {
    const list = dispoOf(m[1]);
    if (method === 'GET') return { enabled: true, threshold: 3, entries: list };
    const others = list.filter(e => e.user.id !== me.id);
    if (method === 'PUT') {
      const end = new Date();
      if (body?.slot === 'now') end.setHours(end.getHours() + 3); else { end.setDate(end.getDate() + (end.getHours() < 4 ? 0 : 1)); end.setHours(4, 0, 0, 0); }
      others.push({ slot: body?.slot === 'now' ? 'now' : 'tonight', tags: body?.tags ?? [], note: body?.note ?? null, minPeople: body?.minPeople ?? null, createdAt: new Date().toISOString(), expiresAt: end.toISOString(),
        user: { id: me.id, pseudo: me.pseudo, firstName: me.firstName ?? null } });
    }
    demoDispo!.set(m[1], others);
    return { ok: true };
  }
  // Discussion du Cercle
  if ((m = path.match(/^\/circle-chat\/([^/]+)$/)) && method === 'GET') {
    const chat = chatOf(m[1]);
    if (!chat) return { mode: 'off', canWrite: false, canModerate: false, messages: [] };
    const circle = (fixtures!['GET /circles'] as any[]).find(c => c.id === m![1]);
    const manager = circle?.creatorId === me.id || circle?.members.some((x: any) => x.userId === me.id && x.role !== 'member');
    return { mode: chat.mode, canWrite: chat.mode === 'open' || manager, canModerate: manager, messages: chat.messages };
  }
  if ((m = path.match(/^\/circle-chat\/([^/]+)\/seen$/))) { const chat = chatOf(m[1]); if (chat) chat.seen = true; return { ok: true }; }
  if ((m = path.match(/^\/circle-chat\/([^/]+)\/messages$/)) && method === 'POST') {
    const chat = chatOf(m[1]);
    if (!chat || !body?.content?.trim()) throw new DemoError(403, NOT_IN_DEMO);
    const msg = { id: `demo-cm-${Date.now()}`, circleId: m[1], author: { ...meRef(), firstName: me.firstName }, content: body.content.trim(), imageKey: null, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, reactions: [] };
    chat.messages.push(msg);
    return msg;
  }
  if ((m = path.match(/^\/circle-chat\/messages\/([^/]+)(\/reactions)?$/))) {
    for (const chat of demoChats.values()) {
      const msg = chat.messages.find(x => x.id === m![1]);
      if (!msg) continue;
      if (m[2]) {
        const i = msg.reactions.findIndex((r: any) => r.userId === me.id && r.emoji === body?.emoji);
        if (i >= 0) msg.reactions.splice(i, 1); else msg.reactions.push({ emoji: body?.emoji, userId: me.id });
      } else if (method === 'PUT') { msg.content = String(body?.content ?? '').trim(); msg.editedAt = new Date().toISOString(); }
      else if (method === 'DELETE') { msg.content = ''; msg.deletedAt = new Date().toISOString(); }
      return { ...msg, reactions: [...msg.reactions] };
    }
    throw new DemoError(404, NOT_IN_DEMO);
  }

  if (method === 'GET') {
    // Roue : l'heure du « serveur » est celle du navigateur (animation synchronisée)
    if (path.match(/^\/plans\/[^/]+\/wheels$/) && key in fixtures!) return { ...fixtures![key], serverNow: Date.now() };
    if ((m = path.match(/^\/plans\/([^/]+)\/summary$/))) return demoSummary(m[1]);
    if ((m = path.match(/^\/plans\/([^/]+)\/transit\/stops$/))) {
      const q = String(body?.q ?? '').toLowerCase();
      return DEMO_STOPS.filter(n => n.toLowerCase().includes(q)).slice(0, 6).map(name => ({ id: `demo-stop-${name}`, name, kind: 'stop' }));
    }
    // Photos de profil : avatars dessinés (public/demo/avatars, client/scripts/demo-avatars.py)
    if (path === '/photos/people') return Object.fromEntries(DEMO_AVATARS.map(p => [p, `demo/avatars/${p}.svg`]));
    // « Mes contacts » : les membres des Cercles d'Alex (comme server/src/routes/contacts.ts)
    if (path === '/contacts') return demoContacts(body?.circleId);
    if ((m = path.match(/^\/contacts\/([^/]+)$/))) return demoPerson(m[1]);
    // Cercles : sondages de dates ouverts et ceux qui attendent la réponse d'Alex (comme GET /circles du serveur)
    if (path === '/circles') return (fixtures![key] as any[]).map(c => {
      const polls = ((fixtures![`GET /circles/${c.id}/polls`] ?? []) as any[]).filter(p => !p.expiresAt || new Date(p.expiresAt).getTime() > Date.now());
      const pending = polls.filter(p => !(p.declines ?? []).some((d: any) => d.userId === me.id) && !p.options.some((o: any) => o.votes.some((v: any) => v.userId === me.id)));
      const chat = chatOf(c.id);
      const last = chat?.messages.filter(x => !x.deletedAt).slice(-1)[0];
      return {
        ...c, photoKey: c.photoKey ?? (DEMO_CIRCLE_PHOTOS.has(c.code) ? `demo/circles/${c.code}.svg` : null),
        pollCount: polls.length, pendingPolls: pending.map(p => ({ id: p.id, question: p.question })),
        chatMode: chat?.mode ?? 'off', chatUnseen: !!chat && !chat.seen,
        availabilityEnabled: c.code !== FOCUS_CIRCLE_CODE, availabilityThreshold: 3,
        dispo: (() => { const d = dispoOf(c.id); return d.length ? { count: d.length, pseudos: d.slice(0, 5).map((e: any) => e.user.pseudo) } : null; })(),
        chatLast: last ? { author: last.author.pseudo, text: last.content.slice(0, 90), at: last.createdAt } : null,
      };
    });
    if (key in fixtures!) return fixtures![key];
    if ((m = path.match(/^\/plans\/messages\/([^/]+)\/replies$/))) return fixtures![key] ?? [];
    if (path === '/circles/invitations/mine' || path === '/suggestions/mine' || path === '/moderation/blocks') return [];
    if (path === '/mutes') return (fixtures!['GET /mutes'] ??= { plans: [], circles: [] });
    if ((m = path.match(/^\/plans\/([^/]+)\/shifts$/))) return (fixtures![key] ??= { shifts: [], canManage: plan(m[1]).creatorId === me.id });
    throw new DemoError(403, NOT_IN_DEMO);
  }

  // Père Noël secret (Noël entre copains) : tirage déjà fait ; envies, cadeau prêt, messages anonymes
  if ((m = path.match(/^\/plans\/([^/]+)\/santa(\/[a-z]+)?$/)) && method !== 'GET') {
    const st = fixtures![`GET /plans/${m[1]}/santa`];
    if (!st) throw new DemoError(403, NOT_IN_DEMO);
    const sub = m[2] ?? '';
    const meP = st.participants.find((p: any) => p.id === me.id);
    if (sub === '/wish') {
      st.myNoWish = body.noWish === true;
      st.myWish = st.myNoWish ? '' : String(body.text ?? '').trim();
      if (meP) meP.wishStatus = st.myWish ? 'wish' : st.myNoWish ? 'none' : 'pending';
    } else if (sub === '/ready' && st.me) {
      if (st.me.giftReady !== (body.ready === true)) st.readyCount += body.ready === true ? 1 : -1;
      st.me.giftReady = body.ready === true;
    } else if (sub === '/messages') {
      const content = String(body.content ?? '').trim();
      if (!content) throw new DemoError(400, 'Message vide');
      const thread = body.to === 'receiver' ? st.me?.withReceiver : st.santa?.withSanta;
      if (!thread) throw new DemoError(404, 'Conversation introuvable');
      thread.push({ id: newId('santa'), mine: true, content, createdAt: now() });
      // Une réponse arrive quelques secondes plus tard, pour donner vie à la démo
      const reply = body.to === 'receiver' ? tr('ui.demoApi.santaReplyReceiver') : tr('ui.demoApi.santaReplyGiver');
      window.setTimeout(() => { thread.push({ id: newId('santa'), mine: false, content: reply, createdAt: now() }); changed(m![1]); }, 2500);
    } else if (sub === '/draw' && method === 'POST' && st.canManage && !st.drawn && st._wishes) {
      drawDemoSanta(m[1]);
    } else if (sub === '' && method === 'PUT' && st.canManage && body.budget !== undefined) {
      st.budget = String(body.budget ?? '').trim() || null;
    } else throw new DemoError(403, NOT_IN_DEMO);
    changed(m[1]);
    return { ok: true };
  }

  // Killer (Week-end au chalet) : partie en cours. « J'ai eu ma cible » : la cible confirme
  // quelques secondes plus tard et Alex reçoit une nouvelle mission. Le reste est réservé au vrai site.
  if ((m = path.match(/^\/plans\/([^/]+)\/killer\/claim$/))) {
    const st = fixtures![`GET /plans/${m[1]}/killer`];
    if (!st?.me?.mission || st.ended) throw new DemoError(403, NOT_IN_DEMO);
    const planId = m[1];
    st.me.claimed = method === 'POST';
    if (method === 'POST') window.setTimeout(() => killerConfirm(planId), 3000);
    changed(planId);
    return { ok: true };
  }
  if (path.match(/^\/plans\/[^/]+\/killer/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Match de groupe (apéro au bord du lac) : les copains ont joué ; quand Alex a fini ses cartes, les
  // résultats s'affichent (oui au Grand Bain = c'est un match). Choisir applique au Plan.
  if ((m = path.match(/^\/plans\/matches\/options\/([^/]+)\/swipe$/))) {
    const found = findDemoMatch(m[1]);
    if (!found) throw new DemoError(403, NOT_IN_DEMO);
    const { planId, match, full } = found;
    const optionId = m[1];
    if (method === 'POST') {
      match.deck = match.deck.filter((c: any) => c.id !== optionId);
      match.myLikes = match.myLikes.filter((id: string) => id !== optionId).concat(body.like ? [optionId] : []);
      if (!match.deck.length) revealDemoMatch(planId, match, full);
    } else {
      const card = full.results.find((r: any) => r.id === optionId);
      if (card && !match.deck.some((c: any) => c.id === optionId)) match.deck.unshift({ id: card.id, label: card.label, note: card.note, url: card.url, attachmentId: card.attachmentId, createdBy: card.createdBy });
      match.myLikes = match.myLikes.filter((id: string) => id !== optionId);
      match.results = null; match.matchedIds = []; match.finishedCount = full.finishedCount; match.allFinished = false;
    }
    changed(planId);
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/matches\/([^/]+)\/choose$/))) {
    const found = findDemoMatch(undefined, m[1]);
    if (!found || !found.match.canChoose) throw new DemoError(403, NOT_IN_DEMO);
    const { planId, match } = found;
    const option = match.results?.find((r: any) => r.id === body.optionId);
    if (!option) throw new DemoError(400, tr('ui.demoApi.playFirst'));
    match.closed = true; match.canChoose = false; match.chosenOptionId = option.id; match.deck = [];
    for (const t of [plan(planId), ...planCopies(planId)]) {
      if (body.setLocation) t.location = option.label;
      if (body.addToInfo) t.importantInfo = [t.importantInfo, `✅ ${match.question} → ${option.label}`].filter(Boolean).join('\n');
    }
    changed(planId, plan(planId).circleId);
    return { ok: true };
  }
  if (path.match(/^\/plans\/(matches|[^/]+\/matches)/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Assemblée générale de la jeunesse : Alex vote (pour lui et pour Chloé), les autres finissent de voter quelques
  // secondes plus tard ; Alex, organisateur du Cercle, peut clore le vote. Notes du PV en mémoire.
  // Clore l'assemblée (aucun vote ouvert) : le PV n'est plus un « projet »
  if ((m = path.match(/^\/plans\/([^/]+)\/assembly\/close$/)) && method === 'POST') {
    const st = fixtures![`GET /plans/${m[1]}/assembly`];
    if (!st?.canManage || st.status !== 'open') throw new DemoError(403, NOT_IN_DEMO);
    if ((st.items as any[]).some(i => i.status === 'open')) throw new DemoError(400, tr('ui.demoApi.otherVoteOpen'));
    st.status = 'closed'; st.closedAt = now();
    changed(m[1]);
    return { ok: true };
  }
  // Candidats d'une élection (avant son ouverture), en mémoire
  if ((m = path.match(/^\/plans\/assembly\/items\/([^/]+)\/candidates$/)) && method === 'POST') {
    const found = findDemoAssemblyItem(m[1]);
    if (!found || !found.st.canManage || found.item.kind !== 'election' || found.item.status !== 'pending') throw new DemoError(403, NOT_IN_DEMO);
    const { planId, st, item } = found;
    const member = (st.members as any[]).find(x => x.id === body?.userId);
    const name = member?.name ?? String(body?.name ?? '').trim();
    if (!name || (member && item.candidates.some((c: any) => c.userId === member.id))) throw new DemoError(400, NOT_IN_DEMO);
    item.candidates.push({ id: newId('cand'), name, userId: member?.id ?? null, elected: false });
    changed(planId);
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/assembly\/candidates\/([^/]+)$/)) && method === 'DELETE') {
    for (const k of Object.keys(fixtures!)) {
      const mm = k.match(/^GET \/plans\/([^/]+)\/assembly$/);
      const item = mm && (fixtures![k].items as any[]).find(i => i.status === 'pending' && i.candidates.some((c: any) => c.id === m![1]));
      if (item) { item.candidates = item.candidates.filter((c: any) => c.id !== m![1]); changed(mm![1]); return { ok: true }; }
    }
    throw new DemoError(403, NOT_IN_DEMO);
  }
  if ((m = path.match(/^\/plans\/assembly\/items\/([^/]+)\/(vote|close|notes|open)$/))) {
    const found = findDemoAssemblyItem(m[1]);
    if (!found) throw new DemoError(403, NOT_IN_DEMO);
    const { planId, st, item } = found;
    // Voix d'Alex (la sienne et celle de Yann, par procuration), d'après l'assemblée enregistrée
    const mandates = () => ((st.me?.mandates ?? []) as any[]).map(x => ({ id: x.id, name: x.name, voted: false }));
    if (m[2] === 'notes') { item.notes = String(body.notes ?? '').trim() || null; changed(planId); return { ok: true }; }
    // Ouvrir le vote d'un point (vote ou élection), un seul à la fois
    if (m[2] === 'open') {
      if (!st.canManage || item.kind === 'info' || item.status !== 'pending') throw new DemoError(403, NOT_IN_DEMO);
      if ((st.items as any[]).some(i => i.status === 'open')) throw new DemoError(400, tr('ui.demoApi.otherVoteOpen'));
      if (item.kind === 'election' && !item.candidates.length) throw new DemoError(400, tr('ui.demoApi.addCandidates'));
      item.status = 'open'; item.eligibleVotes = st.quorum?.represented ?? 13; item.votedCount = 0; item.myMandates = mandates();
      changed(planId);
      return { ok: true };
    }
    if (m[2] === 'vote') {
      if (item.status !== 'open') throw new DemoError(400, tr('ui.demoApi.voteNotOpen'));
      for (const v of body.votes ?? []) {
        const mandate = item.myMandates.find((x: any) => x.id === v.onBehalfOfId);
        if (!mandate || mandate.voted) continue;
        mandate.voted = true; item.votedCount += 1;
        (item._mine ??= []).push(item.kind === 'election' ? (Array.isArray(v.candidateIds) ? v.candidateIds : []) : v.choice);
      }
      window.setTimeout(() => { if (item.status === 'open') { item.votedCount = item.eligibleVotes; changed(planId); } }, 4000);
      changed(planId);
      return { ok: true };
    }
    if (!st.canManage || item.status !== 'open') throw new DemoError(403, NOT_IN_DEMO);
    // Élection : bulletins d'Alex + ceux des autres (répartis entre les candidats), élus = les plus de voix (comme lib/assembly.ts)
    if (item.kind === 'election') {
      const seats = item.seats ?? 1;
      const cands = item.candidates as any[];
      const votes = new Map(cands.map(c => [c.id, 0]));
      const ballots: string[][] = [...(item._mine ?? [])];
      const others = Math.max((item.eligibleVotes ?? 0) - ballots.length, 0);
      for (let i = 0; i < others; i++) ballots.push(cands.length ? [...new Set(Array.from({ length: Math.min(seats, cands.length) }, (_, j) => cands[(i + j * 2) % cands.length].id))] : []);
      for (const b of ballots) for (const id of b) if (votes.has(id)) votes.set(id, votes.get(id)! + 1);
      const ranking = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: cands.find(c => c.id === id)?.name ?? '?', votes: n }));
      const electedIds = new Set(ranking.filter(r => r.votes > 0).slice(0, seats).map(r => r.id));
      for (const c of cands) c.elected = electedIds.has(c.id);
      item.status = 'closed'; item.votedCount = item.eligibleVotes; item.myMandates = [];
      item.result = { tacit: false, ranking, elected: cands.filter(c => c.elected).map(c => c.name), tie: false, tiedIds: [], blank: ballots.filter(b => !b.length).length, ballots: ballots.length };
      changed(planId);
      return { ok: true };
    }
    // Voix des autres (bulletin secret) : celles déjà enregistrées dans la démo + les retardataires
    const mine: string[] = item._mine ?? [];
    const others = (item.eligibleVotes ?? 0) - mine.length;
    const counts = { yes: Math.max(others - 2, 0), no: Math.min(1, others), abstain: others >= 2 ? 1 : 0 };
    for (const ch of mine) counts[ch as 'yes' | 'no' | 'abstain'] += 1;
    item.status = 'closed'; item.votedCount = item.eligibleVotes; item.myMandates = [];
    item.result = { counts, adopted: counts.yes > counts.no };
    changed(planId);
    return { ok: true };
  }
  if (path.match(/^\/plans\/(assembly|[^/]+\/assembly)/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Qui s'y colle ? (soirée raclette) : retirer / remettre des personnes et lancer la roue, en mémoire
  if ((m = path.match(/^\/plans\/wheels\/([^/]+)(\/spin)?$/)) && (method === 'PUT' || m[2])) {
    const found = findDemoWheel(m[1]);
    if (!found) throw new DemoError(403, NOT_IN_DEMO);
    const { planId, wheel } = found;
    if (m[2]) {
      if (!wheel.candidates.length) throw new DemoError(400, tr('ui.demoApi.wheelEmpty'));
      const last = wheel.spins[wheel.spins.length - 1];
      if (last && last.startAt + last.durationMs > Date.now()) throw new DemoError(409, tr('ui.demoApi.wheelSpinning'));
      const winner = wheel.candidates[Math.floor(Math.random() * wheel.candidates.length)];
      const pick = (f: (p: any) => boolean) => wheel.participants.filter(f).map((p: any) => ({ id: p.id, name: p.name }));
      const spin = { id: newId('spin'), winner, candidates: [...wheel.candidates], excluded: pick((p: any) => p.excluded), skipped: pick((p: any) => !p.excluded && p.alreadyDrawn),
        spunBy: { id: me.id, name: me.firstName ?? me.pseudo }, startAt: Date.now() + 3000, durationMs: 5000 };
      wheel.spins.push(spin);
      refreshDemoWheel(wheel);
      changed(planId);
      return { id: spin.id, startAt: spin.startAt, serverNow: Date.now() };
    }
    if (Array.isArray(body.excludedUserIds)) for (const p of wheel.participants) p.excluded = body.excludedUserIds.includes(p.id);
    if (typeof body.noRepeat === 'boolean') wheel.noRepeat = body.noRepeat;
    refreshDemoWheel(wheel);
    changed(planId);
    return { ok: true };
  }
  if (path.match(/^\/plans\/(wheels|[^/]+\/wheels)/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Le mot piège (Week-end au chalet) : « … l'a dit ! » est confirmé quelques secondes plus tard (+1 point,
  // nouvelle mission) ; « Démasquer » réussit une fois sur deux. Le reste est réservé au vrai site.
  if ((m = path.match(/^\/plans\/([^/]+)\/words\/(claim|accuse)$/))) {
    const st = fixtures![`GET /plans/${m[1]}/words`];
    if (!st?.me || st.ended || !st.started) throw new DemoError(403, NOT_IN_DEMO);
    const planId = m[1];
    if (m[2] === 'claim') {
      if (!st.me.mission) throw new DemoError(400, tr('ui.demoApi.noMission'));
      st.me.claimed = method === 'POST';
      if (method === 'POST') window.setTimeout(() => wordConfirm(planId), 3000);
      changed(planId);
      return { ok: true };
    }
    if (st.me.accuseBlockedUntil) throw new DemoError(429, tr('ui.demoApi.accuseWait'));
    const correct = Math.random() < 0.5;
    if (correct) { st.me.points += 1; bumpWordRanking(st); }
    else st.me.accuseBlockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    changed(planId);
    return correct ? { correct: true } : { correct: false, blockedUntil: st.me.accuseBlockedUntil };
  }
  if (path.match(/^\/plans\/[^/]+\/words/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Tournoi (pétanque) : Alex, organisateur du Cercle, saisit les scores du championnat
  if ((m = path.match(/^\/plans\/([^/]+)\/teams\/matches\/([^/]+)$/)) && method === 'PUT') {
    const st = fixtures![`GET /plans/${m[1]}/teams`];
    const match = st?.matches.find((x: any) => x.id === m![2]);
    if (!match || st.format !== 'league') throw new DemoError(403, NOT_IN_DEMO);
    if (body.clear) { match.homeScore = null; match.awayScore = null; }
    else {
      const h = Number(body.homeScore), a = Number(body.awayScore);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) throw new DemoError(400, 'Score invalide');
      match.homeScore = h; match.awayScore = a;
    }
    recomputeStandings(st);
    changed(m[1]);
    return { ok: true };
  }
  if (path.match(/^\/plans\/[^/]+\/teams/) && method !== 'GET') throw new DemoError(403, NOT_IN_DEMO);

  // Cagnotte (anniversaire surprise de Tom) : participation, paiement, idées et votes, réglages d'Alex
  if ((m = path.match(/^\/plans\/([^/]+)\/pot(\/.*)?$/)) && method !== 'GET') {
    const st = fixtures![`GET /plans/${m[1]}/pot`];
    if (!st) throw new DemoError(403, NOT_IN_DEMO);
    const sub = m[2] ?? '';
    const meP = { id: me.id, pseudo: me.pseudo, firstName: me.firstName };
    let im: RegExpMatchArray | null;
    let result: any = { ok: true };
    if (sub === '/pledge' && method === 'PUT') {
      const amount = Math.round(Number(String(body.amount).replace(',', '.')) * 100) / 100;
      if (!(amount > 0)) throw new DemoError(400, 'Montant invalide');
      if (st.closed) throw new DemoError(400, 'La cagnotte est close');
      st.myPledge = { amount, declaredPaid: st.myPledge?.declaredPaid ?? false, received: st.myPledge?.received ?? false };
      st.pledges = (st.pledges ?? []).filter((p: any) => p.user.id !== me.id).concat({ user: meP, ...st.myPledge });
      if (!st.contributors.some((c: any) => c.id === me.id)) st.contributors.push(meP);
      st.notYet = (st.notYet ?? []).filter((u: any) => u.id !== me.id);
    } else if (sub === '/pledge' && method === 'DELETE') {
      st.myPledge = null;
      st.pledges = (st.pledges ?? []).filter((p: any) => p.user.id !== me.id);
      st.contributors = st.contributors.filter((c: any) => c.id !== me.id);
    } else if (sub === '/pledge/paid' && st.myPledge) {
      st.myPledge.declaredPaid = body.paid === true;
      const mine = st.pledges?.find((p: any) => p.user.id === me.id); if (mine) mine.declaredPaid = body.paid === true;
    } else if ((im = sub.match(/^\/pledges\/([^/]+)$/)) && st.canManage) {
      const p = st.pledges?.find((x: any) => x.user.id === im![1]);
      if (!p) throw new DemoError(404, 'Participation introuvable');
      p.received = body.received === true;
      if (im[1] === me.id && st.myPledge) st.myPledge.received = p.received;
    } else if (sub === '/ideas' && method === 'POST') {
      const text = String(body.text ?? '').trim();
      if (!text) throw new DemoError(400, tr('ui.demoApi.emptyIdea'));
      const price = body.price ? Number(String(body.price).replace(',', '.')) : null;
      st.ideas.push({ id: newId('idea'), text, url: body.url || null, price: price && price > 0 ? price : null, createdBy: meP, votes: 1, myVote: true, canDelete: true });
    } else if ((im = sub.match(/^\/ideas\/([^/]+)$/)) && method === 'DELETE') {
      const idea = st.ideas.find((i: any) => i.id === im![1]);
      if (!idea?.canDelete) throw new DemoError(403, NOT_IN_DEMO);
      st.ideas = st.ideas.filter((i: any) => i.id !== idea.id);
      if (st.chosenIdeaId === idea.id) st.chosenIdeaId = null;
    } else if ((im = sub.match(/^\/ideas\/([^/]+)\/vote$/))) {
      const idea = st.ideas.find((i: any) => i.id === im![1]);
      if (!idea) throw new DemoError(404, tr('ui.demoApi.ideaNotFound'));
      idea.votes += idea.myVote ? -1 : 1; idea.myVote = !idea.myVote;
    } else if (sub === '' && method === 'PUT' && st.canManage) {
      for (const k of ['forWhom', 'payInfo', 'currency', 'chosenIdeaId']) if (body[k] !== undefined) st[k] = body[k] || null;
      for (const k of ['target', 'suggested']) if (body[k] !== undefined) st[k] = body[k] === '' || body[k] === null ? null : Number(String(body[k]).replace(',', '.')) || null;
      st.currency = st.currency || 'CHF';
    } else if (sub === '/remind' && st.canManage) {
      st.canRemind = false;
      result = { ok: true, sent: (st.notYet?.length ?? 0) + (st.pledges ?? []).filter((p: any) => !p.declaredPaid && !p.received && p.user.id !== me.id).length };
    } else if (sub === '/close' && st.canManage) {
      st.closed = body.closed !== false;
    } else throw new DemoError(403, NOT_IN_DEMO);
    st.ideas.sort((a: any, b: any) => b.votes - a.votes);
    if (st.pledges) {
      st.total = Math.round(st.pledges.reduce((s: number, p: any) => s + p.amount, 0) * 100) / 100;
      st.received = Math.round(st.pledges.filter((p: any) => p.received).reduce((s: number, p: any) => s + p.amount, 0) * 100) / 100;
      st.count = st.pledges.length;
    }
    changed(m[1]);
    return result;
  }

  // Mode silencieux (Plan ou Cercle), en mémoire
  if (path === '/mutes' && method === 'PUT') {
    const mutes = (fixtures!['GET /mutes'] ??= { plans: [], circles: [] });
    if (body.planId) {
      mutes.plans = mutes.plans.filter((x: any) => x.id !== body.planId);
      if (body.muted) mutes.plans.unshift({ id: body.planId, title: plan(body.planId).title });
    } else if (body.circleId) {
      mutes.circles = mutes.circles.filter((x: any) => x.id !== body.circleId);
      const c = (fixtures!['GET /circles'] ?? []).find((x: any) => x.id === body.circleId);
      if (body.muted && c) mutes.circles.unshift({ id: c.id, name: c.name });
    }
    return { ok: true, muted: body.muted };
  }

  // Planning des bénévoles
  if ((m = path.match(/^\/plans\/([^/]+)\/shifts$/)) && method === 'POST') {
    const list = route('GET', path, null);
    if (!list.canManage) throw new DemoError(403, tr('ui.demoApi.shiftsManagers'));
    if (!String(body.title ?? '').trim()) throw new DemoError(400, 'Nom du poste requis');
    list.shifts.push({ id: newId('shift'), title: String(body.title).trim(), needed: Number(body.needed ?? 1), note: body.note || null, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null, signups: [] });
    list.shifts.sort((a: any, b: any) => (a.startsAt ? 0 : 1) - (b.startsAt ? 0 : 1) || String(a.startsAt).localeCompare(String(b.startsAt)));
    changed(m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/shifts\/([^/]+)(\/signup|\/signups\/([^/]+))?$/))) {
    const found = findShift(m[1]);
    if (!found) throw new DemoError(404, 'Poste introuvable');
    const { planId, list, shift } = found;
    if (!m[2] && method === 'PUT') {
      if (!list.canManage) throw new DemoError(403, NOT_IN_DEMO);
      if (Number(body.needed ?? 1) < shift.signups.length) throw new DemoError(400, tr('ui.demoApi.shiftTooSmall', { count: shift.signups.length }));
      Object.assign(shift, { title: String(body.title ?? shift.title).trim(), needed: Number(body.needed ?? 1), note: body.note || null, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null });
    } else if (!m[2] && method === 'DELETE') {
      if (!list.canManage) throw new DemoError(403, NOT_IN_DEMO);
      list.shifts = list.shifts.filter((x: any) => x !== shift);
    } else if (m[2] === '/signup' && method === 'POST') {
      if (shift.signups.some((x: any) => x.userId === me.id)) throw new DemoError(409, tr('ui.demoApi.alreadySigned'));
      if (shift.signups.length >= shift.needed) throw new DemoError(409, 'Ce poste est complet');
      shift.signups.push({ userId: me.id, user: { id: me.id, pseudo: me.pseudo, firstName: me.firstName ?? null } });
      setRsvp(planId, 'in'); // s'inscrire vaut « Je suis in »
    } else if (m[2] === '/signup' && method === 'DELETE') {
      shift.signups = shift.signups.filter((x: any) => x.userId !== me.id);
    } else if (m[3] && method === 'DELETE') {
      if (!list.canManage) throw new DemoError(403, NOT_IN_DEMO);
      shift.signups = shift.signups.filter((x: any) => x.userId !== m![3]);
    } else throw new DemoError(403, NOT_IN_DEMO);
    changed(planId, plan(planId).circleId);
    return { ok: true };
  }

  // Réponse (RSVP), « vu », informations importantes, modification du Plan
  // Liste d'attente
  if ((m = path.match(/^\/plans\/([^/]+)\/waitlist$/))) { setWaitlist(m[1], method === 'POST'); changed(m[1], plan(m[1]).circleId); return { ok: true }; }
  // Transports publics : mes arrêts, voyages proposés (en mémoire)
  if ((m = path.match(/^\/plans\/([^/]+)\/transit\/me$/)) && method === 'PUT') {
    const st = transitOf(m[1]);
    if (body?.from !== undefined) st.from = body.from;
    if (body?.to !== undefined) st.to = body.to;
    if (body?.remember === true && st.from) st.home = st.from;
    if (body?.remember === false) st.home = null;
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/([^/]+)\/transit\/groups$/)) && method === 'POST') {
    const st = transitOf(m[1]);
    const c = body?.connection;
    const rides = (c?.legs ?? []).filter((l: any) => l.kind !== 'walk');
    if (!rides.length) throw new DemoError(400, NOT_IN_DEMO);
    for (const g of st.groups) g.members = g.members.filter((x: any) => x.userId !== me.id);
    st.groups = st.groups.filter((g: any) => g.members.length);
    st.groups.push({ id: newId('transit'), creator: meRef(), fromName: rides[0].from, toName: c.legs[c.legs.length - 1].to, departureAt: rides[0].departureAt ?? c.departureAt, arrivalAt: c.arrivalAt,
      lines: rides.map((l: any) => l.line).filter(Boolean).join(' › '), platform: rides[0].platform, note: body?.note?.trim() || null, legs: c.legs.slice(c.legs.findIndex((l: any) => l.kind !== 'walk')),
      members: [{ userId: me.id, user: meRef() }] });
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/transit-groups\/([^/]+)\/join$/))) {
    for (const [k, st] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+\/transit$/.test(k)) continue;
      const g = (st as any).groups.find((x: any) => x.id === m![1]);
      if (!g) continue;
      for (const other of (st as any).groups) other.members = other.members.filter((x: any) => x.userId !== me.id);
      if (method === 'POST') g.members.push({ userId: me.id, user: meRef() });
      (st as any).groups = (st as any).groups.filter((x: any) => x.members.length);
      return { ok: true };
    }
    throw new DemoError(404, NOT_IN_DEMO);
  }
  if ((m = path.match(/^\/plans\/([^/]+)\/rsvp$/)) && method === 'PUT') { setRsvp(m[1], body.rsvp); changed(m[1], plan(m[1]).circleId); return { ok: true }; }
  if ((m = path.match(/^\/plans\/([^/]+)\/seen$/))) {
    for (const t of [plan(m[1]), ...planCopies(m[1])]) t.unseen = (t.unseen ?? []).filter((s: string) => s !== body.section);
    return { ok: true };
  }
  if ((m = path.match(/^\/plans\/([^/]+)\/important-info$/)) && method === 'PUT') {
    const text = String(body.importantInfo ?? '').trim() || null;
    for (const t of [plan(m[1]), ...planCopies(m[1])]) t.importantInfo = text;
    changed(m[1]);
    return { ok: true, importantInfo: text };
  }
  if ((m = path.match(/^\/plans\/([^/]+)$/)) && method === 'PUT') {
    const p = plan(m[1]);
    if (p.creatorId !== me.id) throw new DemoError(403, tr('ui.demoApi.creatorOnly'));
    const fields = ['title', 'description', 'eventDate', 'endDate', 'location', 'maxParticipants', 'deletionMode', 'disabledFeatures', 'editMode', 'importantInfoMode'];
    for (const t of [p, ...planCopies(m[1])]) for (const f of fields) if (body[f] !== undefined) t[f] = body[f];
    changed(m[1], p.circleId);
    return p;
  }

  // Qui apporte quoi
  if ((m = path.match(/^\/plans\/([^/]+)\/items$/)) && method === 'POST') {
    const item = { id: newId('item'), label: String(body.label ?? '').trim(), quantity: String(body.quantity ?? '').trim() || null, claimedBy: null, createdById: me.id, planId: m[1] };
    plan(m[1]).items.push(item);
    changed(m[1]);
    return item;
  }
  if ((m = path.match(/^\/plans\/items\/([^/]+)$/)) && method === 'PUT') {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const p = v as any;
      const item = p.items?.find((i: any) => i.id === m![1]);
      if (!item) continue;
      if (item.createdById !== me.id && p.creatorId !== me.id) throw new DemoError(403, tr('ui.demoApi.itemEditForbidden'));
      item.label = String(body.label ?? item.label).trim();
      item.quantity = String(body.quantity ?? '').trim() || null;
      changed(p.id);
      return item;
    }
    throw new DemoError(404, tr('ui.demoApi.itemNotFound'));
  }
  if ((m = path.match(/^\/plans\/items\/([^/]+)$/)) && method === 'DELETE') {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const p = v as any;
      const item = p.items?.find((i: any) => i.id === m![1]);
      if (!item) continue;
      if (item.createdById !== me.id && p.creatorId !== me.id) throw new DemoError(403, tr('ui.demoApi.itemRemoveForbidden'));
      p.items = p.items.filter((i: any) => i !== item);
      changed(p.id);
      return { ok: true };
    }
    throw new DemoError(404, tr('ui.demoApi.itemNotFound'));
  }
  if ((m = path.match(/^\/plans\/items\/([^/]+)\/claim$/))) {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const item = (v as any).items?.find((i: any) => i.id === m![1]);
      if (item) {
        if (item.claimedBy && item.claimedBy !== me.pseudo) throw new DemoError(409, tr('ui.demoApi.taken'));
        item.claimedBy = item.claimedBy ? null : me.pseudo;
        changed((v as any).id);
        return item;
      }
    }
    throw new DemoError(404, tr('ui.demoApi.itemNotFound'));
  }

  // Sondages d'un Plan (un seul choix)
  if ((m = path.match(/^\/plans\/polls\/([^/]+)\/vote$/))) {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const poll = (v as any).polls?.find((p: any) => p.options.some((o: any) => o.id === m![1]));
      if (!poll) continue;
      const already = poll.options.find((o: any) => o.id === m![1]).votes.some((x: any) => x.userId === me.id);
      for (const o of poll.options) o.votes = o.votes.filter((x: any) => x.userId !== me.id);
      if (!already) poll.options.find((o: any) => o.id === m![1]).votes.push({ id: newId('vote'), userId: me.id, optionId: m![1] });
      changed((v as any).id);
      return { ok: true };
    }
    throw new DemoError(404, 'Sondage introuvable');
  }

  // Dépenses
  if ((m = path.match(/^\/plans\/([^/]+)\/expenses$/)) && method === 'POST') {
    const data = fixtures![`GET /plans/${m[1]}/expenses`];
    const members = plan(m[1]).members;
    const amount = Number(body.amount);
    if (!body.description?.trim() || !(amount > 0)) throw new DemoError(400, 'Description et montant requis');
    const e = {
      id: newId('exp'), description: body.description.trim(), amount, currency: body.currency ?? 'CHF', createdAt: now(),
      planId: m[1], paidById: me.id, paidBy: meRef(),
      splitWith: (body.splitWith ?? members.map((x: any) => x.userId)).map((uid: string) => ({ userId: uid, user: { id: uid, pseudo: members.find((x: any) => x.userId === uid)?.user.pseudo } })),
    };
    data.expenses.unshift(e);
    data.defaultCurrency = e.currency;
    recomputeExpenses(m[1]);
    changed(m[1]);
    return e;
  }
  if ((m = path.match(/^\/plans\/expenses\/([^/]+)$/)) && method === 'DELETE') {
    for (const [k, v] of Object.entries(fixtures!)) {
      const mm = k.match(/^GET \/plans\/([^/]+)\/expenses$/);
      if (!mm) continue;
      const data = v as any;
      if (data.expenses.some((e: any) => e.id === m![1])) {
        data.expenses = data.expenses.filter((e: any) => e.id !== m![1]);
        recomputeExpenses(mm[1]);
        changed(mm[1]);
        return { ok: true };
      }
    }
    throw new DemoError(404, tr('ui.demoApi.expenseNotFound'));
  }
  if ((m = path.match(/^\/plans\/([^/]+)\/reimbursements$/)) && method === 'POST') {
    const data = fixtures![`GET /plans/${m[1]}/expenses`];
    data.reimbursements.unshift({ id: newId('rb'), amount: Number(body.amount), currency: body.currency ?? 'CHF', fromUserId: me.id, toUserId: body.toUserId, planId: m[1], createdAt: now() });
    recomputeExpenses(m[1]);
    changed(m[1]);
    return { ok: true };
  }

  // Covoiturage
  if ((m = path.match(/^\/rides\/plan\/([^/]+)$/)) && method === 'POST') {
    leaveRides(m[1]);
    rides(m[1]).rides.push({ id: newId('ride'), departure: body.departure, departureAt: body.departureAt ?? null, seats: Number(body.seats) || 3, note: body.note ?? null, createdAt: now(), planId: m[1], driverId: me.id, driver: meRef(), passengers: [] });
    fire('rides-updated', { planId: m[1] });
    return { ok: true };
  }
  if ((m = path.match(/^\/rides\/plan\/([^/]+)\/request$/))) {
    const r = rides(m[1]);
    r.requests = r.requests.filter((x: any) => x.userId !== me.id);
    if (method === 'POST') r.requests.push({ id: newId('rq'), fromLocation: body.fromLocation, createdAt: now(), planId: m[1], userId: me.id, user: meRef() });
    fire('rides-updated', { planId: m[1] });
    return { ok: true };
  }
  if ((m = path.match(/^\/rides\/([^/]+)(\/join)?$/))) {
    for (const [k, v] of Object.entries(fixtures!)) {
      const mm = k.match(/^GET \/rides\/plan\/([^/]+)$/);
      if (!mm) continue;
      const data = v as any;
      const ride = data.rides.find((x: any) => x.id === m![1]);
      if (!ride) continue;
      if (!m[2] && method === 'DELETE') data.rides = data.rides.filter((x: any) => x !== ride);
      else if (!m[2] && method === 'PUT') Object.assign(ride, { departure: body.departure, seats: Number(body.seats) || ride.seats, departureAt: body.departureAt ?? null, note: body.note ?? null });
      else if (method === 'DELETE') ride.passengers = ride.passengers.filter((x: any) => x.userId !== me.id);
      else {
        if (ride.passengers.length >= ride.seats) throw new DemoError(409, 'Plus de place dans ce trajet');
        for (const other of data.rides) other.passengers = other.passengers.filter((x: any) => x.userId !== me.id);
        data.requests = data.requests.filter((x: any) => x.userId !== me.id);
        ride.passengers.push({ rideId: ride.id, userId: me.id, planId: mm[1], createdAt: now(), user: meRef() });
      }
      fire('rides-updated', { planId: mm[1] });
      return { ok: true };
    }
    throw new DemoError(404, 'Trajet introuvable');
  }

  // Sondages de dates (Cercle) : vote multiple, « pas disponible », chat
  if ((m = path.match(/^\/circles\/polls\/options\/([^/]+)\/vote$/))) {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/circles\/polls\/[^/]+$/.test(k)) continue;
      const poll = v as any;
      const opt = poll.options?.find((o: any) => o.id === m![1]);
      if (!opt) continue;
      const mine = opt.votes.some((x: any) => x.userId === me.id);
      opt.votes = mine ? opt.votes.filter((x: any) => x.userId !== me.id) : [...opt.votes, { votedAt: now(), optionId: opt.id, userId: me.id, user: meRef() }];
      poll.declines = (poll.declines ?? []).filter((d: any) => d.userId !== me.id);
      syncPollLists(poll);
      return poll;
    }
    throw new DemoError(404, 'Sondage introuvable');
  }
  if ((m = path.match(/^\/circles\/polls\/([^/]+)\/decline$/))) {
    const poll = circlePoll(m[1]);
    const declined = (poll.declines ?? []).some((d: any) => d.userId === me.id);
    for (const o of poll.options) o.votes = o.votes.filter((x: any) => x.userId !== me.id);
    poll.declines = declined ? poll.declines.filter((d: any) => d.userId !== me.id) : [...(poll.declines ?? []), { userId: me.id, pollId: poll.id, createdAt: now(), user: meRef() }];
    syncPollLists(poll);
    return poll;
  }
  if ((m = path.match(/^\/circles\/polls\/([^/]+)\/messages$/)) && method === 'POST') {
    const msg = { id: newId('pm'), content: String(body.content ?? '').trim(), createdAt: now(), editedAt: null, deletedAt: null, pollId: m[1], authorId: me.id, author: meRef() };
    (fixtures![`GET /circles/polls/${m[1]}/messages`] ??= []).push(msg);
    return msg;
  }

  // Créer un Cercle (vide, Alex seul membre)
  if (path === '/circles' && method === 'POST') {
    const name = String(body.name ?? '').trim();
    if (!name) throw new DemoError(400, tr('ui.demoApi.circleName'));
    const id = newId('circle');
    const circle = {
      id, name, code: Math.random().toString(36).slice(2, 8).toUpperCase(), description: body.description?.trim() || null,
      color: body.color ?? null, createdAt: now(), isPersonal: false,
      deletionMode: body.deletionMode ?? 'vote', admissionMode: body.admissionMode ?? 'vote',
      planCreationMode: body.planCreationMode ?? 'all', pollCreationMode: body.pollCreationMode ?? 'all',
      creatorId: me.id, creator: meRef(), deleteVotes: [], joinRequests: [], _count: { plans: 0 }, plans: [], hasUnseen: false,
      members: [{ userId: me.id, circleId: id, role: 'admin', joinedAt: now(), user: { ...meRef(), firstName: me.firstName } }],
    };
    fixtures!['GET /circles'].push(circle);
    fixtures![`GET /circles/${id}/plans`] = [];
    fixtures![`GET /circles/${id}/polls`] = [];
    fixtures![`GET /circles/${id}/history`] = [];
    friendsJoinCircle(id);
    return circle;
  }

  // Créer un Plan dans un Cercle
  if ((m = path.match(/^\/circles\/([^/]+)\/plans$/)) && method === 'POST') {
    const detail = createPlan(m[1], body);
    if (body?.fromAvailability) demoDispo?.set(m[1], []);
    changed(undefined, m[1]);
    return detail;
  }

  // Tout le reste (créer un Cercle, inviter, envoyer une photo, paramètres du compte…)
  throw new DemoError(403, NOT_IN_DEMO);
}

function demoPdf(path: string): string | null {
  let m: RegExpMatchArray | null;
  if (path.match(/^\/plans\/[^/]+\/assembly\/pv$/)) return 'assemblee-pv';
  const agId = (fixtures?.DEMO_SHOWCASE as Record<string, [string, string]> | undefined)?.assemblee?.[0];
  if ((m = path.match(/^\/plans\/([^/]+)\/recap$/)) && m[1] === agId) return 'assemblee-recap';
  return null;
}

export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  await loadDemo();
  const method = (config.method ?? 'get').toUpperCase();
  const url = new URL(config.url ?? '', 'http://demo');
  const path = url.pathname.replace(/^\/api/, '');
  let body: any = {};
  if (typeof config.data === 'string') { try { body = JSON.parse(config.data); } catch { body = {}; } }
  if (config.params && typeof config.params === 'object') body = { ...config.params, ...body };
  const respond = (status: number, data: any): AxiosResponse => ({ data, status, statusText: String(status), headers: {}, config, request: {} });
  // Petit délai, comme un vrai réseau
  await new Promise(r => setTimeout(r, 60));
  // PDF de l'assemblée de la démo (procès-verbal et récapitulatif du Plan) : de vrais PDF, générés une fois sur la base de
  // démo et l'assemblée close (public/demo/pdf, server/scripts/demo-site/LISEZMOI.md)
  const pdf = method === 'GET' ? demoPdf(path) : null;
  if (pdf) {
    const res = await fetch(`/demo/pdf/${pdf}-${currentLang()}.pdf`);
    if (res.ok) return respond(200, await res.blob());
  }
  try {
    const data = route(method, path, body);
    return respond(200, JSON.parse(JSON.stringify(data ?? { ok: true })));
  } catch (e) {
    const err: any = new Error(e instanceof DemoError ? e.message : tr('ui.demoApi.error'));
    err.response = respond(e instanceof DemoError ? e.status : 500, { error: err.message });
    err.config = config;
    err.isAxiosError = true;
    throw err;
  }
};
