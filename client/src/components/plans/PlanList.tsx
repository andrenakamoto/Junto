import { useState, useEffect } from 'react';
import { endedLast } from '../../lib/planEnd';
import { usePlanSort } from '../../lib/planSort';
import { sortPlans } from '../../lib/order';
import { PlanSortToggle } from './PlanSortToggle';
import { photoUrl } from '../../lib/photos';
import { CircleMembersSheet } from '../circles/CircleMembersSheet';
import { useMutes } from '../../contexts/MuteContext';
import { Plus, Copy, Check, Trash2, UserPlus, LogOut, ChevronLeft, CalendarRange, SlidersHorizontal, Bell, BellOff, Users, MessageCircle, Megaphone, MoreHorizontal, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Circle, Plan, CirclePoll } from '../../types';
import { PlanCard } from './PlanCard';
import { PlanSummarySheet } from './PlanSummarySheet';
import { CreatePlanModal } from './CreatePlanModal';
import { PLAN_KINDS, PlanKind } from '../../lib/planKinds';
import { AvailabilityPanel } from '../circles/AvailabilityPanel';
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
import { intlLocale, t } from '../../i18n';
import { Trans } from 'react-i18next';

interface Props {
  circle: Circle;
  plans: Plan[];
  loading: boolean;
  selectedPlanId: string | null;
  onSelectPlan: (plan: Plan, tab?: string) => void;
  onPlanCreated: (plan: Plan, tab?: string) => void;
  onCircleDeleted: () => void;
  onCircleUpdated: (circle: Circle) => void;
  onBack: () => void;
  unreadPlans: Set<string>;
  selectedPollId?: string | null;
  onSelectPoll: (pollId: string) => void;
  /** Discussion du Cercle : ouverte (carte en surbrillance) et ouverture */
  chatActive?: boolean;
  onOpenChat?: () => void;
  /** Tous mes Cercles : « Je suis dispo » peut se dire dans plusieurs Cercles à la fois */
  circles?: Circle[];
  /** Présence en ligne (fenêtre des membres) */
  onlineUserIds?: Set<string>;
  /** Plan pour plusieurs Cercles : mes autres Cercles dont je suis créateur ou organisateur */
  otherManagedCircles?: Circle[];
}

