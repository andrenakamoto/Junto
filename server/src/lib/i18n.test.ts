import { describe, expect, it } from 'vitest';
import { localeFromHeader, parseLocale, translateMessage } from './i18n';
import { ERRORS_1 } from '../i18n/errors1';
import { ERRORS_2 } from '../i18n/errors2';

describe('langue', () => {
  it('lit Accept-Language', () => {
    expect(localeFromHeader('de-CH,de;q=0.9,en;q=0.8')).toBe('de');
    expect(localeFromHeader('es-ES,it;q=0.5')).toBe('it');
    expect(localeFromHeader('es-ES')).toBeNull();
    expect(parseLocale('EN')).toBe('en');
  });
});

describe('messages d’erreur', () => {
  it('traduit un message exact', () => {
    expect(translateMessage('Plan introuvable', 'de')).toBe('Plan nicht gefunden');
    expect(translateMessage('Plan introuvable', 'fr')).toBe('Plan introuvable');
  });
  it('garde les parties variables', () => {
    expect(translateMessage('Informations importantes : 500 caractères maximum', 'en')).toBe('Important information: 500 characters at most');
    expect(translateMessage('500 caractères maximum', 'it')).toBe('Al massimo 500 caratteri');
    expect(translateMessage('3 personne(s) participent déjà, la limite doit être au moins 3', 'de')).toBe('3 Person(en) nehmen schon teil, die Grenze muss mindestens 3 sein');
    expect(translateMessage('@lea fait déjà partie du Cercle', 'it')).toBe('@lea fa già parte del Cerchio');
  });
  it('laisse un message inconnu en français', () => {
    expect(translateMessage('Message pas encore traduit', 'en')).toBe('Message pas encore traduit');
  });
  it('n’invente pas de variable absente du français', () => {
    for (const [fr, tr] of Object.entries({ ...ERRORS_1, ...ERRORS_2 })) {
      const vars = (s: string) => [...s.matchAll(/\{\d\}/g)].map(m => m[0]).filter((v, i, a) => a.indexOf(v) === i).sort();
      for (const t of tr) for (const v of vars(t)) expect(vars(fr), `${fr} → ${t}`).toContain(v);
    }
  });
});

describe('notifications', () => {
  it('traduit un aperçu et ses morceaux imbriqués', () => {
    expect(translateMessage('@lea a rejoint le Plan', 'de')).toBe('@lea ist dem Plan beigetreten');
    expect(translateMessage('🏆 Le tournoi commence (championnat) : découvre les matchs', 'en')).toBe('🏆 The tournament is starting (league): see the matches');
    expect(translateMessage('🗳️ Cotisation : Adopté — 5 oui, 1 non, 2 abstentions', 'it')).toBe('🗳️ Cotisation: Approvato — 5 sì, 1 no, 2 astensioni');
    expect(translateMessage('🎁 Tu participes à la cagnotte pour Léa ?', 'de')).toBe('🎁 Machst du bei der Geschenkkasse für Léa mit?');
  });
});
