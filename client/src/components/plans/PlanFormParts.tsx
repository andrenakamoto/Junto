import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DateTimeField } from '../ui/DateTimeField';
import { DeletionMode, EditMode, OptionalFeature, PlanFeature } from '../../types';
import { FEATURE_GROUPS } from '../../lib/settings';
import { intlLocale, t } from '../../i18n';

// Morceaux communs aux fenêtres « Créer un Plan » et « Modifier le Plan » : l'essentiel en haut
// (titre, quand, où), le reste rangé dans des lignes « Plus d'options » qui s'ouvrent sur place.

// Durée proposée quand on choisit le début : la fin se remplit toute seule (modifiable)
export const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');
export function localToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}
export function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function addDefaultDuration(local: string): string {
  return isoToLocal(new Date(new Date(localToISO(local)).getTime() + DEFAULT_DURATION_MS).toISOString());
}

// Début et fin du Plan. Sans début, la fin se choisit directement (elle est obligatoire : le Plan
// est supprimé après). Avec un début, la fin s'affiche en petit avec « modifier ».
export function WhenField({ start, end, onStart, onEnd, startLabel, endTouched, onEndTouched }: {
  start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
  startLabel?: string;
  endTouched: boolean; onEndTouched: () => void;
}) {
  const [editEnd, setEditEnd] = useState(false);
  function changeStart(v: string) {
    onStart(v);
    if (v && !endTouched) onEnd(addDefaultDuration(v));
  }
  const endText = end
    ? new Intl.DateTimeFormat(intlLocale(), sameDay(start, end) ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(localToISO(end)))
    : '';
  const showEnd = editEnd || (!!start && !end);
  return (
    <div>
      <DateTimeField label={startLabel ?? t('plan.form.when')} value={start} onChange={changeStart} clearable defaultNow />
      {showEnd ? (
        <div className="mt-2">
          <DateTimeField label={t('plan.form.endDate')} value={end} onChange={v => { onEndTouched(); onEnd(v); }} required openAt={start} defaultTime="23:00" />
          <p className="text-xs text-slate-500 mt-1">{t('plan.form.endDateWarning')}</p>
        </div>
      ) : !start ? (
        <p className="text-xs text-slate-500 mt-1.5">
          {end ? t('plan.form.openUntil', { time: endText }) : t('plan.form.noDateHint')}{' '}
          <button type="button" onClick={() => setEditEnd(true)} className="font-medium text-indigo-600 hover:underline">{end ? t('plan.form.change') : t('plan.form.chooseEnd')}</button>
        </p>
      ) : (
        <p className="text-xs text-slate-500 mt-1.5">
          {t('plan.form.endsAt', { time: endText })}{' '}
          <button type="button" onClick={() => setEditEnd(true)} className="font-medium text-indigo-600 hover:underline">{t('plan.form.change')}</button>
        </p>
      )}
    </div>
  );
}
const sameDay = (a: string, b: string) => !!a && !!b && a.slice(0, 10) === b.slice(0, 10);

// Une ligne de « Plus d'options » : icône, nom, réglage actuel en gris (corail s'il sort de l'ordinaire)
export function OptionRow({ icon, label, summary, modified, children }: {
  icon: React.ReactNode; label: string; summary: string; modified?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-3 py-3 text-left">
        <span className="text-slate-400 flex-shrink-0">{icon}</span>
        <span className="text-sm font-medium text-slate-800 flex-shrink-0">{label}</span>
        <span className={`ml-auto text-xs text-right truncate ${modified ? 'text-indigo-600 font-medium' : 'text-slate-400'}`}>{summary}</span>
        <ChevronRight size={15} className={`text-slate-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-3 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export function OptionsBox({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('plan.form.moreOptions')}</p>
      <div className="rounded-xl border border-slate-200 bg-white">{children}</div>
    </div>
  );
}

// Résumés affichés sur les lignes
export function participantsSummary(max: string, hidden: number, circles = 1): string {
  const parts: string[] = [];
  if (circles > 1) parts.push(t('plan.form.sum.circles', { count: circles }));
  if (max) parts.push(t('plan.form.sum.places', { count: Number(max) }));
  if (hidden > 0) parts.push(t('plan.form.sum.hidden', { count: hidden }));
  return parts.length ? parts.join(' · ') : t('plan.form.sum.everyone');
}

export function featuresSummary(disabled: PlanFeature[], enabled: OptionalFeature[]): string {
  const label = (v: string) => FEATURE_GROUPS.flatMap(g => g.items).find(i => i.value === v)?.label ?? v;
  const parts: string[] = [];
  if (enabled.length) parts.push(`+ ${enabled.map(label).join(', ')}`);
  if (disabled.length) parts.push(t('plan.form.sum.without', { list: disabled.map(label).join(', ') }));
  return parts.length ? `${t('plan.form.sum.standard')} ${parts.join(' · ')}` : t('plan.form.sum.standard');
}

export function rulesAreDefault(editMode: EditMode, importantInfoMode: EditMode, deletionMode: DeletionMode) {
  return editMode === 'creator' && importantInfoMode === 'creator' && deletionMode === 'vote';
}
