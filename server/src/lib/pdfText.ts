import { parseRichText } from './richText';

// Polices des PDF (Inter, Fraunces) sans emoji : un emoji s'afficherait en carré vide. Retirés de tout texte écrit dans le
// document (titres, descriptions, tâches, dépenses…), sans toucher aux retours à la ligne ni aux autres espaces.
export function plainPdfText(text: string): string {
  // L'espace devant l'emoji part avec lui ; les autres espaces (« Date  » devant sa valeur) restent
  return text.replace(/[ \t]*[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '');
}

export function stripEmojiFromPdf<T extends { text: (...args: any[]) => any }>(doc: T): T {
  const write = doc.text.bind(doc);
  doc.text = ((text: unknown, ...rest: unknown[]) => write(typeof text === 'string' ? plainPdfText(text) : text, ...rest)) as T['text'];
  return doc;
}

// Texte mis en forme (lib/richText.ts) dans un PDF : gras, souligné et listes ; l'italique reste droit (pas de police
// italique d'Inter). Polices « regular » et « semibold » enregistrées par le document.
export function writeRichText(doc: PDFKit.PDFDocument, text: string, opts: { color: string; x: number; width: number; size?: number }) {
  const size = opts.size ?? 10;
  for (const line of parseRichText(text)) {
    const prefix = line.kind === 'bullet' ? '•  ' : line.kind === 'number' ? `${line.number}.  ` : '';
    const parts = [{ text: prefix, bold: false, underline: false }, ...line.parts].filter(p => p.text);
    doc.x = opts.x;
    if (parts.length === 0) { doc.font('regular').fontSize(size).moveDown(0.6); continue; }
    parts.forEach((p, i) => doc.font(p.bold ? 'semibold' : 'regular').fontSize(size).fillColor(opts.color)
      .text(p.text, { width: opts.width, lineGap: 1.5, underline: !!p.underline, continued: i < parts.length - 1 }));
  }
}
