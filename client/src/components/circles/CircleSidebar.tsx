import { useState, useRef, useEffect } from 'react';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, CalendarDays, KeyRound, Bell, UserPlus, Check } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [membersPopover, setMembersPopover] = useState<string | null>(null);
  const [colorPopover, setColorPopover] = useState<string | null>(null);
  const [requestsPopover, setRequestsPopover] = useState<string | null>(null);
  const [circleColors, setCircleColors] = useState<Record<string, string | null | undefined>>({});
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate('/auth');
  }

  return (
    <div className="w-full bg-slate-900 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-700/60">
        <LogoFull iconSize={32} />
      </div>

      {/* Circle list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5">
        <button
          onClick={onAllPlans}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 text-left transition-all border text-sm font-semibold ${
            allPlansActive
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
              : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600/60'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${allPlansActive ? 'bg-indigo-500' : 'bg-slate-700'}`}>
            <Calendar size={15} />
          </div>
          Tous mes plans
        </button>
        <button
          onClick={onCalendar}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 text-left transition-all border text-sm font-semibold ${
            calendarActive
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
              : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600/60'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${calendarActive ? 'bg-indigo-500' : 'bg-slate-700'}`}>
            <CalendarDays size={15} />
          </div>
          Calendrier
        </button>
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes Cercles</p>
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-600 italic">Aucun Cercle pour l'instant</p>
        )}
        {circles.map((circle) => {
          const selected = selectedId === circle.id;
          const nextPlan = circle.plans?.[0];
          const hasUnread = unreadCircles.has(circle.id);
          const circleColor = circleColors[circle.id] !== undefined ? circleColors[circle.id] : circle.color;
          const isCreator = circle.creatorId === user?.id;
          return (
            <div key={circle.id}>
              <button
                onClick={() => onSelect(circle.id)}
                style={circleColor ? { borderLeftColor: circleColor, borderLeftWidth: 3 } : undefined}
                className={`w-full text-left rounded-xl transition-all border relative ${
                  selected
                    ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/30'
                    : hasUnread
                    ? 'bg-slate-800/60 border-orange-500/50 hover:bg-slate-800 hover:border-orange-400/60'
                    : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/60'
                }`}
              >
                {hasUnread && !selected && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full" />
                )}
                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                  <Avatar pseudo={circle.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${selected ? 'text-white' : 'text-slate-200'}`}>
                      {circle.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); setMembersPopover(membersPopover === circle.id ? null : circle.id); }}
                        className={`text-xs hover:underline ${selected ? 'text-indigo-200/80 hover:text-white' : 'text-indigo-300 hover:text-indigo-200'}`}
                      >
                        {circle.members.length} membre{circle.members.length > 1 ? 's' : ''}
                      </button>
                      {(circle._count?.plans ?? 0) > 0 && (
                        <>
                          <span className="text-xs text-indigo-300/50">·</span>
                          <span className={`text-xs ${selected ? 'text-indigo-200/80' : 'text-indigo-300'}`}>
                            {circle._count!.plans} plan{circle._count!.plans > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                      {isCreator && (
                        <button
                          onClick={e => { e.stopPropagation(); setColorPopover(colorPopover === circle.id ? null : circle.id); }}
                          title="Couleur du Cercle"
                          className="w-3 h-3 rounded-full border border-white/30 flex-shrink-0 ml-0.5"
                          style={{ backgroundColor: circleColor || '#64748b' }}
                        />
                      )}
                    </div>
                  </div>
                  {(circle.joinRequests?.length ?? 0) > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setRequestsPopover(requestsPopover === circle.id ? null : circle.id); }}
                      title="Demandes en attente"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex-shrink-0 text-xs font-semibold"
                    >
                      <UserPlus size={12} />
                      {circle.joinRequests!.length}
                    </button>
                  )}
                </div>

                {nextPlan && (
                  <div className={`mx-3 mb-3 px-2.5 py-2 rounded-lg ${selected ? 'bg-indigo-500/30' : 'bg-slate-700/50'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${selected ? 'text-indigo-200/70' : 'text-indigo-300'}`}>
                      Prochain évènement
                    </p>
                    <p className={`text-xs font-semibold truncate ${selected ? 'text-white' : 'text-slate-200'}`}>
                      {nextPlan.title}
                    </p>
                    <div className={`flex items-center gap-1 mt-0.5 ${selected ? 'text-indigo-200/80' : 'text-slate-400'}`}>
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
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-slate-800 border border-slate-700/60 rounded-xl p-2 space-y-1">
                  {circle.members.map(m => (
                    <div key={m.userId} className="flex items-center gap-2 px-1 py-0.5">
                      <Avatar pseudo={m.user.pseudo} size="sm" />
                      <span className="text-xs text-slate-200 truncate flex-1">@{m.user.pseudo}</span>
                      {m.role === 'admin' && <ShieldCheck size={11} className="text-indigo-400 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {colorPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-slate-800 border border-slate-700/60 rounded-xl p-2.5 flex items-center gap-1.5 flex-wrap">
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
                      className={`w-6 h-6 rounded-full flex-shrink-0 transition-transform ${circleColor === c ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-110' : ''}`}
                    />
                  ))}
                </div>
              )}

              {requestsPopover === circle.id && (
                <div ref={popoverRef} className="mx-1 mt-1 mb-0.5 bg-slate-800 border border-slate-700/60 rounded-xl p-2.5 space-y-2">
                  {(() => {
                    const threshold = Math.ceil(circle.members.length / 2);
                    return (circle.joinRequests ?? []).map(r => {
                      const hasVoted = r.votes.some(v => v.userId === user?.id);
                      return (
                        <div key={r.id} className="flex items-center gap-2 px-1 py-0.5">
                          <Avatar pseudo={r.user.pseudo} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 truncate">@{r.user.pseudo}</p>
                            <p className="text-xs text-indigo-300">{r.votes.length}/{threshold} vote{threshold > 1 ? 's' : ''}</p>
                          </div>
                          <button
                            onClick={() => handleVoteRequest(circle.id, r.id)}
                            disabled={votingRequestId === r.id}
                            title={hasVoted ? 'Retirer mon vote' : 'Approuver'}
                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 ${
                              hasVoted ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300'
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

      {/* Actions */}
      <div className="px-2 py-3 border-t border-slate-700/60 space-y-0.5">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
        >
          <Plus size={15} />
          Créer un Cercle
        </button>
        <button
          onClick={() => setShowJoin(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
        >
          <Users size={15} />
          Rejoindre un Cercle
        </button>
        {user?.isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors text-sm"
          >
            <ShieldCheck size={15} />
            Panneau admin
          </button>
        )}
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
        >
          <KeyRound size={15} />
          Changer mon mot de passe
        </button>
        <button
          onClick={() => setShowNotifSettings(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
        >
          <Bell size={15} />
          Notifications
        </button>
        <button
          onClick={() => setShowTerms(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-indigo-300/70 hover:text-indigo-200 hover:bg-slate-800 transition-colors text-sm"
        >
          <ScrollText size={15} />
          Conditions d'utilisation
        </button>
      </div>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-slate-700/60 flex items-center gap-2">
        {user && <Avatar pseudo={user.pseudo} size="sm" />}
        <span className="flex-1 text-sm text-slate-300 font-medium truncate">@{user?.pseudo}</span>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <button
          onClick={handleLogout}
          title="Se déconnecter"
          className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-slate-700 transition-colors"
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
