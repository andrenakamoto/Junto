import { useState, useRef, useEffect } from 'react';
import { Plus, Users, ShieldCheck, LogOut, ScrollText, Calendar, KeyRound } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
import { ChangePasswordModal } from '../ui/ChangePasswordModal';
import { useNavigate } from 'react-router-dom';
import { Circle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { disconnectSocket } from '../../lib/socket';
import { CreateCircleModal } from './CreateCircleModal';
import { JoinCircleModal } from './JoinCircleModal';
import { Avatar } from '../ui/Avatar';

interface Props {
  circles: Circle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (circle: Circle) => void;
  onAllPlans: () => void;
  allPlansActive: boolean;
}

export function CircleSidebar({ circles, selectedId, onSelect, onCreated, onAllPlans, allPlansActive }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [membersPopover, setMembersPopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMembersPopover(null);
      }
    }
    if (membersPopover) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [membersPopover]);

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
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes Cercles</p>
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-600 italic">Aucun Cercle pour l'instant</p>
        )}
        {circles.map((circle) => {
          const selected = selectedId === circle.id;
          const nextPlan = circle.plans?.[0];
          return (
            <div key={circle.id}>
              <button
                onClick={() => onSelect(circle.id)}
                className={`w-full text-left rounded-xl transition-all border ${
                  selected
                    ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/60'
                }`}
              >
                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                  <Avatar pseudo={circle.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${selected ? 'text-white' : 'text-slate-200'}`}>
                      {circle.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); setMembersPopover(membersPopover === circle.id ? null : circle.id); }}
                        className={`text-xs hover:underline ${selected ? 'text-indigo-200/80 hover:text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {circle.members.length} membre{circle.members.length > 1 ? 's' : ''}
                      </button>
                      {(circle._count?.plans ?? 0) > 0 && (
                        <>
                          <span className={`text-xs ${selected ? 'text-indigo-300/50' : 'text-slate-600'}`}>·</span>
                          <span className={`text-xs ${selected ? 'text-indigo-200/80' : 'text-slate-500'}`}>
                            {circle._count!.plans} plan{circle._count!.plans > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {nextPlan && (
                  <div className={`flex items-center gap-1.5 px-3 pb-2.5 ${selected ? 'text-indigo-200/80' : 'text-slate-500'}`}>
                    <Calendar size={10} className="flex-shrink-0" />
                    <span className="text-xs truncate">
                      {nextPlan.eventDate
                        ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(nextPlan.eventDate))
                        : `fin ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(nextPlan.endDate))}`
                      }
                      <span className={`ml-1 font-medium ${selected ? 'text-white/90' : 'text-slate-400'}`}>
                        — {nextPlan.title}
                      </span>
                    </span>
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
          onClick={() => setShowTerms(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors text-sm"
        >
          <ScrollText size={15} />
          Conditions d'utilisation
        </button>
      </div>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-slate-700/60 flex items-center gap-2">
        {user && <Avatar pseudo={user.pseudo} size="sm" />}
        <span className="flex-1 text-sm text-slate-300 font-medium truncate">@{user?.pseudo}</span>
        <button
          onClick={handleLogout}
          title="Se déconnecter"
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <LogOut size={15} />
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
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
