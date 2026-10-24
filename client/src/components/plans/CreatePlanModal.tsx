import React, { useEffect, useRef, useState } from 'react';
import { SantaDatesNote } from './SantaDatesNote';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan, Circle, CircleMember, DeletionMode, EditMode, OptionalFeature, PlanFeature } from '../../types';
import { CirclePlansField, DeletionModeField, EditModeField, FeaturesField, ImportantInfoModeField, MembersVisibilityField, FilesModeField, GuestInviteField } from '../ui/AdvancedSettings';
import { FilesMode, GuestInviteMode, MembersVisibility } from '../../lib/settings';
import { OptionRow, OptionsBox, WhenField, addDefaultDuration, featuresSummary, ANNONCE_DISABLED, isAnnonce, isoToLocal, localToISO, participantsSummary, rulesAreDefault } from './PlanFormParts';
import { recurrenceLabel } from '../../lib/recurrence';
import { AlertTriangle, Layers, Lock, Megaphone, Puzzle, Repeat, Users } from 'lucide-react';
import { DESCRIPTION_MAX, IMPORTANT_INFO_MAX, RichTextArea, stripFormatting, visibleLength } from '../../lib/richText';
import { RecurrenceField, untilToISO } from './RecurrenceField';
import { Recurrence } from '../../lib/recurrence';
import { useAuth } from '../../contexts/AuthContext';
import { VisibilityField, emptyVisibility, visibilityPayload, visibilityCount } from './VisibilityField';
import { t } from '../../i18n';
import { KIND_GAMES, PLAN_KINDS, PlanKind, kindPreset } from '../../lib/planKinds';
import { OPTIONAL_FEATURES } from '../../lib/settings';

interface Props {
  circleId: string;
  /** Membres du Cercle, pour choisir à qui cacher un Plan surprise */
  circleMembers?: CircleMember[];
  onClose: () => void;
  /** tab : onglet à ouvrir après la création (Plan spécifique) */
  onCreated: (plan: Plan, tab?: string) => void;
  /** Plan pour plusieurs Cercles : les autres Cercles dont la personne est créatrice ou organisatrice */
  otherCircles?: Circle[];
  /** Si le Plan est créé à partir d'une option gagnante d'un sondage de Cercle */
  fromPoll?: { pollId: string; optionId: string; suggestedTitle?: string; suggestedEventDateISO?: string | null; excludedUserIds?: string[]; surprise?: boolean };
  /** Titre proposé (« Faire un Plan » depuis un message de la discussion du Cercle) */
  suggestedTitle?: string;
  /** « Y aller avec un Cercle » : Plan pré-rempli d'après un événement en Mode annonce */
  // Depuis un Plan en Mode annonce (sourcePlanId) ou une annonce de Découvrir (url : lien « Plus d'infos »)
  fromEvent?: { sourcePlanId?: string; title: string; eventDate?: string | null; endDate: string; location?: string | null; url?: string | null };
  /** « Lancer un Plan » depuis « Je suis dispo » : début proposé (heure locale « AAAA-MM-JJTHH:MM ») ; les dispos s'effacent */
  fromAvailability?: { start: string };
  /** Plan spécifique choisi dans « Créer » (lib/planKinds.ts) */
  kind?: PlanKind | null;
}

