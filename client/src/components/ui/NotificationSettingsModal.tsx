import { useState } from 'react';
import { Modal } from './Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onClose: () => void;
}

export function NotificationSettingsModal({ onClose }: Props) {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  async function toggleDigest() {
    if (!user || loading) return;
    setLoading(true);
    try {
      const { data } = await api.put('/auth/notification-settings', { weeklyDigestEnabled: !user.weeklyDigestEnabled });
      setUser(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-sm font-medium text-slate-800">Résumé hebdomadaire</p>
            <p className="text-xs text-slate-500 mt-0.5">Un email chaque lundi avec les Plans actifs de tes Cercles.</p>
          </div>
          <button
            onClick={toggleDigest}
            disabled={loading || !user?.email}
            className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${user?.weeklyDigestEnabled ? 'bg-indigo-600' : 'bg-slate-300'} disabled:opacity-40`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${user?.weeklyDigestEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
        {!user?.email && (
          <p className="text-xs text-slate-400">Ajoute un email à ton compte pour recevoir des notifications.</p>
        )}
        <p className="text-xs text-slate-400">
          Les rappels avant un Plan (24h avant) sont envoyés automatiquement si tu as un email vérifié.
        </p>
      </div>
    </Modal>
  );
}
