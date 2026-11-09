import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';
import { draftCircleCount, draftFromModel, draftPayload, draftProblem, ORG_MODELS, type OrgDraft, type OrgModelKey } from '../../lib/organisations';

const fieldBase = 'px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const field = `w-full ${fieldBase}`;
const TOTAL_STEPS = 3;

// Assistant « Créer une Organisation » : réservé aux comptes autorisés dans le panneau admin
export function CreateOrganisationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (organisationId: string) => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OrgDraft>(() => draftFromModel('youth'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<OrgDraft>) => { setError(''); setDraft(d => ({ ...d, ...patch })); };
  const chooseModel = (key: OrgModelKey) => setDraft(d => draftFromModel(key, d.name));
  const memberRoles = draft.memberNames.map((n, i) => ({ i, n })).filter(r => r.n.trim());

  function next() {
    if (step === 1 && !draft.name.trim()) { setError(t('org.create.needName')); return; }
    if (step === 2) { const p = draftProblem(draft); if (p) { setError(p); return; } }
    setError('');
    setStep(s => s + 1);
  }

  async function submit() {
    const p = draftProblem(draft);
    if (p) { setError(p); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/organisations', draftPayload(draft));
      onCreated(data.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t('common.error'));
      setSaving(false);
    }
  }

  const textList = (items: string[], onChange: (v: string[]) => void, addLabel: string) => (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex gap-1.5">
          <input value={v} maxLength={60} placeholder={t('org.create.newItem')} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={field} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} title={t('org.create.remove')} aria-label={t('org.create.remove')} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"><Plus size={15} />{addLabel}</button>
    </div>
  );

  return (
    <Modal title={t('org.create.title')} onClose={onClose} wide>
      <p className="text-xs font-semibold text-slate-500 mb-4">{t('org.create.stepOf', { step, total: TOTAL_STEPS })}</p>

      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">{t('org.create.nameLabel')}</span>
            <input value={draft.name} maxLength={60} autoFocus placeholder={t('org.create.namePlaceholder')} onChange={e => set({ name: e.target.value })} className={field} />
          </label>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">{t('org.create.chooseModel')}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {ORG_MODELS.map(m => (
                <button key={m.key} type="button" onClick={() => chooseModel(m.key)} aria-pressed={draft.modelKey === m.key}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors ${draft.modelKey === m.key ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{t(`org.models.${m.key}.name`)}</span>
                    <span className="block text-xs text-slate-500">{t(`org.models.${m.key}.hint`)}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">{t('org.create.modelNote')}</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">{t('org.create.rolesTitle')}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block"><span className="block text-xs text-slate-600 mb-1">{t('org.create.directionLabel')}</span><input value={draft.directionName} maxLength={60} onChange={e => set({ directionName: e.target.value })} className={field} /></label>
              <label className="block"><span className="block text-xs text-slate-600 mb-1">{t('org.create.responsibleLabel')}</span><input value={draft.responsibleName} maxLength={60} onChange={e => set({ responsibleName: e.target.value })} className={field} /></label>
            </div>
            <p className="text-xs text-slate-600">{t('org.create.memberRolesLabel')}</p>
            {textList(draft.memberNames, v => set({ memberNames: v }), t('org.create.addRole'))}
          </section>

          <section className="space-y-2">
            <input value={draft.unitLabel} maxLength={60} aria-label={t('org.create.labelOf')} title={t('org.create.labelOf')} onChange={e => set({ unitLabel: e.target.value })} className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500 bg-transparent" />
            <p className="text-xs text-slate-500">{t('org.create.unitsHelp')}</p>
            {textList(draft.units, v => set({ units: v }), t('org.create.addUnit'))}
          </section>

          <section className="space-y-2">
            <input value={draft.teamLabel} maxLength={60} aria-label={t('org.create.labelOf')} title={t('org.create.labelOf')} onChange={e => set({ teamLabel: e.target.value })} className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500 bg-transparent" />
            <p className="text-xs text-slate-500">{t('org.create.teamsHelp')}</p>
            <div className="space-y-1.5">
              {draft.teams.map((team, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input type="color" value={team.color} aria-label={team.name} onChange={e => set({ teams: draft.teams.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })} className="w-8 h-8 p-0 rounded border-0 bg-transparent flex-shrink-0" />
                  <input value={team.name} maxLength={60} placeholder={t('org.create.newItem')} onChange={e => set({ teams: draft.teams.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={`${fieldBase} flex-1 min-w-0`} />
                  <select value={team.roleIndex} aria-label={t('org.manage.role')} onChange={e => set({ teams: draft.teams.map((x, j) => (j === i ? { ...x, roleIndex: Number(e.target.value) } : x)) })} className={`${fieldBase} w-24 sm:w-32 flex-shrink-0`}>
                    {memberRoles.map(r => <option key={r.i} value={r.i}>{r.n}</option>)}
                  </select>
                  <button type="button" onClick={() => set({ teams: draft.teams.filter((_, j) => j !== i) })} title={t('org.create.remove')} aria-label={t('org.create.remove')} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={() => set({ teams: [...draft.teams, { name: '', roleIndex: memberRoles[0]?.i ?? 0, color: '#6366f1' }] })} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"><Plus size={15} />{t('org.create.addTeam')}</button>
            </div>
          </section>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t('org.create.autoTitle')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('org.create.autoHelp')}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={draft.autoResponsibles} onChange={e => set({ autoResponsibles: e.target.checked })} />{t('org.create.autoResponsibles')}</label>
            {draft.autoResponsibles && (<>
              <label className="block"><span className="block text-xs text-slate-600 mb-1">{t('org.create.groupName')}</span><input value={draft.autoResponsiblesName} maxLength={60} onChange={e => set({ autoResponsiblesName: e.target.value })} className={field} /></label>
              {draft.units.some(u => u.trim()) && (
                <div>
                  <p className="text-xs text-slate-600 mb-1">{t('org.create.alsoUnits')}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {draft.units.map((u, i) => u.trim() && (
                      <label key={i} className="flex items-center gap-1.5 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.autoResponsibleUnits.includes(i)} onChange={e => set({ autoResponsibleUnits: e.target.checked ? [...draft.autoResponsibleUnits, i] : draft.autoResponsibleUnits.filter(x => x !== i) })} />{u}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>)}
          </div>
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={draft.autoDirection} onChange={e => set({ autoDirection: e.target.checked })} />{t('org.create.autoDirection')}</label>
            {draft.autoDirection && <label className="block"><span className="block text-xs text-slate-600 mb-1">{t('org.create.groupName')}</span><input value={draft.autoDirectionName} maxLength={60} onChange={e => set({ autoDirectionName: e.target.value })} className={field} /></label>}
          </div>
          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{t('org.create.summary', { count: draftCircleCount(draft) })}</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex justify-between gap-2 mt-5 pt-3 border-t border-slate-100">
        {step > 1 ? <button type="button" onClick={() => { setError(''); setStep(s => s - 1); }} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">{t('org.create.back')}</button> : <span />}
        {step < TOTAL_STEPS
          ? <button type="button" onClick={next} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">{t('org.create.next')}</button>
          : <button type="button" onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">{saving ? t('org.create.creating') : t('org.create.submit')}</button>}
      </div>
    </Modal>
  );
}
