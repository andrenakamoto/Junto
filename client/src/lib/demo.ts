import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Démo sans compte (/demo) : tout tourne dans le navigateur. Les données (public/demo/data.json)
// sont de vraies réponses du serveur, enregistrées une fois sur une base jetable avec des
// personnes et des Cercles fictifs (Alex, « Jeunesse de Montvert », « Les copains »). Les dates
// sont décalées pour rester à venir. Les actions (répondre, écrire, voter, prendre une place,
// ajouter une dépense…) ne modifient qu'une copie en mémoire : rien n'est envoyé au serveur, et
// tout disparaît en quittant ou en rechargeant la page.
//
// Branchements : services/api.ts (adapter axios), lib/socket.ts (faux temps réel),
// AuthContext (session « démo »), lib/media.ts (photos locales).

const FLAG = 'evly_demo';
export const DEMO_TOKEN = 'demo';
const NOT_IN_DEMO = 'Dans la démo, cette action n’est pas disponible. Crée ton compte gratuit pour l’essayer pour de vrai !';

export function isDemo(): boolean {
  try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; }
}

export function startDemo() {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* stockage indisponible */ }
}

export function exitDemo(to = '/auth') {
  try { sessionStorage.removeItem(FLAG); } catch { /* stockage indisponible */ }
  window.location.replace(to);
}

type Fixtures = Record<string, any>;
let fixtures: Fixtures | null = null;
let me: { id: string; pseudo: string; firstName: string } = { id: '', pseudo: '', firstName: '' };
let loading: Promise<void> | null = null;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// Décale toutes les dates du nombre de jours écoulés depuis l'enregistrement
function shiftDates(value: any, delta: number): any {
  if (typeof value === 'string') return ISO.test(value) ? new Date(new Date(value).getTime() + delta).toISOString() : value;
  if (Array.isArray(value)) return value.map(v => shiftDates(v, delta));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = shiftDates(v, delta);
    return out;
  }
  return value;
}

