import { useState, useEffect } from 'react';
import { CircleMembersSheet } from '../circles/CircleMembersSheet';
import { useMutes } from '../../contexts/MuteContext';
import { Plus, Copy, Check, Trash2, UserPlus, LogOut, ChevronLeft, CalendarRange, SlidersHorizontal, Bell, BellOff, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Circle, Plan, CirclePoll } from '../../types';
import { PlanCard } from './PlanCard';
import { CreatePlanModal } from './CreatePlanModal';
import { DeleteCircleModal } from '../circles/DeleteCircleModal';
import { LeaveCircleModal } from '../circles/LeaveCircleModal';
import { InviteModal } from '../circles/InviteModal';
import { CreateCirclePollModal } from '../circles/CreateCirclePollModal';
import { CirclePollCard } from '../circles/CirclePollCard';
import { CircleSettingsModal } from '../circles/CircleSettingsModal';
import { isCircleManager } from '../../lib/settings';
import api from '../../services/api';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { JoinRequestList } from '../circles/JoinRequestList';
import { t } from '../../i18n';
import { Trans } from 'react-i18next';

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
  selectedPollId?: string | null;
  onSelectPoll: (pollId: string) => void;
  /** Présence en ligne (fenêtre des membres) */
  onlineUserIds?: Set<string>;
}

