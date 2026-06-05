import { Calendar, MapPin, MessageSquare, Users } from 'lucide-react';
import { Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  plan: Plan;
  isSelected: boolean;
  onClick: () => void;
}

const rsvpBadge = {
  in: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  maybe: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  out: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
const rsvpLabel = { in: 'Je suis in', maybe: 'Peut-être', out: 'Je passe' };

export function PlanCard({ plan, isSelected, onClick }: Props) {
  const { user } = useAuth();
  const myMember = plan.members.find(m => m.userId === user?.id);
  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;

  const date = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;


  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl transition-all border ${
        isSelected
          ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md shadow-indigo-900/20'
          : 'bg-slate-700/40 border-slate-600/40 hover:bg-slate-700/70 hover:border-slate-500/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-semibold text-white text-sm leading-tight">{plan.title}</h3>
        {myMember ? (
          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${rsvpBadge[myMember.rsvp]}`}>
            {rsvpLabel[myMember.rsvp]}
          </span>
        ) : (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Rejoindre
          </span>
        )}
      </div>

      <p className="text-slate-400 text-xs line-clamp-2 mb-2.5">{plan.description}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {date && <span className="flex items-center gap-1"><Calendar size={10} />{date}</span>}
        {myMember && plan.location && <span className="flex items-center gap-1 truncate max-w-full"><MapPin size={10} />{plan.location}</span>}
        {myMember && (
          <span className="flex items-center gap-1">
            <Users size={10} />
            <span className="text-emerald-400">{inCount} in</span>
            {maybeCount > 0 && <span className="text-amber-400">· {maybeCount} ?</span>}
          </span>
        )}
        {myMember && (plan._count?.messages ?? 0) > 0 && (
          <span className="flex items-center gap-1"><MessageSquare size={10} />{plan._count!.messages}</span>
        )}
      </div>
    </button>
  );
}
