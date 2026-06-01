import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Plan, Poll } from '../../types';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface Props {
  plan: Plan;
  onPlanUpdated: (plan: Plan) => void;
  userId: string;
}

export function VotesTab({ plan, onPlanUpdated, userId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const { data } = await api.get(`/plans/${plan.id}`);
    onPlanUpdated(data);
  }

  async function handleCreate() {
    const valid = options.filter(o => o.trim());
    if (!question.trim() || valid.length < 2) return;
    setCreating(true);
    try {
      await api.post(`/plans/${plan.id}/polls`, { question: question.trim(), options: valid });
      await refresh();
      setShowCreate(false);
      setQuestion('');
      setOptions(['', '']);
    } finally {
      setCreating(false);
    }
  }

  async function handleVote(optionId: string) {
    await api.post(`/plans/polls/${optionId}/vote`);
    await refresh();
  }

  const polls = plan.polls || [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-4">
      {polls.length === 0 && !showCreate && (
        <p className="text-sm text-slate-400 italic">Aucun sondage pour l'instant.</p>
      )}
      {polls.map(poll => (
        <PollCard key={poll.id} poll={poll} userId={userId} onVote={handleVote} />
      ))}

      {showCreate ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <input
            autoFocus
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Question du sondage..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt}
                onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                placeholder={`Option ${i + 1}`}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {options.length > 2 && (
                <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 p-1">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button onClick={() => setOptions([...options, ''])} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
              <Plus size={13} />Ajouter une option
            </button>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={creating} size="sm">{creating ? 'Création...' : 'Créer le sondage'}</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} size="sm">Annuler</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus size={14} />Créer un sondage
        </button>
      )}
    </div>
  );
}

function PollCard({ poll, userId, onVote }: { poll: Poll; userId: string; onVote: (optionId: string) => void }) {
  const total = poll.options.reduce((s, o) => s + o.votes.length, 0);
  const myVote = poll.options.find(o => o.votes.some(v => v.userId === userId));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="font-semibold text-slate-800 text-sm mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map(opt => {
          const count = opt.votes.length;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMe = myVote?.id === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              className={`w-full relative overflow-hidden rounded-lg border text-left text-sm transition-all ${
                isMe ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${isMe ? 'bg-indigo-200/40' : 'bg-slate-200/40'}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <span className={isMe ? 'text-indigo-700 font-medium' : 'text-slate-700'}>{opt.text}</span>
                <span className={`text-xs ml-2 flex-shrink-0 ${isMe ? 'text-indigo-500' : 'text-slate-400'}`}>{count} ({pct}%)</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-2">{total} vote{total !== 1 ? 's' : ''}</p>
    </div>
  );
}
