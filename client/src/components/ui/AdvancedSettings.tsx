import { useState } from 'react';
import { SantaDatesNote } from '../plans/SantaDatesNote';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AdmissionMode, DeletionMode, EditMode, OptionalFeature, PlanCreationMode, PlanFeature } from '../../types';
import { ADMISSION_OPTIONS, DELETION_OPTIONS, EDIT_OPTIONS, IMPORTANT_INFO_OPTIONS, PLAN_CREATION_OPTIONS, POLL_CREATION_OPTIONS, FEATURE_GROUPS, FeatureItem } from '../../lib/settings';

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
  /** Fonctions à activer (bénévoles, jeux, cagnotte…), décochées par défaut */
  enabled?: OptionalFeature[];
  onEnabledChange?: (v: OptionalFeature[]) => void;
  readOnly?: boolean;
}) {
  const isOn = (f: FeatureItem) => (f.kind === 'base' ? !disabled.includes(f.value) : enabled.includes(f.value));
  // Catégories repliables (fêtes, jeux) : ouvertes d'office si une de leurs fonctions est cochée
  const [open, setOpen] = useState<Set<string>>(() => new Set(FEATURE_GROUPS.filter(g => !g.collapsible || g.items.some(isOn)).map(g => g.key)));
  function toggle(f: FeatureItem) {
    if (f.kind === 'base') onChange(disabled.includes(f.value) ? disabled.filter(x => x !== f.value) : [...disabled, f.value]);
    else onEnabledChange?.(enabled.includes(f.value) ? enabled.filter(x => x !== f.value) : [...enabled, f.value]);
  }
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Fonctions du Plan</legend>
      <p className="text-xs text-slate-400 mb-2">Infos et Membres sont toujours actifs. Décocher masque une fonction sans effacer ses données.</p>
      <div className="space-y-2.5">
        {FEATURE_GROUPS.map(g => {
          const isOpen = open.has(g.key);
          const count = g.items.filter(isOn).length;
          return (
            <div key={g.key}>
              {g.collapsible ? (
                <button type="button" onClick={() => setOpen(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                  className="w-full flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide py-1">
                  <span aria-hidden>{g.icon}</span>{g.title}
                  {count > 0 && <span className="normal-case font-medium text-indigo-600">· {count} activée{count > 1 ? 's' : ''}</span>}
                  <ChevronDown size={14} className={`ml-auto text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide py-1"><span aria-hidden>{g.icon}</span>{g.title}</p>
              )}
              {isOpen && (
                <div className="space-y-1 mt-0.5">
                  {g.items.map(f => (
                    <div key={f.value}>
                      <label className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg ${readOnly ? '' : 'cursor-pointer hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={isOn(f)}
                          onChange={() => toggle(f)}
                          disabled={readOnly || (f.kind === 'optional' && !onEnabledChange)}
                          className="accent-indigo-600 mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-slate-800">{f.label}</span>
                          <span className="block text-xs text-slate-400">{f.hint}</span>
                        </span>
                      </label>
                      {/* Rappels utiles, sous la fonction concernée */}
                      {!readOnly && f.value === 'pere_noel' && isOn(f) && <div className="ml-7 mt-1"><SantaDatesNote compact /></div>}
                      {!readOnly && f.value === 'cagnotte' && isOn(f) && (
                        <p className="ml-7 mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          🎁 Pour une surprise, pense à cacher ce Plan à la personne fêtée (« Plan surprise »).
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
