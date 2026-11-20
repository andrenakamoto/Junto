import { useState } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
  circle: Circle;
  onClose: () => void;
  onLeft: () => void;
}

export function LeaveCircleModal({ circle, onClose, onLeft }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const isCreator = circle.creatorId === user?.id;
  const isOnlyMember = circle.members.length === 1;

  async function handleLeave() {
    setLoading(true); setError('');
    try {
      await api.post(`/circles/${circle.id}/leave`);
      onLeft();
    } catch (err: any) {
      // Groupe automatique d'une Organisation (le serveur explique comment en sortir), réseau…
      setError(err?.response?.data?.error ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={t('circle.leave.title')} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <Trans i18nKey="circle.leave.text" values={{ name: circle.name }} components={{ b: <strong /> }} />
            {isCreator && isOnlyMember && <Trans i18nKey="circle.leave.onlyMember" components={{ b: <strong /> }} />}
            {isCreator && !isOnlyMember && t('circle.leave.creator')}
          </p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <button
            onClick={handleLeave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <LogOut size={14} />
            {loading ? '...' : t('circle.leave.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Quitter toute une Organisation (tous ses Cercles) — serveur : POST /organisations/:id/leave
export function LeaveOrganisationModal({ organisation, onClose, onLeft }: { organisation: { id: string; name: string }; onClose: () => void; onLeft: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  async function leave() {
    setLoading(true); setError('');
    try { await api.post(`/organisations/${organisation.id}/leave`); onLeft(); }
    catch (err: any) { setError(err?.response?.data?.error ?? t('common.error')); }
    finally { setLoading(false); }
  }
  return (
    <Modal title={t('org.admins.leaveOrg')} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800"><strong>{organisation.name}</strong> — {t('org.admins.leaveOrgHint')}</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <button onClick={leave} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
            <LogOut size={14} />{loading ? '...' : t('org.admins.leaveOrg')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
