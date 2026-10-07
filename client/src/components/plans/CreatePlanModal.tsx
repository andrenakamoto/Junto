import React, { useState } from 'react';
import { SantaDatesNote } from './SantaDatesNote';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan, CircleMember, DeletionMode, EditMode, OptionalFeature, PlanFeature } from '../../types';
import { AdvancedSection, DeletionModeField, EditModeField, FeaturesField, ImportantInfoModeField } from '../ui/AdvancedSettings';
import { IMPORTANT_INFO_MAX } from './ImportantInfoCard';
import { RecurrenceField, untilToISO } from './RecurrenceField';
import { Recurrence } from '../../lib/recurrence';
import { useAuth } from '../../contexts/AuthContext';
import { SurpriseSelector } from './SurpriseSelector';

function localDateTimeToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  circleId: string;
  /** Membres du Cercle, pour choisir à qui cacher un Plan surprise */
  circleMembers?: CircleMember[];
  onClose: () => void;
  onCreated: (plan: Plan) => void;
  /** Si le Plan est créé à partir d'une option gagnante d'un sondage de Cercle */
  fromPoll?: { pollId: string; optionId: string; suggestedTitle?: string; suggestedEventDateISO?: string | null; excludedUserIds?: string[] };
}

export function CreatePlanModal({ circleId, circleMembers = [], onClose, onCreated, fromPoll }: Props) {
  const { user } = useAuth();
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>(fromPoll?.excludedUserIds ?? []);
  const [title, setTitle] = useState(fromPoll?.suggestedTitle ?? '');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(isoToLocal(fromPoll?.suggestedEventDateISO));
  const [endDate, setEndDate] = useState('');
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const payload = {
      title,
      description,
      eventDate: eventDate ? localDateTimeToISO(eventDate) : null,
      endDate: localDateTimeToISO(endDate),
      location: location || null,
      maxParticipants: maxParticipants || null,
      excludedUserIds,
      deletionMode,
      disabledFeatures,
      enabledFeatures,
      editMode,
      importantInfo,
      importantInfoMode,
      recurrence: recurrence || null,
      recurrenceUntil: recurrence ? untilToISO(recurrenceUntil) : null,
    };
    try {
      const { data } = fromPoll
        ? await api.post(`/circles/polls/${fromPoll.pollId}/convert`, { ...payload, optionId: fromPoll.optionId })
        : await api.post(`/circles/${circleId}/plans`, payload);
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={fromPoll ? 'Créer le Plan à partir du sondage' : 'Créer un Plan'} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">Rejoindre un Plan = être d'accord avec sa description.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Titre" value={title} onChange={e => setTitle(e.target.value)} placeholder="Qui veut manger ce midi ?" required autoFocus />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Description (optionnel)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Décris l'événement. Les gens qui rejoignent ce Plan sont d'accord avec ce que tu écris ici."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Informations importantes (optionnel)</label>
          <textarea
            value={importantInfo}
            onChange={e => setImportantInfo(e.target.value.slice(0, IMPORTANT_INFO_MAX))}
            placeholder="Ex : code de l'immeuble, documents à prendre, heure de départ précise…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
          />
        </div>
        <Input label={enabledFeatures.includes('pere_noel') ? "Date et heure de l'échange des cadeaux" : "Date et heure de l'événement (optionnel)"} type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        {!fromPoll && (
          <RecurrenceField
            value={recurrence}
            until={recurrenceUntil}
            eventDateISO={eventDate ? localDateTimeToISO(eventDate) : null}
            onChange={(v, u) => { setRecurrence(v); setRecurrenceUntil(u); }}
          />
        )}
        <Input label="Date de fin du Plan" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required />
        <p className="text-sm font-medium text-red-500 -mt-2">Le Plan et toutes les données liées seront automatiquement supprimés après cette date. Maximum 3 semaines après le début du Plan.</p>
        {enabledFeatures.includes('pere_noel') && <SantaDatesNote />}
        <Input label="Lieu (optionnel)" value={location} onChange={e => setLocation(e.target.value)} placeholder="Place de la République, Chez Marco..." />
        <Input
          label="Limite de participants (optionnel)"
          type="number"
          min={1}
          value={maxParticipants}
          onChange={e => setMaxParticipants(e.target.value)}
          placeholder="Ex : 8"
        />
        {user && (
          <SurpriseSelector
            members={circleMembers}
            currentUserId={user.id}
            value={excludedUserIds}
            onChange={setExcludedUserIds}
          />
        )}
        <AdvancedSection>
          <FeaturesField disabled={disabledFeatures} onChange={setDisabledFeatures} enabled={enabledFeatures} onEnabledChange={setEnabledFeatures} />
          <EditModeField value={editMode} onChange={setEditMode} />
          <ImportantInfoModeField value={importantInfoMode} onChange={setImportantInfoMode} />
          <DeletionModeField subject="Plan" value={deletionMode} onChange={setDeletionMode} />
        </AdvancedSection>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer le Plan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
