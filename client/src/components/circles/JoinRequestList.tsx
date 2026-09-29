import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isCircleManager } from '../../lib/settings';
import { Avatar } from '../ui/Avatar';
import api from '../../services/api';

// Demandes pour rejoindre un Cercle, avec les actions permises par le mode d'admission :
// vote à la majorité (chaque membre approuve), ou validation par le créateur / les organisateurs
// (accepter ou refuser). Utilisé dans la pastille du Cercle et en tête de la liste des Plans.
export function JoinRequestList({ circle, onCircleUpdated }: { circle: Circle; onCircleUpdated: (c: Circle) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const requests = circle.joinRequests ?? [];
  const threshold = Math.ceil(circle.members.length / 2);
  const byManager = (circle.admissionMode ?? 'vote') !== 'vote';
  const isManager = isCircleManager(circle, user?.id);

  async function act(requestId: string, action: () => Promise<{ data: any }>) {
    setBusy(requestId);
    try {
      const { data } = await action();
      const updated = data?.circle ?? (data?.id ? data : null);
      if (updated) onCircleUpdated(updated);
    } catch { /* le temps réel rechargera le Cercle */ } finally {
      setBusy(null);
    }
  }
  const accept = (id: string) => act(id, () => api.post(`/circles/${circle.id}/join-requests/${id}/vote`));
  const refuse = (id: string) => act(id, () => api.delete(`/circles/${circle.id}/join-requests/${id}`));

  return (
    <div className="space-y-1.5">
      {requests.map(r => {
        const hasVoted = r.votes.some(v => v.userId === user?.id);
        return (
          <div key={r.id} className="flex items-center gap-2 px-1 py-0.5">
            <Avatar pseudo={r.user.pseudo} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-800 truncate">@{r.user.pseudo}</p>
              <p className="text-xs text-indigo-600">
                {byManager
                  ? (isManager ? 'À toi de décider' : 'Validation par les organisateurs')
                  : `${r.votes.length}/${threshold} vote${threshold > 1 ? 's' : ''}`}
              </p>
            </div>
            {byManager ? isManager && (
              <>
                <button
                  onClick={() => accept(r.id)}
                  disabled={busy === r.id}
                  title="Accepter"
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => refuse(r.id)}
                  disabled={busy === r.id}
                  title="Refuser"
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={() => accept(r.id)}
                disabled={busy === r.id}
                title={hasVoted ? 'Retirer mon vote' : 'Approuver'}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 ${
                  hasVoted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700'
                }`}
              >
                <Check size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
