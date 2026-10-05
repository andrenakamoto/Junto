import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { MuteToggle } from './MuteToggle';
import { saveFile } from '../../lib/saveFile';
import { Calendar, CalendarPlus, MapPin, LogOut, Users, CheckSquare, BarChart2, MessageSquare, UserPlus, Trash2, ChevronLeft, Pencil, History, Receipt, ImageDown, MoreVertical, Car, Gift, SlidersHorizontal, Repeat, CalendarX, Repeat1, HandHeart, Images, FileDown } from 'lucide-react';
import { recurrenceLabel } from '../../lib/recurrence';
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
import { hasFeature, isEnabled } from '../../lib/settings';
import { VolunteersTab } from './VolunteersTab';
import { ExpiryChip } from './ExpiryChip';
import { downloadPlanPhotos, planImageCount } from '../../lib/planPhotos';
import { downloadPlanRecap } from '../../lib/planRecap';
import { EditPlanModal } from './EditPlanModal';
import { getSocket } from '../../lib/socket';
import api from '../../services/api';

// Écran de téléphone (< 768 px) : page principale du Plan avec des cartes au lieu des onglets
function useIsPhone() {
  const query = '(max-width: 767px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

type Tab = 'chat' | 'infos' | 'trajets' | 'membres' | 'votes' | 'depenses' | 'benevoles';

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
  { key: 'benevoles' as Tab,  Icon: HandHeart,        label: 'Bénévoles' },
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
  /** Onglet à afficher à l'ouverture (notification de la cloche) ; `n` change à chaque demande */
  openTab?: { tab: string; n: number } | null;
}

