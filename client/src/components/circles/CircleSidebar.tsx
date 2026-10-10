import { useState, useRef, useEffect } from 'react';
import { CircleMembersSheet } from './CircleMembersSheet';
import { useMutes } from '../../contexts/MuteContext';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, CalendarDays, KeyRound, Bell, UserPlus, Check, X, Menu, BookOpen, UserRound, UserX, Lightbulb, BellOff } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
import { GuideModal } from '../ui/GuideModal';
import { ProfileModal } from '../ui/ProfileModal';
import { DeleteAccountModal } from '../ui/DeleteAccountModal';
import { ChangePasswordModal } from '../ui/ChangePasswordModal';
import { NotificationSettingsModal } from '../ui/NotificationSettingsModal';
import { SuggestionModal } from '../ui/SuggestionModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { disconnectSocket } from '../../lib/socket';
import api from '../../services/api';
import { CreateCircleModal, CIRCLE_COLORS } from './CreateCircleModal';
import { JoinCircleModal } from './JoinCircleModal';
import { Avatar } from '../ui/Avatar';
import { isCircleManager } from '../../lib/settings';
import { JoinRequestList } from './JoinRequestList';
import { siteUrl } from '../../lib/siteUrl';
import { intlLocale, t } from '../../i18n';

interface Props {
  circles: Circle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (circle: Circle) => void;
  onAllPlans: () => void;
  allPlansActive: boolean;
  onCalendar: () => void;
  calendarActive: boolean;
  onCircleUpdated: (circle: Circle) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  unreadCircles: Set<string>;
  /** Présence en ligne (fenêtre des membres) */
  onlineUserIds?: Set<string>;
}