export function PlanList({ circle, plans, loading, selectedPlanId, onSelectPlan, onPlanCreated, onCircleDeleted, onCircleUpdated, onBack, unreadPlans, selectedPollId, onSelectPoll, onlineUserIds, otherManagedCircles = [], chatActive = false, onOpenChat, circles = [] }: Props) {
  const { user } = useAuth();
  // Tri choisi sur l'appareil : « Activité » (ordre reçu) ou « Date » de début
  const [planSort, setPlanSort] = usePlanSort('activity');
  // Plans terminés (lecture seule 24 h) toujours en bas
  const shownPlans = endedLast(planSort === 'date' ? sortPlans(plans) : plans);
  const { isCircleMuted, setCircleMuted } = useMutes();
  const circleMuted = isCircleMuted(circle.id);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [summaryPlan, setSummaryPlan] = useState<Plan | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  // Menu « Créer » : premier niveau, ou liste des Plans spécifiques
  const [menuLevel, setMenuLevel] = useState<'main' | 'kinds'>('main');
  const [createKind, setCreateKind] = useState<PlanKind | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [polls, setPolls] = useState<CirclePoll[]>([]);
  // Cercle dont les sondages sont chargés (évite de mettre à jour la carte avec ceux d'un autre Cercle)
  const [pollsFor, setPollsFor] = useState<string | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(circle.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function refreshPolls() {
    const id = circle.id;
    api.get(`/circles/${id}/polls`).then(res => { setPolls(res.data); setPollsFor(id); }).catch(() => {});
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

  // Carte du Cercle (barre latérale) : bandeau « À toi de voter » mis à jour dès qu'on répond, sans attendre
  // le rechargement de la liste des Cercles
  useEffect(() => {
    if (!user || pollsFor !== circle.id) return;
    const pending = polls
      .filter(p => !(p.declines ?? []).some(d => d.userId === user.id) && !p.options.some(o => o.votes.some(v => v.userId === user.id)))
      .map(p => ({ id: p.id, question: p.question }));
    const same = pending.length === (circle.pendingPolls?.length ?? 0) && pending.every((p, i) => circle.pendingPolls![i]?.id === p.id);
    if (!same || (circle.pollCount ?? 0) !== polls.length) onCircleUpdated({ ...circle, pollCount: polls.length, pendingPolls: pending });
  }, [polls, pollsFor]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeclinePoll(pollId: string) {
    const { data } = await api.post(`/circles/polls/${pollId}/decline`);
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

  // Affichage simplifié (2026-10-23) : en-tête léger (Membres, Inviter, menu ⋯), ce qui est vide est masqué, un seul
  // bouton « Créer » (Plan standard, Plan spécifique, sondage de dates ; « Je suis dispo » est à côté de la Discussion)
  const chatOn = !!(circle.chatMode && circle.chatMode !== 'off' && onOpenChat);
  const dispoOn = !circle.isPersonal && circle.availabilityEnabled !== false;
  const dispoFull = dispoOn && (circle.dispo?.count ?? 0) > 0;
  const chatFull = chatOn && !!circle.chatLast;
  const createOptions = [
    ...(canCreate ? [
      { key: 'plan', Icon: Plus, label: t('plan.kinds.menu.standard'), hint: t('plan.kinds.menu.standardHint'), run: () => { setCreateKind(null); setShowCreate(true); } },
      { key: 'kinds', Icon: Sparkles, label: t('plan.kinds.menu.specific'), hint: t('plan.kinds.menu.specificHint'), run: () => setMenuLevel('kinds') },
    ] : []),
    ...(canCreatePoll ? [{ key: 'poll', Icon: CalendarRange, label: t('circle.planList.proposeDates'), hint: t('circle.planList.pollHint'), run: () => setShowCreatePoll(true) }] : []),
  ];
  // L'Assemblée : créateur et organisateurs du Cercle seulement (pas de Cercle personnel)
  const kinds = PLAN_KINDS.filter(k => !k.managersOnly || (!circle.isPersonal && isCircleManager(circle, user?.id)));
  const closeMenu = () => { setShowCreateMenu(false); setMenuLevel('main'); };
  const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left';

  return (
    <div className="w-full bg-slate-50 flex flex-col h-full flex-shrink-0 border-r border-slate-200 short:overflow-y-auto">
      {/* Photo du Cercle : bandeau en tête, le nom écrit dessus */}
      {circle.photoKey && (
        <div className="relative h-[140px] md:h-[112px] short:h-[72px] flex-shrink-0 bg-slate-200">
          <img src={photoUrl(circle.photoKey)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <button onClick={onBack} aria-label="←" className="md:hidden absolute top-2 left-2 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/45">
            <ChevronLeft size={18} />
          </button>
          <h2 className="absolute left-4 right-4 bottom-2.5 text-white font-bold text-lg leading-tight truncate drop-shadow">{circle.name}</h2>
        </div>
      )}
      <div className="px-4 py-2.5 border-b border-slate-200">
        {!circle.photoKey && (
          <div className="flex items-center gap-2 mb-1.5">
            <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0">
              <ChevronLeft size={18} />
            </button>
            <h2 className="flex-1 min-w-0 font-bold text-slate-900 text-base leading-tight truncate">{circle.name}</h2>
          </div>
        )}
        {circle.description && (
          <button onClick={() => setDescOpen(v => !v)} className="block w-full text-left mb-2 text-xs text-slate-500 leading-relaxed break-words">
            <span className={descOpen ? 'whitespace-pre-line' : 'line-clamp-1'}>{circle.description}</span>
          </button>
        )}

        {/* Membres, Inviter ; le reste dans le menu ⋯ */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            <Users size={14} className="text-indigo-600" />{t('circle.planList.members', { count: circle.members.length })}
          </button>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            <UserPlus size={14} className="text-indigo-600" />{t('circle.planList.invite')}
          </button>
          {circleMuted && (
            <button onClick={() => setCircleMuted(circle, false)} title={t('circle.planList.mutedTap')} aria-label={t('circle.planList.mutedTap')}
              className="p-1.5 rounded-lg text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors">
              <BellOff size={14} />
            </button>
          )}
          <div className="relative ml-auto">
            <button onClick={() => setShowMore(v => !v)} title={t('circle.planList.more')} aria-label={t('circle.planList.more')} aria-expanded={showMore}
              className={`p-1.5 rounded-lg transition-colors ${showMore ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
              <MoreHorizontal size={18} />
            </button>
            {showMore && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5">
                  <button className={menuItem} onClick={() => { setShowMore(false); setCircleMuted(circle, !circleMuted); }}>
                    {circleMuted ? <Bell size={15} className="text-slate-400" /> : <BellOff size={15} className="text-slate-400" />}
                    {circleMuted ? t('circle.planList.unmuteShort') : t('circle.planList.muteShort')}
                  </button>
                  <button className={menuItem} onClick={() => { setShowMore(false); setShowSettings(true); }}>
                    <SlidersHorizontal size={15} className="text-slate-400" />{t('circle.planList.settings')}
                  </button>
                  <button className={menuItem} onClick={() => { setShowMore(false); copyCode(); }}>
                    <Copy size={15} className="text-slate-400" />{t('circle.planList.copyCode', { code: circle.code })}
                  </button>
                  {canDelete && (
                    <button className={`${menuItem} text-red-600`} onClick={() => { setShowMore(false); setShowDelete(true); }}>
                      <Trash2 size={15} />{creatorDeletes ? t('circle.planList.delete') : t('circle.planList.voteDelete')}
                    </button>
                  )}
                  <button className={menuItem} onClick={() => { setShowMore(false); setShowLeave(true); }}>
                    <LogOut size={15} className="text-slate-400" />{t('circle.planList.leave')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {codeCopied && <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600"><Check size={12} />{t('circle.planList.copied')}</p>}

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

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 short:flex-none short:overflow-visible">
        {/* Discussion avec des messages récents : la carte complète */}
        {chatFull && (
          <button onClick={onOpenChat}
            className={`w-full text-left p-3.5 rounded-2xl border transition-all relative ${chatActive ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500 shadow-md' : circle.chatUnseen ? 'bg-white border-orange-300 shadow-md hover:shadow-lg' : 'bg-white border-slate-300 shadow-md hover:border-slate-400 hover:shadow-lg'}`}>
            {circle.chatUnseen && !chatActive && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-orange-500 rounded-full" />}
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <MessageCircle size={15} className="text-indigo-500" />{t('circle.chat.title')}
              {circle.chatMode === 'announce' && <Megaphone size={13} className="text-amber-600" aria-label={t('circle.chat.announce')} />}
            </p>
            <p className="text-xs text-slate-600 mt-1 truncate"><span className="font-semibold">{circle.chatLast!.author}</span> : {circle.chatLast!.text}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(circle.chatLast!.at))}</p>
          </button>
        )}
        {/* Sans message récent ni personne de dispo : deux simples boutons sur une ligne */}
        {((chatOn && !chatFull) || (dispoOn && !dispoFull)) && (
          <div className="flex flex-wrap gap-2">
            {chatOn && !chatFull && (
              <button onClick={onOpenChat}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${chatActive ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <MessageCircle size={15} className="text-indigo-500" />{t('circle.chat.title')}
                {circle.chatUnseen && !chatActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full" />}
              </button>
            )}
            {dispoOn && !dispoFull && (
              <AvailabilityPanel circle={circle} circles={circles.length ? circles : [circle]} onPlanCreated={onPlanCreated} compact />
            )}
          </div>
        )}
        {/* « Je suis dispo » : la carte complète dès que quelqu'un est dispo */}
        {dispoFull && (
          <AvailabilityPanel circle={circle} circles={circles.length ? circles : [circle]} onPlanCreated={onPlanCreated} />
        )}
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

        {/* Sondages de dates : seulement s'il y en a ; « Proposer des dates » est dans « Créer » */}
        {polls.length > 0 && (
          <div className="mb-1">
            <p className="px-1 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('circle.planList.polls')}</p>
            <div className="space-y-2 mb-3">
              {polls.map(poll => (
                <CirclePollCard
                  key={poll.id}
                  poll={poll}
                  userId={user!.id}
                  selected={poll.id === selectedPollId}
                  onVote={handleVotePoll}
                  onDecline={() => handleDeclinePoll(poll.id)}
                  onOpen={() => onSelectPoll(poll.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('circle.planList.plans')}</p>
          {plans.length > 1 && <PlanSortToggle value={planSort} onChange={setPlanSort} />}
        </div>
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t('common.loading')}</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm px-4">
            {t('circle.planList.noPlan')}<br />
            <span className="text-slate-400">{canCreate ? t('circle.planList.createFirst') : t('circle.planList.organizersWill')}</span>
          </div>
        ) : (
          shownPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={plan.id === selectedPlanId}
              isUnread={unreadPlans.has(plan.id)}
              onClick={() => onSelectPlan(plan)}
              onSummary={() => setSummaryPlan(plan)}
            />
          ))
        )}
      </div>

      {/* Un seul bouton « Créer » : Plan standard, Plan spécifique (liste des types), sondage de dates */}
      <div className="relative px-2 py-3 border-t border-slate-200 short:sticky short:bottom-0 short:z-10 short:bg-slate-50">
        {createOptions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">{t('circle.planList.reserved')}</p>
        ) : (
          <button
            onClick={() => createOptions.length === 1 ? createOptions[0].run() : showCreateMenu ? closeMenu() : setShowCreateMenu(true)}
            aria-expanded={showCreateMenu}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors text-sm font-semibold"
          >
            <Plus size={16} />
            {createOptions.length === 1 ? (createOptions[0].key === 'plan' ? t('circle.planList.createPlan') : createOptions[0].label) : t('circle.planList.create')}
          </button>
        )}
        {showCreateMenu && createOptions.length > 1 && (
          <>
            {/* Fond assombri : le menu blanc ressort sur la colonne blanche */}
            <div className="fixed inset-0 z-20 bg-slate-900/50" onClick={closeMenu} />
            <div className="absolute left-2 right-2 bottom-full mb-2 z-30 bg-white border-2 border-indigo-400 rounded-2xl shadow-2xl p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
              {menuLevel === 'main' ? createOptions.map(({ key, Icon, label, hint, run }) => (
                <button key={key} onClick={() => { if (key !== 'kinds') closeMenu(); run(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 transition-colors">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600"><Icon size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                  {key === 'kinds' && <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
                </button>
              )) : (
                <>
                  <button onClick={() => setMenuLevel('main')} className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                    <ChevronLeft size={14} />{t('plan.kinds.menu.specific')}
                  </button>
                  {kinds.map(({ kind, emoji }) => (
                    <button key={kind} onClick={() => { closeMenu(); setCreateKind(kind); setShowCreate(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-lg">{emoji}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{t(`plan.kinds.${kind}.name`)}</span>
                        <span className="block text-xs text-slate-500">{t(`plan.kinds.${kind}.hint`)}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showInvite && (
        <InviteModal
          circleName={circle.name}
          circleCode={circle.code}
          circleId={circle.id}
          admissionMode={circle.admissionMode}
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
          otherCircles={user && isCircleManager(circle, user.id) ? otherManagedCircles : []}
          kind={createKind}
          onClose={() => setShowCreate(false)}
          onCreated={(plan, tab) => { onPlanCreated(plan, tab); setShowCreate(false); }}
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
      {summaryPlan && (
        <PlanSummarySheet planId={summaryPlan.id} onClose={() => setSummaryPlan(null)} onOpenTab={tab => { const p = summaryPlan; setSummaryPlan(null); onSelectPlan(p, tab); }} />
      )}
    </div>
  );
}
