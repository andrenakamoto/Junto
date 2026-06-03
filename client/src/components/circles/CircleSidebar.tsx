import { useState, useRef, useEffect } from 'react';
import { Plus, Users, ShieldCheck, LogOut, ScrollText } from 'lucide-react';
import { LogoFull } from '../ui/Logo';
import { TermsModal } from '../ui/TermsModal';
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
}

export function CircleSidebar({ circles, selectedId, onSelect, onCreated }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
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
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mes Cercles</p>
        {circles.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-600 italic">Aucun Cercle pour l'instant</p>
        )}
        {circles.map((circle) => (
          <div key={circle.id}>
            <button
              onClick={() => onSelect(circle.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                selectedId === circle.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Avatar pseudo={circle.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{circle.name}</p>
                <button
                  onClick={e => { e.stopPropagation(); setMembersPopover(membersPopover === circle.id ? null : circle.id); }}
                  className="text-xs opacity-60 hover:opacity-100 hover:underline text-left"
                >
                  {circle.members.length} membre{circle.members.length > 1 ? 's' : ''}
                </button>
              </div>
            </button>

            {membersPopover === circle.id && (
              <div ref={popoverRef} className="mx-2 mb-1 bg-slate-800 border border-slate-700/60 rounded-lg p-2 space-y-1">
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
        ))}
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