export function PlanDetail({ plan, circleName, circleCode, onPlanUpdated, onPlanDeleted, onLogout, onBack, user, onlineUserIds, circleMembers = [], openTab }: Props) {
  const { token, user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  // Téléphone : page principale du Plan (en-tête + une carte par rubrique), puis une rubrique
  // à la fois en plein écran. Grand écran : onglets.
  const isPhone = useIsPhone();
  const [hub, setHub] = useState(true);
  const tabRef = useRef<Tab | null>('chat');
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
  // Bénévoles : fonction à activer (absente par défaut)
  const visibleTabs = tabs.filter(t => t.key === 'infos' || t.key === 'membres' || (t.key === 'benevoles' ? hasFeature(plan, 'benevoles') : isEnabled(plan, t.key)));
  const defaultTab: Tab = isEnabled(plan, 'chat') ? 'chat' : 'infos';
  const showHub = isPhone && isMember && hub;
  const phoneSection = isPhone && isMember && !hub;
  // Rubrique réellement affichée (aucune sur la page principale)
  const activeTab: Tab | null = showHub ? null : tab;
  tabRef.current = activeTab;
  const disabledKey = [...(plan.disabledFeatures ?? []), '|', ...(plan.enabledFeatures ?? [])].join(',');

  // Onglet par défaut à l'ouverture d'un Plan, ou celui demandé par la cloche
  useEffect(() => {
    const wanted = openTab?.tab as Tab | undefined;
    const valid = !!wanted && visibleTabs.some(t => t.key === wanted);
    setTab(valid ? wanted! : defaultTab);
    setHub(!valid);
    setReplyTo(null);
    setOpenThreadId(null);
    setThreadReplies([]);
  }, [plan.id, openTab?.n]);

  useLayoutEffect(() => {
    if (activeTab === 'chat') scrollToBottom();
  }, [messages, activeTab, scrollToBottom]);

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
  }, [activeTab, isMember, scrollToBottom]);

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
    if (!activeTab) return; // page principale : rien n'est « vu »
    if (activeTab === 'chat') setChatUnseen(false);
    if (!isMember || !(plan.unseen ?? []).includes(activeTab)) return;
    api.post(`/plans/${plan.id}/seen`, { section: activeTab }).catch(() => {});
    onPlanUpdated({ ...plan, unseen: (plan.unseen ?? []).filter(s => s !== activeTab) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, activeTab, isMember, unseenKey]);

  // Retour à la page principale du Plan (flèche, bouton retour Android, glissement depuis le bord)
  function backToHub() {
    setHub(true);
    setReplyTo(null);
    setOpenThreadId(null);
    setThreadReplies([]);
  }
  const phoneSectionRef = useRef(phoneSection);
  phoneSectionRef.current = phoneSection;
  useEffect(() => {
    // Le tableau de bord (bouton retour Android) demande d'abord au Plan s'il a une rubrique à fermer
    function onBack(e: Event) {
      if (!phoneSectionRef.current) return;
      e.preventDefault();
      backToHub();
    }
    window.addEventListener('evly-back-plan', onBack);
    return () => window.removeEventListener('evly-back-plan', onBack);
  }, []);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      swipeRef.current = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = swipeRef.current;
      swipeRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (t.clientX - start.x > 70 && Math.abs(t.clientY - start.y) < 60) backToHub();
    },
  };
  const hasNews = (key: Tab) => (plan.unseen ?? []).includes(key) || (key === 'chat' && chatUnseen);

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

  // Photo envoyée dans le chat : ajoutée aux fichiers du Plan (visible dans Infos), puis
  // publiée comme message (légende = texte saisi)
  async function handleSendPhoto(file: File, caption: string) {
    if (!token) return;
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/attachments/plans/${plan.id}?via=chat`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    getSocket(token).emit('send-message', { planId: plan.id, content: caption, parentId: replyTo?.id, attachmentId: data.id });
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
  // Plan récurrent (lib/recurrence.ts) : étiquette « Chaque lundi » ; le créateur peut annuler
  // cette date-là (le suivant est créé tout de suite) ou arrêter la série
  const repeatLabel = recurrenceLabel(plan.recurrence, plan.eventDate);
  const canManageSeries = isCreator && !!plan.recurrence && !plan.nextOccurrenceId;

  async function skipThisTime() {
    if (!confirm('Annuler ce Plan cette fois-ci ? Il sera supprimé, et le suivant est créé tout de suite.')) return;
    try {
      await api.post(`/plans/${plan.id}/skip`);
      onPlanDeleted();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur, réessaie dans un instant');
    }
  }

  async function stopRepeating() {
    if (!confirm('Arrêter la répétition ? Ce Plan reste, mais aucun Plan suivant ne sera créé.')) return;
    try {
      await api.put(`/plans/${plan.id}/recurrence`, { recurrence: null });
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur, réessaie dans un instant');
    }
  }
  const deleteLabel = creatorDeletes ? 'Supprimer ce Plan' : 'Voter pour supprimer ce Plan';
  // Paramètre avancé : les participants (hors invités externes) peuvent modifier dates et lieu
  const canEdit = isCreator || (plan.editMode === 'all' && isMember && !plan.viewerIsGuest);

  const eventDateFmt = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;


  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  const outCount = plan.members.filter(m => m.rsvp === 'out').length;
  const isFull = plan.maxParticipants != null && plan.members.length >= plan.maxParticipants;

  // Téléphone, page principale : une carte par rubrique (le Chat en premier, sur toute la largeur)
  const hubCards = (
    <div className="grid grid-cols-2 gap-3 p-4">
      {visibleTabs.map(({ key, Icon, label }) => (
        <button
          key={key}
          onClick={() => { setTab(key); setHub(false); }}
          className={`relative flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left active:bg-slate-100 transition-colors ${key === 'chat' ? 'col-span-2 py-5' : ''}`}
        >
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Icon size={20} />
          </span>
          <span className="font-semibold text-slate-800 text-sm truncate">{label}</span>
          {hasNews(key) && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500" aria-label="Nouveau" />}
        </button>
      ))}
    </div>
  );
  // Téléphone, page principale : actions rapides dans une barre fixe en bas, bien séparée des
  // cartes (fond blanc, trait et ombre vers le haut, boutons corail)
  const photoCount = planImageCount(plan);
  const [zipping, setZipping] = useState(false);
  const [recapBusy, setRecapBusy] = useState(false);
  async function downloadRecap() {
    setRecapBusy(true);
    try { await downloadPlanRecap(plan); }
    catch { alert('Impossible de préparer le récapitulatif. Réessaie.'); }
    finally { setRecapBusy(false); }
  }
  async function downloadPhotos() {
    setZipping(true);
    try { await downloadPlanPhotos(plan); }
    catch { alert('Impossible de préparer le téléchargement. Réessaie.'); }
    finally { setZipping(false); }
  }
  const actions = [
    { key: 'invite', Icon: UserPlus, label: 'Inviter', onClick: () => setShowInvite(true) },
    ...(photoCount > 0 ? [{ key: 'photos', Icon: Images, label: zipping ? '…' : 'Photos', onClick: downloadPhotos }] : []),
    { key: 'ical', Icon: CalendarPlus, label: 'Agenda', onClick: handleExportIcal },
    { key: 'story', Icon: ImageDown, label: 'Story', onClick: () => setShowStory(true) },
    ...(plan.canRecap ? [{ key: 'recap', Icon: FileDown, label: recapBusy ? '…' : 'Récap', onClick: downloadRecap }] : []),
  ];
  const actionBar = (
    <div className="flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-6px_16px_-8px_rgba(15,23,42,0.18)] px-3 pt-2.5 pb-3 short:sticky short:bottom-0">
      <div className="flex gap-2">
        {actions.map(({ key, Icon, label, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            disabled={(key === 'photos' && zipping) || (key === 'recap' && recapBusy)}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-indigo-50 text-indigo-700 active:bg-indigo-100 transition-colors"
          >
            <Icon size={19} />
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
  const current = visibleTabs.find(t => t.key === tab);
  // Téléphone, une rubrique : seulement le titre du Plan et le nom de la rubrique
  const sectionHeader = (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 flex-shrink-0 bg-white short:sticky short:top-0 short:z-10">
      <button onClick={backToHub} aria-label="Retour au Plan" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex-shrink-0">
        <ChevronLeft size={20} />
      </button>
      <button onClick={backToHub} className="min-w-0 text-left">
        <span className="block text-xs text-slate-500 truncate">{plan.title}</span>
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          {current && <current.Icon size={15} className="text-indigo-600" />}{current?.label}
        </span>
      </button>
    </div>
  );

  // En-tête du Plan (titre, actions, dates, réponses, RSVP)
  const header = (
      <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex-shrink-0 bg-white">
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
                <h1 className="text-xl md:text-lg font-bold text-slate-900 leading-tight flex-1">{plan.title}</h1>
                {isMember && <span className="mt-0.5"><MuteToggle plan={plan} size={16} /></span>}
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
                {plan.canRecap && (
                  <button
                    onClick={downloadRecap}
                    disabled={recapBusy}
                    title="Télécharger le récapitulatif (PDF)"
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <FileDown size={16} />
                  </button>
                )}
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
                {canManageSeries && (
                  <>
                    <button
                      onClick={skipThisTime}
                      title="Annuler cette fois"
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <CalendarX size={16} />
                    </button>
                    <button
                      onClick={stopRepeating}
                      title="Arrêter la répétition"
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Repeat1 size={16} />
                    </button>
                  </>
                )}
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
                    {/* Téléphone : Inviter, Agenda et Story sont dans la barre d'actions en bas */}
                    {!isPhone && (
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
                      </>
                    )}
                    {!isPhone && plan.canRecap && (
                      <button
                        onClick={() => { setShowActionsMenu(false); downloadRecap(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                      >
                        <FileDown size={15} className="text-slate-400" />
                        Télécharger le récapitulatif
                      </button>
                    )}
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
                    {canManageSeries && (
                      <>
                        <button
                          onClick={() => { setShowActionsMenu(false); skipThisTime(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                        >
                          <CalendarX size={15} className="text-slate-400" />
                          Annuler cette fois
                        </button>
                        <button
                          onClick={() => { setShowActionsMenu(false); stopRepeating(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                        >
                          <Repeat1 size={15} className="text-slate-400" />
                          Arrêter la répétition
                        </button>
                      </>
                    )}
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

        {/* Date de l'événement, répétition et date de suppression du Plan */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {eventDateFmt && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg w-fit">
              <Calendar size={15} className="text-indigo-500 flex-shrink-0" />
              <span className="text-base md:text-sm font-medium text-indigo-700">{eventDateFmt}</span>
            </div>
          )}
          {repeatLabel && (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-sm md:text-xs font-medium text-slate-600">
              <Repeat size={13} /> {repeatLabel}
            </span>
          )}
        </div>
        {/* Date de suppression du Plan, sur sa propre ligne */}
        <div className="flex mt-2">
          <ExpiryChip endDate={plan.endDate} onRecap={isMember && plan.canRecap ? downloadRecap : undefined} />
        </div>

        {/* Infos membres */}
        {isMember && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {plan.location && (
              <span className="flex items-center gap-1.5 text-sm md:text-xs text-slate-500">
                <MapPin size={14} className="text-indigo-400" />{plan.location}
              </span>
            )}
            <span className="text-sm md:text-xs text-slate-400">
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

        {(plan.exclusions ?? []).length > 0 && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm md:text-xs text-indigo-800">
            <Gift size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Plan surprise</strong> pour {(plan.exclusions ?? []).map(e => `@${e.user.pseudo}`).join(', ')} :
              {' '}{(plan.exclusions ?? []).length > 1 ? 'ils ne voient' : 'cette personne ne voit'} pas ce Plan. Chut, ne dis rien !
            </span>
          </div>
        )}

        {plan.viewerIsGuest && (
          <p className="mt-2 text-sm md:text-xs text-slate-500">
            Tu es <strong>invité(e)</strong> à ce Plan : tu y as accès, sans faire partie du Cercle.
          </p>
        )}
        </div>

        {isMember ? (
          <div className="grid grid-cols-3 md:flex items-center gap-2 mt-3 md:flex-wrap">
            {/* Téléphone : les trois réponses sur toute la largeur, sans libellé */}
            <span className="hidden md:inline text-xs text-slate-400 font-medium">Mon RSVP :</span>
            {(['in', 'maybe', 'out'] as const).map(rsvp => (
              <button
                key={rsvp}
                onClick={() => handleRsvp(rsvp)}
                disabled={updatingRsvp}
                className={`px-3.5 py-2 md:px-3 md:py-1.5 rounded-lg text-sm md:text-xs font-semibold transition-colors ${
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
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden short:overflow-y-auto" {...(phoneSection ? swipeHandlers : {})}>
      {/* En-tête : page principale (téléphone) ou au-dessus des onglets (grand écran) */}
      {phoneSection ? sectionHeader : showHub ? (
        <>
          <div className="flex-1 overflow-y-auto bg-slate-50 short:flex-none short:overflow-visible">
            {header}
            {hubCards}
          </div>
          {actionBar}
        </>
      ) : header}

      {/* Tabs (only if member) */}
      {isMember && !showHub && (
        <>
          <div className="hidden md:flex border-b border-slate-200 flex-shrink-0 bg-white short:sticky short:top-0 short:z-10">
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

          {activeTab === 'chat' && isEnabled(plan, 'chat') && (
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
                        mediaToken={plan.mediaToken}
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
                              mediaToken={plan.mediaToken}
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
                onSendPhoto={isEnabled(plan, 'fichiers') ? handleSendPhoto : undefined}
                members={plan.members.map(m => ({ pseudo: m.user.pseudo }))}
                replyTo={replyTo ? { id: replyTo.id, authorPseudo: replyTo.author.pseudo, preview: (replyTo.content || (replyTo.attachment ? '📷 Photo' : '')).slice(0, 40) } : null}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          )}

          {activeTab === 'infos' && (
            <InfosTab plan={plan} onPlanUpdated={onPlanUpdated} pseudo={user.pseudo} userId={user.id} />
          )}
          {activeTab === 'membres' && <MembresTab members={plan.members} onlineUserIds={onlineUserIds} />}
          {activeTab === 'votes' && <VotesTab plan={plan} onPlanUpdated={onPlanUpdated} userId={user.id} />}
          {activeTab === 'benevoles' && <VolunteersTab plan={plan} userId={user.id} onPlanUpdated={onPlanUpdated} />}
          {activeTab === 'depenses' && <DepensesTab planId={plan.id} members={plan.members} userId={user.id} plan={plan} pseudo={user.pseudo} onPlanUpdated={onPlanUpdated} />}
          {activeTab === 'trajets' && (
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
