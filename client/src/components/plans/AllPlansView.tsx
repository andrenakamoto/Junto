import { useEffect, useState } from 'react';
import { Calendar, Users, MessageSquare, ChevronLeft } from 'lucide-react';
import { Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { sortPlans } from '../../lib/order';
import { t } from '../../i18n';
import { shortDateTime } from '../../lib/dates';

interface Props {
  onSelectPlan: (plan: Plan) => void;
  selectedPlanId: string | null;
  onBack: () => void;
  refreshSignal?: number;
}

const rsvpBadge = {
  in:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  maybe: 'bg-amber-50 text-amber-700 border-amber-200',
  out:   'bg-slate-100 text-slate-500 border-slate-200',
};
const rsvpLabel = (r: 'in' | 'maybe' | 'out') => t(`common.rsvp.${r}`);

export function AllPlansView({ onSelectPlan, selectedPlanId, onBack, refreshSignal }: Props) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/plans').then(res => setPlans(res.data)).finally(() => setLoading(false));
  }, [refreshSignal]);

  // Une seule liste, du plus proche au plus lointain (ordre du serveur, lib/planOrder.ts) ; le
  // Cercle est indiqué sur chaque carte (« Invitation » pour un invité externe, sans révéler le Cercle)
  const sorted = sortPlans(plans);

  return (
    <div className="w-full bg-slate-50 flex flex-col h-full flex-shrink-0 border-r border-slate-200 short:overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold text-slate-900 text-sm">{t('plan.allPlans.title')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 short:flex-none short:overflow-visible">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('common.loading')}</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('plan.allPlans.empty')}</div>
        ) : (
          <div className="space-y-2">
            {sorted.map(plan => {
              const myMember = plan.members.find(m => m.userId === user?.id);
              const inCount = plan.members.filter(m => m.rsvp === 'in').length;
              const date = plan.eventDate
                ? shortDateTime(plan.eventDate)
                : null;
              const circleName = plan.isGuest ? t('plan.allPlans.invitation') : plan.circle?.name;

              return (
                <button
                  key={plan.id}
                  onClick={() => onSelectPlan(plan)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    selectedPlanId === plan.id
                      ? 'bg-indigo-50 border-indigo-400 shadow-md'
                      : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow'
                  }`}
                >
                  {circleName && <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 truncate">{circleName}</p>}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight">{plan.title}</h3>
                    {myMember ? (
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${rsvpBadge[myMember.rsvp]}`}>
                        {rsvpLabel(myMember.rsvp)}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-600 border border-indigo-500/30">
                        {t('common.join')}
                      </span>
                    )}
                  </div>
                  {plan.description && <p className="text-slate-500 text-xs line-clamp-1 mb-2">{plan.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {date && <span className="flex items-center gap-1"><Calendar size={10} />{date}</span>}
                    <span className="flex items-center gap-1"><Users size={10} /><span className="text-emerald-600">{t('common.inCount', { count: inCount })}</span></span>
                    {(plan._count?.messages ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><MessageSquare size={10} />{plan._count!.messages}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
