import { escapeHtml } from './escapeHtml';

// Mise en forme simple de la description et des informations importantes d'un Plan (miroir de
// client/src/lib/richText.tsx) : le texte reste du texte, avec des repères discrets posés par les
// boutons de l'app — **gras**, _italique_, ++souligné++, lignes « - élément » (puces) et « 1. élément » (numérotées).
// Aucun HTML n'est stocké ; chaque sortie (app, e-mail, PDF, texte brut) les interprète elle-même.

export const DESCRIPTION_MAX = 500;
export const IMPORTANT_INFO_MAX = 5000;
// Plafond du texte enregistré, repères compris (sécurité : les limites ci-dessus comptent le texte visible)
export const RAW_FACTOR = 2;

export type Inline = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Line = { kind: 'text' | 'bullet' | 'number'; number?: number; parts: Inline[] };

const BULLET = /^\s*[-•]\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;
// _italique_ : le « _ » ouvrant n'est pas collé à une lettre avant (sinon @nadia_f serait touché),
// le fermant pas collé à une lettre après
const INLINE = /\*\*(?=\S)([^\n]*?\S)\*\*|\+\+(?=\S)([^\n]*?\S)\+\+|(?<![\p{L}\p{N}_])_(?=\S)([^\n_]*?\S)_(?![\p{L}\p{N}_])/gu;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      // Italique ou souligné à l'intérieur du gras
      for (const p of parseInline(m[1])) out.push({ ...p, bold: true });
    } else if (m[2] !== undefined) {
      for (const p of parseInline(m[2])) out.push({ ...p, underline: true });
    } else {
      out.push({ text: m[3], italic: true });
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseRichText(text: string): Line[] {
  return text.split('\n').map(raw => {
    const b = raw.match(BULLET);
    if (b) return { kind: 'bullet', parts: parseInline(b[1]) };
    const n = raw.match(NUMBER);
    if (n) return { kind: 'number', number: Number(n[1]), parts: parseInline(n[2]) };
    return { kind: 'text', parts: parseInline(raw) };
  });
}

const plainLine = (l: Line) => {
  const text = l.parts.map(p => p.text).join('');
  return l.kind === 'bullet' ? `• ${text}` : l.kind === 'number' ? `${l.number}. ${text}` : text;
};

// Texte sans repères (notifications, « En bref », fichier agenda…) ; les puces deviennent « • »
export function stripFormatting(text: string): string {
  return parseRichText(text).map(plainLine).join('\n');
}

// Nombre de caractères visibles : sans les repères de mise en forme ni les marques de liste
export function visibleLength(text: string): number {
  return parseRichText(text).reduce((n, l, i) => n + (i ? 1 : 0) + l.parts.reduce((k, p) => k + [...p.text].length, 0), 0);
}

// Validation d'un texte mis en forme : vide → '' ; undefined si trop long
export function parseRichInput(v: unknown, max: number): string | undefined {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return undefined;
  const text = v.trim();
  if (visibleLength(text) > max || text.length > max * RAW_FACTOR) return undefined;
  return text;
}

// HTML pour les e-mails (texte échappé, puis gras, italique et listes)
export function richTextToHtml(text: string): string {
  const inline = (parts: Inline[]) => parts.map(p => {
    let h = escapeHtml(p.text);
    if (p.italic) h = `<em>${h}</em>`;
    if (p.underline) h = `<u>${h}</u>`;
    if (p.bold) h = `<strong>${h}</strong>`;
    return h;
  }).join('');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const l of parseRichText(text)) {
    const want = l.kind === 'bullet' ? 'ul' : l.kind === 'number' ? 'ol' : null;
    if (want !== list) { close(); if (want) { out.push(`<${want} style="margin:4px 0;padding-left:22px">`); list = want; } }
    if (want) out.push(`<li>${inline(l.parts)}</li>`);
    else out.push(l.parts.length ? `${inline(l.parts)}<br>` : '<br>');
  }
  close();
  return out.join('').replace(/(<br>)+$/, '');
}
