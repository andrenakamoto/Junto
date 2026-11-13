import { useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { t } from '../../i18n';

// Accompagnants (2026-11-13) : nombre de personnes qui viennent avec une réponse, la personne comprise (1 par défaut).
// Petit compteur − n + ; max = 1 + accompagnants permis par le Plan (Plan.companionsMax, serveur : lib/party.ts).
export function PartyStepper({ value, max, onChange, busy, compact, dark }: {
  value: number; max: number; onChange: (n: number) => void; busy?: boolean; compact?: boolean;
  /** Pages sombres (invitation sans compte) */
  dark?: boolean;
}) {
  const btn = dark
    ? 'w-8 h-8 flex items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-200 hover:border-indigo-400 disabled:opacity-30'
    : 'w-7 h-7 flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-slate-300 disabled:hover:text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1.5 flex-shrink-0 ${busy ? 'opacity-60' : ''}`} onClick={e => e.stopPropagation()}>
      {!compact && <Users size={14} className="text-slate-400" />}
      <button type="button" className={btn} disabled={busy || value <= 1} onClick={() => onChange(value - 1)} aria-label={t('plan.party.less')}><Minus size={13} /></button>
      <span className={`min-w-[1.5rem] text-center text-sm font-semibold tabular-nums ${dark ? 'text-white' : 'text-slate-800'}`} aria-live="polite">{value}</span>
      <button type="button" className={btn} disabled={busy || value >= max} onClick={() => onChange(value + 1)} aria-label={t('plan.party.more')}><Plus size={13} /></button>
    </span>
  );
}

// Réglage du créateur : accompagnants autorisés (jusqu'à N par personne) ou désactivés
export function CompanionsField({ value, onChange, readOnly }: { value: number; onChange: (n: number) => void; readOnly?: boolean }) {
  const on = value > 0;
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${on ? 'border-slate-200' : 'border-indigo-300 bg-indigo-50'}`}>
      <label className={`flex items-start gap-2.5 ${readOnly ? '' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={on} disabled={readOnly} onChange={e => onChange(e.target.checked ? 5 : 0)} className="mt-0.5 accent-indigo-600" />
        <Users size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm text-slate-800">{t('plan.party.field')} : {on ? t('plan.party.allowed') : t('plan.party.off')}</span>
          <span className="block text-xs text-slate-500">{t('plan.party.fieldHint')}</span>
        </span>
      </label>
      {on && (
        <div className="flex items-center gap-2 mt-2 ml-7 text-sm text-slate-700">
          <span>{t('plan.party.upTo')}</span>
          <PartyStepper value={value} max={20} onChange={n => onChange(Math.max(1, n))} compact busy={readOnly} />
          <span className="text-slate-500">{t('plan.party.perAnswer')}</span>
        </div>
      )}
    </div>
  );
}

// Mode annonce et invitation sans compte : rien n'est demandé. Un petit lien « Vous venez à plusieurs ? » ouvre le
// compteur ; il reste ouvert si plus d'une personne est déjà indiquée.
export function PartyReveal({ value, max, onChange, busy, dark, error }: {
  value: number; max: number; onChange: (n: number) => void; busy?: boolean; dark?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(value > 1);
  if (!open && value <= 1) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}>
        <Plus size={13} />{t('plan.party.several')}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className={`text-sm ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{t('plan.party.question')} <span className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-400'}`}>({t('plan.party.hint')})</span></span>
      <PartyStepper dark={dark} value={value} max={max} busy={busy} onChange={onChange} />
      {error && <span className="basis-full text-xs text-red-500">{error}</span>}
    </div>
  );
}
