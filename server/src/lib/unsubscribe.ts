import jwt from 'jsonwebtoken';
import { APP_URL } from './mailer';

// Désinscription en un clic des emails envoyés régulièrement sans action de la personne (2026-11-24) : le résumé hebdomadaire et
// le résumé du lundi du cockpit d'une Organisation. Chaque email porte un lien signé propre à la personne et au résumé :
// la page /desinscription du site (un bouton, sans connexion) et les en-têtes List-Unsubscribe / List-Unsubscribe-Post
// (RFC 8058) que les messageries affichent en bouton « Se désabonner ». Jeton sans durée (un vieux résumé reste désinscriptible),
// avec un `purpose` : il n'ouvre jamais de session (verifySessionToken refuse tout jeton qui a un purpose).

export type UnsubscribeKind = 'digest' | `cockpit:${string}`;
const PURPOSE = 'unsubscribe';

export function isUnsubscribeKind(k: unknown): k is UnsubscribeKind {
  return k === 'digest' || (typeof k === 'string' && /^cockpit:[A-Za-z0-9_-]{1,64}$/.test(k));
}

export function unsubscribeToken(userId: string, kind: UnsubscribeKind): string {
  return jwt.sign({ purpose: PURPOSE, uid: userId, kind }, process.env.JWT_SECRET!);
}

export function readUnsubscribeToken(token: unknown): { userId: string; kind: UnsubscribeKind } | null {
  if (typeof token !== 'string' || token.length > 600) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as { purpose?: string; uid?: unknown; kind?: unknown };
    if (p.purpose !== PURPOSE || typeof p.uid !== 'string' || !isUnsubscribeKind(p.kind)) return null;
    return { userId: p.uid, kind: p.kind };
  } catch {
    return null;
  }
}

// Adresse publique de l'API (pour le bouton « Se désabonner » des messageries, qui envoie un POST sans passer par le site)
export const API_PUBLIC_URL = process.env.API_PUBLIC_URL
  || (/evly\.ch/.test(APP_URL) ? 'https://api.evly.ch' : `http://localhost:${process.env.PORT || 3001}`);

export function unsubscribeLinks(userId: string, kind: UnsubscribeKind) {
  const t = encodeURIComponent(unsubscribeToken(userId, kind));
  const page = `${APP_URL}/desinscription?t=${t}`;
  const oneClick = `${API_PUBLIC_URL}/api/unsubscribe?t=${t}`;
  return {
    page,
    headers: {
      'List-Unsubscribe': `<${oneClick}>, <mailto:info@evly.ch?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
