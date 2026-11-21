import { describe, expect, it } from 'vitest';
import { taskDocType } from './taskDocs';

describe('taskDocType', () => {
  it('accepte PDF, Word, Excel et photos', () => {
    expect(taskDocType('application/pdf', 'devis.pdf')).toBe('application/pdf');
    expect(taskDocType('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')).toContain('wordprocessingml');
    expect(taskDocType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx')).toContain('spreadsheetml');
    expect(taskDocType('image/jpeg', 'plan.jpg')).toBe('image/jpeg');
  });
  it('se fie à l’extension quand le type est vague', () => {
    expect(taskDocType('application/octet-stream', 'Budget.XLSX')).toContain('spreadsheetml');
    expect(taskDocType('', 'notes.odt')).toBe('application/vnd.oasis.opendocument.text');
  });
  it('refuse le reste', () => {
    expect(taskDocType('text/html', 'page.html')).toBeNull();
    expect(taskDocType('image/svg+xml', 'logo.svg')).toBeNull();
    expect(taskDocType('application/octet-stream', 'setup.exe')).toBeNull();
    expect(taskDocType('application/zip', 'archive.zip')).toBeNull();
  });
});
