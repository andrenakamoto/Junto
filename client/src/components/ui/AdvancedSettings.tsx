import { useState } from 'react';
import { SantaDatesNote } from '../plans/SantaDatesNote';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AdmissionMode, DeletionMode, EditMode, OptionalFeature, PlanCreationMode, PlanFeature } from '../../types';
import { ADMISSION_OPTIONS, DELETION_OPTIONS, EDIT_OPTIONS, IMPORTANT_INFO_OPTIONS, PLAN_CREATION_OPTIONS, PLAN_FEATURES, POLL_CREATION_OPTIONS, OPTIONAL_FEATURES } from '../../lib/settings';

// Section repliable « Paramètres avancés » (associations, entreprises…).
// `readOnly` : affichage pour les membres qui ne sont pas le créateur.

export function AdvancedSection({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700"
      >
        <SlidersHorizontal size={15} className="text-slate-400" />
        Paramètres avancés
        <ChevronDown size={15} className={`ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 space-y-4 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
}

function Choice<T extends string>({ label, options, value, onChange, readOnly }: {
  label: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
  readOnly?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</legend>
      <div className="space-y-1.5">
        {options.map(o => (
          <label
            key={o.value}
            className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
              value === o.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
            } ${readOnly ? (value === o.value ? '' : 'opacity-50') : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              disabled={readOnly}
              className="mt-0.5 accent-indigo-600"
            />
            <span>
              <span className="block text-sm text-slate-800">{o.label}</span>
              <span className="block text-xs text-slate-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DeletionModeField(props: { value: DeletionMode; onChange: (v: DeletionMode) => void; readOnly?: boolean; subject: 'Cercle' | 'Plan' }) {
  return <Choice label={`Suppression du ${props.subject}`} options={DELETION_OPTIONS} {...props} />;
}

export function EditModeField(props: { value: EditMode; onChange: (v: EditMode) => void; readOnly?: boolean }) {
  return <Choice label="Modification des dates et du lieu" options={EDIT_OPTIONS} {...props} />;
}

export function ImportantInfoModeField(props: { value: EditMode; onChange: (v: EditMode) => void; readOnly?: boolean }) {
  return <Choice label="Modification des informations importantes" options={IMPORTANT_INFO_OPTIONS} {...props} />;
}

export function PlanCreationModeField(props: { value: PlanCreationMode; onChange: (v: PlanCreationMode) => void; readOnly?: boolean }) {
  return <Choice label="Création des Plans" options={PLAN_CREATION_OPTIONS} {...props} />;
}

export function PollCreationModeField(props: { value: PlanCreationMode; onChange: (v: PlanCreationMode) => void; readOnly?: boolean }) {
  return <Choice label="Création des sondages de dates" options={POLL_CREATION_OPTIONS} {...props} />;
}

export function AdmissionModeField(props: { value: AdmissionMode; onChange: (v: AdmissionMode) => void; readOnly?: boolean }) {
  return <Choice label="Admission des nouveaux membres" options={ADMISSION_OPTIONS} {...props} />;
}

export function FeaturesField({ disabled, onChange, enabled = [], onEnabledChange, readOnly }: {
  disabled: PlanFeature[];
  onChange: (v: PlanFeature[]) => void;
  /** Fonctions à activer (planning des bénévoles), décochées par défaut */
  enabled?: OptionalFeature[];
  onEnabledChange?: (v: OptionalFeature[]) => void;
  readOnly?: boolean;
}) {
  function toggle(f: PlanFeature) {
    onChange(disabled.includes(f) ? disabled.filter(x => x !== f) : [...disabled, f]);
  }
  function toggleOptional(f: OptionalFeature) {
    onEnabledChange?.(enabled.includes(f) ? enabled.filter(x => x !== f) : [...enabled, f]);
  }
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fonctions du Plan</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {PLAN_FEATURES.map(f => (
          <label key={f.value} className={`flex items-center gap-2 text-sm text-slate-700 ${readOnly ? '' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={!disabled.includes(f.value)}
              onChange={() => toggle(f.value)}
              disabled={readOnly}
              className="accent-indigo-600"
            />
            {f.label}
          </label>
        ))}
        {OPTIONAL_FEATURES.map(f => (
          <label key={f.value} className={`flex items-center gap-2 text-sm text-slate-700 ${readOnly ? '' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={enabled.includes(f.value)}
              onChange={() => toggleOptional(f.value)}
              disabled={readOnly || !onEnabledChange}
              className="accent-indigo-600"
            />
            {f.label}
          </label>
        ))}
      </div>
      {!readOnly && enabled.includes('pere_noel') && <div className="mt-2"><SantaDatesNote compact /></div>}
      <p className="text-xs text-slate-400 mt-1.5">
        Infos et Membres restent toujours actifs. Une fonction décochée est masquée, ses données sont conservées. Bénévoles : des postes à pourvoir, chacun s’y inscrit (associations, fêtes, tournois…). Père Noël secret : tirage au sort des cadeaux ; la date du Plan est alors le jour de l’échange.
      </p>
    </fieldset>
  );
}
