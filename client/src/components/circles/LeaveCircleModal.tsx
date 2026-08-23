import { useState } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface Props {
  circle: Circle;
  onClose: () => void;
  onLeft: () => void;
}

export function LeaveCircleModal({ circle, onClose, onLeft }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isCreator = circle.creatorId === user?.id;
  const isOnlyMember = circle.members.length === 1;

  async function handleLeave() {
    setLoading(true);
    try {
      await api.post(`/circles/${circle.id}/leave`);
      onLeft();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Quitter le Cercle" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Tu vas quitter <strong>"{circle.name}"</strong>. Tu perdras l'accès à ses Plans et devras
            être réinvité(e) pour le rejoindre.
            {isCreator && isOnlyMember && (
              <> Comme tu es le seul membre, le Cercle sera <strong>définitivement supprimé</strong> avec tous ses Plans.</>
            )}
            {isCreator && !isOnlyMember && (
              <> Comme tu es le créateur, un autre membre du Cercle deviendra automatiquement créateur.</>
            )}
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <button
            onClick={handleLeave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <LogOut size={14} />
            {loading ? '...' : 'Quitter le Cercle'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
