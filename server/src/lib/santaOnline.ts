import prisma from './prisma';

// Secret Santa en ligne, gratuit et sans compte (2026-11-17, page publique /secret-santa, routes/santaOnline.ts).
// Porte d'entrée vers EvLY : on tire au sort en 30 secondes, chacun reçoit un lien secret qui ne montre que la personne
// à qui il offre ; les pages invitent ensuite à organiser le reste (chat anonyme, rappels…) dans l'app.

export const SANTA_MIN = 3;
export const SANTA_MAX = 40;
export const NAME_MAX = 40;
const DAY = 86_400_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SantaInput {
  title: string;
  budget: string | null;
  exchangeDate: Date | null;
  people: { name: string; email: string | null }[];
  /** Paires d'indices (dans `people`) qui ne doivent pas se tirer l'un l'autre (couples…) */
  exclusions: [number, number][];
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

// Valeurs reçues, toujours vérifiées en texte (jamais d'objet passé à Prisma)
export function parseSantaInput(body: any, now = new Date()): { data: SantaInput } | { error: string } {
  const title = text(body?.title, 80) ?? 'Secret Santa';
  const budget = text(body?.budget, 40);
  let exchangeDate: Date | null = null;
  if (body?.exchangeDate != null && body.exchangeDate !== '') {
    if (typeof body.exchangeDate !== 'string' || isNaN(new Date(body.exchangeDate).getTime())) return { error: 'Date invalide' };
    exchangeDate = new Date(body.exchangeDate);
    if (exchangeDate.getTime() < now.getTime() - DAY) return { error: 'La date de l’échange est déjà passée' };
    if (exchangeDate.getTime() > now.getTime() + 365 * DAY) return { error: 'Date invalide' };
  }
  if (!Array.isArray(body?.people)) return { error: 'Ajoute les participants' };
  const people: SantaInput['people'] = [];
  for (const p of body.people) {
    const name = text(p?.name, NAME_MAX);
    if (!name) continue;
    const rawEmail = text(p?.email, 200);
    if (rawEmail && !EMAIL_RE.test(rawEmail)) return { error: `Email invalide : ${rawEmail}` };
    people.push({ name, email: rawEmail ? rawEmail.toLowerCase() : null });
  }
  if (people.length < SANTA_MIN) return { error: 'Il faut au moins 3 participants' };
  if (people.length > SANTA_MAX) return { error: 'Au plus 40 participants' };
  const lower = people.map(p => p.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return { error: 'Deux participants ont le même prénom : ajoute une initiale pour les distinguer' };
  const exclusions: [number, number][] = [];
  if (Array.isArray(body?.exclusions)) {
    for (const pair of body.exclusions.slice(0, 40)) {
      const [a, b] = Array.isArray(pair) ? pair.map(Number) : [NaN, NaN];
      if (Number.isInteger(a) && Number.isInteger(b) && a !== b && a >= 0 && b >= 0 && a < people.length && b < people.length) exclusions.push([a, b]);
    }
  }
  return { data: { title, budget, exchangeDate, people, exclusions } };
}

// Effacé 30 jours après l'échange, ou 60 jours après la création s'il n'y a pas de date
export function santaExpiry(exchangeDate: Date | null, now = new Date()): Date {
  return exchangeDate ? new Date(exchangeDate.getTime() + 30 * DAY) : new Date(now.getTime() + 60 * DAY);
}

export async function deleteExpiredOnlineSantas() {
  try {
    await prisma.onlineSanta.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (e) {
    console.error('[santa online cleanup]', e);
  }
}
