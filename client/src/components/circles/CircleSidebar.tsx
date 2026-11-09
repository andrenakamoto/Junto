import { useState, useRef, useEffect, useMemo } from 'react';
import { photoUrl } from '../../lib/photos';
import { CircleMembersSheet } from './CircleMembersSheet';
import { useMutes } from '../../contexts/MuteContext';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, CalendarDays, KeyRound, Bell, UserPlus, Check, X, Menu, BookOpen, UserRound, UserX, Lightbulb, BellOff, Vote, ChevronRight, Search, Contact as ContactIcon, Compass, Megaphone, CalendarPlus, CalendarRange, Sparkles, ChevronLeft, ChevronDown, Network, Settings } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { PLAN_KINDS, type PlanKind } from '../../lib/planKinds';
import { isCircleManager } from '../../lib/settings';
import { useBackClose } from '../../lib/backClose';
import { TermsModal } from '../ui/TermsModal';
import { GuideModal } from '../ui/GuideModal';
import { ProfileModal } from '../ui/ProfileModal';
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
import { CreateOrganisationModal } from '../organisations/CreateOrganisationModal';
import { OrganisationModal } from '../organisations/OrganisationModal';

// Recherche d'un Cercle : sans accents ni majuscules (« montvert » trouve « Jeunesse de Montvert »)
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Barre de recherche à partir de ce nombre de Cercles
const SEARCH_FROM = 5;
// Bloc d'une Organisation : déplié d'office jusqu'à ce nombre de Cercles, choix gardé sur l'appareil
const ORG_OPEN_UP_TO = 3;
const ORG_OPEN_KEY = 'evly_org_open';
interface MyOrg { id: string; name: string; isAdmin: boolean; isDirection: boolean }
interface OrgBlock { id: string; name: string; circles: Circle[] }
type ListEntry = { circle?: Circle; org?: OrgBlock };

