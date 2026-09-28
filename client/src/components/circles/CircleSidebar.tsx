import { useState, useRef, useEffect } from 'react';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, CalendarDays, KeyRound, Bell, UserPlus, Check, X, Menu, BookOpen, UserRound, UserX } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
import { GuideModal } from '../ui/GuideModal';
import { ProfileModal } from '../ui/ProfileModal';
import { DeleteAccountModal } from '../ui/DeleteAccountModal';
import { fullName } from '../../lib/names';
import { ChangePasswordModal } from '../ui/ChangePasswordModal';
import { NotificationSettingsModal } from '../ui/NotificationSettingsModal';
import { useNavigate } from 'react-router-dom';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { disconnectSocket } from '../../lib/socket';
import api from '../../services/api';
import { CreateCircleModal, CIRCLE_COLORS } from './CreateCircleModal';
import { JoinCircleModal } from './JoinCircleModal';
import { Avatar } from '../ui/Avatar';
import { isCircleManager } from '../../lib/settings';

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
  unreadCircles: Set<string>;
}

export function CircleSidebar({ circles, selectedId, onSelect, onCreated, onAllPlans, allPlansActive, onCalendar, calendarActive, onCircleUpdated, unreadCount, unreadCircles }: Props) {
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
  const [membersPopover, setMembersPopover] = useState<string | null>(null);
  const [colorPopover, setColorPopover] = useState<string | null>(null);
  const [requestsPopover, setRequestsPopover] = useState<string | null>(null);
  const [circleColors, setCircleColors] = useState<Record<string, string | null | undefined>>({});
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null);
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

  async function handleVoteRequest(circleId: string, requestId: string) {
    setVotingRequestId(requestId);
    try {
      const { data } = await api.post(`/circles/${circleId}/join-requests/${requestId}/vote`);
      if (data.circle) onCircleUpdated(data.circle);
    } finally {
      setVotingRequestId(null);
    }
  }

  // Nommer / retirer un organisateur (créateur du Cercle uniquement)
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  async function handleSetRole(circleId: string, userId: string, role: 'organizer' | 'member') {
    setRoleBusy(userId);
    try {
      const { data } = await api.put(`/circles/${circleId}/members/${userId}/role`, { role });
      onCircleUpdated(data);
    } catch { /* rechargé par le temps réel */ } finally {
      setRoleBusy(null);
    }
  }

  // Mode « validation par le créateur » : refus possible (en mode vote, seule la majorité fait foi)
  async function handleRefuseRequest(circleId: string, requestId: string) {
    setVotingRequestId(requestId);
    try {
      const { data } = await api.delete(`/circles/${circleId}/join-requests/${requestId}`);
      onCircleUpdated(data);
    } finally {
      setVotingRequestId(null);
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMembersPopover(null);
        setColorPopover(null);
        setRequestsPopover(null);
      }
    }
    if (membersPopover || colorPopover || requestsPopover) document.addEventListener('mousedown', handleClick);
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
          Tous mes plans
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
          Calendrier
        </button>
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes Cercles</p>
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400 italic">Aucun Cercle pour l'instant</p>
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
                        onClick={e => { e.stopPropagation(); setMembersPopover(membersPopover === circle.id ? null : circle.id); }}
                        className={`text-xs hover:underline ${selected ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'}`}
                      >
                        {circle.members.length} membre{circle.members.length > 1 ? 's' : ''}
                      </button>
                      {(circle._count?.plans ?? 0) > 0 && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className={`text-xs ${selected ? 'text-indigo-200/80' : 'text-indigo-600'}`}>
                            {circle._count!.plans} plan{circle._count!.plans > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                      {isManager && (
                        <button
                          onClick={e => { e.stopPropagation(); setColorPopover(colorPopover === circle.id ? null : circle.id); }}
                          title="Couleur du Cercle"
                          className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0 ml-0.5"
                          style={{ backgroundColor: circleColor || '#64748b' }}
                        />
                      )}
                    </div>
                  </div>
                  {(circle.joinRequests?.length ?? 0) > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setRequestsPopover(requestsPopover === circle.id ? null : circle.id); }}
                      title="Demandes en attente"
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
                      Prochain évènement
                    </p>
                    <p className={`text-xs font-semibold truncate ${selected ? 'text-white' : 'text-slate-800'}`}>
                      {nextPlan.title}
                    </p>
                    <div className={`flex items-center gap-1 mt-0.5 ${selected ? 'text-indigo-200/80' : 'text-slate-500'}`}>
                      <Calendar size={10} className="flex-shrink-0" />
                      <span className="text-xs">
                        {nextPlan.eventDate
                          ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(nextPlan.eventDate))
                          : `Clôture le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(nextPlan.endDate))}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </button>

              {membersPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-white border border-slate-200 rounded-xl p-2 space-y-1">
                  {circle.members.map(m => {
                    const memberIsCreator = m.userId === circle.creatorId;
                    const memberIsOrganizer = m.role === 'organizer';
                    return (
                      <div key={m.userId} className="flex items-center gap-2 px-1 py-0.5">
                        <Avatar pseudo={m.user.pseudo} size="sm" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-slate-800 truncate">{fullName(m.user) ?? `@${m.user.pseudo}`}</span>
                          <span className="block text-[10px] text-slate-500 truncate">
                            {fullName(m.user) && `@${m.user.pseudo}`}
                            {(memberIsCreator || memberIsOrganizer) && (
                              <span className="text-indigo-600 font-semibold">{fullName(m.user) && ' · '}{memberIsCreator ? 'Créateur' : 'Organisateur'}</span>
                            )}
                          </span>
                        </span>
                        {isCreator && !memberIsCreator ? (
                          <button
                            onClick={() => handleSetRole(circle.id, m.userId, memberIsOrganizer ? 'member' : 'organizer')}
                            disabled={roleBusy === m.userId}
                            title={memberIsOrganizer ? 'Retirer le rôle d\'organisateur' : 'Nommer organisateur'}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-colors disabled:opacity-50 ${
                              memberIsOrganizer ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <ShieldCheck size={11} />
                            {memberIsOrganizer ? 'Organisateur' : 'Nommer'}
                          </button>
                        ) : (memberIsCreator || memberIsOrganizer) && (
                          <ShieldCheck size={11} className="text-indigo-600 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {isCreator && circle.members.length > 1 && (
                    <p className="text-[10px] text-slate-400 px-1 pt-1 border-t border-slate-100">
                      Les organisateurs gèrent le Cercle avec toi (paramètres, admissions, création des Plans). Ils ne modifient pas les Plans des autres.
                    </p>
                  )}
                </div>
              )}

              {colorPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleSetColor(circle.id, null)}
                    title="Aucune couleur"
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
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                  {(() => {
                    const threshold = Math.ceil(circle.members.length / 2);
                    const byCreator = (circle.admissionMode ?? 'vote') !== 'vote';
                    const iAmCreator = isManager;
                    return (circle.joinRequests ?? []).map(r => {
                      const hasVoted = r.votes.some(v => v.userId === user?.id);
                      if (byCreator) return (
                        <div key={r.id} className="flex items-center gap-2 px-1 py-0.5">
                          <Avatar pseudo={r.user.pseudo} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-800 truncate">@{r.user.pseudo}</p>
                            <p className="text-xs text-indigo-600">{iAmCreator ? 'À toi de décider' : 'Validation par les organisateurs'}</p>
                          </div>
                          {iAmCreator && (
                            <>
                              <button
                                onClick={() => handleVoteRequest(circle.id, r.id)}
                                disabled={votingRequestId === r.id}
                                title="Accepter"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700 transition-colors flex-shrink-0 disabled:opacity-50"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => handleRefuseRequest(circle.id, r.id)}
                                disabled={votingRequestId === r.id}
                                title="Refuser"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-700 transition-colors flex-shrink-0 disabled:opacity-50"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                      return (
                        <div key={r.id} className="flex items-center gap-2 px-1 py-0.5">
                          <Avatar pseudo={r.user.pseudo} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-800 truncate">@{r.user.pseudo}</p>
                            <p className="text-xs text-indigo-600">{r.votes.length}/{threshold} vote{threshold > 1 ? 's' : ''}</p>
                          </div>
                          <button
                            onClick={() => handleVoteRequest(circle.id, r.id)}
                            disabled={votingRequestId === r.id}
                            title={hasVoted ? 'Retirer mon vote' : 'Approuver'}
                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 ${
                              hasVoted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700'
                            }`}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User + menu + logout */}
      <div className="relative px-3 py-3 border-t border-slate-200 flex items-center gap-2 short:sticky short:bottom-0 short:z-10 short:bg-slate-100">
        {user && <Avatar pseudo={user.pseudo} size="sm" />}
        <span className="flex-1 text-sm text-slate-700 font-medium truncate">@{user?.pseudo}</span>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        <button
          onClick={() => setShowMenu(v => !v)}
          title="Menu"
          className={`p-1.5 rounded-lg transition-colors ${showMenu ? 'bg-slate-200 text-slate-900' : 'text-indigo-600 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <Menu size={15} />
        </button>

        {showMenu && (
          <div ref={menuRef} className="absolute bottom-full right-3 mb-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 space-y-0.5 z-20">
            <button
              onClick={() => { setShowMenu(false); setShowCreate(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Plus size={15} />
              Créer un Cercle
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowJoin(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Users size={15} />
              Rejoindre un Cercle
            </button>
            {user?.isAdmin && (
              <button
                onClick={() => { setShowMenu(false); navigate('/admin'); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
              >
                <ShieldCheck size={15} />
                Panneau admin
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); setShowProfile(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <UserRound size={15} />
              Mon profil
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowChangePassword(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <KeyRound size={15} />
              Changer mon mot de passe
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowNotifSettings(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <Bell size={15} />
              Notifications
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowGuide(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm"
            >
              <BookOpen size={15} />
              Guide d'utilisation
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowTerms(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <ScrollText size={15} />
              Conditions d'utilisation
            </button>
            <a
              href="/confidentialite"
              target="_blank"
              rel="noopener"
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <ShieldCheck size={15} />
              Politique de confidentialité
            </a>
            <button
              onClick={() => { setShowMenu(false); setShowDeleteAccount(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-slate-100 transition-colors text-sm"
            >
              <UserX size={15} />
              Supprimer mon compte
            </button>
            <p className="text-center text-xs text-slate-500 pt-2 mt-1 border-t border-slate-200">info@evly.ch</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Se déconnecter"
          className="p-1.5 rounded-lg text-indigo-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <LogOut size={15} />
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
      {showNotifSettings && (
        <NotificationSettingsModal onClose={() => setShowNotifSettings(false)} />
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
