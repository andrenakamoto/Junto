import crypto from 'crypto';

// Chiffrement des messages en base (chat des Plans et des sondages de dates).
// AES-256-GCM, clé dans MESSAGE_ENCRYPTION_KEY (32 octets en base64), gardée
// sur Railway, jamais dans la base. Protège une copie ou une fuite de la base ;
// ne protège pas contre quelqu'un qui contrôle le serveur (pas de bout en bout).
//
// Format stocké : "enc1:" + base64(iv 12 octets | tag 16 octets | texte chiffré).
// Un contenu sans ce préfixe est un ancien message en clair : il est renvoyé tel
// quel (voir encryptLegacyMessages, qui les chiffre au démarrage).
//
// Sans clé (cas du serveur local), les nouveaux messages restent en clair et
// les messages chiffrés s'affichent comme illisibles.

const PREFIX = 'enc1:';
const UNREADABLE = '[Message illisible]';

function loadKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('MESSAGE_ENCRYPTION_KEY doit faire 32 octets encodés en base64');
  return key;
}

let key = loadKey(process.env.MESSAGE_ENCRYPTION_KEY);
if (!key) console.warn('[messageCrypto] MESSAGE_ENCRYPTION_KEY absente : les messages sont enregistrés en clair');

// Pour les tests uniquement
export function setMessageKeyForTests(raw: string | undefined) {
  key = loadKey(raw);
}

export function hasMessageKey(): boolean {
  return key !== null;
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function encryptMessage(plain: string): string {
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decryptMessage(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  if (!key) return UNREADABLE;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return UNREADABLE;
  }
}

// Déchiffre le champ content d'un message (ou d'une liste) avant envoi au client
export function withPlainContent<T extends { content: string }>(message: T): T {
  return { ...message, content: decryptMessage(message.content) };
}
