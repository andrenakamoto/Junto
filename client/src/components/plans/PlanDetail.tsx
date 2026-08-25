import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, CalendarPlus, MapPin, LogOut, Users, CheckSquare, BarChart2, MessageSquare, UserPlus, Clock, Trash2, ChevronLeft, Pencil, History, Euro, ImageDown, MoreVertical } from 'lucide-react';
import { Plan, Message, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { ChatInput } from '../chat/ChatInput';
import { ChatMessage } from '../chat/ChatMessage';
import { InfosTab } from './InfosTab';
import { MembresTab } from './MembresTab';
import { VotesTab } from './VotesTab';
import { DepensesTab } from './DepensesTab';
import { HistoriqueTab } from './HistoriqueTab';
import { InviteModal } from '../circles/InviteModal';
import { StoryModal } from './StoryModal';
import { DeletePlanModal } from './DeletePlanModal';
import { EditPlanModal } from './EditPlanModal';
import { getSocket } from '../../lib/socket';
import api from '../../services/api';

type Tab = 'chat' | 'infos' | 'membres' | 'votes' | 'depenses' | 'historique';

const rsvpConfig = {
  in:    { label: 'Je suis in',  active: 'bg-emerald-500 text-white', inactive: 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700' },
  maybe: { label: 'Peut-être',   active: 'bg-amber-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700' },
  out:   { label: 'Absent(e)',    active: 'bg-slate-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
};

const tabs = [
  { key: 'chat' as Tab,       Icon: MessageSquare, label: 'Chat' },
  { key: 'infos' as Tab,      Icon: CheckSquare,   label: 'Infos' },
  { key: 'membres' as Tab,    Icon: Users,         label: 'Membres' },
  { key: 'votes' as Tab,      Icon: BarChart2,     label: 'Votes' },
  { key: 'depenses' as Tab,   Icon: Euro,          label: 'Dépenses' },
  { key: 'historique' as Tab, Icon: History,       label: 'Historique' },
];

interface Props {
  plan: Plan;
  circleName: string;
  circleCode: string;
  onPlanUpdated: (plan: Plan) => void;
  onPlanDeleted: () => void;
  onLogout: () => void;
  onBack: () => void;
  user: User;
  onlineUserIds?: Set<string>;
}

export function PlanDetail({ plan, circleName, circleCode, onPlanUpdated, onPlanDeleted, onLogout, onBack, user, onlineUserIds }: Props) {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [showDeletePlan, setShowDeletePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openThreadIdRef = useRef<string | null>(null);
  useEffect(() => { openThreadIdRef.current = openThreadId; }, [openThreadId]);

  const myMember = plan.members.find(m => m.userId === user.id);
  const isMember = !!myMember;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isMember || !token) return;
    setMessages([]);
    api.get(`/plans/${plan.id}/messages`).then(res => {
      setMessages(res.data);
      setTimeout(scrollToBottom, 100);
    });

    const socket = getSocket(token);
    socket.emit('join-plan', plan.id);

    function onMessage(msg: Message) {
      if (msg.parentId) {
        setMessages(prev => prev.map(m => m.id === msg.parentId
          ? { ...m, _count: { replies: (m._count?.replies ?? 0) + 1 } }
          : m));
        setThreadReplies(prev => msg.parentId === openThreadIdRef.current ? [...prev, msg] : prev);
        return;
      }
      setMessages(prev => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    }
    socket.on('message', onMessage);

    function onReactionsUpdated({ messageId, reactions }: { messageId: string; reactions: Message['reactions'] }) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      setThreadReplies(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    }
    socket.on('reactions-updated', onReactionsUpdated);

    return () => {
      socket.emit('leave-plan', plan.id);
      socket.off('message', onMessage);
      socket.off('reactions-updated', onReactionsUpdated);
    };
  }, [plan.id, isMember, token, scrollToBottom]);

  // Reset tab to chat when plan changes
  useEffect(() => {
    setTab('chat');
    setReplyTo(null);
    setOpenThreadId(null);
    setThreadReplies([]);
  }, [plan.id]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    if (showActionsMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  async function handleJoin() {
    setJoining(true);
    try {
      const { data } = await api.post(`/plans/${plan.id}/join`);
      onPlanUpdated(data);
    } finally {
      setJoining(false);
    }
  }

  async function handleRsvp(rsvp: 'in' | 'maybe' | 'out') {
    if (updatingRsvp || myMember?.rsvp === rsvp) return;
    setUpdatingRsvp(true);
    try {
      await api.put(`/plans/${plan.id}/rsvp`, { rsvp });
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
    } finally {
      setUpdatingRsvp(false);
    }
  }

  function handleSend(content: string) {
    if (!token) return;
    getSocket(token).emit('send-message', { planId: plan.id, content, parentId: replyTo?.id });
  }

  function handleReact(messageId: string, emoji: string) {
    if (!token) return;
    getSocket(token).emit('toggle-reaction', { messageId, emoji });
  }

  function handleOpenThread(message: Message) {
    if (openThreadId === message.id) {
      setOpenThreadId(null);
      setThreadReplies([]);
      setReplyTo(null);
      return;
    }
    setOpenThreadId(message.id);
    setThreadReplies([]);
    setReplyTo(message);
    api.get(`/plans/messages/${message.id}/replies`).then(res => setThreadReplies(res.data));
  }

  async function handleExportIcal() {
    const res = await api.get(`/plans/${plan.id}/ical`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const isCreator = plan.creatorId === user.id;

  const eventDateFmt = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;

  const endDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.endDate));

  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  const outCount = plan.members.filter(m => m.rsvp === 'out').length;
  const isFull = plan.maxParticipants != null && plan.members.length >= plan.maxParticipants;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="md:hidden p-1 -ml-1 mt-0.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight flex-1">{plan.title}</h1>
                {isCreator && (
                  <button
                    onClick={() => setShowEditPlan(true)}
                    title="Modifier le plan"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {plan.description && <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{plan.description}</p>}

              {/* Date de l'événement */}
              {eventDateFmt && (
                <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-indigo-50 rounded-lg w-fit">
                  <Calendar size={13} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-indigo-700">{eventDateFmt}</span>
                </div>
              )}

              {/* Infos membres */}
              {isMember && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  {plan.location && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} className="text-indigo-400" />{plan.location}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    par @{plan.creator.pseudo} ·{' '}
                    <span className="text-emerald-600">{inCount} in</span>{' '}·{' '}
                    <span className="text-amber-600">{maybeCount} ?</span>{' '}·{' '}
                    <span className="text-slate-400">{outCount} non</span>
                    {plan.maxParticipants != null && (
                      <>{' '}· <span className={isFull ? 'text-red-500 font-semibold' : 'text-slate-400'}>{plan.members.length}/{plan.maxParticipants}</span></>
                    )}
                  </span>
                </div>
              )}

              {/* Date d'expiration du plan — séparée visuellement */}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 border-t border-slate-100 pt-2">
                <Clock size={11} />
                <span>Ce plan disparaît le <span className="font-medium text-slate-500">{endDateFmt}</span> — toutes les données liées (messages, photos, dépenses) seront supprimées</span>
              </div>
            </div>
          </div>
          {/* Actions — icônes en ligne sur desktop, menu compact sur mobile */}
          <div className="hidden md:flex gap-1 flex-shrink-0">
            {isMember && (
              <>
                <button
                  onClick={() => setShowInvite(true)}
                  title="Inviter"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <UserPlus size={16} />
                </button>
                <button
                  onClick={handleExportIcal}
                  title="Exporter vers mon calendrier (.ics)"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <CalendarPlus size={16} />
                </button>
                <button
                  onClick={() => setShowStory(true)}
                  title="Télécharger la story"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <ImageDown size={16} />
                </button>
                <button
                  onClick={() => setShowDeletePlan(true)}
                  title="Voter pour supprimer ce Plan"
                  className={`p-2 rounded-lg transition-colors ${
                    (plan.deleteVotes ?? []).some(v => v.userId === user.id)
                      ? 'text-red-500 bg-red-50 hover:bg-red-100'
                      : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button
              onClick={onLogout}
              title="Se déconnecter"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="relative md:hidden flex-shrink-0" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(v => !v)}
              title="Menu"
              className={`p-2 rounded-lg transition-colors ${showActionsMenu ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            >
              <MoreVertical size={18} />
            </button>
            {showActionsMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 space-y-0.5 z-20">
                {isMember && (
                  <>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowInvite(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <UserPlus size={15} className="text-slate-400" />
                      Inviter
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); handleExportIcal(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <CalendarPlus size={15} className="text-slate-400" />
                      Exporter vers mon calendrier
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowStory(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <ImageDown size={15} className="text-slate-400" />
                      Télécharger la story
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowDeletePlan(true); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm ${
                        (plan.deleteVotes ?? []).some(v => v.userId === user.id) ? 'text-red-500' : 'text-slate-700'
                      }`}
                    >
                      <Trash2 size={15} className={(plan.deleteVotes ?? []).some(v => v.userId === user.id) ? 'text-red-500' : 'text-slate-400'} />
                      Voter pour supprimer ce Plan
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setShowActionsMenu(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                >
                  <LogOut size={15} className="text-slate-400" />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>

        {isMember ? (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">Mon RSVP :</span>
            {(['in', 'maybe', 'out'] as const).map(rsvp => (
              <button
                key={rsvp}
                onClick={() => handleRsvp(rsvp)}
                disabled={updatingRsvp}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  myMember?.rsvp === rsvp ? rsvpConfig[rsvp].active : rsvpConfig[rsvp].inactive
                }`}
              >
                {rsvpConfig[rsvp].label}
              </button>
            ))}
          </div>
        ) : isFull ? (
          <div className="mt-3 p-4 bg-red-50 rounded-xl border border-red-100">
            <p className="text-sm text-red-600 font-medium">
              Ce Plan est complet ({plan.members.length}/{plan.maxParticipants} participants).
            </p>
          </div>
        ) : (
          <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-sm text-slate-600 mb-3">
              Rejoindre ce Plan, c'est dire <strong>oui</strong> à sa description. Tu pourras ensuite chatter et voir les infos.
            </p>
            <Button onClick={handleJoin} disabled={joining} size="sm">
              {joining ? 'Rejoindre...' : '→ Rejoindre ce Plan'}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs (only if member) */}
      {isMember && (
        <>
          <div className="flex border-b border-slate-200 flex-shrink-0 bg-white">
            {tabs.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-w-0 ${
                  tab === key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                <span className="truncate leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {tab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm pt-12">
                    Aucun message encore. Lance la conversation !
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id}>
                      <ChatMessage
                        message={msg}
                        isMe={msg.author.id === user.id}
                        myUserId={user.id}
                        onReact={handleReact}
                        onReply={handleOpenThread}
                        replyCount={msg._count?.replies}
                      />
                      {openThreadId === msg.id && (
                        <div className={`mt-2 ml-8 pl-3 border-l-2 border-indigo-100 space-y-2 ${msg.author.id === user.id ? 'mr-8 ml-0 pr-3 pl-0 border-l-0 border-r-2' : ''}`}>
                          {threadReplies.map(reply => (
                            <ChatMessage
                              key={reply.id}
                              message={reply}
                              isMe={reply.author.id === user.id}
                              myUserId={user.id}
                              onReact={handleReact}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <ChatInput
                onSend={handleSend}
                members={plan.members.map(m => ({ pseudo: m.user.pseudo }))}
                replyTo={replyTo ? { id: replyTo.id, authorPseudo: replyTo.author.pseudo, preview: replyTo.content.slice(0, 40) } : null}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          )}

          {tab === 'infos' && (
            <InfosTab plan={plan} onPlanUpdated={onPlanUpdated} pseudo={user.pseudo} userId={user.id} />
          )}
          {tab === 'membres' && <MembresTab members={plan.members} onlineUserIds={onlineUserIds} />}
          {tab === 'votes' && <VotesTab plan={plan} onPlanUpdated={onPlanUpdated} userId={user.id} />}
          {tab === 'depenses' && <DepensesTab planId={plan.id} members={plan.members} userId={user.id} />}
          {tab === 'historique' && <HistoriqueTab changeLogs={plan.changeLogs ?? []} />}
        </>
      )}

      {showInvite && (
        <InviteModal
          circleName={circleName}
          circleCode={circleCode}
          planTitle={plan.title}
          planId={plan.id}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showStory && (
        <StoryModal plan={plan} onClose={() => setShowStory(false)} />
      )}

      {showEditPlan && (
        <EditPlanModal
          plan={plan}
          onClose={() => setShowEditPlan(false)}
          onUpdated={(updated) => { onPlanUpdated(updated); setShowEditPlan(false); }}
        />
      )}
      {showDeletePlan && (
        <DeletePlanModal
          plan={plan}
          onClose={() => setShowDeletePlan(false)}
          onDeleted={() => { setShowDeletePlan(false); onPlanDeleted(); }}
          onUpdated={(updated) => { onPlanUpdated(updated); }}
        />
      )}
    </div>
  );
}
