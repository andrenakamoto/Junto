import { useEffect, useRef, useState } from 'react';
import { Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { Circle } from '../../types';
import api from '../../services/api';
import { Avatar } from '../ui/Avatar';
import { displayName } from '../../lib/names';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from './InviteModal';
import { currentLang, t } from '../../i18n';

// Membres d'un Cercle : feuille qui monte du bas sur téléphone, fenêtre centrée sur grand écran.
// Groupés (créateur, organisateurs, membres), triés par prénom, recherche dès 10 membres. Le
// créateur nomme ou retire les organisateurs. Ouverte depuis la pastille du Cercle (CircleSidebar)
// et l'en-tête de la liste des Plans (PlanList).
export function CircleMembersSheet({ circle, onlineUserIds, onClose, onCircleUpdated }: {
  circle: Circle;
  onlineUserIds?: Set<string>;
  onClose: () => void;
  onCircleUpdated: (circle: Circle) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const isCreator = circle.creatorId === user?.id;

  // Bouton retour Android (NativeChrome → DashboardPage) : ferme la feuille d'abord
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onBack(e: Event) { e.preventDefault(); onCloseRef.current(); }
    window.addEventListener('evly-back-plan', onBack);
    return () => window.removeEventListener('evly-back-plan', onBack);
  }, []);
  // Échap au clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Glisser la poignée vers le bas pour fermer (téléphone)
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  async function setRole(userId: string, role: 'organizer' | 'member') {
    setRoleBusy(userId);
    try {
      const { data } = await api.put(`/circles/${circle.id}/members/${userId}/role`, { role });
      onCircleUpdated(data);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.retryError'));
    } finally {
      setRoleBusy(null);
    }
  }

  const name = (m: Circle['members'][number]) => (displayName(m.user) ?? m.user.pseudo).toLocaleLowerCase();
  const q = query.trim().toLocaleLowerCase();
  const matches = circle.members
    .filter(m => !q || name(m).includes(q) || m.user.pseudo.toLocaleLowerCase().includes(q))
    .sort((a, b) => name(a).localeCompare(name(b), currentLang()));
  const groups = [
    { key: 'creator', label: t('circle.members.creator'), list: matches.filter(m => m.userId === circle.creatorId) },
    { key: 'organizers', label: t('circle.members.organizers'), list: matches.filter(m => m.userId !== circle.creatorId && m.role === 'organizer') },
    { key: 'members', label: t('circle.members.members'), list: matches.filter(m => m.userId !== circle.creatorId && m.role !== 'organizer') },
  ].filter(g => g.list.length > 0);
  const onlineCount = circle.members.filter(m => onlineUserIds?.has(m.userId)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('circle.members.ariaTitle', { name: circle.name })}
        onClick={e => e.stopPropagation()}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl max-h-[80vh] md:max-h-[80vh] flex flex-col shadow-2xl pb-[var(--sa-bottom,0px)] md:pb-0 transition-transform"
      >
        {/* Poignée + titre (zone de glissement) */}
        <div
          className="px-5 pt-2 pb-3 border-b border-slate-100 flex-shrink-0"
          onTouchStart={e => { dragStart.current = e.touches[0].clientY; }}
          onTouchMove={e => { if (dragStart.current !== null) setDragY(Math.max(0, e.touches[0].clientY - dragStart.current)); }}
          onTouchEnd={() => { if (dragY > 90) onClose(); setDragY(0); dragStart.current = null; }}
        >
          <div className="md:hidden mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{t('circle.members.title')}</h2>
              <p className="text-sm text-slate-500 truncate">
                {circle.name} · {t('circle.members.count', { count: circle.members.length })}
                {onlineCount > 0 && <span className="text-emerald-600">{t('circle.members.online', { count: onlineCount })}</span>}
              </p>
            </div>
            <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0">
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            {circle.members.length >= 10 && (
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-500 min-w-0">
                <Search size={16} className="flex-shrink-0" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('circle.members.search')} className="flex-1 min-w-0 bg-transparent text-sm text-slate-800 focus:outline-none" />
              </label>
            )}
            <button onClick={() => setShowInvite(true)} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 ${circle.members.length >= 10 ? '' : 'flex-1'}`}>
              <UserPlus size={16} /> {t('circle.members.invite')}
            </button>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {groups.length === 0 && <p className="text-sm text-slate-400 italic text-center py-6">{t('circle.members.noMatch', { query })}</p>}
          {groups.map(g => (
            <section key={g.key} className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                {g.label}{g.key !== 'creator' && ` (${g.list.length})`}
              </p>
              <ul className="space-y-1">
                {g.list.map(m => {
                  const memberIsCreator = m.userId === circle.creatorId;
                  const memberIsOrganizer = m.role === 'organizer';
                  const first = displayName(m.user);
                  return (
                    <li key={m.userId} className="flex items-center gap-3 py-1.5">
                      <Avatar pseudo={m.user.pseudo} online={onlineUserIds?.has(m.userId)} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">
                          {first ?? `@${m.user.pseudo}`}{m.userId === user?.id && <span className="text-slate-400 font-normal">{t('circle.members.you')}</span>}
                        </span>
                        {first && <span className="block text-xs text-slate-500 truncate">@{m.user.pseudo}</span>}
                      </span>
                      {isCreator && !memberIsCreator ? (
                        <button
                          onClick={() => setRole(m.userId, memberIsOrganizer ? 'member' : 'organizer')}
                          disabled={roleBusy === m.userId}
                          title={memberIsOrganizer ? t('circle.members.removeOrganizer') : t('circle.members.makeOrganizer')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors disabled:opacity-50 ${
                            memberIsOrganizer ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <ShieldCheck size={13} />
                          {memberIsOrganizer ? t('circle.members.organizer') : t('circle.members.appoint')}
                        </button>
                      ) : (memberIsCreator || memberIsOrganizer) && (
                        <ShieldCheck size={15} className="text-indigo-600 flex-shrink-0" aria-label={memberIsCreator ? t('circle.members.creator') : t('circle.members.organizer')} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {isCreator && circle.members.length > 1 && (
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              {t('circle.members.organizersHint')}
            </p>
          )}
        </div>
      </div>

      {showInvite && (
        <div onClick={e => e.stopPropagation()}>
          <InviteModal circleName={circle.name} circleCode={circle.code} circleId={circle.id} onClose={() => setShowInvite(false)} />
        </div>
      )}
    </div>
  );
}
