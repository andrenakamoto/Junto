// Documents de la rubrique Tâches : PDF, Word, Excel, PowerPoint, LibreOffice, texte et photos, rangés à part
// (Attachment.section = 'taches', masqués de l'onglet Infos), éventuellement dans un lot (Attachment.taskGroupId).

export const TASK_DOCS_SECTION = 'taches';
export const TASK_DOC_MAX_BYTES = 20 * 1024 * 1024; // 20 Mo par document (dans les 200 Mo du Plan)
export const OTHER_FILE_MAX_BYTES = 10 * 1024 * 1024; // les autres fichiers du Plan restent à 10 Mo
export const MAX_TASK_DOCS = 100;

const DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/rtf',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Certains téléphones et navigateurs envoient « application/octet-stream » : l'extension décide alors
const EXT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Type MIME retenu pour un document des Tâches, ou null s'il n'est pas accepté. */
export function taskDocType(mimeType: string, fileName: string): string | null {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (DOC_TYPES.has(mime)) return mime;
  // Type vague ou inconnu : seulement si l'extension est l'une des nôtres
  return EXT_TYPES[ext] ?? null;
}
