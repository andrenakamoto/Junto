import { Pencil } from 'lucide-react';
import { Plan } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DeletionModeField, EditModeField, FeaturesField } from '../ui/AdvancedSettings';

interface Props {
  plan: Plan;
  isCreator: boolean;
  onClose: () => void;
  onEdit: () => void;
}

// Paramètres avancés du Plan, en lecture seule : visibles par tous, modifiables par le créateur
// depuis « Modifier le Plan ».
export function PlanSettingsModal({ plan, isCreator, onClose, onEdit }: Props) {
  const noop = () => {};
  return (
    <Modal title="Paramètres du Plan" onClose={onClose}>
      <div className="space-y-4">
        <FeaturesField disabled={plan.disabledFeatures ?? []} onChange={noop} readOnly />
        <EditModeField value={plan.editMode ?? 'creator'} onChange={noop} readOnly />
        <DeletionModeField subject="Plan" value={plan.deletionMode ?? 'vote'} onChange={noop} readOnly />
        {isCreator && (
          <p className="text-xs text-slate-500">Le titre, la description, les dates et ces paramètres se modifient avec « Modifier ».</p>
        )}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          {isCreator ? (
            <>
              <Button variant="ghost" onClick={onClose}>Fermer</Button>
              <Button onClick={onEdit}><Pencil size={14} className="mr-1.5 inline" />Modifier</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mr-auto self-center">Seul le créateur peut les modifier.</p>
              <Button onClick={onClose}>Fermer</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
