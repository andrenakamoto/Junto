import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { AdmissionMode, Circle, DeletionMode, PlanCreationMode } from '../../types';
import { AdvancedSection, AdmissionModeField, DeletionModeField, PlanCreationModeField, PollCreationModeField } from '../ui/AdvancedSettings';
import { useTranslation } from 'react-i18next';

export const CIRCLE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

interface Props {
  onClose: () => void;
  onCreated: (circle: Circle) => void;
}

export function CreateCircleModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [deletionMode, setDeletionMode] = useState<DeletionMode>('vote');
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>('vote');
  const [planCreationMode, setPlanCreationMode] = useState<PlanCreationMode>('all');
  const [pollCreationMode, setPollCreationMode] = useState<PlanCreationMode>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles', { name, description, color, deletionMode, admissionMode, planCreationMode, pollCreationMode });
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={t('circle.create.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('circle.create.name')} value={name} onChange={e => setName(e.target.value)} placeholder={t('circle.create.namePlaceholder')} required autoFocus />
        <Input label={t('circle.create.description')} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('circle.create.descriptionPlaceholder')} />
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">{t('circle.create.color')}</label>
          <div className="flex gap-2">
            {CIRCLE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(color === c ? null : c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
              />
            ))}
          </div>
        </div>
        <AdvancedSection>
          <AdmissionModeField value={admissionMode} onChange={setAdmissionMode} />
          <PlanCreationModeField value={planCreationMode} onChange={setPlanCreationMode} />
          <PollCreationModeField value={pollCreationMode} onChange={setPollCreationMode} />
          <DeletionModeField subject="Cercle" value={deletionMode} onChange={setDeletionMode} />
          <p className="text-xs text-slate-400">{t('circle.create.advancedHint')}</p>
        </AdvancedSection>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>{loading ? t('common.creating') : t('circle.create.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
