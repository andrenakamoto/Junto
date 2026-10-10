import { describe, expect, it } from 'vitest';
import { mail } from './emailText';
import { notificationFooter } from './mailer';

describe('textes des emails', () => {
  it('échappe les valeurs dans le HTML, pas dans le sujet', () => {
    expect(mail('fr').t('common.hello', { name: '<b>Léa</b>' })).toBe('Salut &lt;b&gt;Léa&lt;/b&gt; 👋');
    expect(mail('en').s('firstJoin.subject', { who: 'Tom & Co', plan: 'Raclette' })).toBe('Tom & Co joined “Raclette”');
  });
  it('choisit le pluriel selon la langue', () => {
    expect(mail('fr').s('digest.subject', { count: 1 })).toBe('Cette semaine sur EvLY — 1 Plan actif');
    expect(mail('fr').s('digest.subject', { count: 0 })).toBe('Cette semaine sur EvLY — 0 Plan actif');
    expect(mail('en').s('digest.subject', { count: 0 })).toBe('This week on EvLY — 0 active Plans');
    expect(mail('de').s('digest.subject', { count: 3 })).toBe('Diese Woche auf EvLY — 3 aktive Pläne');
  });
  it('accepte du HTML déjà construit', () => {
    expect(mail('it').t('recap.why', { menu: { html: '<b>menu</b>' } })).toContain('<b>menu</b>');
  });
  it('traduit le pied de page', () => {
    expect(notificationFooter('simple', 'de')).toContain('Benachrichtigungen');
    expect(notificationFooter('digest', 'en')).toContain('Weekly summary');
  });
});
