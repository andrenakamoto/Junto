import { useState } from 'react';
import { Gift, Check } from 'lucide-react';

interface Props {
  members: { userId: string; user: { pseudo: string } }[];
  currentUserId: string;
  value: string[];
  onChange: (excludedUserIds: string[]) => void;
  label?: string;
  hint?: string;
}

export function SurpriseSelector({ members, currentUserId, value, onChange, label = 'Plan surprise', hint = 'Cacher ce Plan à (ils ne verront ni le Plan, ni ses notifications, ni ses emails) :' }: Props) {
  const [enabled, setEnabled] = useState(value.length > 0);
  const candidates = members.filter(m => m.userId !== currentUserId);

  function toggleEnabled() {
    if (enabled) onChange([]);
    setEnabled(!enabled);
  }

  function toggleMember(userId: string) {
    onChange(value.includes(userId) ? value.filter(id => id !== userId) : [...value, userId]);
  }

  if (candidates.length === 0) return null;

  return (
    <div className={`rounded-xl border p-3 ${enabled ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200'}`}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={enabled} onChange={toggleEnabled} className="accent-indigo-600" />
        <Gift size={15} className="text-indigo-500" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </label>

      {enabled && (
        <div className="mt-2.5">
          <p className="text-xs text-slate-500 mb-2">{hint}</p>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map(m => {
              const selected = value.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggleMember(m.userId)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {selected && <Check size={11} />}
                  @{m.user.pseudo}
                </button>
              );
            })}
          </div>
          {value.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">Choisis au moins une personne à qui le cacher.</p>
          )}
        </div>
      )}
    </div>
  );
}
