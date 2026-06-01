import { useState } from 'react';
import { Trash2, Users, AlertTriangle } from 'lucide-react';
import { Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface Props {
  plan: Plan;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: (plan: Plan) => void;
}

export function DeletePlanModal({ plan, onClose, onDeleted, onUpdated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const votes = plan.deleteVotes ?? [];
  const memberCount = plan.members.length;
  const threshold = Math.ceil(memberCount / 2);
  const voteCount = votes.length;
  const hasMyVote = votes.some(v => v.userId === user?.id);
  const progress = Math.min((voteCount / threshold) * 100, 100);

  async function handleVote() {
    setLoading(true);
    try {
      const { data } = await api.post(`/plans/${plan.id}/vote-delete`);
      if (data.deleted) {
        onDeleted();
      } else {
        onUpdated(data.plan);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Supprimer le Plan" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            La suppression est <strong>irréversible</strong>. Tous les messages et votes seront perdus.
            Il faut <strong>{threshold} vote{threshold > 1 ? 's' : ''}</strong> sur {memberCount} membre{memberCount > 1 ? 's' : ''} pour confirmer.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Votes pour supprimer</span>
            <span className="text-sm font-bold text-slate-800">{voteCount} / {threshold}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${voteCount >= threshold ? 'bg-red-500' : 'bg-amber-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {votes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users size={11} />
              A voté pour supprimer
            </p>
            <div className="flex flex-wrap gap-1.5">
              {votes.map(v => (
                <span key={v.userId} className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  @{v.user.pseudo}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <button
            onClick={handleVote}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              hasMyVote
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <Trash2 size={14} />
            {loading ? '...' : hasMyVote ? 'Retirer mon vote' : 'Voter pour supprimer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
