import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Connexion avec Apple (2026-11-14) : vérification du jeton d'identité envoyé par l'app iPhone, échange du code
// d'autorisation contre un jeton de rafraîchissement (gardé chiffré, sert seulement à révoquer l'accès quand le compte
// est supprimé, exigence d'Apple), révocation.
// Variables (/etc/evly/app.env) : APPLE_CLIENT_ID (ch.evly.app), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_B64
// (fichier .p8 de la clé « Sign in with Apple », encodé en base64). Sans clé, la connexion marche quand même, sans révocation.

const ISSUER = 'https://appleid.apple.com';
export const appleClientId = () => process.env.APPLE_CLIENT_ID || 'ch.evly.app';

interface Jwk { kid: string; kty: string; alg: string; use: string; n: string; e: string }
let keys: { list: Jwk[]; at: number } | null = null;

async function appleKeys(force = false): Promise<Jwk[]> {
  if (!force && keys && Date.now() - keys.at < 3600_000) return keys.list;
  const res = await fetch(`${ISSUER}/auth/keys`);
  if (!res.ok) throw new Error(`clés Apple : ${res.status}`);
  const data = await res.json() as { keys: Jwk[] };
  keys = { list: data.keys, at: Date.now() };
  return data.keys;
}

export interface AppleIdentity { sub: string; email: string | null; emailVerified: boolean; privateEmail: boolean }

// Vérifie signature, émetteur, destinataire (l'app) et expiration du jeton d'identité
export async function verifyAppleIdToken(idToken: string): Promise<AppleIdentity> {
  const header = jwt.decode(idToken, { complete: true })?.header;
  if (!header?.kid) throw new Error('jeton Apple illisible');
  let jwk = (await appleKeys()).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await appleKeys(true)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('clé Apple inconnue');
  const key = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
  const p = jwt.verify(idToken, key, { algorithms: ['RS256'], issuer: ISSUER, audience: appleClientId() }) as Record<string, unknown>;
  if (typeof p.sub !== 'string' || !p.sub) throw new Error('jeton Apple sans identifiant');
  const bool = (v: unknown) => v === true || v === 'true';
  return {
    sub: p.sub,
    email: typeof p.email === 'string' ? p.email.toLowerCase() : null,
    emailVerified: bool(p.email_verified),
    privateEmail: bool(p.is_private_email),
  };
}

function privateKey(): string | null {
  const b64 = process.env.APPLE_PRIVATE_KEY_B64;
  if (!b64 || !process.env.APPLE_KEY_ID || !process.env.APPLE_TEAM_ID) return null;
  return Buffer.from(b64, 'base64').toString('utf8');
}

export const appleRevocationReady = () => privateKey() !== null;

// « client_secret » demandé par Apple : un jeton signé avec la clé .p8, valable 5 minutes
function clientSecret(): string | null {
  const key = privateKey();
  if (!key) return null;
  return jwt.sign({}, key, {
    algorithm: 'ES256', keyid: process.env.APPLE_KEY_ID, issuer: process.env.APPLE_TEAM_ID,
    audience: ISSUER, subject: appleClientId(), expiresIn: '5m',
  });
}

async function applePost(path: string, form: Record<string, string>) {
  return fetch(`${ISSUER}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
}

// Code d'autorisation (une seule utilisation, 5 minutes) → jeton de rafraîchissement, ou null
export async function exchangeAppleCode(code: string): Promise<string | null> {
  const secret = clientSecret();
  if (!secret) return null;
  const res = await applePost('/auth/token', { client_id: appleClientId(), client_secret: secret, code, grant_type: 'authorization_code' });
  if (!res.ok) { console.error('[apple] échange du code', res.status, (await res.text()).slice(0, 200)); return null; }
  const data = await res.json() as { refresh_token?: string };
  return data.refresh_token ?? null;
}

// Révoque l'accès d'EvLY au compte Apple (suppression du compte EvLY)
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  const secret = clientSecret();
  if (!secret) return false;
  const res = await applePost('/auth/revoke', { client_id: appleClientId(), client_secret: secret, token: refreshToken, token_type_hint: 'refresh_token' });
  if (!res.ok) console.error('[apple] révocation', res.status);
  return res.ok;
}
