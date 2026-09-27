import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan, CircleMember, DeletionMode, EditMode, PlanFeature } from '../../types';
import { AdvancedSection, DeletionModeField, EditModeField, FeaturesField } from '../ui/AdvancedSettings';
import { SurpriseSelector } from './SurpriseSelector';

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

interface Props {
  plan: Plan;
  /** Membres du Cercle, pour choisir à qui cacher un Plan surprise */
  circleMembers?: CircleMember[];
  onClose: () => void;
  onUpdated: (plan: Plan) => void;
  /** Faux : participant autorisé par le paramètre « tous les participants » (dates et lieu seulement) */
  isCreator?: boolean;
}

export function EditPlanModal({ plan, circleMembers = [], onClose, onUpdated, isCreator = true }: Props) {
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>((plan.exclusions ?? []).map(e => e.userId));
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [eventDate, setEventDate] = useState(isoToLocal(plan.eventDate));
  const [endDate, setEndDate] = useState(isoToLocal(plan.endDate));
  const [location, setLocation] = useState(plan.location ?? '');
  const [editMode, setEditMode] = useState<EditMode>(plan.editMode ?? 'creator');
  const [maxParticipants, setMaxParticipants] = useState(plan.maxParticipants?.toString() ?? '');
  const [deletionMode, setDeletionMode] = useState<DeletionMode>(plan.deletionMode ?? 'vote');
  const [disabledFeatures, setDisabledFeatures] = useState<PlanFeature[]>(plan.disabledFeatures ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.put(`/plans/${plan.id}`, isCreator ? {
        title,
        description,
        eventDate: eventDate ? localToISO(eventDate) : null,
        endDate: localToISO(endDate),
        maxParticipants: maxParticipants || null,
        excludedUserIds,
        deletionMode,
        disabledFeatures,
        editMode,
        location,
      } : {
        eventDate: eventDate ? localToISO(eventDate) : null,
        endDate: localToISO(endDate),
        location,
      });
      onUpdated(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Modifier le Plan" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isCreator && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Tu peux modifier les dates et le lieu. Le titre, la description et les autres réglages restent
            au créateur. Ta modification sera visible dans l'historique du Plan.
          </p>
        )}
        {isCreator && <>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optionnel)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 resize-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Les membres qui ont déjà rejoint le plan voient cette mise à jour.</p>
        </div>
        </>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date et heure de l'événement (optionnel)</label>
          <input
            type="datetime-local"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin du Plan</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
          <p className="text-sm font-medium text-red-500 mt-1">Le Plan et toutes les données liées seront automatiquement supprimés après cette date. Maximum 3 semaines après le début du Plan.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lieu (optionnel)</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={200}
            placeholder="Place de la République, Chez Marco..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        {isCreator && <>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Limite de participants (optionnel)</label>
          <input
            type="number"
            min={1}
            value={maxParticipants}
            onChange={e => setMaxParticipants(e.target.value)}
            placeholder="Ex : 8"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        <SurpriseSelector
          members={circleMembers}
          currentUserId={plan.creatorId}
          value={excludedUserIds}
          onChange={setExcludedUserIds}
        />
        {excludedUserIds.some(id => plan.members.some(m => m.userId === id)) && (
          <p className="text-xs text-amber-600 -mt-2">
            Une personne cochée a déjà rejoint ce Plan : elle en sera retirée.
          </p>
        )}
        <AdvancedSection>
          <FeaturesField disabled={disabledFeatures} onChange={setDisabledFeatures} />
          <EditModeField value={editMode} onChange={setEditMode} />
          <DeletionModeField subject="Plan" value={deletionMode} onChange={setDeletionMode} />
        </AdvancedSection>
        </>}
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
