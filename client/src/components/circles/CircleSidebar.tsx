import { useState, useRef, useEffect, useMemo } from 'react';
import { photoUrl } from '../../lib/photos';
import { CircleMembersSheet } from './CircleMembersSheet';
import { useMutes } from '../../contexts/MuteContext';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, CalendarDays, KeyRound, Bell, UserPlus, Check, X, Menu, BookOpen, UserRound, UserX, Lightbulb, BellOff, Vote, ChevronRight, Search, Contact as ContactIcon, Compass, Megaphone } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
import { GuideModal } from '../ui/GuideModal';
import { ProfileModal } from '../ui/ProfileModal';
import { DeleteAccountModal } from '../ui/DeleteAccountModal';
import { ChangePasswordModal } from '../ui/ChangePasswordModal';
import { NotificationSettingsModal } from '../ui/NotificationSettingsModal';
import { SuggestionModal } from '../ui/SuggestionModal';
import { ProSoonModal } from '../discover/ProSoonModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { disconnectSocket } from '../../lib/socket';
import api from '../../services/api';
import { CreateCircleModal } from './CreateCircleModal';
import { JoinCircleModal } from './JoinCircleModal';
import { Avatar } from '../ui/Avatar';
import { JoinRequestList } from './JoinRequestList';
import { siteUrl } from '../../lib/siteUrl';
import { intlLocale, t } from '../../i18n';
import { useCircleSort } from '../../lib/planSort';
import { sortCircles } from '../../lib/order';
import { PlanSortToggle } from '../plans/PlanSortToggle';

// Recherche d'un Cercle : sans accents ni majuscules (« montvert » trouve « Jeunesse de Montvert »)
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Barre de recherche à partir de ce nombre de Cercles
const SEARCH_FROM = 5;

interface Props {
  circles: Circle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (circle: Circle) => void;
  onAllPlans: () => void;
  allPlansActive: boolean;
  onCalendar: () => void;
  calendarActive: boolean;
  /** « Mes contacts » : les personnes de mes Cercles */
  onContacts: () => void;
  contactsActive: boolean;
  onDiscover: () => void;
  discoverActive: boolean;
  onCircleUpdated: (circle: Circle) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  unreadCircles: Set<string>;
  /** Présence en ligne (fenêtre des membres) */
  onlineUserIds?: Set<string>;
  /** Ouvrir directement un sondage de dates (bandeau « À toi de voter ») */
  onOpenPoll?: (circleId: string, pollId: string) => void;
}

