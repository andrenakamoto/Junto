import { describe, expect, it } from 'vitest';
import { parseInline, parseRichInput, parseRichText, richTextToHtml, stripFormatting, visibleLength } from './richText';

describe('mise en forme des textes de Plan', () => {
  it('gras et italique', () => {
    expect(parseInline('**Tenue** : _baskets_ propres')).toEqual([
      { text: 'Tenue', bold: true }, { text: ' : ' }, { text: 'baskets', italic: true }, { text: ' propres' },
    ]);
  });
  it('ne touche pas aux pseudos ni aux mots avec « _ »', () => {
    expect(parseInline('Voir @nadia_f et snake_case_mot')).toEqual([{ text: 'Voir @nadia_f et snake_case_mot' }]);
    expect(parseInline('** pas du gras **')).toEqual([{ text: '** pas du gras **' }]);
  });
  it('listes à puces et numérotées', () => {
    const lines = parseRichText('Programme :\n- Accueil\n• Repas\n1. Danse\n2) Spectacle');
    expect(lines.map(l => l.kind)).toEqual(['text', 'bullet', 'bullet', 'number', 'number']);
    expect(lines[4].number).toBe(2);
  });
  it('texte sans repères', () => {
    expect(stripFormatting('**Tenue** : _noire_\n- Pique-nique\n1. Spectacle')).toBe('Tenue : noire\n• Pique-nique\n1. Spectacle');
  });
  it('compte seulement le texte visible', () => {
    expect(visibleLength('**abc**')).toBe(3);
    expect(visibleLength('- un\n- deux')).toBe(7);
    expect(visibleLength('🎉 ok')).toBe(4);
  });
  it('valide la longueur visible', () => {
    expect(parseRichInput('  salut ', 10)).toBe('salut');
    expect(parseRichInput(null, 10)).toBe('');
    expect(parseRichInput('**' + 'x'.repeat(10) + '**', 10)).toBe('**xxxxxxxxxx**');
    expect(parseRichInput('x'.repeat(11), 10)).toBeUndefined();
    expect(parseRichInput(42, 10)).toBeUndefined();
  });
  it('HTML des e-mails, échappé', () => {
    expect(richTextToHtml('**A** <b>\n- x\n- y\nfin')).toBe('<strong>A</strong> &lt;b&gt;<br><ul style="margin:4px 0;padding-left:22px"><li>x</li><li>y</li></ul>fin');
  });
});
