import { describe, expect, it } from 'vitest';
import { cleanFirstName, lightPseudoBase } from './lightGuest';
import { validatePseudo } from './pseudo';
import { wrapTitle } from './shareImage';
import { injectMeta, shareDate } from '../routes/share';

describe('réponse sans compte', () => {
  it('pseudo « prenom.invite », impossible à choisir pour un vrai compte', () => {
    expect(lightPseudoBase('Julie-Anne')).toBe('julieanne.invite');
    expect(lightPseudoBase('Zoé')).toBe('zoe.invite');
    expect(lightPseudoBase('李')).toBe('invite.invite');
    expect(validatePseudo('julie.invite')).not.toBeNull();
  });

  it('prénom nettoyé, 30 caractères au plus', () => {
    expect(cleanFirstName('  Julie   Anne ')).toBe('Julie Anne');
    expect(cleanFirstName('')).toBeNull();
    expect(cleanFirstName('x'.repeat(31))).toBeNull();
    expect(cleanFirstName(42)).toBeNull();
  });
});

describe('aperçu des invitations', () => {
  it('date à l’heure suisse', () => {
    expect(shareDate(new Date('2026-10-03T17:00:00Z'))).toBe('Samedi 3 octobre · 19:00');
    expect(shareDate(null)).toBeNull();
  });

  it('titre sur deux lignes au plus', () => {
    expect(wrapTitle('Raclette chez Tom', 27)).toEqual(['Raclette chez Tom']);
    const lines = wrapTitle('Week-end ski à Verbier avec toute la bande des anciens du lycée', 27);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('remplace les balises du site, sans lieu ni description du Plan, et sans indexation', () => {
    const html = '<html><head><title>EvLY</title><meta name="description" content="x" /><meta property="og:title" content="EvLY" /></head><body></body></html>';
    const out = injectMeta(html, { title: 'Raclette <chez> Tom', date: 'Samedi 3 octobre · 19:00', participants: 4, creatorName: 'Julie' }, 'abcdefghijkl');
    expect(out).toContain('<title>Raclette &lt;chez&gt; Tom — invitation EvLY</title>');
    expect(out).toContain('content="Samedi 3 octobre · 19:00 · 4 participants — Réponds en un clic, sans créer de compte."');
    expect(out).toContain('/apercu/abcdefghijkl.png?v=');
    expect(out).toContain('noindex');
    expect(out.match(/og:title/g)).toHaveLength(1);
    expect(injectMeta(html, null, 'zzz')).toContain('og-evly.png');
  });
});
