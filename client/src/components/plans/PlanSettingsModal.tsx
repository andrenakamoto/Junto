import { Pencil } from 'lucide-react';
import { Plan } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DeletionModeField, EditModeField, FeaturesField, ImportantInfoModeField } from '../ui/AdvancedSettings';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Modal title={t('plan.settingsModal.title')} onClose={onClose}>
      <div className="space-y-4">
        <FeaturesField disabled={plan.disabledFeatures ?? []} onChange={noop} enabled={plan.enabledFeatures ?? []} readOnly />
        <EditModeField value={plan.editMode ?? 'creator'} onChange={noop} readOnly />
        <ImportantInfoModeField value={plan.importantInfoMode ?? 'creator'} onChange={noop} readOnly />
        <DeletionModeField subject="Plan" value={plan.deletionMode ?? 'vote'} onChange={noop} readOnly />
        {isCreator && (
          <p className="text-xs text-slate-500">{t('plan.settingsModal.editHint')}</p>
        )}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          {isCreator ? (
            <>
              <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
              <Button onClick={onEdit}><Pencil size={14} className="mr-1.5 inline" />{t('common.edit')}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mr-auto self-center">{t('plan.settingsModal.creatorOnly')}</p>
              <Button onClick={onClose}>{t('common.close')}</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
