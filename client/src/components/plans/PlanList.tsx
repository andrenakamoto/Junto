import { useState } from 'react';
import { Plus, Copy, Check, Trash2, UserPlus, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Circle, Plan } from '../../types';
import { PlanCard } from './PlanCard';
import { CreatePlanModal } from './CreatePlanModal';
import { DeleteCircleModal } from '../circles/DeleteCircleModal';
import { InviteModal } from '../circles/InviteModal';

interface Props {
  circle: Circle;
  plans: Plan[];
  loading: boolean;
  selectedPlanId: string | null;
  onSelectPlan: (plan: Plan) => void;
  onPlanCreated: (plan: Plan) => void;
  onCircleDeleted: () => void;
  onCircleUpdated: (circle: Circle) => void;
  onBack: () => void;
  unreadPlans: Set<string>;
}

export function PlanList({ circle, plans, loading, selectedPlanId, onSelectPlan, onPlanCreated, onCircleDeleted, onCircleUpdated, onBack, unreadPlans }: Props) {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(circle.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  const votes = circle.deleteVotes ?? [];
  const threshold = Math.ceil(circle.members.length / 2);
  const hasMyVote = votes.some(v => v.userId === user?.id);

  return (
    <div className="w-full bg-slate-800 flex flex-col h-full flex-shrink-0 border-r border-slate-700/50">
      <div className="px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="md:hidden p-1 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white text-sm leading-tight truncate">{circle.name}</h2>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 hover:text-slate-300 transition-colors group"
              >
                {codeCopied
                  ? <Check size={10} className="text-emerald-400" />
                  : <Copy size={10} className="group-hover:text-slate-300" />}
                <span>Code : <span className="font-mono tracking-widest">{circle.code}</span></span>
                {codeCopied && <span className="text-emerald-400 ml-1">Copié !</span>}
              </button>
            </div>
          </div>

          {/* Invite button */}
          <button
            onClick={() => setShowInvite(true)}
            title="Inviter par SMS"
            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <UserPlus size={14} />
          </button>

          {/* Delete vote button */}
          <button
            onClick={() => setShowDelete(true)}
            title="Voter pour supprimer ce Cercle"
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              hasMyVote
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-slate-600 hover:text-red-400 hover:bg-slate-700'
            }`}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Vote progress hint */}
        {votes.length > 0 && (
          <button
            onClick={() => setShowDelete(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Trash2 size={10} />
            {votes.length}/{threshold} vote{threshold > 1 ? 's' : ''} pour supprimer
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Chargement...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm px-4">
            Aucun Plan pour l'instant.<br />
            <span className="text-slate-600">Crée le premier !</span>
          </div>
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={plan.id === selectedPlanId}
              isUnread={unreadPlans.has(plan.id)}
              onClick={() => onSelectPlan(plan)}
            />
          ))
        )}
      </div>

      <div className="px-2 py-3 border-t border-slate-700/50">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Créer un Plan
        </button>
      </div>

      {showInvite && (
        <InviteModal
          circleName={circle.name}
          circleCode={circle.code}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showCreate && (
        <CreatePlanModal
          circleId={circle.id}
          onClose={() => setShowCreate(false)}
          onCreated={(plan) => { onPlanCreated(plan); setShowCreate(false); }}
        />
      )}

      {showDelete && (
        <DeleteCircleModal
          circle={circle}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { setShowDelete(false); onCircleDeleted(); }}
          onUpdated={(c) => { onCircleUpdated(c); }}
        />
      )}
    </div>
  );
}
