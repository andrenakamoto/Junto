import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { encryptMessage, decryptMessage, isEncrypted, setMessageKeyForTests, withPlainContent } from './messageCrypto';

const KEY = crypto.randomBytes(32).toString('base64');

describe('messageCrypto', () => {
  beforeEach(() => setMessageKeyForTests(KEY));

  it('chiffre puis déchiffre (accents, emoji)', () => {
    const text = 'Rendez-vous à 19h chez Léa 🧀 @marc';
    const stored = encryptMessage(text);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('Léa');
    expect(decryptMessage(stored)).toBe(text);
  });

  it('produit un chiffré différent à chaque fois (IV aléatoire)', () => {
    expect(encryptMessage('salut')).not.toBe(encryptMessage('salut'));
  });

  it('renvoie tel quel un ancien message en clair', () => {
    expect(decryptMessage('ancien message')).toBe('ancien message');
  });

  it('refuse un chiffré modifié ou une mauvaise clé', () => {
    const stored = encryptMessage('secret');
    const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(decryptMessage(tampered)).toBe('[Message illisible]');
    setMessageKeyForTests(crypto.randomBytes(32).toString('base64'));
    expect(decryptMessage(stored)).toBe('[Message illisible]');
  });

  it('sans clé : enregistre en clair, ne lit pas les messages chiffrés', () => {
    const stored = encryptMessage('secret');
    setMessageKeyForTests(undefined);
    expect(encryptMessage('en clair')).toBe('en clair');
    expect(decryptMessage(stored)).toBe('[Message illisible]');
  });

  it('refuse une clé de mauvaise taille', () => {
    expect(() => setMessageKeyForTests(Buffer.alloc(16).toString('base64'))).toThrow();
  });

  it('withPlainContent garde les autres champs', () => {
    const m = { id: 'x', content: encryptMessage('coucou'), author: { pseudo: 'lea' } };
    expect(withPlainContent(m)).toEqual({ id: 'x', content: 'coucou', author: { pseudo: 'lea' } });
  });
});
