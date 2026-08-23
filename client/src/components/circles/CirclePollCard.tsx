import { useState } from 'react';
import { Calendar, Check, Trash2, CalendarPlus } from 'lucide-react';
import { CirclePoll, CirclePollOption } from '../../types';

interface Props {
  poll: CirclePoll;
  userId: string;
  onVote: (optionId: string) => void;
  onDelete: () => void;
  onConvert: (option: CirclePollOption) => void;
}

export function CirclePollCard({ poll, userId, onVote, onDelete, onConvert }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCreator = poll.creator.id === userId;
  const maxVotes = Math.max(1, ...poll.options.map(o => o.votes.length));

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-white leading-tight">{poll.question}</p>
        {isCreator && (
          confirmDelete ? (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={onDelete} className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Oui</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">Non</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} title="Supprimer le sondage" className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
              <Trash2 size={13} />
            </button>
          )
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map(opt => {
          const count = opt.votes.length;
          const pct = Math.round((count / maxVotes) * 100);
          const iVoted = opt.votes.some(v => v.userId === userId);
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                onClick={() => onVote(opt.id)}
                className={`flex-1 relative overflow-hidden rounded-lg border text-left text-xs transition-all ${
                  iVoted ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <div className={`absolute inset-y-0 left-0 ${iVoted ? 'bg-emerald-400/10' : 'bg-slate-600/20'}`} style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between px-2.5 py-1.5">
                  <span className={`flex items-center gap-1.5 ${iVoted ? 'text-emerald-300 font-medium' : 'text-slate-300'}`}>
                    {iVoted && <Check size={11} />}
                    <Calendar size={11} className="flex-shrink-0 opacity-70" />
                    {opt.label}
                  </span>
                  <span className="text-slate-400 flex-shrink-0 ml-2">{count}</span>
                </div>
              </button>
              {isCreator && (
                <button
                  onClick={() => onConvert(opt)}
                  title="Créer le Plan avec cette date"
                  className="p-1.5 rounded-lg text-indigo-300 hover:text-indigo-200 hover:bg-slate-700 transition-colors flex-shrink-0"
                >
                  <CalendarPlus size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
