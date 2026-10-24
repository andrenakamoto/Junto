import { useState } from 'react';
import { DESCRIPTION_MAX, RichTextArea, visibleLength } from '../../lib/richText';
import { SantaDatesNote } from './SantaDatesNote';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan, CircleMember, DeletionMode, EditMode, OptionalFeature, PlanFeature } from '../../types';
import { CirclePlansField, DeletionModeField, EditModeField, FeaturesField, ImportantInfoModeField, MembersVisibilityField } from '../ui/AdvancedSettings';
import { MembersVisibility } from '../../lib/settings';
import { OptionRow, OptionsBox, WhenField, featuresSummary, ANNONCE_DISABLED, isAnnonce, isoToLocal, localToISO, participantsSummary, rulesAreDefault } from './PlanFormParts';
import { recurrenceLabel } from '../../lib/recurrence';
import { Lock, Puzzle, Repeat, Users } from 'lucide-react';
import { RecurrenceField, untilToISO, isoToDateInput } from './RecurrenceField';
import { Recurrence } from '../../lib/recurrence';
import { VisibilityField, visibilityOf, visibilityPayload, visibilityCount } from './VisibilityField';
import { t } from '../../i18n';

interface Props {
  plan: Plan;
  /** Membres du Cercle, pour choisir à qui cacher le Plan (ou à qui le réserver) */
  circleMembers?: CircleMember[];
  onClose: () => void;
  onUpdated: (plan: Plan) => void;
  /** Faux : participant autorisé par le paramètre « tous les participants » (dates et lieu seulement) */
  isCreator?: boolean;
}

