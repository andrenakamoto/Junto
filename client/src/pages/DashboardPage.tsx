import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Circle, Plan } from '../types';
import api from '../services/api';
import { CircleSidebar } from '../components/circles/CircleSidebar';
import { PlanList } from '../components/plans/PlanList';
import { PlanDetail } from '../components/plans/PlanDetail';
import { AllPlansView } from '../components/plans/AllPlansView';
import { NotificationToast, AppNotification } from '../components/ui/NotificationToast';
import { getSocket } from '../lib/socket';
import { useUnread } from '../hooks/useUnread';
import { TermsModal } from '../components/ui/TermsModal';
import { LogoIcon } from '../components/ui/Logo';
import { disconnectSocket } from '../lib/socket';

type MobileView = 'circles' | 'plans' | 'detail';

export function DashboardPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('circles');
  const [allPlansActive, setAllPlansActive] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { unreadCircles, unreadPlans, markCircle, markPlan, clearCircle, clearPlan } = useUnread();

  useEffect(() => {
    api.get('/circles').then(res => {
      setCircles(res.data);
      if (res.data.length > 0) setSelectedCircleId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('junto_token');
    if (!token) return;
    const socket = getSocket(token);
    function onNotification(data: Omit<AppNotification, 'id' | 'at'>) {
      setNotifications(prev => [...prev, { ...data, id: crypto.randomUUID(), at: Date.now() }]);
      if (data.circleId) markCircle(data.circleId);
      if (data.type === 'new_message') markPlan(data.planId);
    }
    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
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

  function handleSelectCircle(id: string) {
    setSelectedCircleId(id);
    setAllPlansActive(false);
    setMobileView('plans');
    clearCircle(id);
  }

  function handleAllPlans() {
    setAllPlansActive(true);
    setSelectedCircleId(null);
    setSelectedPlan(null);
    setMobileView('plans');
  }

  function handleSelectPlan(plan: Plan) {
    clearPlan(plan.id);
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
        handleSelectPlan({ id: n.planId } as any);
      }}
    />
    <div className="flex h-dvh bg-slate-900 overflow-hidden">
      {/* Colonne 1 — Cercles */}
      <div className={`${showCircles ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 flex-shrink-0 h-full`}>
        <CircleSidebar
          circles={circles}
          selectedId={allPlansActive ? null : selectedCircleId}
          onSelect={handleSelectCircle}
          onCreated={c => {
            setCircles(prev => [...prev, c]);
            setSelectedCircleId(c.id);
            setAllPlansActive(false);
            setMobileView('plans');
          }}
          onAllPlans={handleAllPlans}
          allPlansActive={allPlansActive}
          unreadCount={unreadCircles.size + unreadPlans.size}
          unreadCircles={unreadCircles}
        />
      </div>

      {/* Colonne 2 — Plans */}
      {allPlansActive ? (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 flex-shrink-0 h-full`}>
          <AllPlansView
            onSelectPlan={handleSelectPlan}
            selectedPlanId={selectedPlan?.id ?? null}
            onBack={() => setMobileView('circles')}
          />
        </div>
      ) : selectedCircle ? (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 flex-shrink-0 h-full`}>
          <PlanList
            circle={selectedCircle}
            plans={plans}
            loading={loadingPlans}
            selectedPlanId={selectedPlan?.id ?? null}
            onSelectPlan={handleSelectPlan}
            onPlanCreated={handlePlanCreated}
            onCircleDeleted={handleCircleDeleted}
            onCircleUpdated={handleCircleUpdated}
            onBack={() => setMobileView('circles')}
            unreadPlans={unreadPlans}
          />
        </div>
      ) : (
        <div className={`${showPlans ? 'flex' : 'hidden'} md:flex flex-1`}>
          <EmptyState message="Bienvenue dans Junto !" sub="Crée un Cercle ou rejoins-en un pour commencer" />
        </div>
      )}

      {/* Colonne 3 — Détail */}
      <div className={`${showDetail ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full`}>
        {selectedPlan ? (
          <PlanDetail
            plan={selectedPlan}
            circleName={selectedCircle?.name ?? ''}
            circleCode={selectedCircle?.code ?? ''}
            onPlanUpdated={handlePlanUpdated}
            onPlanDeleted={handlePlanDeleted}
            onLogout={handleLogout}
            onBack={() => setMobileView('plans')}
            user={user!}
          />
        ) : (
          <EmptyState message="Sélectionne un Plan" sub="ou crée-en un nouveau dans ce Cercle" />
        )}
      </div>
    </div>
    </>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <LogoIcon size={64} />
        </div>
        <p className="text-lg font-semibold text-slate-700 mb-1">{message}</p>
        <p className="text-sm text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
