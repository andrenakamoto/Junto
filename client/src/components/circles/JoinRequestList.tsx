import { useState } from 'react';
import { Check } from 'lucide-react';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isCircleManager } from '../../lib/settings';
import { Avatar } from '../ui/Avatar';
import api from '../../services/api';
import { t } from '../../i18n';

// Demandes pour rejoindre un Cercle, avec les actions permises par le mode d'admission :
// vote à la majorité (chaque membre approuve), ou validation par le créateur / les organisateurs
// (accepter ou refuser). Utilisé dans la pastille du Cercle et en tête de la liste des Plans.
export function JoinRequestList({ circle, onCircleUpdated }: { circle: Circle; onCircleUpdated: (c: Circle) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
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
    <div className="space-y-2">
      {requests.map(r => {
        const hasVoted = r.votes.some(v => v.userId === user?.id);
        return (
          <div key={r.id} className="px-1 py-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Avatar pseudo={r.user.pseudo} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-800 truncate">@{r.user.pseudo}</p>
              <p className="text-xs text-indigo-600">
                {byManager
                  ? (isManager ? t('circle.requests.yourCall') : t('circle.requests.byManagers'))
                  : t('circle.requests.votes', { n: r.votes.length, count: threshold })}
              </p>
            </div>
          </div>
          {byManager ? isManager && (
            confirming === r.id ? (
              // Refuser ne s'annule pas : confirmation
              // « Annuler » à la place de « Refuser » : un double appui ne confirme pas
              <div className="pl-9 space-y-1.5">
                <p className="text-xs font-medium text-slate-800">{t('circle.requests.confirmRefuse', { pseudo: r.user.pseudo })}</p>
                <div className="flex items-center justify-between gap-6">
                <button onClick={() => setConfirming(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-600 hover:bg-slate-100">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => { setConfirming(null); refuse(r.id); }}
                  disabled={busy === r.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t('circle.requests.yesRefuse')}
                </button>
                </div>
              </div>
            ) : (
              // Boutons écrits et bien séparés : Refuser à gauche, Accepter à droite
              <div className="flex items-center justify-between gap-6 pl-9">
                <button
                  onClick={() => setConfirming(r.id)}
                  disabled={busy === r.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
                >
                  {t('circle.requests.refuse')}
                </button>
                <button
                  onClick={() => accept(r.id)}
                  disabled={busy === r.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <Check size={14} /> {t('circle.requests.accept')}
                </button>
              </div>
            )
          ) : (
            <div className="flex justify-end pl-9">
              <button
                onClick={() => accept(r.id)}
                disabled={busy === r.id}
                title={hasVoted ? t('circle.requests.withdrawVote') : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 ${
                  hasVoted ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <Check size={14} /> {hasVoted ? t('circle.requests.approved') : t('circle.requests.approve')}
              </button>
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}