export function CreatePlanModal({ circleId, circleMembers = [], otherCircles = [], onClose, onCreated, fromPoll, suggestedTitle, fromEvent, fromAvailability, kind }: Props) {
  const { user } = useAuth();
  // Plan spécifique (Créer › Plan spécifique) : réglages de départ selon le type, tous modifiables
  const [preset] = useState(() => kind ? kindPreset(kind) : null);
  // Qui voit ce Plan : un sondage caché garde les mêmes personnes (et sa surprise) ; une Surprise commence en « Cacher à… »
  const [vis, setVis] = useState(() => preset?.surprise ? { mode: 'hidden' as const, excluded: [], allowed: [], surprise: true } : emptyVisibility(fromPoll?.excludedUserIds ?? [], fromPoll?.surprise !== false));
  const [title, setTitle] = useState(fromPoll?.suggestedTitle ?? suggestedTitle ?? (fromEvent ? t('plan.goWith.titleSuggestion', { title: fromEvent.title }) : preset?.title ?? ''));
  const [description, setDescription] = useState(fromEvent?.url ? t('plan.goWith.moreInfo', { url: fromEvent.url }) : '');
  const [eventDate, setEventDate] = useState(isoToLocal(fromPoll?.suggestedEventDateISO ?? fromEvent?.eventDate) || fromAvailability?.start || preset?.start || '');
  const [endDate, setEndDate] = useState(preset?.end ? preset.end : fromEvent ? isoToLocal(fromEvent.endDate) : fromPoll?.suggestedEventDateISO ? addDefaultDuration(isoToLocal(fromPoll.suggestedEventDateISO)) : fromAvailability ? addDefaultDuration(fromAvailability.start) : '');
  const [endTouched, setEndTouched] = useState(!!fromEvent || !!preset?.end);
  const [location, setLocation] = useState(fromEvent?.location ?? '');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [deletionMode, setDeletionMode] = useState<DeletionMode>('creator');
  const [disabledFeatures, setDisabledFeatures] = useState<PlanFeature[]>(preset?.disabled ?? []);
  const [enabledFeatures, setEnabledFeatures] = useState<OptionalFeature[]>(preset?.enabled ?? []);
  const [editMode, setEditMode] = useState<EditMode>('creator');
  const [importantInfo, setImportantInfo] = useState(preset?.importantInfo ?? '');
  const [importantInfoMode, setImportantInfoMode] = useState<EditMode>('creator');
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(preset?.recurrence ?? '');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  // Plan pour plusieurs Cercles (à la création seulement)
  const [multi, setMulti] = useState(false);
  const [extraCircleIds, setExtraCircleIds] = useState<string[]>([]);
  const chosenExtra = multi ? extraCircleIds : [];
  // Cacher à… / Réservé à… : parmi les membres de tous les Cercles choisis
  const surpriseMembers = [...circleMembers, ...otherCircles.filter(c => chosenExtra.includes(c.id)).flatMap(c => c.members)]
    .filter((m, i, all) => all.findIndex(x => x.userId === m.userId) === i);
  const [membersVisibility, setMembersVisibility] = useState<MembersVisibility>(preset?.membersVisibility ?? 'all');
  // Qui ajoute des photos et fichiers (Mode annonce : le créateur et les organisateurs)
  const [filesMode, setFilesMode] = useState<FilesMode>(preset?.filesMode ?? 'all');
  // Qui invite des personnes extérieures : par défaut selon l'admission du Cercle (entrée libre → tous), comme le serveur
  const [guestInviteMode, setGuestInviteMode] = useState<GuestInviteMode>(preset?.guestInviteMode ?? 'all');
  const guestTouched = useRef(!!preset?.guestInviteMode);
  useEffect(() => {
    api.get(`/circles/${circleId}`).then(({ data }) => { if (!guestTouched.current) setGuestInviteMode(data?.admissionMode === 'open' ? 'all' : 'managers'); }).catch(() => {});
  }, [circleId]);
  // Mode annonce : les membres peuvent y aller avec un de leurs Cercles
  const [allowCirclePlans, setAllowCirclePlans] = useState(true);
  const annonce = isAnnonce(disabledFeatures, enabledFeatures, membersVisibility);
  // Mode annonce : toutes les fonctions décochées, liste des participants réservée (et retour au standard)
  function setAnnonce(on: boolean) {
    setDisabledFeatures(on ? ANNONCE_DISABLED : []);
    setEnabledFeatures([]);
    setMembersVisibility(on ? 'managers' : 'all');
    setFilesMode(on ? 'managers' : 'all');
    // Mode annonce : chacun peut partager l'invitation (inscriptions)
    if (on) { setGuestInviteMode('all'); guestTouched.current = true; }
    if (on) setImportantInfoMode('creator');
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventDate || !endDate) { setError(t('plan.form.datesRequired')); return; }
    if (!location.trim()) { setError(t('plan.form.locationRequired')); return; }
    if (visibleLength(description) > DESCRIPTION_MAX) { setError(t('plan.format.tooLong', { field: t('plan.form.description'), max: DESCRIPTION_MAX })); return; }
    // Plan spécifique : ce qui fait le type doit être rempli
    if (kind === 'surprise' && (vis.mode !== 'hidden' || vis.excluded.length === 0)) { setError(t('plan.kinds.surprise.required')); return; }
    if (kind === 'jeux' && !KIND_GAMES.some(g => enabledFeatures.includes(g))) { setError(t('plan.kinds.jeux.required')); return; }
    if (visibleLength(importantInfo) > IMPORTANT_INFO_MAX) { setError(t('plan.format.tooLong', { field: t('plan.form.rows.important'), max: IMPORTANT_INFO_MAX })); return; }
    setLoading(true);
    setError('');
    const payload = {
      title,
      description,
      eventDate: eventDate ? localToISO(eventDate) : null,
      endDate: endDate ? localToISO(endDate) : null,
      location: location || null,
      maxParticipants: maxParticipants || null,
      ...visibilityPayload(vis),
      deletionMode,
      disabledFeatures,
      enabledFeatures,
      editMode,
      importantInfo,
      importantInfoMode,
      membersVisibility,
      filesMode,
      guestInviteMode,
      allowCirclePlans,
      recurrence: recurrence || null,
      recurrenceUntil: recurrence ? untilToISO(recurrenceUntil) : null,
      extraCircleIds: chosenExtra,
      sourcePlanId: fromEvent?.sourcePlanId,
      fromAvailability: fromAvailability ? true : undefined,
      kind: kind ?? undefined,
    };
    try {
      const { data } = fromPoll
        ? await api.post(`/circles/polls/${fromPoll.pollId}/convert`, { ...payload, optionId: fromPoll.optionId })
        : await api.post(`/circles/${circleId}/plans`, payload);
      onCreated(data, preset?.tab ?? (kind === 'jeux' ? KIND_GAMES.find(g => enabledFeatures.includes(g)) : undefined));
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={fromPoll ? t('plan.form.fromPollTitle') : t('plan.form.createTitle')} onClose={onClose}>
      {fromEvent && (
        <p className="flex items-center gap-2 text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-4"><Megaphone size={15} className="flex-shrink-0 text-indigo-500" />{t('plan.goWith.note', { title: fromEvent.title })}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('plan.form.title')} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('plan.form.titlePlaceholder')} required autoFocus />
        {kind && (
          <div className="text-sm text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <p className="font-semibold">{PLAN_KINDS.find(k => k.kind === kind)?.emoji} {t(`plan.kinds.${kind}.name`)}</p>
            {t(`plan.kinds.${kind}.note`) && <p className="text-xs text-indigo-800 mt-0.5">{t(`plan.kinds.${kind}.note`)}</p>}
          </div>
        )}
        <WhenField start={eventDate} end={endDate} onStart={setEventDate} onEnd={setEndDate} endTouched={endTouched} onEndTouched={() => setEndTouched(true)}
          durationMs={preset?.durationMs}
          startLabel={enabledFeatures.includes('pere_noel') && kind !== 'pere_noel' ? t('plan.form.santaDate') : undefined} />
        {enabledFeatures.includes('pere_noel') && kind !== 'pere_noel' && <SantaDatesNote />}
        {/* Surprise : pour qui (le Plan lui est caché) ; Soirée jeux : quels jeux */}
        {kind === 'surprise' && user && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{t('plan.kinds.surprise.forWho')}</p>
            <VisibilityField members={surpriseMembers} currentUserId={user.id} value={vis} onChange={setVis} />
          </div>
        )}
        {kind === 'jeux' && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">{t('plan.kinds.jeux.games')}</p>
            <div className="flex flex-wrap gap-1.5">
              {KIND_GAMES.map(g => { const on = enabledFeatures.includes(g); return (
                <button key={g} type="button" onClick={() => setEnabledFeatures(on ? enabledFeatures.filter(x => x !== g) : [...enabledFeatures, g])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {(OPTIONAL_FEATURES.find(f => f.value === g)?.label ?? g).replace(/\s*\(.*\)$/, '')}
                </button>); })}
            </div>
          </div>
        )}
        <Input label={t('plan.form.place')} value={location} onChange={e => setLocation(e.target.value)} placeholder={t('plan.form.locationPlaceholder')} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">{t('plan.form.description')}</label>
          <RichTextArea value={description} onChange={setDescription} max={DESCRIPTION_MAX} rows={2} placeholder={t('plan.form.descriptionPlaceholder')} />
        </div>

        <OptionsBox>
          <OptionRow icon={<AlertTriangle size={16} />} label={t('plan.form.rows.important')} modified={!!importantInfo.trim()}
            summary={importantInfo.trim() ? stripFormatting(importantInfo.trim()).split('\n')[0] : t('plan.form.sum.none')}>
            <RichTextArea value={importantInfo} onChange={setImportantInfo} max={IMPORTANT_INFO_MAX} rows={4} placeholder={t('plan.form.importantInfoPlaceholder')} />
          </OptionRow>
          <OptionRow icon={<Puzzle size={16} />} label={t('plan.form.rows.features')} modified={disabledFeatures.length > 0 || enabledFeatures.length > 0}
            summary={annonce ? t('settings.annonce.title') : featuresSummary(disabledFeatures, enabledFeatures)}>
            <FeaturesField disabled={disabledFeatures} onChange={setDisabledFeatures} enabled={enabledFeatures} onEnabledChange={setEnabledFeatures} annonce={{ active: annonce, onChange: setAnnonce }} />
          </OptionRow>
          {!fromPoll && !fromEvent && (
            <OptionRow icon={<Repeat size={16} />} label={t('plan.form.rows.recurrence')} modified={!!recurrence} defaultOpen={kind === 'cours'}
              summary={(recurrence && recurrenceLabel(recurrence, eventDate ? localToISO(eventDate) : null)) || t('plan.form.sum.noRepeat')}>
              <RecurrenceField
                value={recurrence}
                until={recurrenceUntil}
                eventDateISO={eventDate ? localToISO(eventDate) : null}
                onChange={(v, u) => { setRecurrence(v); setRecurrenceUntil(u); }}
              />
            </OptionRow>
          )}
          <OptionRow icon={<Users size={16} />} label={t('plan.form.rows.participants')} modified={!!maxParticipants || vis.mode !== 'all' || chosenExtra.length > 0} defaultOpen={kind === 'cours' || kind === 'annonce'}
            summary={participantsSummary(maxParticipants, visibilityCount(vis).hidden, 1 + chosenExtra.length, visibilityCount(vis).reserved)}>
            {!fromPoll && !fromEvent && kind !== 'assemblee' && otherCircles.length > 0 && (
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
              kind !== 'surprise' && <VisibilityField members={surpriseMembers} currentUserId={user.id} value={vis} onChange={setVis} />
            )}
          </OptionRow>
          <OptionRow icon={<Lock size={16} />} label={t('plan.form.rows.rules')} modified={!rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility, filesMode) || !allowCirclePlans}
            summary={rulesAreDefault(editMode, importantInfoMode, deletionMode, membersVisibility, filesMode) && allowCirclePlans ? t('plan.form.sum.defaults') : t('plan.form.sum.custom')}>
            <EditModeField value={editMode} onChange={setEditMode} />
            <ImportantInfoModeField value={importantInfoMode} onChange={setImportantInfoMode} />
            <MembersVisibilityField value={membersVisibility} onChange={setMembersVisibility} />
              <FilesModeField value={filesMode} onChange={setFilesMode} />
              <GuestInviteField value={guestInviteMode} onChange={v => { guestTouched.current = true; setGuestInviteMode(v); }} />
            {membersVisibility === 'managers' && <CirclePlansField value={allowCirclePlans} onChange={setAllowCirclePlans} />}
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
