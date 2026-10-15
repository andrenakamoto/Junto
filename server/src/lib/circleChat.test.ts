import { describe, expect, it } from 'vitest';
import { canWriteChat, chatPreview, mentionedIn } from './circleChat';

describe('discussion du Cercle', () => {
  it('qui peut écrire selon le mode', () => {
    expect(canWriteChat('open', false)).toBe(true);
    expect(canWriteChat('announce', false)).toBe(false);
    expect(canWriteChat('announce', true)).toBe(true);
    expect(canWriteChat('off', true)).toBe(false);
  });
  it('mentions : pseudos des membres, sans l’auteur, insensible à la casse', () => {
    const members = [{ userId: 'a', pseudo: 'alex' }, { userId: 'l', pseudo: 'lea_m' }, { userId: 't', pseudo: 'tom' }];
    expect(mentionedIn('Salut @Lea_M et @tom !', members, 'a')).toEqual(['l', 't']);
    expect(mentionedIn('@alex tu viens ?', members, 'a')).toEqual([]);
    expect(mentionedIn('@tommy', members, 'a')).toEqual([]);
  });
  it('aperçu du dernier message', () => {
    expect(chatPreview({ content: '  Qui vient\nsamedi ?  ', imageKey: null, deletedAt: null })).toBe('Qui vient samedi ?');
    expect(chatPreview({ content: '', imageKey: 'k', deletedAt: null })).toBe('📷 Photo');
    expect(chatPreview({ content: 'x', imageKey: null, deletedAt: new Date() })).toBe('');
  });
});
