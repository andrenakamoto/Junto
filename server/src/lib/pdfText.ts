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