export function CircleSidebar({ circles, selectedId, onSelect, onCreated, onAllPlans, allPlansActive, onCalendar, calendarActive, onCircleUpdated, unreadCount, onOpenNotifications, unreadCircles, onlineUserIds }: Props) {
  const { isCircleMuted } = useMutes();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Lien « Gérer mes notifications » des emails : /dashboard?reglages=notifications
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    // Notification de suivi d'une suggestion : /dashboard?suggestions=1
    if (searchParams.get('suggestions') === '1') {
      setShowSuggestions(true);
      setSearchParams(prev => { prev.delete('suggestions'); return prev; }, { replace: true });
      return;
    }
    if (searchParams.get('reglages') !== 'notifications') return;
    setShowNotifSettings(true);
    setSearchParams(prev => { prev.delete('reglages'); return prev; }, { replace: true });
  }, [searchParams]);
  const [membersPopover, setMembersPopover] = useState<string | null>(null);
  const [colorPopover, setColorPopover] = useState<string | null>(null);
  const [requestsPopover, setRequestsPopover] = useState<string | null>(null);
  const [circleColors, setCircleColors] = useState<Record<string, string | null | undefined>>({});
  const [showMenu, setShowMenu] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleSetColor(circleId: string, color: string | null) {
    setColorPopover(null);
    try {
      const { data } = await api.put(`/circles/${circleId}/color`, { color });
      setCircleColors(prev => ({ ...prev, [circleId]: data.color }));
    } catch { /* ignore */ }
  }

  // Nommer / retirer un organisateur (créateur du Cercle uniquement)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMembersPopover(null);
        setColorPopover(null);
        setRequestsPopover(null);
      }
    }
    if (colorPopover || requestsPopover) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [membersPopover, colorPopover, requestsPopover]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate('/auth');
  }

  return (
    <div className="w-full bg-slate-100 flex flex-col h-full flex-shrink-0 short:overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2.5">
        <LogoFull iconSize={32} light />
        <div className="w-px self-stretch bg-slate-200" />
        <p className="text-indigo-600 text-[10px] font-semibold uppercase tracking-wide leading-tight">
          Events<br />Linked to You
        </p>
        <button
          onClick={handleLogout}
          title={t('circle.sidebar.logout')}
          aria-label={t('circle.sidebar.logout')}
          className="ml-auto p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={17} />
        </button>
      </div>

      {/* Circle list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 short:flex-none short:overflow-visible">
        <button
          onClick={onAllPlans}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 text-left transition-all border text-sm font-semibold ${
            allPlansActive
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${allPlansActive ? 'bg-indigo-500' : 'bg-slate-100'}`}>
            <Calendar size={15} />
          </div>
          {t('circle.sidebar.allPlans')}
        </button>
        <button
          onClick={onCalendar}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 text-left transition-all border text-sm font-semibold ${
            calendarActive
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${calendarActive ? 'bg-indigo-500' : 'bg-slate-100'}`}>
            <CalendarDays size={15} />
          </div>
          {t('circle.sidebar.calendar')}
        </button>
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('circle.sidebar.myCircles')}</p>
        <div className="space-y-1.5 pb-2">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            {t('circle.sidebar.create')}
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Users size={14} />
            {t('circle.sidebar.join')}
          </button>
        </div>
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">{t('circle.sidebar.noCircle')}</p>
        )}
        {circles.map((circle) => {
          const selected = selectedId === circle.id;
          const nextPlan = circle.plans?.[0];
          const hasUnread = unreadCircles.has(circle.id);
          const circleColor = circleColors[circle.id] !== undefined ? circleColors[circle.id] : circle.color;
          const isCreator = circle.creatorId === user?.id;
          const isManager = isCircleManager(circle, user?.id);
          return (
            <div key={circle.id}>
              <button
                onClick={() => onSelect(circle.id)}
                style={circleColor ? { borderLeftColor: circleColor, borderLeftWidth: 3 } : undefined}
                className={`w-full text-left rounded-xl transition-all border relative ${
                  selected
                    ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : hasUnread
                    ? 'bg-white border-orange-300 shadow-sm hover:bg-slate-50 hover:border-orange-400'
                    : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {hasUnread && !selected && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full" />
                )}
                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                  <Avatar pseudo={circle.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${selected ? 'text-white' : 'text-slate-800'}`}>
                      {circle.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); setMembersPopover(circle.id); }}
                        className={`text-xs hover:underline ${selected ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'}`}
                      >
                        {t('circle.members.count', { count: circle.members.length })}
                      </button>
                      {isCircleMuted(circle.id) && (
                        <span title={t('circle.sidebar.muted')} className={selected ? 'text-indigo-100' : 'text-slate-400'}><BellOff size={12} /></span>
                      )}
                      {(circle._count?.plans ?? 0) > 0 && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className={`text-xs ${selected ? 'text-indigo-200/80' : 'text-indigo-600'}`}>
                            {t('circle.sidebar.plans', { count: circle._count!.plans })}
                          </span>
                        </>
                      )}
                      {isManager && (
                        <button
                          onClick={e => { e.stopPropagation(); setColorPopover(colorPopover === circle.id ? null : circle.id); }}
                          title={t('circle.sidebar.color')}
                          className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0 ml-0.5"
                          style={{ backgroundColor: circleColor || '#64748b' }}
                        />
                      )}
                    </div>
                  </div>
                  {(circle.joinRequests?.length ?? 0) > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setRequestsPopover(requestsPopover === circle.id ? null : circle.id); }}
                      title={t('circle.sidebar.pending')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors flex-shrink-0 text-xs font-semibold"
                    >
                      <UserPlus size={12} />
                      {circle.joinRequests!.length}
                    </button>
                  )}
                </div>

                {nextPlan && (
                  <div className={`mx-3 mb-3 px-2.5 py-2 rounded-lg ${selected ? 'bg-indigo-500/30' : 'bg-slate-50'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${selected ? 'text-indigo-200/70' : 'text-indigo-600'}`}>
                      {t('circle.sidebar.nextEvent')}
                    </p>
                    <p className={`text-xs font-semibold truncate ${selected ? 'text-white' : 'text-slate-800'}`}>
                      {nextPlan.title}
                    </p>
                    <div className={`flex items-center gap-1 mt-0.5 ${selected ? 'text-indigo-200/80' : 'text-slate-500'}`}>
                      <Calendar size={10} className="flex-shrink-0" />
                      <span className="text-xs">
                        {nextPlan.eventDate
                          ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(nextPlan.eventDate))
                          : t('circle.sidebar.closesOn', { date: new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(nextPlan.endDate)) })
                        }
                      </span>
                    </div>
                  </div>
                )}
              </button>

              {colorPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleSetColor(circle.id, null)}
                    title={t('circle.sidebar.noColor')}
                    className="w-6 h-6 rounded-full border-2 border-dashed border-slate-500 flex-shrink-0"
                  />
                  {CIRCLE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => handleSetColor(circle.id, c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full flex-shrink-0 transition-transform ${circleColor === c ? 'ring-2 ring-offset-2 ring-offset-white ring-slate-400 scale-110' : ''}`}
                    />
                  ))}
                </div>
              )}

              {requestsPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-white border border-slate-200 rounded-xl p-2.5">
                  <JoinRequestList circle={circle} onCircleUpdated={onCircleUpdated} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Utilisateur + menu */}
      <div className="relative px-3 py-3 border-t border-slate-200 flex items-center gap-2 short:sticky short:bottom-0 short:z-10 short:bg-slate-100">
        {user && <Avatar pseudo={user.pseudo} size="sm" />}
        <span className="flex-1 text-sm text-slate-700 font-medium truncate">@{user?.pseudo}</span>
        {/* Cloche : panneau des notifications (NotificationCenter), avec le nombre de Cercles
            qui ont du nouveau */}
        <button
          onClick={onOpenNotifications}
          title={t('circle.sidebar.notifications')}
          aria-label={unreadCount > 0 ? t('circle.sidebar.notificationsCount', { count: unreadCount }) : t('circle.sidebar.notifications')}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-indigo-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] leading-4 text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Séparation nette entre la cloche et le menu (cibles distinctes au doigt) */}
        <span className="w-px h-6 bg-slate-300 mx-1.5" aria-hidden />

        <button
          onClick={() => setShowMenu(v => !v)}
          title={t('circle.sidebar.menu')}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border shadow-sm transition-colors ${showMenu ? 'bg-slate-200 border-slate-300 text-slate-900' : 'bg-white border-slate-200 text-indigo-600 hover:text-slate-900 hover:bg-slate-50'}`}
        >
          <Menu size={18} />
        </button>

        {showMenu && (
          <div ref={menuRef} className="absolute bottom-full right-3 mb-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 space-y-0.5 z-20">
            {user?.isAdmin && (
              <button
                onClick={() => { setShowMenu(false); navigate('/admin'); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
              >
                <ShieldCheck size={15} />
                {t('circle.sidebar.admin')}
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); setShowProfile(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <UserRound size={15} />
              {t('circle.sidebar.profile')}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowChangePassword(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <KeyRound size={15} />
              {t('circle.sidebar.password')}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowNotifSettings(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Bell size={15} />
              {t('circle.sidebar.notifications')}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowSuggestions(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Lightbulb size={15} />
              {t('circle.sidebar.suggest')}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowGuide(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <BookOpen size={15} />
              {t('circle.sidebar.guide')}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowTerms(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <ScrollText size={15} />
              {t('circle.sidebar.terms')}
            </button>
            <a
              href={siteUrl('/confidentialite')}
              target="_blank"
              rel="noopener"
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <ShieldCheck size={15} />
              {t('circle.sidebar.privacy')}
            </a>
            <button
              onClick={() => { setShowMenu(false); setShowDeleteAccount(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <UserX size={15} />
              {t('circle.sidebar.deleteAccount')}
            </button>
            <p className="text-center text-xs text-slate-500 pt-2 mt-1 border-t border-slate-200">info@evly.ch</p>
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
      {showNotifSettings && (
        <NotificationSettingsModal onClose={() => setShowNotifSettings(false)} />
      )}
      {showSuggestions && (
        <SuggestionModal onClose={() => setShowSuggestions(false)} />
      )}
      {showTerms && (
        <TermsModal readOnly onClose={() => setShowTerms(false)} />
      )}
      {showGuide && (
        <GuideModal onClose={() => setShowGuide(false)} />
      )}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}
      {showDeleteAccount && (
        <DeleteAccountModal onClose={() => setShowDeleteAccount(false)} />
      )}
      {membersPopover && (() => {
        const c = circles.find(x => x.id === membersPopover);
        return c ? <CircleMembersSheet circle={c} onlineUserIds={onlineUserIds} onClose={() => setMembersPopover(null)} onCircleUpdated={onCircleUpdated} /> : null;
      })()}
      {showCreate && (
        <CreateCircleModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { onCreated(c); setShowCreate(false); }}
        />
      )}
      {showJoin && (
        <JoinCircleModal
          onClose={() => setShowJoin(false)}
          onJoined={(c) => { onCreated(c); setShowJoin(false); }}
        />
      )}
    </div>
  );
}
