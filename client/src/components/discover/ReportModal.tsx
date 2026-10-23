import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';

// « Signaler une erreur » sur une annonce ou un lieu de Découvrir : email à l'équipe (POST /api/discover/report)
export function ReportModal({ target, title, onClose }: { target: { eventId: string } | { placeId: string }; title: string; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setSending(true);
    setError('');
    try {
      await api.post('/discover/report', { ...target, message });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={t('discover.report')} onClose={onClose}>
      <p className="text-sm font-medium text-slate-800 mb-2">{title}</p>
      {sent ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-3"><Check size={16} />{t('discover.reportThanks')}</p>
      ) : (
        <div className="space-y-2.5">
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3} placeholder={t('discover.reportIntro')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={send} disabled={sending} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {t('discover.reportSend')}
          </button>
        </div>
      )}
    </Modal>
  );
}
