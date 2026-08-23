export function icsEscape(s: string): string {
  return s.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
}

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