export function PlanList({ circle, plans, loading, selectedPlanId, onSelectPlan, onPlanCreated, onCircleDeleted, onCircleUpdated, onBack, unreadPlans, selectedPollId, onSelectPoll, onlineUserIds }: Props) {
  const { user } = useAuth();
  const { isCircleMuted, setCircleMuted } = useMutes();
  const circleMuted = isCircleMuted(circle.id);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [polls, setPolls] = useState<CirclePoll[]>([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(circle.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function refreshPolls() {
    api.get(`/circles/${circle.id}/polls`).then(res => setPolls(res.data)).catch(() => {});
  }

  useEffect(() => { refreshPolls(); }, [circle.id]);
  // Sondage de dates créé, voté ou converti par un autre membre
  useSocketEvent<{ circleId: string }>('circle-updated', p => { if (p.circleId === circle.id) refreshPolls(); });
  // Compteur de messages des cartes de sondage
  useSocketEvent<{ pollId: string }>('poll-message', p => {
    setPolls(prev => prev.map(x => x.id === p.pollId ? { ...x, _count: { messages: (x._count?.messages ?? 0) + 1 } } : x));
  });

  async function handleVotePoll(optionId: string) {
    const { data } = await api.post(`/circles/polls/options/${optionId}/vote`);
    setPolls(prev => prev.map(p => p.id === data.id ? data : p));
  }


  const votes = circle.deleteVotes ?? [];
  const threshold = Math.ceil(circle.members.length / 2);
  const hasMyVote = votes.some(v => v.userId === user?.id);
  // Paramètre avancé : suppression par le créateur seul → bouton réservé au créateur
  const creatorDeletes = circle.deletionMode === 'creator';
  const canDelete = !creatorDeletes || circle.creatorId === user?.id;
  // Paramètre avancé : création des Plans et des sondages de dates réservée au créateur
  const canCreate = circle.planCreationMode !== 'creator' || isCircleManager(circle, user?.id);
  const canCreatePoll = circle.pollCreationMode !== 'creator' || isCircleManager(circle, user?.id);

  return (
    <div className="w-full bg-slate-50 flex flex-col h-full flex-shrink-0 border-r border-slate-200 short:overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200">
        {/* Grand écran (colonne étroite) : actions sur une 2e ligne, sous le nom du Cercle */}
        <div className="flex items-start justify-between gap-2 md:flex-wrap md:gap-y-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0 md:basis-full">
            <button
              onClick={onBack}
              className="md:hidden p-1 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900 text-sm leading-tight truncate">{circle.name}</h2>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 mt-1 text-xs text-indigo-600 hover:text-indigo-700 transition-colors group"
              >
                {codeCopied
                  ? <Check size={10} className="text-emerald-600" />
                  : <Copy size={10} className="group-hover:text-indigo-700" />}
                <span><Trans i18nKey="circle.planList.code" values={{ code: circle.code }} components={{ b: <span className="font-mono tracking-widest" /> }} /></span>
                {codeCopied && <span className="text-emerald-600 ml-1">{t('circle.planList.copied')}</span>}
              </button>
            </div>
          </div>

          <div className="flex items-center flex-shrink-0 md:-ml-1.5">
          {/* Membres du Cercle */}
          <button
            onClick={() => setShowMembers(true)}
            title={t('circle.planList.members', { count: circle.members.length })}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <Users size={14} />
          </button>

          {/* Invite button */}
          <button
            onClick={() => setShowInvite(true)}
            title={t('circle.planList.invite')}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <UserPlus size={14} />
          </button>

          {/* Mode silencieux du Cercle : plus de notifications ni d'emails pour tous ses Plans */}
          <button
            onClick={() => setCircleMuted(circle, !circleMuted)}
            title={circleMuted ? t('circle.planList.mutedTap') : t('circle.planList.mute')}
            aria-pressed={circleMuted}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${circleMuted ? 'text-slate-600 bg-slate-200 hover:bg-slate-300' : 'text-indigo-600 hover:text-indigo-700 hover:bg-slate-100'}`}
          >
            {circleMuted ? <BellOff size={14} /> : <Bell size={14} />}
          </button>

          {/* Paramètres avancés (lecture seule sauf pour le créateur) */}
          <button
            onClick={() => setShowSettings(true)}
            title={t('circle.planList.settings')}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* Delete vote button */}
          {canDelete && <button
            onClick={() => setShowDelete(true)}
            title={creatorDeletes ? t('circle.planList.delete') : t('circle.planList.voteDelete')}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              hasMyVote
                ? 'text-red-600 bg-red-500/10 hover:bg-red-100'
                : 'text-indigo-600 hover:text-red-600 hover:bg-slate-100'
            }`}
          >
            <Trash2 size={14} />
          </button>}

          {/* Leave circle button */}
          <button
            onClick={() => setShowLeave(true)}
            title={t('circle.planList.leave')}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-amber-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <LogOut size={14} />
          </button>
          </div>
        </div>

        {circle.description && (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed whitespace-pre-line break-words line-clamp-3" title={circle.description}>
            {circle.description}
          </p>
        )}

        {/* Vote progress hint */}
        {votes.length > 0 && (
          <button
            onClick={() => setShowDelete(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 transition-colors"
          >
            <Trash2 size={10} />
            {votes.length}/{threshold} vote{threshold > 1 ? 's' : ''} pour supprimer
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 short:flex-none short:overflow-visible">
        {/* Demandes pour rejoindre le Cercle : affiché seulement s'il y en a */}
        {(circle.joinRequests?.length ?? 0) > 0 && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            <p className="px-1 mb-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus size={12} />
              {t('circle.planList.wantToJoin', { count: circle.joinRequests!.length })}
            </p>
            <JoinRequestList circle={circle} onCircleUpdated={onCircleUpdated} />
          </div>
        )}

        <div className="mb-1">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('circle.planList.polls')}</p>
            {canCreatePoll && (
              <button
                onClick={() => setShowCreatePoll(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <CalendarRange size={12} />{t('circle.planList.proposeDates')}
              </button>
            )}
          </div>
          {polls.length === 0 ? (
            <p className="px-1 mb-3 text-xs text-slate-400 italic">{t('circle.planList.noPoll')}</p>
          ) : (
            <div className="space-y-2 mb-3">
              {polls.map(poll => (
                <CirclePollCard
                  key={poll.id}
                  poll={poll}
                  userId={user!.id}
                  selected={poll.id === selectedPollId}
                  onVote={handleVotePoll}
                  onOpen={() => onSelectPoll(poll.id)}
                />
              ))}
            </div>
          )}
        </div>

        <p className="px-1 pt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('circle.planList.plans')}</p>
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('common.loading')}</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm px-4">
            {t('circle.planList.noPlan')}<br />
            <span className="text-slate-400">{canCreate ? t('circle.planList.createFirst') : t('circle.planList.organizersWill')}</span>
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

      <div className="px-2 py-3 border-t border-slate-200 short:sticky short:bottom-0 short:z-10 short:bg-slate-50">
        {canCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors text-sm font-semibold"
          >
            <Plus size={16} />
            {t('circle.planList.createPlan')}
          </button>
        ) : (
          <p className="px-3 py-2 text-xs text-slate-400">{t('circle.planList.reserved')}</p>
        )}
      </div>

      {showInvite && (
        <InviteModal
          circleName={circle.name}
          circleCode={circle.code}
          circleId={circle.id}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showMembers && (
        <CircleMembersSheet circle={circle} onlineUserIds={onlineUserIds} onClose={() => setShowMembers(false)} onCircleUpdated={onCircleUpdated} />
      )}

      {showCreate && (
        <CreatePlanModal
          circleId={circle.id}
          circleMembers={circle.members}
          onClose={() => setShowCreate(false)}
          onCreated={(plan) => { onPlanCreated(plan); setShowCreate(false); }}
        />
      )}

      {showCreatePoll && (
        <CreateCirclePollModal
          circleId={circle.id}
          circleMembers={circle.members}
          onClose={() => setShowCreatePoll(false)}
          onCreated={(poll) => { setPolls(prev => [poll, ...prev]); setShowCreatePoll(false); onSelectPoll(poll.id); }}
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

      {showSettings && (
        <CircleSettingsModal
          circle={circle}
          onClose={() => setShowSettings(false)}
          onUpdated={(c) => { onCircleUpdated(c); setShowSettings(false); }}
        />
      )}

      {showLeave && (
        <LeaveCircleModal
          circle={circle}
          onClose={() => setShowLeave(false)}
          onLeft={() => { setShowLeave(false); onCircleDeleted(); }}
        />
      )}
    </div>
  );
}
