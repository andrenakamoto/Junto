import { describe, expect, it } from 'vitest';
import { plainPdfText } from './pdfText';

describe('plainPdfText', () => {
  it('retire les emoji sans toucher aux retours à la ligne', () => {
    expect(plainPdfText('Verrée offerte après la séance 🥂')).toBe('Verrée offerte après la séance');
    expect(plainPdfText('Fête 🎉 de fin\nd’année 👨‍👩‍👧')).toBe('Fête de fin\nd’année');
    expect(plainPdfText('3 000 CHF · 19:30')).toBe('3 000 CHF · 19:30');
    expect(plainPdfText('Date  ')).toBe('Date  ');
  });
});
