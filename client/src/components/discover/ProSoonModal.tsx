import { useState } from 'react';
import { Megaphone, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { t } from '../../i18n';

// « Poster un événement public » : prochainement disponible (comptes pros vérifiés, plus tard). En attendant, les
// organisateurs laissent leurs coordonnées pour être prévenus (POST /api/discover/pro-interest).
export function ProSoonModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState([user?.firstName, user?.lastName].filter(Boolean).join(' '));
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t('discover.post.nameRequired')); return; }
    if (!email.trim()) { setError(t('discover.post.emailRequired')); return; }
    setSending(true);
    setError('');
    try {
      await api.post('/discover/pro-interest', { name, company, email, city, message });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      setSending(false);
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  return (
    <Modal title={t('discover.post.button')} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
          <Megaphone size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-900">{t('discover.post.soon')}</p>
            <p className="text-sm text-indigo-900/80 mt-0.5">{t('discover.post.text')}</p>
          </div>
        </div>
        {sent ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-3"><Check size={16} />{t('discover.post.thanks')}</p>
        ) : (
          <form onSubmit={send} className="space-y-2.5">
            <p className="text-sm text-slate-600">{t('discover.post.notify')}</p>
            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('discover.post.name')} maxLength={80} />
            <input className={input} value={company} onChange={e => setCompany(e.target.value)} placeholder={t('discover.post.company')} maxLength={100} />
            <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('discover.post.email')} maxLength={160} />
            <input className={input} value={city} onChange={e => setCity(e.target.value)} placeholder={t('discover.post.city')} maxLength={60} />
            <textarea className={input} value={message} onChange={e => setMessage(e.target.value)} placeholder={t('discover.post.message')} maxLength={500} rows={3} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={sending} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {t('discover.post.send')}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
