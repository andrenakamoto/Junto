import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { saveFile } from '../../lib/saveFile';
import { Calendar, CalendarPlus, MapPin, LogOut, Users, CheckSquare, BarChart2, MessageSquare, UserPlus, Clock, Trash2, ChevronLeft, Pencil, History, Receipt, ImageDown, MoreVertical, Car, Gift, SlidersHorizontal } from 'lucide-react';
import { Plan, Message, User, CircleMember } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { ChatInput } from '../chat/ChatInput';
import { ChatMessage } from '../chat/ChatMessage';
import { ReportMessageModal } from '../chat/ReportMessageModal';
import { InfosTab } from './InfosTab';
import { MembresTab } from './MembresTab';
import { VotesTab } from './VotesTab';
import { DepensesTab } from './DepensesTab';
import { HistoriqueTab } from './HistoriqueTab';
import { InviteModal } from '../circles/InviteModal';
import { StoryModal } from './StoryModal';
import { CarpoolSection } from './CarpoolSection';
import { Modal } from '../ui/Modal';
import { DeletePlanModal } from './DeletePlanModal';
import { PlanSettingsModal } from './PlanSettingsModal';
import { isEnabled } from '../../lib/settings';
import { EditPlanModal } from './EditPlanModal';
import { getSocket } from '../../lib/socket';
import api from '../../services/api';

type Tab = 'chat' | 'infos' | 'trajets' | 'membres' | 'votes' | 'depenses';

