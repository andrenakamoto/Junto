// Nom d'un fichier envoyé : multer le lit en latin-1 alors que les navigateurs et les apps l'envoient
// en UTF-8 (« procès-verbal.pdf » devenait « procÃ¨s-verbal.pdf »). On le relit en UTF-8, sauf si ce
// n'est pas de l'UTF-8 valide (nom déjà correct) : il est alors gardé tel quel.
export function fixUploadedFileName(name: string): string {
  if (!/[\u0080-ÿ]/.test(name)) return name;
  const bytes = Buffer.from(name, 'latin1');
  const decoded = bytes.toString('utf8');
  if (decoded.includes('�') || Buffer.from(decoded, 'utf8').length !== bytes.length) return name;
  return decoded.normalize('NFC');
}
