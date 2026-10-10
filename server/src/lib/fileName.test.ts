import { describe, expect, it } from 'vitest';
import { fixUploadedFileName } from './fileName';

describe('nom des fichiers envoyés', () => {
  it('répare les accents lus en latin-1', () => {
    expect(fixUploadedFileName(Buffer.from('AG - procès-verbal.pdf', 'utf8').toString('latin1'))).toBe('AG - procès-verbal.pdf');
    expect(fixUploadedFileName(Buffer.from('Übersicht Größe.docx', 'utf8').toString('latin1'))).toBe('Übersicht Größe.docx');
    expect(fixUploadedFileName(Buffer.from('photo 🎉.jpg', 'utf8').toString('latin1'))).toBe('photo 🎉.jpg');
  });
  it('laisse un nom déjà correct', () => {
    expect(fixUploadedFileName('rapport.pdf')).toBe('rapport.pdf');
    expect(fixUploadedFileName('café.pdf')).toBe('café.pdf');
  });
});
