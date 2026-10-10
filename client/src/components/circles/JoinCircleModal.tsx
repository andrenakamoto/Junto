import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Circle } from '../../types';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
  onClose: () => void;
  onJoined: (circle: Circle) => void;
}

export function JoinCircleModal({ onClose, onJoined }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ circleName: string; byCreator: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles/join', { code: code.toUpperCase() });
      if (data.pending) {
        setPending({ circleName: data.circleName, byCreator: data.admissionMode === 'creator' });
      } else {
        onJoined(data.circle);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <Modal title={t('circle.join.sentTitle')} onClose={onClose}>
        <p className="text-sm text-slate-600 mb-4">
          <Trans i18nKey="circle.join.sent" values={{ name: pending.circleName }} components={{ b: <strong /> }} />
          {pending.byCreator ? t('circle.join.byCreator') : t('circle.join.byVote')}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('common.ok')}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t('circle.join.title')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">{t('circle.join.intro')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('circle.join.code')}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="AB3X7Y"
          maxLength={6}
          required
          autoFocus
          className="tracking-widest font-mono uppercase"
        />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>{loading ? t('common.sending') : t('circle.join.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
