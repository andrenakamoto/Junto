import { describe, expect, it } from 'vitest';
import { mergeIdeas, moveInList, parseColumnTitle, parseIdeaText } from './ideas';

describe('idées', () => {
  it('valide le texte et le thème', () => {
    expect(parseIdeaText('  Karaoké ')).toBe('Karaoké');
    expect(parseIdeaText('')).toHaveProperty('error');
    expect(parseIdeaText({ not: '' })).toHaveProperty('error');
    expect(parseIdeaText('x'.repeat(301))).toHaveProperty('error');
    expect(parseColumnTitle(' Animation ')).toBe('Animation');
  });
  it('fusion : textes réunis, votes additionnés, statut le plus avancé', () => {
    expect(mergeIdeas({ text: 'Karaoké', votes: 3, status: 'new' }, { text: 'Blind test', votes: 2, status: 'kept' }))
      .toEqual({ text: 'Karaoké / Blind test', votes: 5, status: 'kept' });
    expect(mergeIdeas({ text: 'Soirée karaoké', votes: 1, status: 'explore' }, { text: 'karaoke', votes: 0, status: 'dropped' }))
      .toEqual({ text: 'Soirée karaoké', votes: 1, status: 'explore' });
  });
  it('déplace un thème d’un cran', () => {
    expect(moveInList(['a', 'b', 'c'], 'c', 'left')).toEqual(['a', 'c', 'b']);
    expect(moveInList(['a', 'b'], 'a', 'left')).toEqual(['a', 'b']);
  });
});
