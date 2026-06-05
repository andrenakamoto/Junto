import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, MapPin, LogOut, Users, CheckSquare, BarChart2, MessageSquare, UserPlus, Clock, Trash2, ChevronLeft, Pencil } from 'lucide-react';
import { Plan, Message, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ChatInput } from '../chat/ChatInput';
import { InfosTab } from './InfosTab';
import { MembresTab } from './MembresTab';
import { VotesTab } from './VotesTab';
import { InviteModal } from '../circles/InviteModal';
import { DeletePlanModal } from './DeletePlanModal';
import { EditPlanModal } from './EditPlanModal';
import { getSocket } from '../../lib/socket';
import api from '../../services/api';

type Tab = 'chat' | 'infos' | 'membres' | 'votes';

const rsvpConfig = {
  in:    { label: 'Je suis in',  active: 'bg-emerald-500 text-white', inactive: 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700' },
  maybe: { label: 'Peut-être',   active: 'bg-amber-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700' },
  out:   { label: 'Je passe',    active: 'bg-slate-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
};

const tabs = [
  { key: 'chat' as Tab,    Icon: MessageSquare, label: 'Chat' },
  { key: 'infos' as Tab,   Icon: CheckSquare,   label: 'Infos' },
  { key: 'membres' as Tab, Icon: Users,         label: 'Membres' },
  { key: 'votes' as Tab,   Icon: BarChart2,     label: 'Votes' },
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
}

export function PlanDetail({ plan, circleName, circleCode, onPlanUpdated, onPlanDeleted, onLogout, onBack, user }: Props) {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDeletePlan, setShowDeletePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      setMessages(prev => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    }
    socket.on('message', onMessage);

    return () => {
      socket.emit('leave-plan', plan.id);
      socket.off('message', onMessage);
    };
  }, [plan.id, isMember, token, scrollToBottom]);

  // Reset tab to chat when plan changes
  useEffect(() => { setTab('chat'); }, [plan.id]);

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
    getSocket(token).emit('send-message', { planId: plan.id, content });
  }

  const isCreator = plan.creatorId === user.id;

  const eventDateFmt = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;

  const endDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.endDate));

  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  const outCount = plan.members.filter(m => m.rsvp === 'out').length;

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
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{plan.description}</p>

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
                  </span>
                </div>
              )}

              {/* Date d'expiration du plan — séparée visuellement */}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 border-t border-slate-100 pt-2">
                <Clock size={11} />
                <span>Ce plan disparaît le <span className="font-medium text-slate-500">{endDateFmt}</span></span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {isMember && (
              <>
                <button
                  onClick={() => setShowInvite(true)}
                  title="Inviter par SMS"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <UserPlus size={16} />
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
          <div className="flex border-b border-slate-200 px-4 flex-shrink-0 bg-white">
            {tabs.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={13} />
                {label}
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
                    <ChatMessage key={msg.id} message={msg} isMe={msg.author.id === user.id} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <ChatInput onSend={handleSend} />
            </div>
          )}

          {tab === 'infos' && (
            <InfosTab plan={plan} onPlanUpdated={onPlanUpdated} pseudo={user.pseudo} />
          )}
          {tab === 'membres' && <MembresTab members={plan.members} />}
          {tab === 'votes' && <VotesTab plan={plan} onPlanUpdated={onPlanUpdated} userId={user.id} />}
        </>
      )}

      {showInvite && (
        <InviteModal
          circleName={circleName}
          circleCode={circleCode}
          planTitle={plan.title}
          onClose={() => setShowInvite(false)}
        />
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

function ChatMessage({ message, isMe }: { message: Message; isMe: boolean }) {
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && <Avatar pseudo={message.author.pseudo} size="sm" />}
      <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{message.author.pseudo}</span>
            <span className="text-xs text-slate-400">{time}</span>
          </div>
        )}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isMe
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
        }`}>
          {message.content}
        </div>
        {isMe && <span className="text-xs text-slate-400">{time}</span>}
      </div>
    </div>
  );
}
