import React, { useState } from 'react';
import { SantaDatesNote } from './SantaDatesNote';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan, Circle, CircleMember, DeletionMode, EditMode, OptionalFeature, PlanFeature } from '../../types';
import { DeletionModeField, EditModeField, FeaturesField, ImportantInfoModeField, MembersVisibilityField } from '../ui/AdvancedSettings';
import { MembersVisibility } from '../../lib/settings';
import { OptionRow, OptionsBox, WhenField, addDefaultDuration, featuresSummary, AnnonceToggle, ALL_BASE_FEATURES, isAnnonce, isoToLocal, localToISO, participantsSummary, rulesAreDefault } from './PlanFormParts';
import { recurrenceLabel } from '../../lib/recurrence';
import { AlertTriangle, Layers, Lock, Puzzle, Repeat, Users } from 'lucide-react';
import { IMPORTANT_INFO_MAX } from './ImportantInfoCard';
import { RecurrenceField, untilToISO } from './RecurrenceField';
import { Recurrence } from '../../lib/recurrence';
import { useAuth } from '../../contexts/AuthContext';
import { SurpriseSelector } from './SurpriseSelector';
import { t } from '../../i18n';

interface Props {
  circleId: string;
  /** Membres du Cercle, pour choisir à qui cacher un Plan surprise */
  circleMembers?: CircleMember[];
  onClose: () => void;
  onCreated: (plan: Plan) => void;
  /** Plan pour plusieurs Cercles : les autres Cercles dont la personne est créatrice ou organisatrice */
  otherCircles?: Circle[];
  /** Si le Plan est créé à partir d'une option gagnante d'un sondage de Cercle */
  fromPoll?: { pollId: string; optionId: string; suggestedTitle?: string; suggestedEventDateISO?: string | null; excludedUserIds?: string[] };
}