export function loadDemo(): Promise<void> {
  if (!loading) {
    loading = fetch('/demo/data.json')
      .then(r => r.json())
      .then(data => {
        // Décalage en jours entiers : les heures restent rondes (19:00, pas 19:04)
        const delta = Math.floor((Date.now() - new Date(data.capturedAt).getTime()) / 864e5) * 864e5;
        fixtures = shiftDates(data.fixtures, delta);
        const u = fixtures!['GET /auth/me'];
        me = { id: u.id, pseudo: u.pseudo, firstName: u.firstName };
      });
  }
  return loading;
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
  if (circleId) fire('circle-updated', { circleId });
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

function plan(id: string) {
  const p = fixtures![`GET /plans/${id}`];
  if (!p) throw new DemoError(404, 'Plan introuvable');
  return p;
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
  const listEntry = { ...(template ?? {}), ...base, _count: { messages: 0 } };
  for (const key of [`GET /circles/${circleId}/plans`, 'GET /plans']) {
    const list = fixtures![key];
    if (Array.isArray(list)) list.push(key === 'GET /plans' ? { ...listEntry, circle: fixtures!['GET /circles'].find((c: any) => c.id === circleId) } : listEntry);
  }
  return detail;
}

function route(method: string, path: string, body: any): any {
  const key = `${method} ${path}`;
  let m: RegExpMatchArray | null;

  if (method === 'GET') {
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
      const reply = body.to === 'receiver' ? 'Ha ha, mystère… Merci Père Noël ! 😄' : 'Bien reçu, je note ! 🎅';
      window.setTimeout(() => { thread.push({ id: newId('santa'), mine: false, content: reply, createdAt: now() }); changed(m![1]); }, 2500);
    } else if (sub === '' && method === 'PUT' && st.canManage && body.budget !== undefined) {
      st.budget = String(body.budget ?? '').trim() || null;
    } else throw new DemoError(403, NOT_IN_DEMO);
    changed(m[1]);
    return { ok: true };
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
    if (!list.canManage) throw new DemoError(403, 'Seuls le créateur du Plan et les organisateurs du Cercle créent les postes');
    if (!String(body.title ?? '').trim()) throw new DemoError(400, 'Nom du poste requis');
    list.shifts.push({ id: newId('shift'), title: String(body.title).trim(), needed: Number(body.needed) || 1, note: body.note || null, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null, signups: [] });
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
      if ((Number(body.needed) || 1) < shift.signups.length) throw new DemoError(400, `${shift.signups.length} personnes sont déjà inscrites : retire d’abord des inscrits`);
      Object.assign(shift, { title: String(body.title ?? shift.title).trim(), needed: Number(body.needed) || 1, note: body.note || null, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null });
    } else if (!m[2] && method === 'DELETE') {
      if (!list.canManage) throw new DemoError(403, NOT_IN_DEMO);
      list.shifts = list.shifts.filter((x: any) => x !== shift);
    } else if (m[2] === '/signup' && method === 'POST') {
      if (shift.signups.some((x: any) => x.userId === me.id)) throw new DemoError(409, 'Tu es déjà inscrit(e) à ce poste');
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
    if (p.creatorId !== me.id) throw new DemoError(403, 'Réservé au créateur du Plan');
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
      if (item.createdById !== me.id && p.creatorId !== me.id) throw new DemoError(403, 'Seuls la personne qui l’a ajouté et le créateur du Plan peuvent le modifier');
      item.label = String(body.label ?? item.label).trim();
      item.quantity = String(body.quantity ?? '').trim() || null;
      changed(p.id);
      return item;
    }
    throw new DemoError(404, 'Élément introuvable');
  }
  if ((m = path.match(/^\/plans\/items\/([^/]+)$/)) && method === 'DELETE') {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const p = v as any;
      const item = p.items?.find((i: any) => i.id === m![1]);
      if (!item) continue;
      if (item.createdById !== me.id && p.creatorId !== me.id) throw new DemoError(403, 'Seuls la personne qui l’a ajouté et le créateur du Plan peuvent le retirer');
      p.items = p.items.filter((i: any) => i !== item);
      changed(p.id);
      return { ok: true };
    }
    throw new DemoError(404, 'Élément introuvable');
  }
  if ((m = path.match(/^\/plans\/items\/([^/]+)\/claim$/))) {
    for (const [k, v] of Object.entries(fixtures!)) {
      if (!/^GET \/plans\/[^/]+$/.test(k)) continue;
      const item = (v as any).items?.find((i: any) => i.id === m![1]);
      if (item) {
        if (item.claimedBy && item.claimedBy !== me.pseudo) throw new DemoError(409, 'Déjà pris');
        item.claimedBy = item.claimedBy ? null : me.pseudo;
        changed((v as any).id);
        return item;
      }
    }
    throw new DemoError(404, 'Élément introuvable');
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
    throw new DemoError(404, 'Dépense introuvable');
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

  // Sondages de dates (Cercle) : vote multiple, « pas intéressé », chat
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
    if (!name) throw new DemoError(400, 'Donne un nom à ton Cercle');
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
    return circle;
  }

  // Créer un Plan dans un Cercle
  if ((m = path.match(/^\/circles\/([^/]+)\/plans$/)) && method === 'POST') {
    const detail = createPlan(m[1], body);
    changed(undefined, m[1]);
    return detail;
  }

  // Tout le reste (créer un Cercle, inviter, envoyer une photo, paramètres du compte…)
  throw new DemoError(403, NOT_IN_DEMO);
}

export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  await loadDemo();
  const method = (config.method ?? 'get').toUpperCase();
  const url = new URL(config.url ?? '', 'http://demo');
  const path = url.pathname.replace(/^\/api/, '');
  let body: any = {};
  if (typeof config.data === 'string') { try { body = JSON.parse(config.data); } catch { body = {}; } }
  const respond = (status: number, data: any): AxiosResponse => ({ data, status, statusText: String(status), headers: {}, config, request: {} });
  // Petit délai, comme un vrai réseau
  await new Promise(r => setTimeout(r, 60));
  try {
    const data = route(method, path, body);
    return respond(200, JSON.parse(JSON.stringify(data ?? { ok: true })));
  } catch (e) {
    const err: any = new Error(e instanceof DemoError ? e.message : 'Erreur de la démo');
    err.response = respond(e instanceof DemoError ? e.status : 500, { error: err.message });
    err.config = config;
    err.isAxiosError = true;
    throw err;
  }
};
