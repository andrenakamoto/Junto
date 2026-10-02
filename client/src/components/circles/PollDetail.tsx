import { useEffect, useRef, useState } from 'react';
import { Calendar, CalendarPlus, Check, ChevronLeft, Flag, Gift, Hourglass, MessageSquare, ThumbsDown, Trash2, Users } from 'lucide-react';
import { Circle, CirclePoll, CirclePollMessage, CirclePollOption, Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { fullName } from '../../lib/names';
import { Avatar } from '../ui/Avatar';
import { ChatInput } from '../chat/ChatInput';
import { DeletedBubble, MessageEditor, OwnMessageActions, useEditWindow } from '../chat/MessageEditing';
import { CreatePlanModal } from '../plans/CreatePlanModal';
import { ReportMessageModal } from '../chat/ReportMessageModal';
import api from '../../services/api';
import { isCircleManager } from '../../lib/settings';

type Tab = 'dates' | 'chat';

const displayName = (u: { pseudo: string; firstName?: string | null; lastName?: string | null }) => fullName(u) ?? `@${u.pseudo}`;

interface Props {
  pollId: string;
  circle: Circle;
  onBack: () => void;
  /** Sondage supprimé, converti ou devenu inaccessible */
  onClosed: () => void;
  onPlanCreated: (plan: Plan) => void;
}

// Détail d'un sondage de dates : qui est disponible à quelle date, qui n'est pas intéressé,
// qui n'a pas encore répondu, et un chat pour en discuter.
export function PollDetail({ pollId, circle, onBack, onClosed, onPlanCreated }: Props) {
  const { user } = useAuth();
  const [poll, setPoll] = useState<CirclePoll | null>(null);
  const [messages, setMessages] = useState<CirclePollMessage[]>([]);
  // Signalement en cours ; messages des personnes masquées cachés (lib/moderation.ts)
  const [reporting, setReporting] = useState<CirclePollMessage | null>(null);
  const blocked = new Set(user?.blockedUserIds ?? []);
  const visibleMessages = messages.filter(m => !blocked.has(m.author.id));
  const [tab, setTab] = useState<Tab>('dates');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [convertOption, setConvertOption] = useState<CirclePollOption | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function loadPoll() {
    return api.get(`/circles/polls/${pollId}`)
      .then(res => {
        if (res.data.resolvedAt) { onClosed(); return; }
        setPoll(res.data);
      })
      .catch(err => { if ([403, 404].includes(err.response?.status)) onClosed(); });
  }

  function loadMessages() {
    return api.get(`/circles/polls/${pollId}/messages`).then(res => setMessages(res.data)).catch(() => {});
  }

  useEffect(() => {
    setPoll(null);
    setMessages([]);
    setTab('dates');
    setConfirmDelete(false);
    loadPoll();
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

  useEffect(() => {
    if (tab === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tab, messages.length]);

  // Temps réel : votes / pas intéressés / suppression (circle-updated), messages (poll-message),
  // et rattrapage après une coupure de connexion.
  useSocketEvent<{ circleId: string }>('circle-updated', p => { if (p.circleId === circle.id) loadPoll(); });
  useSocketEvent<{ pollId: string; message: CirclePollMessage }>('poll-message', p => {
    if (p.pollId !== pollId) return;
    setMessages(prev => prev.some(m => m.id === p.message.id) ? prev : [...prev, p.message]);
  });
  useSocketEvent('connect', () => { loadPoll(); loadMessages(); });
  // Message modifié ou supprimé par son auteur
  const replaceMessage = (msg: CirclePollMessage) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
  useSocketEvent<{ pollId: string; message: CirclePollMessage }>('poll-message-updated', p => {
    if (p.pollId === pollId) replaceMessage(p.message);
  });

  if (!user) return null;
  if (!poll) {
    return <div className="flex-1 flex items-center justify-center bg-white text-sm text-slate-400">Chargement…</div>;
  }

  const isCreator = poll.creator.id === user.id;
  // Créer le Plan : le créateur du sondage s'il peut créer des Plans, ou le créateur/un organisateur
  // du Cercle (cas d'un sondage lancé par un membre alors que les Plans sont réservés)
  const isManager = isCircleManager(circle, user.id);
  const canConvert = isManager || (isCreator && circle.planCreationMode !== 'creator');
  const declines = poll.declines ?? [];
  const exclusions = poll.exclusions ?? [];
  const iDeclined = declines.some(d => d.userId === user.id);
  const excludedIds = new Set(exclusions.map(e => e.userId));
  const audience = circle.members.filter(m => !excludedIds.has(m.userId));
  const answered = new Set<string>([
    ...declines.map(d => d.userId),
    ...poll.options.flatMap(o => o.votes.map(v => v.userId)),
  ]);
  const pending = audience.filter(m => !answered.has(m.userId));
  const maxVotes = Math.max(1, ...poll.options.map(o => o.votes.length));
  const now = Date.now();
  const isPast = (o: CirclePollOption) => !!o.eventDate && new Date(o.eventDate).getTime() < now;
  const endsLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(poll.expiresAt));
  const nameOf = (userId: string, pseudo: string) => {
    const m = circle.members.find(x => x.userId === userId);
    return m ? displayName(m.user) : `@${pseudo}`;
  };

  async function run(action: () => Promise<{ data: CirclePoll }>) {
    setBusy(true);
    try { setPoll((await action()).data); } catch { /* le rechargement temps réel corrigera */ } finally { setBusy(false); }
  }

  async function handleSend(content: string) {
    try {
      const { data } = await api.post(`/circles/polls/${pollId}/messages`, { content });
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
    } catch { /* message non envoyé */ }
  }

  async function handleDelete() {
    await api.delete(`/circles/polls/${pollId}`);
    onClosed();
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden short:overflow-y-auto">
      {/* En-tête */}
      <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-start gap-2">
          <button
            onClick={onBack}
            className="md:hidden p-1 -ml-1 mt-0.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">Sondage de dates</p>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{poll.question}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Proposé par @{poll.creator.pseudo} · {answered.size}/{audience.length} ont répondu
            </p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1" title="Sans Plan créé d'ici là, le sondage est supprimé avec ses votes et son chat">
              <Hourglass size={11} className="flex-shrink-0" />
              Se termine {endsLabel}
            </p>
          </div>
          {isCreator && (
            confirmDelete ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-slate-500 mr-1">Supprimer ?</span>
                <button onClick={handleDelete} className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white">Oui</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">Non</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Supprimer le sondage"
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            )
          )}
        </div>
        {exclusions.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <Gift size={14} className="flex-shrink-0 mt-px" />
            <span>Sondage surprise, caché à {exclusions.map(e => `@${e.user.pseudo}`).join(', ')}.</span>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex border-b border-slate-200 flex-shrink-0 bg-white short:sticky short:top-0 short:z-10">
        {([['dates', Calendar, 'Dates'], ['chat', MessageSquare, `Chat${messages.length ? ` (${messages.length})` : ''}`]] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'dates' && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5 bg-slate-50 short:flex-none short:overflow-visible">
          <div className="space-y-2">
            {poll.options.map(opt => {
              const iVoted = opt.votes.some(v => v.userId === user.id);
              const pct = Math.round((opt.votes.length / maxVotes) * 100);
              const past = isPast(opt);
              return (
                <div key={opt.id} className={`bg-white rounded-xl border p-3 ${past ? 'opacity-50' : ''} ${iVoted ? 'border-emerald-300' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => run(() => api.post(`/circles/polls/options/${opt.id}/vote`))}
                      disabled={busy || past}
                      title={past ? 'Date passée' : iVoted ? 'Retirer ma disponibilité' : 'Je suis disponible'}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
                        iVoted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      {iVoted && <Check size={14} />}
                    </button>
                    <span className="flex-1 text-sm font-medium text-slate-800">
                      {opt.label}
                      {past && <span className="ml-2 text-xs font-normal text-slate-500">Date passée</span>}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{opt.votes.length}</span>
                    {canConvert && !past && (
                      <button
                        onClick={() => setConvertOption(opt)}
                        title="Créer le Plan avec cette date"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                      >
                        <CalendarPlus size={14} />
                        <span className="hidden sm:inline">Créer le Plan</span>
                      </button>
                    )}
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${opt.votes.length ? pct : 0}%` }} />
                  </div>
                  {opt.votes.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      {opt.votes.map(v => nameOf(v.userId, v.user.pseudo)).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => run(() => api.post(`/circles/polls/${pollId}/decline`))}
            disabled={busy}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
              iDeclined
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700'
            }`}
          >
            <ThumbsDown size={15} />
            {iDeclined ? 'Tu n\'es pas intéressé(e) — annuler' : 'Pas intéressé(e)'}
          </button>

          <PeopleGroup
            title="Pas intéressés"
            tone="amber"
            people={declines.map(d => nameOf(d.userId, d.user.pseudo))}
            empty="Personne pour l'instant."
          />
          <PeopleGroup
            title="Pas encore répondu"
            tone="slate"
            people={pending.map(m => displayName(m.user))}
            empty="Tout le monde a répondu."
          />
        </div>
      )}

      {tab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden short:flex-none short:overflow-visible">
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 bg-slate-50 short:flex-none short:overflow-visible">
            {visibleMessages.length === 0 ? (
              <div className="text-center text-slate-400 text-sm pt-12">
                Aucun message. Discutez ici des dates proposées !
                <p className="text-xs mt-1">La conversation sera reprise dans le chat du Plan créé.</p>
              </div>
            ) : visibleMessages.map(m => (
              <PollChatMessage
                key={m.id}
                message={m}
                isMe={m.author.id === user.id}
                onReport={() => setReporting(m)}
                onEdit={content => api.put(`/circles/polls/messages/${m.id}`, { content }).then(r => replaceMessage(r.data)).catch(() => {})}
                onDelete={() => api.delete(`/circles/polls/messages/${m.id}`).then(r => replaceMessage(r.data)).catch(() => {})}
              />
            ))}
            <div ref={endRef} />
          </div>
          <ChatInput onSend={handleSend} members={audience.map(m => ({ pseudo: m.user.pseudo }))} />
        </div>
      )}

      {reporting && (
        <ReportMessageModal kind="poll" messageId={reporting.id} author={reporting.author} onClose={() => setReporting(null)} />
      )}

      {convertOption && (
        <CreatePlanModal
          circleId={circle.id}
          circleMembers={circle.members}
          fromPoll={{
            pollId: poll.id,
            optionId: convertOption.id,
            suggestedTitle: poll.question,
            suggestedEventDateISO: convertOption.eventDate,
            excludedUserIds: exclusions.map(e => e.userId),
          }}
          onClose={() => setConvertOption(null)}
          onCreated={plan => { setConvertOption(null); onPlanCreated(plan); }}
        />
      )}
    </div>
  );
}

function PeopleGroup({ title, tone, people, empty }: { title: string; tone: 'amber' | 'slate'; people: string[]; empty: string }) {
  const chip = tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700';
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
        <Users size={11} />{title} {people.length > 0 && `(${people.length})`}
      </p>
      {people.length === 0
        ? <p className="text-xs text-slate-400 italic">{empty}</p>
        : (
          <div className="flex flex-wrap gap-1.5">
            {people.map((p, i) => <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${chip}`}>{p}</span>)}
          </div>
        )}
    </div>
  );
}

// Message du chat d'un sondage, modifiable / supprimable par son auteur pendant 15 minutes
function PollChatMessage({ message: m, isMe, onEdit, onDelete, onReport }: {
  message: CirclePollMessage; isMe: boolean; onEdit: (content: string) => void; onDelete: () => void; onReport: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const editable = useEditWindow(m.createdAt, m.deletedAt, isMe);
  const time = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(m.createdAt))
    + (m.editedAt && !m.deletedAt ? ' (modifié)' : '');
  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && <Avatar pseudo={m.author.pseudo} size="sm" />}
      <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          {!isMe && <span className="text-xs font-semibold text-slate-600">{m.author.pseudo}</span>}
          <span className="text-xs text-slate-400">{time}</span>
        </div>
        {m.deletedAt ? (
          <DeletedBubble isMe={isMe} />
        ) : editing ? (
          <MessageEditor initial={m.content} onCancel={() => setEditing(false)} onSave={text => { setEditing(false); onEdit(text); }} />
        ) : (
          <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
          }`}>
            {m.content}
          </div>
        )}
        {editable && !editing && <OwnMessageActions onEdit={() => setEditing(true)} onDelete={onDelete} />}
        {!isMe && !m.deletedAt && (
          <button onClick={onReport} title="Signaler ce message" className="flex items-center gap-1 text-xs text-slate-300 hover:text-red-500 transition-colors">
            <Flag size={11} /> Signaler
          </button>
        )}
      </div>
    </div>
  );
}
