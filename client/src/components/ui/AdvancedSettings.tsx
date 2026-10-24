import { useState } from 'react';
import { SantaDatesNote } from '../plans/SantaDatesNote';
import { ChevronDown, Megaphone, SlidersHorizontal, Users } from 'lucide-react';
import { AdmissionMode, DeletionMode, EditMode, OptionalFeature, PlanCreationMode, PlanFeature } from '../../types';
import { ADMISSION_OPTIONS, DELETION_OPTIONS, EDIT_OPTIONS, IMPORTANT_INFO_OPTIONS, MEMBERS_VISIBILITY_OPTIONS, MembersVisibility, FILES_MODE_OPTIONS, FilesMode, GUEST_INVITE_OPTIONS, GuestInviteMode, PLAN_CREATION_OPTIONS, POLL_CREATION_OPTIONS, FEATURE_GROUPS, FeatureItem, CHAT_MODE_OPTIONS, ChatMode } from '../../lib/settings';
import { t } from '../../i18n';

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
        {t('settings.advanced')}
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
  return <Choice label={props.subject === 'Plan' ? t('settings.deletionOfPlan') : t('settings.deletionOfCircle')} options={DELETION_OPTIONS} {...props} />;
}

export function EditModeField(props: { value: EditMode; onChange: (v: EditMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.editField')} options={EDIT_OPTIONS} {...props} />;
}

export function GuestInviteField(props: { value: GuestInviteMode; onChange: (v: GuestInviteMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.guestInviteField')} options={GUEST_INVITE_OPTIONS} {...props} />;
}

export function FilesModeField(props: { value: FilesMode; onChange: (v: FilesMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.filesField')} options={FILES_MODE_OPTIONS} {...props} />;
}

export function MembersVisibilityField(props: { value: MembersVisibility; onChange: (v: MembersVisibility) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.membersField')} options={MEMBERS_VISIBILITY_OPTIONS} {...props} />;
}

// Mode annonce : les membres peuvent créer un Plan dans un de leurs Cercles pour y aller ensemble
export function CirclePlansField({ value, onChange, readOnly }: { value: boolean; onChange: (v: boolean) => void; readOnly?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 ${value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'} ${readOnly ? '' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} disabled={readOnly} className="mt-0.5 accent-indigo-600" />
      <Users size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
      <span>
        <span className="block text-sm text-slate-800">{t('settings.circlePlans.label')}</span>
        <span className="block text-xs text-slate-500">{t('settings.circlePlans.hint')}</span>
      </span>
    </label>
  );
}

export function ImportantInfoModeField(props: { value: EditMode; onChange: (v: EditMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.importantInfoField')} options={IMPORTANT_INFO_OPTIONS} {...props} />;
}

export function PlanCreationModeField(props: { value: PlanCreationMode; onChange: (v: PlanCreationMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.planCreationField')} options={PLAN_CREATION_OPTIONS} {...props} />;
}

export function PollCreationModeField(props: { value: PlanCreationMode; onChange: (v: PlanCreationMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.pollCreationField')} options={POLL_CREATION_OPTIONS} {...props} />;
}

// Discussion du Cercle : ouverte, annonces (créateur et organisateurs écrivent) ou désactivée
export function ChatModeField(props: { value: ChatMode; onChange: (v: ChatMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.chatMode.label')} options={CHAT_MODE_OPTIONS} {...props} />;
}

// « Je suis dispo » : activé ou non, et (paramètres du Cercle) nombre de personnes dispo pour proposer un Plan
export function AvailabilityField({ enabled, onEnabledChange, threshold, onThresholdChange, readOnly }: {
  enabled: boolean; onEnabledChange: (v: boolean) => void; threshold?: number; onThresholdChange?: (v: number) => void; readOnly?: boolean;
}) {
  const options = [
    { value: 'on' as const, label: t('settings.dispo.on.label'), hint: t('settings.dispo.on.hint') },
    { value: 'off' as const, label: t('settings.dispo.off.label'), hint: t('settings.dispo.off.hint') },
  ];
  return (
    <div className="space-y-2">
      <Choice label={t('settings.dispo.label')} options={options} value={enabled ? 'on' : 'off'} onChange={v => onEnabledChange(v === 'on')} readOnly={readOnly} />
      {enabled && threshold !== undefined && onThresholdChange && (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-2.5 py-2">
          <span className="text-sm text-slate-800">{t('settings.dispo.threshold')}</span>
          <select value={threshold} onChange={e => onThresholdChange(Number(e.target.value))} disabled={readOnly}
            className="px-2 py-1 rounded-lg border border-slate-300 text-sm bg-white disabled:opacity-60">
            {Array.from({ length: 9 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{t('settings.dispo.thresholdValue', { count: n })}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function AdmissionModeField(props: { value: AdmissionMode; onChange: (v: AdmissionMode) => void; readOnly?: boolean }) {
  return <Choice label={t('settings.admissionField')} options={ADMISSION_OPTIONS} {...props} />;
}

export function FeaturesField({ disabled, onChange, enabled = [], onEnabledChange, readOnly, annonce }: {
  disabled: PlanFeature[];
  onChange: (v: PlanFeature[]) => void;
  /** Fonctions à activer (bénévoles, jeux, cagnotte…), décochées par défaut */
  enabled?: OptionalFeature[];
  onEnabledChange?: (v: OptionalFeature[]) => void;
  readOnly?: boolean;
  /** Mode annonce, proposé dans « Organiser », sous l'Assemblée (création et modification du Plan) */
  annonce?: { active: boolean; onChange: (on: boolean) => void };
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
      <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{t('settings.featuresField')}</legend>
      <p className="text-xs text-slate-400 mb-2">{t('settings.featuresHint')}</p>
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
                  {count > 0 && <span className="normal-case font-medium text-indigo-600">{t('settings.enabled', { count })}</span>}
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
                      {!readOnly && annonce && f.value === 'assemblee' && (
                        <label className={`mt-1 flex items-start gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer ${annonce.active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={annonce.active} onChange={e => annonce.onChange(e.target.checked)} className="accent-indigo-600 mt-0.5" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm text-slate-800"><Megaphone size={14} className="text-indigo-500" />{t('settings.annonce.title')}</span>
                            <span className="block text-xs text-slate-400">{t('settings.annonce.hint')}</span>
                          </span>
                        </label>
                      )}
                      {!readOnly && f.value === 'cagnotte' && isOn(f) && (
                        <p className="ml-7 mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          {t('settings.potSurprise')}
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
