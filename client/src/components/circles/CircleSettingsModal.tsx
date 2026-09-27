import { useState } from 'react';
import { AdmissionMode, Circle, DeletionMode, PlanCreationMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AdmissionModeField, DeletionModeField, PlanCreationModeField } from '../ui/AdvancedSettings';
import api from '../../services/api';
import { isCircleManager } from '../../lib/settings';

interface Props {
  circle: Circle;
  onClose: () => void;
  onUpdated: (circle: Circle) => void;
}

// Paramètres avancés du Cercle : modifiables par le créateur, visibles par tous les membres
export function CircleSettingsModal({ circle, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const isCreator = circle.creatorId === user?.id;
  const canEdit = isCircleManager(circle, user?.id);
  const [deletionMode, setDeletionMode] = useState<DeletionMode>(circle.deletionMode ?? 'vote');
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>(circle.admissionMode ?? 'vote');
  const [planCreationMode, setPlanCreationMode] = useState<PlanCreationMode>(circle.planCreationMode ?? 'all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pendingCount = circle.joinRequests?.length ?? 0;
  const willOpen = admissionMode === 'open' && circle.admissionMode !== 'open' && pendingCount > 0;
  const changed = deletionMode !== (circle.deletionMode ?? 'vote') || admissionMode !== (circle.admissionMode ?? 'vote')
    || planCreationMode !== (circle.planCreationMode ?? 'all');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(`/circles/${circle.id}/settings`, { deletionMode, admissionMode, planCreationMode });
      onUpdated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Paramètres du Cercle" onClose={onClose}>
      <div className="space-y-4">
        <AdmissionModeField value={admissionMode} onChange={setAdmissionMode} readOnly={!canEdit} />
        {willOpen && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente {pendingCount > 1 ? 'seront acceptées' : 'sera acceptée'} automatiquement.
          </p>
        )}
        <PlanCreationModeField value={planCreationMode} onChange={setPlanCreationMode} readOnly={!canEdit} />
        <DeletionModeField subject="Cercle" value={deletionMode} onChange={setDeletionMode} readOnly={!isCreator} />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          {canEdit ? (
            <>
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving || !changed}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mr-auto self-center">Seuls le créateur et les organisateurs peuvent les modifier.</p>
              <Button onClick={onClose}>Fermer</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