export function CreatePlanModal({ circleId, circleMembers = [], otherCircles = [], onClose, onCreated, fromPoll }: Props) {
  const { user } = useAuth();
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>(fromPoll?.excludedUserIds ?? []);
  const [title, setTitle] = useState(fromPoll?.suggestedTitle ?? '');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(isoToLocal(fromPoll?.suggestedEventDateISO));
  const [endDate, setEndDate] = useState(fromPoll?.suggestedEventDateISO ? addDefaultDuration(isoToLocal(fromPoll.suggestedEventDateISO)) : '');
  const [endTouched, setEndTouched] = useState(false);
  const [location, setLocation] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [deletionMode, setDeletionMode] = useState<DeletionMode>('vote');
  const [disabledFeatures, setDisabledFeatures] = useState<PlanFeature[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<OptionalFeature[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('creator');
  const [importantInfo, setImportantInfo] = useState('');
  const [importantInfoMode, setImportantInfoMode] = useState<EditMode>('creator');
  const [recurrence, setRecurrence] = useState<Recurrence | ''>('');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  // Plan pour plusieurs Cercles (à la création seulement)
  const [multi, setMulti] = useState(false);
  const [extraCircleIds, setExtraCircleIds] = useState<string[]>([]);
  const chosenExtra = multi ? extraCircleIds : [];
  // Plan surprise : on peut cacher le Plan à des membres de tous les Cercles choisis
  const surpriseMembers = [...circleMembers, ...otherCircles.filter(c => chosenExtra.includes(c.id)).flatMap(c => c.members)]
    .filter((m, i, all) => all.findIndex(x => x.userId === m.userId) === i);
  const [membersVisibility, setMembersVisibility] = useState<MembersVisibility>('all');
  const annonce = isAnnonce(disabledFeatures, enabledFeatures, membersVisibility);
  // Mode annonce : toutes les fonctions décochées, liste des participants réservée (et retour au standard)
  function setAnnonce(on: boolean) {
    setDisabledFeatures(on ? ALL_BASE_FEATURES : []);
    setEnabledFeatures([]);
    setMembersVisibility(on ? 'managers' : 'all');
    if (on) setImportantInfoMode('creator');
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventDate || !endDate) { setError(t('plan.form.datesRequired')); return; }
    if (!location.trim()) { setError(t('plan.form.locationRequired')); return; }
    setLoading(true);
    setError('');
    const payload = {
      title,
      description,
      eventDate: eventDate ? localToISO(eventDate) : null,
      endDate: endDate ? localToISO(endDate) : null,
      location: location || null,
      maxParticipants: maxParticipants || null,
      excludedUserIds,
      deletionMode,
      disabledFeatures,
      enabledFeatures,
      editMode,
      importantInfo,
      importantInfoMode,
      membersVisibility,
      recurrence: recurrence || null,
      recurrenceUntil: recurrence ? untilToISO(recurrenceUntil) : null,
      extraCircleIds: chosenExtra,
    };
    try {
      const { data } = fromPoll
        ? await api.post(`/circles/polls/${fromPoll.pollId}/convert`, { ...payload, optionId: fromPoll.optionId })
        : await api.post(`/circles/${circleId}/plans`, payload);
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={fromPoll ? t('plan.form.fromPollTitle') : t('plan.form.createTitle')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">{t('plan.form.intro')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('plan.form.title')} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('plan.form.titlePlaceholder')} required autoFocus />
        <WhenField start={eventDate} end={endDate} onStart={setEventDate} onEnd={setEndDate} endTouched={endTouched} onEndTouched={() => setEndTouched(true)}
          startLabel={enabledFeatures.includes('pere_noel') ? t('plan.form.santaDate') : undefined} />
        {enabledFeatures.includes('pere_noel') && <SantaDatesNote />}
        <Input label={t('plan.form.place')} value={location} onChange={e => setLocation(e.target.value)} placeholder={t('plan.form.locationPlaceholder')} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">{t('plan.form.description')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('plan.form.descriptionPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
          />
        </div>

        <AnnonceToggle active={annonce} onChange={setAnnonce} />
        <OptionsBox>
          <OptionRow icon={<AlertTriangle size={16} />} label={t('plan.form.rows.important')} modified={!!importantInfo.trim()}
            summary={importantInfo.trim() ? importantInfo.trim().split('\n')[0] : t('plan.form.sum.none')}>
            <textarea
              value={importantInfo}
              onChange={e => setImportantInfo(e.target.value.slice(0, IMPORTANT_INFO_MAX))}
              placeholder={t('plan.form.importantInfoPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
            />
          </OptionRow>
          <OptionRow icon={<Puzzle size={16} />} label={t('plan.form.rows.features')} modified={disabledFeatures.length > 0 || enabledFeatures.length > 0}
            summary={annonce ? t('settings.annonce.title') : featuresSummary(disabledFeatures, enabledFeatures)}>
            <FeaturesField disabled={disabledFeatures} onChange={setDisabledFeatures} enabled={enabledFeatures} onEnabledChange={setEnabledFeatures} />
          </OptionRow>
          {!fromPoll && (
            <OptionRow icon={<Repeat size={16} />} label={t('plan.form.rows.recurrence')} modified={!!recurrence}
              summary={(recurrence && recurrenceLabel(recurrence, eventDate ? localToISO(eventDate) : null)) || t('plan.form.sum.noRepeat')}>
              <RecurrenceField
                value={recurrence}
                until={recurrenceUntil}
                eventDateISO={eventDate ? localToISO(eventDate) : null}
                onChange={(v, u) => { setRecurrence(v); setRecurrenceUntil(u); }}
              />
            </OptionRow>
          )}
          <OptionRow icon={<Users size={16} />} label={t('plan.form.rows.participants')} modified={!!maxParticipants || excludedUserIds.length > 0 || chosenExtra.length > 0}
            summary={participantsSummary(maxParticipants, excludedUserIds.length, 1 + chosenExtra.length)}>
            {!fromPoll && otherCircles.length > 0 && (
              <div className={`rounded-xl border p-3 ${multi ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} className="accent-indigo-600" />
                  <Layers size={15} className="text-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">{t('plan.multi.label')}</span>
                </label>
                {multi && (
                  <div className="mt-2.5 space-y-1.5">
                    <p className="text-xs text-slate-500">{t('plan.multi.hint')}</p>
                    {otherCircles.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" className="accent-indigo-600" checked={extraCircleIds.includes(c.id)}
                          onChange={e => setExtraCircleIds(e.target.checked ? [...extraCircleIds, c.id] : extraCircleIds.filter(id => id !== c.id))} />
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color ?? '#94a3b8' }} />
                        {c.name}
                      </label>
                    ))}
                    <p className="text-xs text-amber-700">{t('plan.multi.final')}</p>
                  </div>
                )}
              </div>
            )}
            <Input
              label={t('plan.form.maxParticipants')}
              type="number"
              min={1}
              value={maxParticipants}
              onChange={e => setMaxParticipants(e.target.value)}
              placeholder={t('plan.form.maxPlaceholder')}
            />
            {user && (
              <SurpriseSelector
                members={surpriseMembers}
                currentUserId={user.id}
                value={excludedUserIds}
                onChange={setExcludedUserIds}
              />
            )}
          </OptionRow>
          <OptionRow icon={<Lock size={16} />} label={t('plan.form.rows.rules')} modified={!rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility)}
            summary={rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility) ? t('plan.form.sum.defaults') : t('plan.form.sum.custom')}>
            <EditModeField value={editMode} onChange={setEditMode} />
            <ImportantInfoModeField value={importantInfoMode} onChange={setImportantInfoMode} />
            <MembersVisibilityField value={membersVisibility} onChange={setMembersVisibility} />
            <DeletionModeField subject="Plan" value={deletionMode} onChange={setDeletionMode} />
          </OptionRow>
        </OptionsBox>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>{loading ? t('common.creating') : t('plan.form.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
