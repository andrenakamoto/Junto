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
import { NotificationCenter } from '../components/ui/NotificationCenter';
import { clearDeliveredNotifications, pushAvailable } from '../lib/push';

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
  // Historique des notifications reçues (panneau de la cloche), gardé sur l'appareil pour ce
  // compte : 30 dernières, 7 jours au plus
  const historyKey = `evly_notif_history_${user?.id}`;
  const [notifHistory, setNotifHistory] = useState<AppNotification[]>(() => {
    try {
      const list: AppNotification[] = JSON.parse(localStorage.getItem(historyKey) || '[]');
      return list.filter(n => Date.now() - n.at < 7 * 864e5);
    } catch { return []; }
  });
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  // Invitations reçues à rejoindre un Cercle (comptées sur la cloche)
  const [invitesCount, setInvitesCount] = useState(0);
  const refreshInvites = () => api.get('/circles/invitations/mine').then(res => setInvitesCount(res.data.length)).catch(() => {});
  useEffect(() => { if (user) refreshInvites(); }, [user?.id]);
  // Lien des emails et notifications d'invitation : /dashboard?invitations=1 ouvre la cloche
  useEffect(() => {
    if (searchParams.get('invitations') !== '1') return;
    setShowNotifCenter(true);
    setSearchParams(prev => { prev.delete('invitations'); return prev; }, { replace: true });
  }, [searchParams]);
  // Apps : à l'ouverture (et à chaque retour dans l'app), les notifications du volet du
  // téléphone disparaissent
  useEffect(() => {
    if (!pushAvailable || !user) return;
    function clear() { if (!document.hidden) clearDeliveredNotifications(); }
    clear();
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, [user?.id]);
  useEffect(() => {
    try { localStorage.setItem(historyKey, JSON.stringify(notifHistory)); } catch { /* stockage indisponible */ }
  }, [notifHistory, historyKey]);
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

  // Deep-link vers un Cercle (?circleId=...) ou un sondage de dates (&pollId=..., ex. email
  // de rappel, notification push)
  useEffect(() => {
    const deepLinkPollId = searchParams.get('pollId');
    const deepLinkCircleId = searchParams.get('circleId');
    if (!deepLinkCircleId || !circlesLoaded) return;
    setSearchParams(prev => { prev.delete('pollId'); prev.delete('circleId'); return prev; }, { replace: true });
    if (!circles.some(c => c.id === deepLinkCircleId)) return;
    handleSelectCircle(deepLinkCircleId);
    if (deepLinkPollId) openPoll(deepLinkPollId);
  }, [circles, circlesLoaded, searchParams]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('estelle_token');
    if (!token) return;
    const socket = getSocket(token);
    function onNotification(data: Omit<AppNotification, 'id' | 'at'>) {
      // Message dans le sondage déjà ouvert : pas de notification
      if (data.type === 'poll_message' && data.pollId === selectedPollIdRef.current) return;
      const notification = { ...data, id: crypto.randomUUID(), at: Date.now() };
      setNotifications(prev => [...prev, notification]);
      setNotifHistory(prev => [notification, ...prev].slice(0, 30));
      if (data.circleId) markCircle(data.circleId);
      if (data.planId) markPlan(data.planId);
      if (data.type === 'circle_invite') refreshInvites();
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
    setPlans(prev => {
      const next = prev.map(p => p.id === updated.id ? { ...p, ...updated } : p);
      // Onglet consulté : la pastille du Cercle suit sans attendre un rechargement de la liste
      if (updated.unseen && updated.circleId) {
        const news = next.some(p => p.circleId === updated.circleId && (p.unseen?.length ?? 0) > 0);
        setCircles(cs => cs.map(c => c.id === updated.circleId ? { ...c, hasUnseen: news } : c));
      }
      return next;
    });
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

  // Ouvre ce que concerne une notification (bulle ou panneau de la cloche)
  function openNotification(n: AppNotification) {
    if (n.type === 'circle_invite') {
      setShowNotifCenter(true);
    } else if (n.planId) {
      handleSelectPlan({ id: n.planId, circleId: n.circleId } as any);
    } else if (n.pollId && n.circleId) {
      handleSelectCircle(n.circleId);
      openPoll(n.pollId);
    } else if (n.circleId) {
      handleSelectCircle(n.circleId);
    }
  }

  // Cloche : une notification disparaît de la liste dès que ce qu'elle concerne est ouvert
  // (Plan, sondage, ou Cercle pour les demandes d'adhésion)
  function dismissHistory(match: (n: AppNotification) => boolean) {
    setNotifHistory(prev => (prev.some(match) ? prev.filter(n => !match(n)) : prev));
  }

  function openPoll(pollId: string) {
    dismissHistory(n => n.pollId === pollId);
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
    dismissHistory(n => n.circleId === id && !n.planId && !n.pollId);
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
    dismissHistory(n => n.planId === plan.id);
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
  // Pastille des Cercles : notifications reçues + Plans avec du nouveau (serveur). Pour le Cercle
  // ouvert, on suit directement ses cartes, qui se mettent à jour dès qu'un onglet est consulté.
  const circlesWithNews = useMemo(() => {
    const set = new Set(unreadCircles);
    for (const c of circles) {
      const news = c.id === selectedCircleId ? plans.some(p => (p.unseen?.length ?? 0) > 0) : !!c.hasUnseen;
      if (news) set.add(c.id);
    }
    return set;
  }, [unreadCircles, circles, plans, selectedCircleId]);

  // Bouton retour Android (événement « evly-back » de NativeChrome) : écran étroit →
  // Plan/sondage → Plans → Cercles ; écran large → fermer le Plan ou le sondage ouvert.
  const backState = useRef({ mobileView, open: false, notifCenter: false });
  backState.current = { mobileView, open: !!selectedPlan || !!selectedPollId, notifCenter: showNotifCenter };
  useEffect(() => {
    function onBack(e: Event) {
      const { mobileView: view, open, notifCenter } = backState.current;
      // Panneau des notifications ouvert : le retour le ferme
      if (notifCenter) {
        e.preventDefault();
        setShowNotifCenter(false);
        return;
      }
      if (window.matchMedia('(min-width: 768px)').matches) {
        if (!open) return;
        setSelectedPlan(null);
        setSelectedPollId(null);
      } else if (view === 'detail') {
        setMobileView('plans');
      } else if (view === 'plans') {
        setMobileView('circles');
      } else {
        return; // déjà sur les Cercles : l'app passe en arrière-plan
      }
      e.preventDefault();
    }
    window.addEventListener('evly-back', onBack);
    return () => window.removeEventListener('evly-back', onBack);
  }, []);

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
        openNotification(n);
      }}
    />
    {showNotifCenter && (
      <NotificationCenter
        circles={circles}
        history={notifHistory}
        onClose={() => setShowNotifCenter(false)}
        onOpenPlan={handleSelectPlan}
        onOpenCircle={handleSelectCircle}
        onOpenNotification={n => { dismissHistory(x => x.id === n.id); openNotification(n); }}
        onClearHistory={() => setNotifHistory([])}
        onInvitationsChanged={(remaining, joinedCircleId) => {
          setInvitesCount(remaining);
          if (joinedCircleId) api.get('/circles').then(res => setCircles(res.data)).catch(() => {});
        }}
      />
    )}
    {/* Les bandeaux prennent leur place dans la hauteur de l'écran au lieu de pousser le bas hors de la vue */}
    <div className="app-screen flex flex-col bg-slate-100">
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
          unreadCount={circlesWithNews.size + invitesCount}
          onOpenNotifications={() => setShowNotifCenter(true)}
          unreadCircles={circlesWithNews}
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
      <div className={`${showDetail ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col h-full`}>
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
