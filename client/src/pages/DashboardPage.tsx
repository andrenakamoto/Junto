import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Circle, Plan } from '../types';
import api from '../services/api';
import { CircleSidebar } from '../components/circles/CircleSidebar';
import { PlanList } from '../components/plans/PlanList';
import { PlanDetail } from '../components/plans/PlanDetail';
import { PollDetail } from '../components/circles/PollDetail';
import { AllPlansView } from '../components/plans/AllPlansView';
import { CalendarView } from '../components/plans/CalendarView';
import { NotificationToast, AppNotification } from '../components/ui/NotificationToast';
import { getSocket } from '../lib/socket';
import { useUnread } from '../hooks/useUnread';
import { TermsModal } from '../components/ui/TermsModal';
import { EmailMigrationBanner } from '../components/ui/EmailMigrationBanner';
import { ProfileNameBanner } from '../components/ui/ProfileNameBanner';
import { LogoIcon } from '../components/ui/Logo';
import { disconnectSocket } from '../lib/socket';
import { getPendingInvite } from '../lib/pendingInvite';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { sortCircles, sortPlans } from '../lib/order';

type MobileView = 'circles' | 'plans' | 'detail';

export function DashboardPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [circlesLoaded, setCirclesLoaded] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  // Sondage de dates ouvert dans le panneau de droite (exclusif avec selectedPlan)
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const selectedPollIdRef = useRef(selectedPollId);
  useEffect(() => { selectedPollIdRef.current = selectedPollId; }, [selectedPollId]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('circles');
  const [allPlansActive, setAllPlansActive] = useState(false);
  const [calendarActive, setCalendarActive] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [plansRefreshSignal, setPlansRefreshSignal] = useState(0);
  const { unreadCircles, unreadPlans, markCircle, markPlan, clearCircle, clearPlan } = useUnread();
  const selectedCircleIdRef = useRef(selectedCircleId);
  useEffect(() => { selectedCircleIdRef.current = selectedCircleId; }, [selectedCircleId]);
  const selectedPlanRef = useRef(selectedPlan);
  useEffect(() => { selectedPlanRef.current = selectedPlan; }, [selectedPlan]);

  // ─── Rafraîchissement ────────────────────────────────────────────────────
  // Le serveur signale les changements (plan-updated / circle-updated) ; on recharge aussi
  // tout au retour sur l'onglet et après une coupure de connexion. Les appels sont regroupés
  // (plusieurs événements rapprochés = un seul rechargement).
  const pending = useRef<Record<string, number>>({});
  function soon(key: string, fn: () => void) {
    window.clearTimeout(pending.current[key]);
    pending.current[key] = window.setTimeout(fn, 250);
  }

  function refreshCircles() {
    soon('circles', () => api.get('/circles').then(res => setCircles(res.data)).catch(() => {}));
  }

  function refreshPlans() {
    soon('plans', () => {
      const circleId = selectedCircleIdRef.current;
      if (!circleId) return;
      api.get(`/circles/${circleId}/plans`)
        .then(res => { if (selectedCircleIdRef.current === circleId) setPlans(res.data); })
        .catch(() => {});
    });
    setPlansRefreshSignal(v => v + 1); // « Tous mes plans » et calendrier
  }

  function refreshSelectedPlan() {
    soon('plan', () => {
      const current = selectedPlanRef.current;
      if (!current) return;
      api.get(`/plans/${current.id}`)
        .then(res => {
          if (selectedPlanRef.current?.id !== current.id) return;
          setSelectedPlan(res.data);
          setPlans(prev => prev.map(p => p.id === res.data.id ? { ...p, ...res.data } : p));
        })
        .catch(err => {
          const status = err.response?.status;
          if ((status !== 404 && status !== 403) || selectedPlanRef.current?.id !== current.id) return;
          // Plan supprimé (ou devenu inaccessible) pendant qu'il était ouvert
          setSelectedPlan(null);
          setPlans(prev => prev.filter(p => p.id !== current.id));
          setMobileView('plans');
          setNotifications(prev => [...prev, {
            id: crypto.randomUUID(), at: Date.now(), type: 'plan_gone',
            planTitle: current.title,
          } as AppNotification]);
        });
    });
  }

  function refreshAll() {
    refreshCircles();
    refreshPlans();
    refreshSelectedPlan();
  }

  useSocketEvent<{ circleId: string }>('circle-updated', ({ circleId }) => {
    refreshCircles();
    if (circleId === selectedCircleIdRef.current) refreshPlans();
    else setPlansRefreshSignal(v => v + 1);
    if (selectedPlanRef.current?.circleId === circleId) refreshSelectedPlan();
  });

  useSocketEvent<{ planId: string }>('plan-updated', ({ planId }) => {
    if (selectedPlanRef.current?.id === planId) refreshSelectedPlan();
  });

  // Reconnexion après une coupure : des changements ont pu être manqués
  const connectedOnce = useRef(false);
  useSocketEvent('connect', () => {
    if (connectedOnce.current) refreshAll();
    connectedOnce.current = true;
  });

  // Retour sur l'onglet / téléphone déverrouillé (au plus une fois toutes les 15 s)
  const lastVisibleRefresh = useRef(Date.now());
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastVisibleRefresh.current < 15_000) return;
      lastVisibleRefresh.current = Date.now();
      refreshAll();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cercle supprimé ou quitté ailleurs : on le désélectionne
  useEffect(() => {
    if (!circlesLoaded || !selectedCircleId) return;
    if (!circles.some(c => c.id === selectedCircleId)) {
      setSelectedCircleId(null);
      setSelectedPlan(null);
      setSelectedPollId(null);
      setMobileView('circles');
    }
  }, [circles, circlesLoaded, selectedCircleId]);

  useEffect(() => {
    api.get('/circles').then(res => {
      setCircles(res.data);
      setCirclesLoaded(true);
    });
  }, []);

  // Invitation à un Plan ouverte avant la connexion / l'inscription : on y retourne
  useEffect(() => {
    const pending = getPendingInvite();
    if (pending) navigate(`/invitation?token=${pending}`, { replace: true });
  }, [navigate]);

  // Deep-link depuis un lien d'invitation vers un Plan précis (?planId=...)
  useEffect(() => {
    const deepLinkPlanId = searchParams.get('planId');
    // Un invité externe peut n'être dans aucun Cercle : on attend le chargement, pas un Cercle
    if (!deepLinkPlanId || !circlesLoaded) return;
    setSearchParams(prev => { prev.delete('planId'); return prev; }, { replace: true });
    api.get(`/plans/${deepLinkPlanId}`)
      .then(res => handleSelectPlan(res.data))
      .catch(() => {});
  }, [circles, circlesLoaded, searchParams]);

  // Deep-link vers un sondage de dates (?circleId=...&pollId=..., ex. email de rappel)
  useEffect(() => {
    const deepLinkPollId = searchParams.get('pollId');
    const deepLinkCircleId = searchParams.get('circleId');
    if (!deepLinkPollId || !deepLinkCircleId || !circlesLoaded) return;
    setSearchParams(prev => { prev.delete('pollId'); prev.delete('circleId'); return prev; }, { replace: true });
    if (!circles.some(c => c.id === deepLinkCircleId)) return;
    handleSelectCircle(deepLinkCircleId);
    openPoll(deepLinkPollId);
  }, [circles, circlesLoaded, searchParams]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('estelle_token');
    if (!token) return;
    const socket = getSocket(token);
    function onNotification(data: Omit<AppNotification, 'id' | 'at'>) {
      // Message dans le sondage déjà ouvert : pas de notification
      if (data.type === 'poll_message' && data.pollId === selectedPollIdRef.current) return;
      setNotifications(prev => [...prev, { ...data, id: crypto.randomUUID(), at: Date.now() }]);
      if (data.circleId) markCircle(data.circleId);
      if (data.planId) markPlan(data.planId);
      if (data.type === 'join_accepted') {
        api.get('/circles').then(res => setCircles(res.data));
      }
      if (data.type === 'new_plan') {
        api.get('/circles').then(res => setCircles(res.data));
        setPlansRefreshSignal(v => v + 1);
        if (data.planId && data.circleId === selectedCircleIdRef.current) {
          api.get(`/plans/${data.planId}`).then(res => {
            setPlans(prev => prev.some(p => p.id === res.data.id) ? prev : [res.data, ...prev]);
          }).catch(() => {});
        }
      }
    }
    socket.on('notification', onNotification);

    function onPresence({ userId, online }: { userId: string; online: boolean }) {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    }
    socket.on('presence', onPresence);

    function onPresenceSnapshot(userIds: string[]) {
      setOnlineUserIds(new Set(userIds));
    }
    socket.on('presence-snapshot', onPresenceSnapshot);

    return () => {
      socket.off('notification', onNotification);
      socket.off('presence', onPresence);
      socket.off('presence-snapshot', onPresenceSnapshot);
    };
  }, [user]);

  useEffect(() => {
    if (!selectedCircleId) { setPlans([]); return; }
    setLoadingPlans(true);
    setSelectedPlan(null);
    api.get(`/circles/${selectedCircleId}/plans`)
      .then(res => setPlans(res.data))
      .finally(() => setLoadingPlans(false));
  }, [selectedCircleId]);

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate('/auth');
  }

  function handlePlanUpdated(updated: Plan) {
    setPlans(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
    setSelectedPlan(updated);
  }

  function handlePlanDeleted() {
    if (!selectedPlan) return;
    setPlans(prev => prev.filter(p => p.id !== selectedPlan.id));
    setSelectedPlan(null);
    setMobileView('plans');
  }

  function handlePlanCreated(plan: Plan) {
    setPlans(prev => [plan, ...prev]);
    setSelectedPlan(plan);
    setMobileView('detail');
  }

  function openPoll(pollId: string) {
    setSelectedPlan(null);
    setSelectedPollId(pollId);
    setMobileView('detail');
  }

  function handleSelectCircle(id: string) {
    setSelectedPollId(null);
    setSelectedCircleId(id);
    setAllPlansActive(false);
    setCalendarActive(false);
    setMobileView('plans');
    clearCircle(id);
  }

  function handleAllPlans() {
    setSelectedPollId(null);
    setAllPlansActive(true);
    setCalendarActive(false);
    setSelectedCircleId(null);
    setSelectedPlan(null);
    setMobileView('plans');
  }

  function handleCalendar() {
    setSelectedPollId(null);
    setCalendarActive(true);
    setAllPlansActive(false);
    setSelectedCircleId(null);
    setSelectedPlan(null);
    setMobileView('plans');
  }

  function handleSelectPlan(plan: Plan) {
    setSelectedPollId(null);
    clearPlan(plan.id);
    if (plan.circleId && circles.some(c => c.id === plan.circleId)) {
      clearCircle(plan.circleId);
      setSelectedCircleId(plan.circleId);
      setAllPlansActive(false);
      setCalendarActive(false);
    } else if (plan.circleId) {
      // Invité externe : pas d'accès au Cercle, on affiche le Plan depuis « Tous mes plans »
      setSelectedCircleId(null);
      setAllPlansActive(true);
      setCalendarActive(false);
    }
    api.get(`/plans/${plan.id}`).then(res => {
      setSelectedPlan(res.data);
      setMobileView('detail');
    });
  }

  function handleCircleDeleted() {
    const remaining = circles.filter(c => c.id !== selectedCircleId);
    setCircles(remaining);
    setSelectedCircleId(remaining.length > 0 ? remaining[0].id : null);
    setSelectedPlan(null);
    setSelectedPollId(null);
    setMobileView('circles');
  }

  function handleCircleUpdated(updated: Circle) {
    setCircles(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  async function handleAcceptTerms() {
    const { data } = await api.post('/auth/accept-terms');
    setUser(data);
  }

  const selectedCircle = circles.find(c => c.id === selectedCircleId) ?? null;
  // Le plus proche d'abord, y compris juste après une création (avant le rechargement)
  const sortedCircles = useMemo(() => sortCircles(circles), [circles]);
  const sortedPlans = useMemo(() => sortPlans(plans), [plans]);

  const showCircles = mobileView === 'circles';
  const showPlans   = mobileView === 'plans';
  const showDetail  = mobileView === 'detail';

  return (
    <>
    {user && !user.termsAccepted && (
      <TermsModal onAccept={handleAcceptTerms} />
    )}
    <NotificationToast
      notifications={notifications}
      onDismiss={id => setNotifications(prev => prev.filter(n => n.id !== id))}
      onClickNotification={n => {
        setNotifications(prev => prev.filter(x => x.id !== n.id));
        if (n.planId) {
          handleSelectPlan({ id: n.planId, circleId: n.circleId } as any);
        } else if (n.pollId && n.circleId) {
          handleSelectCircle(n.circleId);
          openPoll(n.pollId);
        } else if (n.circleId) {
          handleSelectCircle(n.circleId);
        }
      }}
    />
    {/* Les bandeaux prennent leur place dans la hauteur de l'écran au lieu de pousser le bas hors de la vue */}
    <div className="h-dvh flex flex-col bg-slate-100">
    <EmailMigrationBanner />
    <ProfileNameBanner />
    <div className="flex flex-1 min-h-0 bg-slate-100 overflow-hidden">
      {/* Colonne 1 — Cercles */}
      <div className={`${showCircles ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 flex-shrink-0 h-full`}>
        <CircleSidebar
          circles={sortedCircles}
          selectedId={allPlansActive ? null : selectedCircleId}
          onSelect={handleSelectCircle}
          onCreated={c => {
            setCircles(prev => [...prev, c]);
            setSelectedCircleId(c.id);
            setAllPlansActive(false);
            setCalendarActive(false);
            setMobileView('plans');
          }}
          onAllPlans={handleAllPlans}
          allPlansActive={allPlansActive}
          onCalendar={handleCalendar}
          calendarActive={calendarActive}
          onCircleUpdated={handleCircleUpdated}
          unreadCount={unreadCircles.size}
          unreadCircles={unreadCircles}
        />
      </div>

      {/* Colonne 2 — Plans */}
      {calendarActive ? (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 flex-shrink-0 h-full`}>
          <CalendarView
            onSelectPlan={handleSelectPlan}
            selectedPlanId={selectedPlan?.id ?? null}
            onBack={() => setMobileView('circles')}
            refreshSignal={plansRefreshSignal}
          />
        </div>
      ) : allPlansActive ? (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 flex-shrink-0 h-full`}>
          <AllPlansView
            onSelectPlan={handleSelectPlan}
            selectedPlanId={selectedPlan?.id ?? null}
            onBack={() => setMobileView('circles')}
            refreshSignal={plansRefreshSignal}
          />
        </div>
      ) : selectedCircle ? (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 flex-shrink-0 h-full`}>
          <PlanList
            circle={selectedCircle}
            plans={sortedPlans}
            loading={loadingPlans}
            selectedPlanId={selectedPlan?.id ?? null}
            onSelectPlan={handleSelectPlan}
            onPlanCreated={handlePlanCreated}
            onCircleDeleted={handleCircleDeleted}
            onCircleUpdated={handleCircleUpdated}
            onBack={() => setMobileView('circles')}
            unreadPlans={unreadPlans}
            selectedPollId={selectedPollId}
            onSelectPoll={openPoll}
          />
        </div>
      ) : (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-1`}>
          <EmptyState message="Bienvenue !" sub="Crée un Cercle ou rejoins-en un pour commencer" />
        </div>
      )}

      {/* Colonne 3 — Détail */}
      <div className={`${showDetail ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full`}>
        {selectedPollId && selectedCircle ? (
          <PollDetail
            pollId={selectedPollId}
            circle={selectedCircle}
            onBack={() => setMobileView('plans')}
            onClosed={() => { setSelectedPollId(null); setMobileView('plans'); }}
            onPlanCreated={plan => { setSelectedPollId(null); handlePlanCreated(plan); }}
          />
        ) : selectedPlan ? (
          <PlanDetail
            plan={selectedPlan}
            circleName={selectedCircle?.name ?? ''}
            circleCode={selectedCircle?.code ?? ''}
            onPlanUpdated={handlePlanUpdated}
            onPlanDeleted={handlePlanDeleted}
            onLogout={handleLogout}
            onBack={() => setMobileView('plans')}
            user={user!}
            onlineUserIds={onlineUserIds}
            circleMembers={selectedCircle?.members ?? []}
          />
        ) : (
          <EmptyState message="Sélectionne un Plan" sub="ou crée-en un nouveau dans ce Cercle" />
        )}
      </div>
    </div>
    </div>
    </>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <LogoIcon size={64} light />
        </div>
        <p className="text-indigo-600 text-xs font-semibold uppercase tracking-widest mb-4">Events Linked to You</p>
        <p className="text-lg font-semibold text-slate-700 mb-1">{message}</p>
        <p className="text-sm text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