export function CircleSidebar({ circles, selectedId, onSelect, onCreated, onAllPlans, allPlansActive, onCalendar, calendarActive, onContacts, contactsActive, onDiscover, discoverActive, onCircleUpdated, unreadCount, onOpenNotifications, unreadCircles, onlineUserIds, onOpenPoll }: Props) {
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
  const [showPostEvent, setShowPostEvent] = useState(false);
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
  // Tri (Activité : ordre reçu, déjà par activité ; Date : prochain événement) et recherche par nom
  const [circleSort, setCircleSort] = useCircleSort();
  const [query, setQuery] = useState('');
  const shownCircles = useMemo(() => {
    const sorted = circleSort === 'date' ? sortCircles(circles) : circles;
    const q = fold(query.trim());
    return q ? sorted.filter(c => fold(c.name).includes(q)) : sorted;
  }, [circles, circleSort, query]);
  const [membersPopover, setMembersPopover] = useState<string | null>(null);
  const [requestsPopover, setRequestsPopover] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);


  // Nommer / retirer un organisateur (créateur du Cercle uniquement)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMembersPopover(null);
        setRequestsPopover(null);
      }
    }
    if (requestsPopover) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [membersPopover, requestsPopover]);

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
        {/* Téléphone : deux lignes de deux boutons (icône au-dessus) ; grand écran : l'un sous l'autre */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5 mb-2">
        {([
          [onAllPlans, allPlansActive, Calendar, t('circle.sidebar.allPlans')],
          [onCalendar, calendarActive, CalendarDays, t('circle.sidebar.calendar')],
          [onContacts, contactsActive, ContactIcon, t('circle.contacts.button')],
          [onDiscover, discoverActive, Compass, t('discover.button')],
        ] as const).map(([onClick, active, Icon, label]) => (
          <button
            key={label}
            onClick={onClick}
            className={`w-full flex flex-col md:flex-row items-center gap-1 md:gap-2 px-1.5 md:px-2.5 py-2 rounded-xl text-center md:text-left transition-all border text-[12px] md:text-sm leading-tight font-semibold ${
              active
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-500' : 'bg-slate-100'}`}>
              <Icon size={14} />
            </div>
            {label}
          </button>
        ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-2 md:pl-0 pt-1">
          <p className="flex-1 md:basis-full md:pl-2 min-w-0 text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{t('circle.sidebar.myCircles')}</p>
          <button
            onClick={() => setShowCreate(true)}
            title={t('circle.sidebar.create')}
            className="flex-shrink-0 md:flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={13} />
            {t('circle.sidebar.createShort')}
          </button>
          <button
            onClick={() => setShowJoin(true)}
            title={t('circle.sidebar.join')}
            className="flex-shrink-0 md:flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Users size={12} />
            {t('circle.sidebar.joinShort')}
          </button>
        </div>
        {circles.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1.5">
            {circles.length >= SEARCH_FROM && (
              <div className="relative flex-1 md:basis-full min-w-0">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('circle.sidebar.search')} aria-label={t('circle.sidebar.search')}
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} title={t('circle.sidebar.clearSearch')} aria-label={t('circle.sidebar.clearSearch')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"><X size={14} /></button>
                )}
              </div>
            )}
            <div className="ml-auto flex-shrink-0"><PlanSortToggle value={circleSort} onChange={setCircleSort} /></div>
          </div>
        )}
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">{t('circle.sidebar.noCircle')}</p>
        )}
        {circles.length > 0 && shownCircles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">{t('circle.sidebar.noMatch')}</p>
        )}
        {shownCircles.map((circle) => {
          const selected = selectedId === circle.id;
          const nextPlan = circle.plans?.[0];
          const hasUnread = unreadCircles.has(circle.id);
          const circleColor = circle.color;
          const isCreator = circle.creatorId === user?.id;
          return (
            // pt-2.5 : plus d'espace entre les cartes (le conteneur n'en met que 6 px)
            <div key={circle.id} className="pt-2.5">
              <button
                onClick={() => onSelect(circle.id)}
                className={`w-full text-left rounded-2xl overflow-hidden transition-all border relative bg-white ${
                  selected
                    ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20'
                    : hasUnread
                    ? 'border-orange-300 shadow-md hover:shadow-lg'
                    : 'border-slate-200 shadow-md hover:shadow-lg hover:border-slate-300'
                }`}
              >
                {/* En-tête 2:1 : la photo du Cercle telle qu'elle a été cadrée, ou un dégradé de sa couleur avec son
                    initiale ; nom et compteurs écrits dessus. Toutes les cartes ont ainsi la même forme. */}
                <div className="relative aspect-[2/1] bg-slate-200 [container-type:inline-size]">
                  {circle.photoKey ? (
                    <img src={photoUrl(circle.photoKey, true)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-start justify-center pt-[4%]"
                      style={{ background: `linear-gradient(135deg, ${circleColor || '#64748b'} 0%, ${circleColor || '#64748b'}cc 55%, #0f172a 140%)` }}>
                      <span className="font-['Fraunces'] italic font-light text-white/90 text-[22cqw] leading-none select-none">{circle.name[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  {hasUnread && !selected && (
                    <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-orange-500 rounded-full ring-2 ring-white" />
                  )}
                  <div className="absolute left-0 right-0 bottom-0 px-3 pb-2.5 flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base text-white truncate drop-shadow">{circle.name}</p>
                      <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5 text-white/90">
                        <button
                          onClick={e => { e.stopPropagation(); setMembersPopover(circle.id); }}
                          className="text-xs whitespace-nowrap hover:underline"
                        >
                          {t('circle.members.count', { count: circle.members.length })}
                        </button>
                        {isCircleMuted(circle.id) && (
                          <span title={t('circle.sidebar.muted')}><BellOff size={12} /></span>
                        )}
                        {(circle._count?.plans ?? 0) > 0 && (
                          <>
                            <span className="text-xs text-white/60">·</span>
                            <span className="text-xs whitespace-nowrap">{t('circle.sidebar.plans', { count: circle._count!.plans })}</span>
                          </>
                        )}
                        {(circle.pollCount ?? 0) > 0 && (
                          <>
                            <span className="text-xs text-white/60">·</span>
                            <span className="text-xs whitespace-nowrap">{t('circle.sidebar.polls', { count: circle.pollCount })}</span>
                          </>
                        )}
                        {(circle.dispo?.count ?? 0) > 0 && (
                          <span className="ml-0.5 px-1.5 py-px rounded-full bg-emerald-500 text-white text-[11px] font-semibold whitespace-nowrap">
                            🟢 {t('circle.dispo.chip', { count: circle.dispo!.count })}
                          </span>
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
                </div>
                {/* Couleur du Cercle en fine ligne sous la photo */}
                {circle.photoKey && circleColor && <div className="h-1" style={{ backgroundColor: circleColor }} />}
                <div className="h-3" />

                {/* Sondages de dates qui attendent ma réponse : un seul → il s'ouvre ; plusieurs → le Cercle s'ouvre */}
                {(circle.pendingPolls?.length ?? 0) > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => {
                      e.stopPropagation();
                      const pending = circle.pendingPolls!;
                      if (pending.length === 1 && onOpenPoll) onOpenPoll(circle.id, pending[0].id); else onSelect(circle.id);
                    }}
                    className="mx-3 mb-3 px-2.5 py-2 rounded-lg flex items-center gap-2 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                  >
                    <Vote size={14} className={`flex-shrink-0 text-amber-700`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-xs font-semibold text-amber-800`}>{t('circle.sidebar.voteNow')}</span>
                      <span className={`block text-xs truncate text-amber-900/80`}>
                        {circle.pendingPolls!.length === 1 ? circle.pendingPolls![0].question : t('circle.sidebar.pendingPolls', { count: circle.pendingPolls!.length })}
                      </span>
                    </span>
                    <ChevronRight size={14} className={`flex-shrink-0 text-amber-700`} />
                  </span>
                )}

                {nextPlan && (
                  <div className={`mx-3 mb-3 px-2.5 py-2 rounded-lg bg-slate-50`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 text-indigo-600`}>
                      {t('circle.sidebar.nextEvent')}
                    </p>
                    <p className={`text-xs font-semibold truncate text-slate-800`}>
                      {nextPlan.title}
                    </p>
                    <div className={`flex items-center gap-1 mt-0.5 text-slate-500`}>
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
              onClick={() => { setShowMenu(false); setShowPostEvent(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Megaphone size={15} />
              {t('discover.post.button')}
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
      {showPostEvent && <ProSoonModal onClose={() => setShowPostEvent(false)} />}
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
