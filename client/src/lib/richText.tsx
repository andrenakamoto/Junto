import { Fragment, ReactNode, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { renderContent } from '../components/chat/ChatMessage';
import { t } from '../i18n';

// Mise en forme simple de la description et des informations importantes d'un Plan (miroir de
// server/src/lib/richText.ts) : **gras**, _italique_, ++souligné++, lignes « - élément » et « 1. élément ».
// Le texte reste du texte : les boutons posent ces repères, l'affichage les interprète.

export const DESCRIPTION_MAX = 500;
export const IMPORTANT_INFO_MAX = 5000;

type Inline = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
type Line = { kind: 'text' | 'bullet' | 'number'; number?: number; parts: Inline[] };

const BULLET = /^\s*[-•]\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const INLINE = /\*\*(?=\S)([^\n]*?\S)\*\*|\+\+(?=\S)([^\n]*?\S)\+\+|(?<![\p{L}\p{N}_])_(?=\S)([^\n_]*?\S)_(?![\p{L}\p{N}_])/gu;

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) for (const p of parseInline(m[1])) out.push({ ...p, bold: true });
    else if (m[2] !== undefined) for (const p of parseInline(m[2])) out.push({ ...p, underline: true });
    else out.push({ text: m[3], italic: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function parseRichText(text: string): Line[] {
  return text.split('\n').map(raw => {
    const b = raw.match(BULLET);
    if (b) return { kind: 'bullet', parts: parseInline(b[1]) };
    const n = raw.match(NUMBER);
    if (n) return { kind: 'number', number: Number(n[1]), parts: parseInline(n[2]) };
    return { kind: 'text', parts: parseInline(raw) };
  });
}

// Texte sans repères (aperçus sur les cartes, « Copier le résumé », agenda) ; les puces deviennent « • »
export function stripFormatting(text: string): string {
  return parseRichText(text).map(l => {
    const s = l.parts.map(p => p.text).join('');
    return l.kind === 'bullet' ? `• ${s}` : l.kind === 'number' ? `${l.number}. ${s}` : s;
  }).join('\n');
}

// Caractères visibles (les repères de mise en forme ne comptent pas), comme le serveur
export function visibleLength(text: string): number {
  return parseRichText(text.trim()).reduce((n, l, i) => n + (i ? 1 : 0) + l.parts.reduce((k, p) => k + [...p.text].length, 0), 0);
}

function inline(parts: Inline[], key: string) {
  return parts.map((p, i) => {
    let node: ReactNode = renderContent(p.text, false);
    if (p.italic) node = <em>{node}</em>;
    if (p.underline) node = <u className="underline-offset-2">{node}</u>;
    if (p.bold) node = <strong className="font-semibold">{node}</strong>;
    return <Fragment key={`${key}-${i}`}>{node}</Fragment>;
  });
}

// Affichage mis en forme : paragraphes, listes à puces / numérotées, liens cliquables
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = parseRichText(text);
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (l.kind === 'text') {
      blocks.push(l.parts.length ? <p key={i}>{inline(l.parts, String(i))}</p> : <div key={i} className="h-2" />);
      i++;
      continue;
    }
    const kind = l.kind;
    const items: Line[] = [];
    while (i < lines.length && lines[i].kind === kind) items.push(lines[i++]);
    const li = items.map((it, j) => <li key={j}>{inline(it.parts, `${i}-${j}`)}</li>);
    blocks.push(kind === 'bullet'
      ? <ul key={i} className="list-disc pl-5 space-y-0.5">{li}</ul>
      : <ol key={i} start={items[0].number} className="list-decimal pl-5 space-y-0.5">{li}</ol>);
  }
  return <div className={`break-words space-y-1 ${className}`}>{blocks}</div>;
}

// Champ de saisie avec la barre de mise en forme (gras, italique, listes) et le compteur de caractères visibles
export function RichTextArea({ value, onChange, max, rows = 3, placeholder, autoFocus, className = '' }: {
  value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string; autoFocus?: boolean; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const count = visibleLength(value);

  // Remplace la sélection et la garde sélectionnée (le clavier reste ouvert sur téléphone)
  function apply(next: string, selStart: number, selEnd: number) {
    onChange(next);
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(selStart, selEnd); } });
  }

  function wrap(mark: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b);
    // Déjà entouré : on retire les repères
    if (value.slice(a - mark.length, a) === mark && value.slice(b, b + mark.length) === mark) {
      apply(value.slice(0, a - mark.length) + sel + value.slice(b + mark.length), a - mark.length, b - mark.length);
      return;
    }
    // Espaces de la sélection gardés à l'extérieur des repères (« **mot** » et non « ** mot** »)
    const lead = sel.match(/^\s*/)![0], trail = sel.match(/\s*$/)![0];
    const core = sel.trim() || t('plan.format.sample');
    const insert = `${lead}${mark}${core}${mark}${trail}`;
    const start = a + lead.length + mark.length;
    apply(value.slice(0, a) + insert + value.slice(b), start, start + core.length);
  }

  function list(numbered: boolean) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const from = value.lastIndexOf('\n', a - 1) + 1;
    const toNl = value.indexOf('\n', b);
    const to = toNl === -1 ? value.length : toNl;
    const lines = value.slice(from, to).split('\n');
    const marked = numbered ? NUMBER : BULLET;
    const allMarked = lines.every(l => marked.test(l));
    const out = lines.map((l, i) => {
      const bare = l.replace(BULLET, '$1').replace(NUMBER, '$2');
      return allMarked ? bare : `${numbered ? `${i + 1}.` : '-'} ${bare}`;
    }).join('\n');
    apply(value.slice(0, from) + out + value.slice(to), from, from + out.length);
  }

  const btn = 'p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100';
  return (
    <div className={`rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500 ${className}`}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-200">
        {/* onMouseDown : garder la sélection du champ au clic */}
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => wrap('**')} title={t('plan.format.bold')} aria-label={t('plan.format.bold')} className={btn}><Bold size={15} /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => wrap('_')} title={t('plan.format.italic')} aria-label={t('plan.format.italic')} className={btn}><Italic size={15} /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => wrap('++')} title={t('plan.format.underline')} aria-label={t('plan.format.underline')} className={btn}><Underline size={15} /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => list(false)} title={t('plan.format.bullets')} aria-label={t('plan.format.bullets')} className={btn}><List size={15} /></button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => list(true)} title={t('plan.format.numbers')} aria-label={t('plan.format.numbers')} className={btn}><ListOrdered size={15} /></button>
        <span className={`ml-auto text-xs tabular-nums ${count > max ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{count}/{max}</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="block w-full px-3 py-2 rounded-b-lg text-sm text-slate-900 bg-transparent resize-y focus:outline-none"
      />
    </div>
  );
}