export function EditPlanModal({ plan, circleMembers = [], onClose, onUpdated, isCreator = true }: Props) {
  const [vis, setVis] = useState(() => visibilityOf(plan, circleMembers));
  const excludedUserIds = vis.mode === 'hidden' ? vis.excluded : vis.mode === 'reserved' ? circleMembers.map(m => m.userId).filter(id => id !== plan.creatorId && !vis.allowed.includes(id)) : [];
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [eventDate, setEventDate] = useState(isoToLocal(plan.eventDate));
  const [endDate, setEndDate] = useState(isoToLocal(plan.endDate));
  const [location, setLocation] = useState(plan.location ?? '');
  const [editMode, setEditMode] = useState<EditMode>(plan.editMode ?? 'creator');
  const [importantInfoMode, setImportantInfoMode] = useState<EditMode>(plan.importantInfoMode ?? 'creator');
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(plan.recurrence ?? '');
  const [recurrenceUntil, setRecurrenceUntil] = useState(isoToDateInput(plan.recurrenceUntil));
  const [maxParticipants, setMaxParticipants] = useState(plan.maxParticipants?.toString() ?? '');
  const [deletionMode, setDeletionMode] = useState<DeletionMode>(plan.deletionMode ?? 'vote');
  const [disabledFeatures, setDisabledFeatures] = useState<PlanFeature[]>(plan.disabledFeatures ?? []);
  const [enabledFeatures, setEnabledFeatures] = useState<OptionalFeature[]>(plan.enabledFeatures ?? []);
  const [endTouched, setEndTouched] = useState(true);
  const [membersVisibility, setMembersVisibility] = useState<MembersVisibility>(plan.membersVisibility ?? 'all');
  // Mode annonce : les membres peuvent y aller avec un de leurs Cercles
  const [allowCirclePlans, setAllowCirclePlans] = useState(plan.allowCirclePlans ?? true);
  const annonce = isAnnonce(disabledFeatures, enabledFeatures, membersVisibility);
  // Mode annonce : toutes les fonctions décochées, liste des participants réservée (et retour au standard)
  function setAnnonce(on: boolean) {
    setDisabledFeatures(on ? ANNONCE_DISABLED : []);
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
    // Une description déjà plus longue (créée avant la limite) reste acceptée tant qu'on n'y touche pas
    if (description !== plan.description && visibleLength(description) > DESCRIPTION_MAX) { setError(t('plan.format.tooLong', { field: t('plan.form.description'), max: DESCRIPTION_MAX })); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.put(`/plans/${plan.id}`, isCreator ? {
        title,
        description,
        eventDate: eventDate ? localToISO(eventDate) : null,
        endDate: localToISO(endDate),
        maxParticipants: maxParticipants || null,
        ...visibilityPayload(vis),
        deletionMode,
        disabledFeatures,
        enabledFeatures,
        editMode,
        importantInfoMode,
        membersVisibility,
        allowCirclePlans,
        recurrence: recurrence || null,
        recurrenceUntil: recurrence ? untilToISO(recurrenceUntil) : null,
        location,
      } : {
        eventDate: eventDate ? localToISO(eventDate) : null,
        endDate: localToISO(endDate),
        location,
      });
      onUpdated(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={t('plan.form.editTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isCreator && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {t('plan.form.participantEdit')}
          </p>
        )}
        {isCreator && <>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('plan.form.title')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('plan.form.description')}</label>
          <RichTextArea value={description} onChange={setDescription} max={DESCRIPTION_MAX} rows={3} />
          <p className="text-xs text-slate-400 mt-1">{t('plan.form.descriptionUpdated')}</p>
        </div>
        </>}
        <WhenField start={eventDate} end={endDate} onStart={setEventDate} onEnd={setEndDate} endTouched={endTouched} onEndTouched={() => setEndTouched(true)}
          startLabel={enabledFeatures.includes('pere_noel') ? t('plan.form.santaDate') : undefined} />
        {isCreator && enabledFeatures.includes('pere_noel') && <SantaDatesNote />}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('plan.form.place')}</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            required
            maxLength={200}
            placeholder={t('plan.form.locationPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        {isCreator && (<>
          <OptionsBox>
            <OptionRow icon={<Puzzle size={16} />} label={t('plan.form.rows.features')} modified={disabledFeatures.length > 0 || enabledFeatures.length > 0}
              summary={annonce ? t('settings.annonce.title') : featuresSummary(disabledFeatures, enabledFeatures)}>
              <FeaturesField disabled={disabledFeatures} onChange={setDisabledFeatures} enabled={enabledFeatures} onEnabledChange={setEnabledFeatures} annonce={{ active: annonce, onChange: setAnnonce }} />
            </OptionRow>
            <OptionRow icon={<Repeat size={16} />} label={t('plan.form.rows.recurrence')} modified={!!recurrence}
              summary={(recurrence && recurrenceLabel(recurrence, eventDate ? localToISO(eventDate) : null)) || t('plan.form.sum.noRepeat')}>
              <RecurrenceField
                value={recurrence}
                until={recurrenceUntil}
                eventDateISO={eventDate ? localToISO(eventDate) : null}
                onChange={(v, u) => { setRecurrence(v); setRecurrenceUntil(u); }}
              />
            </OptionRow>
            <OptionRow icon={<Users size={16} />} label={t('plan.form.rows.participants')} modified={!!maxParticipants || vis.mode !== 'all'}
              summary={participantsSummary(maxParticipants, visibilityCount(vis).hidden, 1, visibilityCount(vis).reserved)}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('plan.form.maxParticipants')}</label>
                <input
                  type="number"
                  min={1}
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  placeholder={t('plan.form.maxPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
                />
              </div>
              <VisibilityField members={circleMembers} currentUserId={plan.creatorId} value={vis} onChange={setVis} />
              {excludedUserIds.some(id => plan.members.some(m => m.userId === id)) && (
                <p className="text-xs text-amber-600 -mt-2">{t('plan.form.excludedMember')}</p>
              )}
            </OptionRow>
            <OptionRow icon={<Lock size={16} />} label={t('plan.form.rows.rules')} modified={!rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility) || !allowCirclePlans}
              summary={rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility) && allowCirclePlans ? t('plan.form.sum.defaults') : t('plan.form.sum.custom')}>
              <EditModeField value={editMode} onChange={setEditMode} />
              <ImportantInfoModeField value={importantInfoMode} onChange={setImportantInfoMode} />
              <MembersVisibilityField value={membersVisibility} onChange={setMembersVisibility} />
              {membersVisibility === 'managers' && <CirclePlansField value={allowCirclePlans} onChange={setAllowCirclePlans} />}
              <DeletionModeField subject="Plan" value={deletionMode} onChange={setDeletionMode} />
            </OptionRow>
          </OptionsBox>
        </>)}
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>{loading ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