interface Props {
  circles: Circle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (circle: Circle) => void;
  onAllPlans: () => void;
  /** Menu « + Créer » (2026-11-03) : Plan (standard ou spécifique) sans d'abord ouvrir un Cercle */
  onNewPlan?: (kind?: PlanKind) => void;
  /** « Proposer des dates » dans le Cercle ouvert (absent si aucun Cercle ouvert ou si c'est réservé aux organisateurs) */
  onProposeDates?: () => void;
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

export function CircleSidebar({ circles, selectedId, onSelect, onCreated, onNewPlan, onProposeDates, onAllPlans, allPlansActive, onCalendar, calendarActive, onContacts, contactsActive, onDiscover, discoverActive, onCircleUpdated, unreadCount, onOpenNotifications, unreadCircles, onlineUserIds, onOpenPoll }: Props) {
  const { isCircleMuted } = useMutes();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
  // Menu « + Créer »
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  // Organisations
  const [myOrgs, setMyOrgs] = useState<MyOrg[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [managedOrg, setManagedOrg] = useState<string | null>(null);
  const [orgOpen, setOrgOpen] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(ORG_OPEN_KEY) ?? '{}'); } catch { return {}; }
  });
  const [createLevel, setCreateLevel] = useState<'main' | 'kinds'>('main');
  const createRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showCreateMenu) return;
    const h = (e: MouseEvent) => { if (createRef.current && !createRef.current.contains(e.target as Node)) setShowCreateMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showCreateMenu]);
  useBackClose(() => setShowCreateMenu(false), showCreateMenu);
  useBackClose(() => setShowMenu(false), showMenu);
  const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors';
  const managesACircle = circles.some(c => !c.isPersonal && isCircleManager(c, user?.id));
  const createItem = (Icon: typeof Plus, label: string, hint: string, run: () => void, keepOpen = false) => (
    <button onClick={() => { if (!keepOpen) setShowCreateMenu(false); run(); }} className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
      <Icon size={17} className="text-indigo-500 mt-0.5 flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      {keepOpen && <ChevronRight size={15} className="text-slate-400 mt-0.5" />}
    </button>
  );


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

  // Organisations : les Cercles d'une même Organisation sont réunis dans un bloc dépliable (dès 2 Cercles, ou pour la direction).
  // La recherche revient à une liste simple.
  const orgKey = circles.filter(c => c.organisation).map(c => c.id).join(',');
  useEffect(() => {
    if (!orgKey) { setMyOrgs([]); return; }
    api.get('/organisations/mine').then(r => setMyOrgs(r.data)).catch(() => {});
  }, [orgKey]);
  const listEntries = useMemo((): ListEntry[] => {
    if (query.trim()) return shownCircles.map(circle => ({ circle }));
    const seen = new Set<string>();
    return shownCircles.flatMap((circle): ListEntry[] => {
      const organisation = circle.organisation;
      const list = organisation ? shownCircles.filter(c => c.organisation?.id === organisation.id) : [];
      const mine = myOrgs.find(o => o.id === organisation?.id);
      if (!organisation || (list.length < 2 && !mine?.isDirection && !mine?.isAdmin)) return [{ circle }];
      if (seen.has(organisation.id)) return [];
      seen.add(organisation.id);
      return [{ org: { id: organisation.id, name: organisation.name, circles: list } }];
    });
  }, [shownCircles, query, myOrgs]);
  const isOrgOpen = (org: OrgBlock) => orgOpen[org.id] ?? (org.circles.length <= ORG_OPEN_UP_TO || org.circles.some(c => c.id === selectedId));
  function toggleOrg(org: OrgBlock) {
    const next = { ...orgOpen, [org.id]: !isOrgOpen(org) };
    setOrgOpen(next);
    try { localStorage.setItem(ORG_OPEN_KEY, JSON.stringify(next)); } catch { /* préférence de confort */ }
  }
  function renderOrgBlock(org: OrgBlock) {
    const open = isOrgOpen(org);
    const hasNews = org.circles.some(c => unreadCircles.has(c.id));
    const mine = myOrgs.find(o => o.id === org.id);
    return (
      <div key={org.id} className="pt-2.5">
        <div className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 shadow-sm">
          <button onClick={() => toggleOrg(org)} aria-expanded={open} title={open ? t('org.block.collapse') : t('org.block.expand')} className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 text-left">
            {open ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800 truncate">{org.name}</span>
              <span className="block text-xs text-slate-500">{t('org.block.count', { count: org.circles.length })}</span>
            </span>
            {hasNews && !open && <span className="w-2.5 h-2.5 bg-orange-500 rounded-full flex-shrink-0" />}
          </button>
          {(mine?.isDirection || mine?.isAdmin) && (
            <button onClick={() => setManagedOrg(org.id)} title={t('org.block.manage')} aria-label={t('org.block.manage')} className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-700"><Settings size={16} /></button>
          )}
        </div>
        {open && <div className="pl-2 border-l-2 border-slate-200 ml-2">{org.circles.map(renderCircle)}</div>}
      </div>
    );
  }
  function renderCircle(circle: Circle) {
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
  }

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
        {/* Un seul « + Créer » (2026-11-03) : Plan, Plan spécifique, sondage de dates du Cercle ouvert, Cercle, rejoindre */}
        <div className="relative mb-2" ref={createRef}>
          <button onClick={() => { setCreateLevel('main'); setShowCreateMenu(v => !v); }} aria-expanded={showCreateMenu}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-colors">
            <Plus size={18} />{t('circle.sidebar.createAny')}
          </button>
          {showCreateMenu && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 z-30">
              {createLevel === 'main' ? (<>
                {onNewPlan && createItem(CalendarPlus, t('plan.kinds.menu.standard'), t('plan.kinds.menu.standardHint'), () => onNewPlan())}
                {onNewPlan && createItem(Sparkles, t('plan.kinds.menu.specific'), t('plan.kinds.menu.specificHint'), () => setCreateLevel('kinds'), true)}
                {onProposeDates && createItem(CalendarRange, t('circle.planList.proposeDates'), t('circle.planList.pollHint'), onProposeDates)}
                <div className="my-1 border-t border-slate-100" />
                {createItem(Users, t('circle.sidebar.create'), t('circle.sidebar.createHint'), () => setShowCreate(true))}
                {createItem(KeyRound, t('circle.sidebar.join'), t('circle.sidebar.joinHint'), () => setShowJoin(true))}
                {user?.canCreateOrganisation && createItem(Network, t('org.menu.create'), t('org.menu.createHint'), () => setShowCreateOrg(true))}
              </>) : (<>
                <button onClick={() => setCreateLevel('main')} className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
                  <ChevronLeft size={14} />{t('plan.kinds.menu.specific')}
                </button>
                {PLAN_KINDS.filter(k => !k.managersOnly || managesACircle).map(k => (
                  <button key={k.kind} onClick={() => { setShowCreateMenu(false); onNewPlan?.(k.kind); }}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
                    <span className="text-lg leading-none mt-0.5">{k.emoji}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{t(`plan.kinds.${k.kind}.name`)}</span>
                      <span className="block text-xs text-slate-500">{t(`plan.kinds.${k.kind}.hint`)}</span>
                    </span>
                  </button>
                ))}
              </>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
        {([
          [onAllPlans, allPlansActive || calendarActive, Calendar, t('circle.sidebar.allPlans')],
          [onDiscover, discoverActive, Compass, t('discover.button')],
        ] as const).map(([onClick, active, Icon, label]) => (
          <button
            key={label}
            onClick={onClick}
            className={`w-full flex flex-col items-center gap-1 px-1.5 py-2 rounded-xl text-center transition-all border text-[12px] md:text-[13px] leading-tight font-semibold ${
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
        {/* « Mes Cercles » et le tri sur la même ligne ; la recherche en dessous, en pleine largeur */}
        <div className="flex items-center gap-2 pl-2 pt-1">
          <p className="flex-1 min-w-0 text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{t('circle.sidebar.myCircles')}</p>
          {circles.length > 1 && <div className="flex-shrink-0"><PlanSortToggle value={circleSort} onChange={setCircleSort} /></div>}
        </div>
        {circles.length >= SEARCH_FROM && (
          <div className="pt-1 pb-1.5">
            {(
              <div className="relative">
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
          </div>
        )}
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">{t('circle.sidebar.noCircle')}</p>
        )}
        {circles.length > 0 && shownCircles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">{t('circle.sidebar.noMatch')}</p>
        )}
        {listEntries.map(entry => entry.circle ? renderCircle(entry.circle) : renderOrgBlock(entry.org!))}
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

        {/* Menu ☰ (refait le 2026-11-03) : en-tête « Mon profil », trois groupes, liens légaux en bas. Mot de passe et suppression
            du compte sont dans « Mon profil » (la suppression y est depuis la demande d'Apple, règle 5.1.1(v)) */}
        {showMenu && (
          <div ref={menuRef} className="absolute bottom-full left-2 right-2 mb-1.5 max-h-[80dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 z-20">
            <button onClick={() => { setShowMenu(false); setShowProfile(true); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
              <Avatar pseudo={user?.pseudo ?? ''} size="lg" />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-slate-900 truncate">{user?.firstName || `@${user?.pseudo}`}</span>
                <span className="block text-xs text-slate-500 truncate">@{user?.pseudo} · {t('circle.sidebar.profile')}</span>
              </span>
              <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
            </button>
            <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { setShowMenu(false); onContacts(); }} className={menuItem}>
                <ContactIcon size={16} className="text-slate-400" />{t('circle.contacts.button')}
              </button>
              <button onClick={() => { setShowMenu(false); setShowNotifSettings(true); }} className={menuItem}>
                <Bell size={16} className="text-slate-400" />{t('circle.sidebar.notifications')}
              </button>
              <button onClick={() => { setShowMenu(false); setShowGuide(true); }} className={menuItem}>
                <BookOpen size={16} className="text-slate-400" />{t('circle.sidebar.guide')}
              </button>
            <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { setShowMenu(false); setShowSuggestions(true); }} className={menuItem}>
                <Lightbulb size={16} className="text-slate-400" />{t('circle.sidebar.suggest')}
              </button>
              <button onClick={() => { setShowMenu(false); setShowPostEvent(true); }} className={menuItem}>
                <Megaphone size={16} className="text-slate-400" />{t('discover.post.button')}
              </button>
            {user?.isAdmin && (<>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { setShowMenu(false); navigate('/admin'); }} className={`${menuItem} text-indigo-600`}>
                <ShieldCheck size={16} />{t('circle.sidebar.admin')}
              </button>
            </>)}
            <div className="mt-1 pt-2 px-3 pb-1 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <button onClick={() => { setShowMenu(false); setShowTerms(true); }} className="hover:text-indigo-700">{t('circle.sidebar.termsShort')}</button>
              <span aria-hidden>·</span>
              <a href={siteUrl('/confidentialite')} target="_blank" rel="noopener" onClick={() => setShowMenu(false)} className="hover:text-indigo-700">{t('circle.sidebar.privacyShort')}</a>
              <a href="mailto:info@evly.ch" className="basis-full text-center hover:text-indigo-700">info@evly.ch</a>
            </div>
          </div>
        )}
      </div>

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
      {membersPopover && (() => {
        const c = circles.find(x => x.id === membersPopover);
        return c ? <CircleMembersSheet circle={c} onlineUserIds={onlineUserIds} onClose={() => setMembersPopover(null)} onCircleUpdated={onCircleUpdated} /> : null;
      })()}
      {showCreateOrg && <CreateOrganisationModal onClose={() => setShowCreateOrg(false)} onCreated={id => { setShowCreateOrg(false); setManagedOrg(id); }} />}
      {managedOrg && <OrganisationModal organisationId={managedOrg} onClose={() => setManagedOrg(null)} />}
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
