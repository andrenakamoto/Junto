import { Calendar, Check, MessageSquare, Gift, ChevronRight } from 'lucide-react';
import { CirclePoll } from '../../types';

interface Props {
  poll: CirclePoll;
  userId: string;
  selected?: boolean;
  onVote: (optionId: string) => void;
  onOpen: () => void;
}

// Aperçu d'un sondage de dates dans la colonne des Plans : vote rapide, et clic pour ouvrir
// le détail (qui a voté quoi, pas intéressés, chat, création du Plan).
export function CirclePollCard({ poll, userId, selected, onVote, onOpen }: Props) {
  const maxVotes = Math.max(1, ...poll.options.map(o => o.votes.length));
  const declined = (poll.declines ?? []).some(d => d.userId === userId);
  const declineCount = poll.declines?.length ?? 0;
  const messageCount = poll._count?.messages ?? 0;

  return (
    <div className={`bg-white border rounded-xl p-3 transition-colors ${selected ? 'border-indigo-400/70' : 'border-slate-200'}`}>
      <button onClick={onOpen} className="w-full flex items-start justify-between gap-2 mb-2.5 text-left group">
        <p className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-indigo-700">
          {(poll.exclusions?.length ?? 0) > 0 && <Gift size={12} className="inline mr-1 -mt-0.5 text-indigo-600" />}
          {poll.question}
        </p>
        <ChevronRight size={14} className="text-slate-500 group-hover:text-indigo-600 flex-shrink-0 mt-0.5" />
      </button>

      <div className="space-y-1.5">
        {poll.options.map(opt => {
          const count = opt.votes.length;
          const pct = Math.round((count / maxVotes) * 100);
          const iVoted = opt.votes.some(v => v.userId === userId);
          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              className={`w-full relative overflow-hidden rounded-lg border text-left text-xs transition-all ${
                iVoted ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`absolute inset-y-0 left-0 ${iVoted ? 'bg-emerald-400/10' : 'bg-slate-200/60'}`} style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between px-2.5 py-1.5">
                <span className={`flex items-center gap-1.5 ${iVoted ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                  {iVoted && <Check size={11} />}
                  <Calendar size={11} className="flex-shrink-0 opacity-70" />
                  {opt.label}
                </span>
                <span className="text-slate-500 flex-shrink-0 ml-2">{count}</span>
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={onOpen} className="mt-2 w-full flex items-center gap-3 text-xs text-slate-500 hover:text-slate-900">
        <span className="flex items-center gap-1"><MessageSquare size={11} />{messageCount}</span>
        {declineCount > 0 && (
          <span className={declined ? 'text-amber-800' : ''}>
            {declined ? 'Tu n\'es pas intéressé(e)' : `${declineCount} pas intéressé${declineCount > 1 ? 's' : ''}`}
          </span>
        )}
        <span className="ml-auto text-indigo-600">Ouvrir</span>
      </button>
    </div>
  );
}
