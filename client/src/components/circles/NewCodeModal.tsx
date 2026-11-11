import { useState } from 'react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';
import type { Circle } from '../../types';

// « Générer un nouveau code » : l'ancien code, les liens et les QR codes déjà partagés ne marchent plus
export function NewCodeModal({ circleId, oldCode, onClose, onDone }: { circleId: string; oldCode: string; onClose: () => void; onDone: (circle: Circle) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/circles/${circleId}/code`);
      setNewCode(data.code);
      onDone(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('circle.newCode.title')} onClose={onClose}>
      {newCode ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{t('circle.newCode.done')}</p>
          <p className="text-center font-mono text-3xl font-bold tracking-widest text-slate-900">{newCode}</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">{t('common.close')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{t('circle.newCode.text', { code: oldCode })}</p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
            <button type="button" onClick={generate} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">{t('circle.newCode.confirm')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
