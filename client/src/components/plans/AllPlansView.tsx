import { useEffect, useState } from 'react';
import { Calendar, Clock, Users, MessageSquare, ChevronLeft } from 'lucide-react';
import { Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface Props {
  onSelectPlan: (plan: Plan) => void;
  selectedPlanId: string | null;
  onBack: () => void;
}

const rsvpBadge = {
  in:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  maybe: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  out:   'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
const rsvpLabel = { in: 'Je suis in', maybe: 'Peut-être', out: 'Je passe' };

export function AllPlansView({ onSelectPlan, selectedPlanId, onBack }: Props) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/plans').then(res => setPlans(res.data)).finally(() => setLoading(false));
  }, []);

  // Grouper par cercle
  const byCircle = plans.reduce<Record<string, { name: string; plans: Plan[] }>>((acc, plan) => {
    const id = plan.circleId;
    if (!acc[id]) acc[id] = { name: plan.circle?.name ?? id, plans: [] };
    acc[id].plans.push(plan);
    return acc;
  }, {});

  return (
    <div className="w-full bg-slate-800 flex flex-col h-full flex-shrink-0 border-r border-slate-700/50">
      <div className="px-4 py-4 border-b border-slate-700/50 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold text-white text-sm">Tous mes plans</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Chargement...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">Aucun plan actif pour l'instant.</div>
        ) : (
          Object.values(byCircle).map(({ name, plans: circlePlans }) => (
            <div key={name}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">{name}</p>
              <div className="space-y-2">
                {circlePlans.map(plan => {
                  const myMember = plan.members.find(m => m.userId === user?.id);
                  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
                  const date = plan.eventDate
                    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
                    : null;
                  const endFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(plan.endDate));

                  return (
                    <button
                      key={plan.id}
                      onClick={() => onSelectPlan(plan)}
                      className={`w-full text-left p-3 rounded-xl transition-all border ${
                        selectedPlanId === plan.id
                          ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md'
                          : 'bg-slate-700/40 border-slate-600/40 hover:bg-slate-700/70 hover:border-slate-500/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
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
                      <p className="text-slate-400 text-xs line-clamp-1 mb-2">{plan.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {date && <span className="flex items-center gap-1"><Calendar size={10} />{date}</span>}
                        <span className="flex items-center gap-1 text-amber-500"><Clock size={10} />fin {endFmt}</span>
                        <span className="flex items-center gap-1"><Users size={10} /><span className="text-emerald-400">{inCount} in</span></span>
                        {(plan._count?.messages ?? 0) > 0 && (
                          <span className="flex items-center gap-1"><MessageSquare size={10} />{plan._count!.messages}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