const rsvpConfig = {
  in:    { label: 'Je suis in',  active: 'bg-emerald-500 text-white', inactive: 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700' },
  maybe: { label: 'Peut-être',   active: 'bg-amber-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700' },
  out:   { label: 'Absent(e)',    active: 'bg-slate-500 text-white',   inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
};

const tabs = [
  { key: 'chat' as Tab,       Icon: MessageSquare, label: 'Chat' },
  { key: 'infos' as Tab,      Icon: CheckSquare,   label: 'Infos' },
  { key: 'trajets' as Tab,    Icon: Car,           label: 'Trajets' },
  { key: 'membres' as Tab,    Icon: Users,         label: 'Membres' },
  { key: 'votes' as Tab,      Icon: BarChart2,     label: 'Votes' },
  { key: 'depenses' as Tab,   Icon: Receipt,          label: 'Dépenses' },
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
  /** Membres du Cercle (vide pour un invité externe) — pour gérer un Plan surprise */
  circleMembers?: CircleMember[];
}

export function PlanDetail({ plan, circleName, circleCode, onPlanUpdated, onPlanDeleted, onLogout, onBack, user, onlineUserIds, circleMembers = [] }: Props) {
  const { token, user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  const tabRef = useRef<Tab>('chat');
  tabRef.current = tab;
  // Message reçu en direct pendant qu'un autre onglet est affiché (le chat ne recharge pas le Plan)
  const [chatUnseen, setChatUnseen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [showDeletePlan, setShowDeletePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Signalement en cours, et messages des personnes masquées (lib/moderation.ts) cachés
  const [reporting, setReporting] = useState<Message | null>(null);
  const blocked = new Set(me?.blockedUserIds ?? []);
  const visibleMessages = messages.filter(m => !blocked.has(m.author.id));
  const openThreadIdRef = useRef<string | null>(null);
  useEffect(() => { openThreadIdRef.current = openThreadId; }, [openThreadId]);

  const myMember = plan.members.find(m => m.userId === user.id);
  const isMember = !!myMember;

  // Chat « collé en bas » : tant que la personne est au bas de la conversation, chaque
  // chargement, nouveau message ou redimensionnement (clavier, ouverture depuis une
  // notification, reconnexion) la garde sur le dernier message ; si elle remonte lire
  // l'historique, on ne bouge plus.
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const scrollToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!stickToBottomRef.current) return;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    else messagesEndRef.current?.scrollIntoView({ block: 'end' }); // écran peu haut : la colonne défile d'un bloc
  }, []);
  function onChatScroll() {
    const el = chatScrollRef.current;
    if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    if (!isMember || !token) return;
    setMessages([]);
    stickToBottomRef.current = true;
    api.get(`/plans/${plan.id}/messages`).then(res => setMessages(res.data));

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
      if (msg.author?.id === user.id) stickToBottomRef.current = true;
      setMessages(prev => [...prev, msg]);
      if (tabRef.current !== 'chat' && msg.author?.id !== user.id) setChatUnseen(true);
    }
    socket.on('message', onMessage);

    function onReactionsUpdated({ messageId, reactions }: { messageId: string; reactions: Message['reactions'] }) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      setThreadReplies(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    }
    socket.on('reactions-updated', onReactionsUpdated);

    // Message modifié ou supprimé par son auteur
    function onMessageUpdated(msg: Message) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
      setThreadReplies(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
    }
    socket.on('message-updated', onMessageUpdated);

    // Après une coupure (veille, réseau, redémarrage du serveur), le serveur a oublié la room
    // du Plan : on la rejoint à nouveau et on recharge les messages manqués.
    function onReconnect() {
      socket.emit('join-plan', plan.id);
      api.get(`/plans/${plan.id}/messages`).then(res => {
        // Messages arrivés pendant la coupure : on les montre
        setMessages(prev => {
          if (res.data.length > prev.length) stickToBottomRef.current = true;
          return res.data;
        });
      }).catch(() => {});
      const threadId = openThreadIdRef.current;
      if (threadId) {
        api.get(`/plans/messages/${threadId}/replies`)
          .then(res => { if (openThreadIdRef.current === threadId) setThreadReplies(res.data); })
          .catch(() => {});
      }
    }
    socket.on('connect', onReconnect);

    // App en arrière-plan (ou onglet masqué) : on quitte la room du Plan, sinon le serveur
    // croit qu'on lit le chat et n'envoie pas la notification (push sur téléphone). La
    // connexion d'une app en arrière-plan peut rester ouverte plusieurs minutes. Au retour,
    // on rejoint la room et on recharge les messages, comme après une coupure.
    function onVisibility() {
      if (document.hidden) socket.emit('leave-plan', plan.id);
      else onReconnect();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      socket.emit('leave-plan', plan.id);
      socket.off('message', onMessage);
      socket.off('reactions-updated', onReactionsUpdated);
      socket.off('message-updated', onMessageUpdated);
      socket.off('connect', onReconnect);
    };
  }, [plan.id, isMember, token, scrollToBottom]);

  // Onglets masqués par les paramètres avancés du Plan (Infos et Membres toujours présents)
  const visibleTabs = tabs.filter(t => t.key === 'infos' || t.key === 'membres' || isEnabled(plan, t.key));
  const defaultTab: Tab = isEnabled(plan, 'chat') ? 'chat' : 'infos';
  const disabledKey = (plan.disabledFeatures ?? []).join(',');

  // Reset tab to chat when plan changes
  useEffect(() => {
    setTab(defaultTab);
    setReplyTo(null);
    setOpenThreadId(null);
    setThreadReplies([]);
  }, [plan.id]);

  useLayoutEffect(() => {
    if (tab === 'chat') scrollToBottom();
  }, [messages, tab, scrollToBottom]);

  // Zone de chat redimensionnée (mise en place de l'écran, clavier) : on reste en bas.
  // Chat qui réapparaît (sur téléphone, le Plan reste chargé mais masqué quand on revient
  // aux Cercles ; on y revient par exemple en touchant une notification) : dernier message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastHeight = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (lastHeight === 0 && el.clientHeight > 0) stickToBottomRef.current = true;
      lastHeight = el.clientHeight;
      scrollToBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, isMember, scrollToBottom]);

  // Retour dans l'app (ou sur l'onglet du navigateur) après des messages reçus entre-temps :
  // on affiche le dernier message
  const unseenWhileHiddenRef = useRef(false);
  useEffect(() => {
    if (document.hidden) unseenWhileHiddenRef.current = true;
  }, [messages.length]);
  useEffect(() => {
    function onVisible() {
      if (document.hidden) { unseenWhileHiddenRef.current = false; return; }
      if (!unseenWhileHiddenRef.current) return;
      unseenWhileHiddenRef.current = false;
      stickToBottomRef.current = true;
      setTimeout(scrollToBottom, 50);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scrollToBottom]);

  // Clavier ouvert (ou fermé) : l'écran se redimensionne, on garde les derniers messages
  // visibles au-dessus du champ de saisie
  useEffect(() => {
    const vv = window.visualViewport;
    const onResize = () => { if (tabRef.current === 'chat') setTimeout(scrollToBottom, 60); };
    (vv ?? window).addEventListener('resize', onResize);
    return () => (vv ?? window).removeEventListener('resize', onResize);
  }, [scrollToBottom]);

  // Pastilles « nouveau » : l'onglet affiché est marqué comme vu (côté serveur, pour tous
  // les appareils) dès qu'il a du nouveau, y compris quand le Plan se recharge en direct
  const unseenKey = (plan.unseen ?? []).join(',');
  useEffect(() => {
    if (tab === 'chat') setChatUnseen(false);
    if (!isMember || !(plan.unseen ?? []).includes(tab)) return;
    api.post(`/plans/${plan.id}/seen`, { section: tab }).catch(() => {});
    onPlanUpdated({ ...plan, unseen: (plan.unseen ?? []).filter(s => s !== tab) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, tab, isMember, unseenKey]);

  // Si le créateur masque l'onglet affiché, revenir sur un onglet visible
  useEffect(() => {
    if (!visibleTabs.some(t => t.key === tab)) setTab(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabledKey]);

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

  function handleEditMessage(messageId: string, content: string) {
    if (token) getSocket(token).emit('edit-message', { messageId, content });
  }

  function handleDeleteMessage(messageId: string) {
    if (token) getSocket(token).emit('delete-message', { messageId });
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
    // Apps : menu de partage (Agenda…) ; site : téléchargement
    await saveFile(res.data, `${plan.title.replace(/[^a-z0-9]/gi, '_')}.ics`, plan.title);
  }

  const isCreator = plan.creatorId === user.id;
  // Paramètre avancé : suppression par le créateur seul → bouton réservé au créateur
  const creatorDeletes = plan.deletionMode === 'creator';
  const canDelete = !creatorDeletes || isCreator;
  const deleteLabel = creatorDeletes ? 'Supprimer ce Plan' : 'Voter pour supprimer ce Plan';
  // Paramètre avancé : les participants (hors invités externes) peuvent modifier dates et lieu
  const canEdit = isCreator || (plan.editMode === 'all' && isMember && !plan.viewerIsGuest);

  const eventDateFmt = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;

  const endDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.endDate));

  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  const outCount = plan.members.filter(m => m.rsvp === 'out').length;
  const isFull = plan.maxParticipants != null && plan.members.length >= plan.maxParticipants;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden short:overflow-y-auto">
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
                {canEdit && (
                  <button
                    onClick={() => setShowEditPlan(true)}
                    title="Modifier le plan"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Actions — icônes en ligne sur grand écran, menu compact sinon (colonne étroite) */}
          <div className="hidden xl:flex gap-1 flex-shrink-0">
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
                  onClick={() => setShowHistory(true)}
                  title="Historique des modifications"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  title="Paramètres du Plan"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <SlidersHorizontal size={16} />
                </button>
                {canDelete && <button
                  onClick={() => setShowDeletePlan(true)}
                  title={deleteLabel}
                  className={`p-2 rounded-lg transition-colors ${
                    (plan.deleteVotes ?? []).some(v => v.userId === user.id)
                      ? 'text-red-500 bg-red-50 hover:bg-red-100'
                      : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash2 size={16} />
                </button>}
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

          <div className="relative xl:hidden flex-shrink-0" ref={actionsMenuRef}>
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
                      onClick={() => { setShowActionsMenu(false); setShowHistory(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <History size={15} className="text-slate-400" />
                      Historique des modifications
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowSettings(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <SlidersHorizontal size={15} className="text-slate-400" />
                      Paramètres du Plan
                    </button>
                    {canDelete && <button
                      onClick={() => { setShowActionsMenu(false); setShowDeletePlan(true); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm ${
                        (plan.deleteVotes ?? []).some(v => v.userId === user.id) ? 'text-red-500' : 'text-slate-700'
                      }`}
                    >
                      <Trash2 size={15} className={(plan.deleteVotes ?? []).some(v => v.userId === user.id) ? 'text-red-500' : 'text-slate-400'} />
                      {deleteLabel}
                    </button>}
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

        {/* Infos du Plan : sous le titre, sur toute la largeur */}
        <div>
        {/* Membre : la description est dans l'onglet Infos. Sinon, elle reste ici pour décider de rejoindre. */}
        {!isMember && plan.description && (
          <p className="text-sm text-slate-500 mt-0.5 leading-relaxed whitespace-pre-line break-words">{plan.description}</p>
        )}

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

        {(plan.exclusions ?? []).length > 0 && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
            <Gift size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Plan surprise</strong> pour {(plan.exclusions ?? []).map(e => `@${e.user.pseudo}`).join(', ')} :
              {' '}{(plan.exclusions ?? []).length > 1 ? 'ils ne voient' : 'cette personne ne voit'} pas ce Plan. Chut, ne dis rien !
            </span>
          </div>
        )}

        {plan.viewerIsGuest && (
          <p className="mt-2 text-xs text-slate-500">
            Tu es <strong>invité(e)</strong> à ce Plan : tu y as accès, sans faire partie du Cercle.
          </p>
        )}
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
          <div className="flex border-b border-slate-200 flex-shrink-0 bg-white short:sticky short:top-0 short:z-10">
            {visibleTabs.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex flex-col xl:flex-row items-center justify-center gap-0.5 xl:gap-1.5 px-1 py-2 xl:px-4 xl:py-3 text-xs xl:text-sm font-medium border-b-2 transition-colors min-w-0 ${
                  tab === key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="relative">
                  <Icon size={14} />
                  {tab !== key && ((plan.unseen ?? []).includes(key) || (key === 'chat' && chatUnseen)) && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white" aria-label="Nouveau" />
                  )}
                </span>
                <span className="truncate leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {tab === 'chat' && isEnabled(plan, 'chat') && (
            <div className="flex-1 flex flex-col overflow-hidden short:flex-none short:overflow-visible">
              <div ref={chatScrollRef} onScroll={onChatScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50 short:flex-none short:overflow-visible">
                {visibleMessages.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm pt-12">
                    Aucun message encore. Lance la conversation !
                  </div>
                ) : (
                  visibleMessages.map(msg => (
                    <div key={msg.id}>
                      <ChatMessage
                        message={msg}
                        isMe={msg.author.id === user.id}
                        myUserId={user.id}
                        onReact={handleReact}
                        onReply={handleOpenThread}
                        replyCount={msg._count?.replies}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReport={setReporting}
                      />
                      {openThreadId === msg.id && (
                        <div className={`mt-2 ml-8 pl-3 border-l-2 border-indigo-100 space-y-2 ${msg.author.id === user.id ? 'mr-8 ml-0 pr-3 pl-0 border-l-0 border-r-2' : ''}`}>
                          {threadReplies.filter(r => !blocked.has(r.author.id)).map(reply => (
                            <ChatMessage
                              key={reply.id}
                              message={reply}
                              isMe={reply.author.id === user.id}
                              myUserId={user.id}
                              onReact={handleReact}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onReport={setReporting}
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
          {tab === 'trajets' && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
              <CarpoolSection planId={plan.id} userId={user.id} isAbsent={myMember?.rsvp === 'out'} />
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InviteModal
          circleName={circleName}
          circleCode={circleCode}
          circleId={plan.viewerIsGuest ? undefined : plan.circleId}
          planTitle={plan.title}
          planId={plan.id}
          allowGuest
          canInviteToCircle={!plan.viewerIsGuest}
          isPlanCreator={isCreator}
          onClose={() => setShowInvite(false)}
        />
      )}

      {reporting && (
        <ReportMessageModal kind="plan" messageId={reporting.id} author={reporting.author} onClose={() => setReporting(null)} />
      )}

      {showHistory && (
        <Modal title="Historique des modifications" onClose={() => setShowHistory(false)}>
          <div className="-mx-6 -mb-6 max-h-[60vh] flex flex-col overflow-hidden rounded-b-2xl">
            <HistoriqueTab changeLogs={plan.changeLogs ?? []} />
          </div>
        </Modal>
      )}

      {showSettings && (
        <PlanSettingsModal
          plan={plan}
          isCreator={isCreator}
          onClose={() => setShowSettings(false)}
          onEdit={() => { setShowSettings(false); setShowEditPlan(true); }}
        />
      )}

      {showStory && (
        <StoryModal plan={plan} onClose={() => setShowStory(false)} />
      )}

      {showEditPlan && (
        <EditPlanModal
          plan={plan}
          isCreator={isCreator}
          circleMembers={circleMembers}
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
