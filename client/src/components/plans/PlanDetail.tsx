import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { isPlanEnded, planDeletionAt } from '../../lib/planEnd';
import { MuteToggle } from './MuteToggle';
import { addPlanToCalendar } from '../../lib/calendar';
import { PublishDiscoverModal } from './PublishDiscoverModal';
import { Calendar, CalendarPlus, MapPin, LogOut, Users, CheckSquare, BarChart2, MessageSquare, UserPlus, Trash2, ChevronLeft, Pencil, History, Receipt, ImageDown, MoreVertical, Car, Gift, Lock, SlidersHorizontal, Repeat, CalendarX, Repeat1, HandHeart, Images, FileDown, Crosshair, Trophy, PiggyBank, Speech, Landmark, Brain, Layers, Maximize2, Minimize2, Hourglass, Compass, ListChecks, ListOrdered, Lightbulb, HelpCircle, Loader2, Plus, Store } from 'lucide-react';
import { recurrenceLabel } from '../../lib/recurrence';
import { Plan, Message, User, CircleMember, OptionalFeature, PlanFeature } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { ChatInput } from '../chat/ChatInput';
import { ChatMessage } from '../chat/ChatMessage';
import { PhotoViewer, type ViewerPhoto } from '../chat/PhotoViewer';
import { mediaUrl as chatPhotoUrl } from '../../lib/media';
import { ReportMessageModal } from '../chat/ReportMessageModal';
import { InfosTab } from './InfosTab';
import { MembresTab } from './MembresTab';
import { VotesTab } from './VotesTab';
import { DepensesTab } from './DepensesTab';
import { HistoriqueTab } from './HistoriqueTab';
import { InviteModal } from '../circles/InviteModal';
import { StoryModal } from './StoryModal';
import { TransitSection } from './TransitSection';
import { CarpoolSection } from './CarpoolSection';
import { Modal } from '../ui/Modal';
import { DeletePlanModal } from './DeletePlanModal';
import { PlanSettingsModal } from './PlanSettingsModal';
import { hasFeature, isEnabled } from '../../lib/settings';
import { VolunteersTab } from './VolunteersTab';
import { TasksTab } from './TasksTab';
import { SuppliersTab } from './SuppliersTab';
import { ProgramTab } from './ProgramTab';
import { IdeasTab } from './IdeasTab';
import { CapsuleTab } from './CapsuleTab';
import { MysteryTab } from './MysteryTab';
import { DayPlanTab } from './DayPlanTab';
import { PlanTabBar } from './PlanTabBar';
import { SecretSantaTab } from './SecretSantaTab';
import { KillerTab } from './KillerTab';
import { WordTrapTab } from './WordTrapTab';
import { TeamsTab } from './TeamsTab';
import { GiftPotTab } from './GiftPotTab';
import { AssemblyTab } from './AssemblyTab';
import { ExpiryChip } from './ExpiryChip';
import { GoWithCircleModal } from './GoWithCircleModal';
import { SourceEventCard } from './SourceEventCard';
import { downloadPlanPhotos, planImageCount } from '../../lib/planPhotos';
import { downloadPlanRecap } from '../../lib/planRecap';
import { EditPlanModal } from './EditPlanModal';
import { getSocket } from '../../lib/socket';
import { WheelSpinHost, openWheelSpin } from './WheelSection';
import { QuizLiveHost, QuizTab } from './QuizTab';
import api from '../../services/api';
import { isPlanFull, occupiedPlaces, waitlistPosition } from '../../lib/places';
import { Trans } from 'react-i18next';
import { intlLocale, t } from '../../i18n';
import { RichText } from '../../lib/richText';
import { useBackClose } from '../../lib/backClose';

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

type Tab = 'chat' | 'infos' | 'trajets' | 'membres' | 'votes' | 'depenses' | 'taches' | 'fournisseurs' | 'deroule' | 'idees' | 'benevoles' | 'pere_noel' | 'killer' | 'quiz' | 'mot_piege' | 'equipes' | 'cagnotte' | 'assemblee' | 'capsule' | 'mystere';

const rsvpConfig = {
  // Réponses non choisies : blanches, bordées de la couleur de la réponse (elles avaient l'air désactivées en gris)
  in:    { label: t('common.rsvp.in'),    active: 'bg-emerald-500 border-emerald-500 text-white', inactive: 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
  maybe: { label: t('common.rsvp.maybe'), active: 'bg-amber-500 border-amber-500 text-white',     inactive: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' },
  out:   { label: t('common.rsvp.out'),   active: 'bg-slate-500 border-slate-500 text-white',     inactive: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' },
};

const tabs = [
  { key: 'chat' as Tab,       Icon: MessageSquare, label: t('plan.detail.tabs.chat') },
  { key: 'infos' as Tab,      Icon: CheckSquare,   label: t('plan.detail.tabs.infos') },
  { key: 'trajets' as Tab,    Icon: Car,           label: t('plan.detail.tabs.trajets') },
  { key: 'membres' as Tab,    Icon: Users,         label: t('plan.detail.tabs.membres') },
  { key: 'votes' as Tab,      Icon: BarChart2,     label: t('plan.detail.tabs.votes') },
  { key: 'depenses' as Tab,   Icon: Receipt,          label: t('plan.detail.tabs.depenses') },
  // Organisation, dans l'ordre du travail : les idées, puis les tâches, puis le jour J (Déroulé et Planning)
  { key: 'idees' as Tab,      Icon: Lightbulb,        label: t('plan.detail.tabs.idees') },
  { key: 'taches' as Tab,     Icon: ListChecks,       label: t('plan.detail.tabs.taches') },
  { key: 'deroule' as Tab,    Icon: ListOrdered,      label: t('plan.detail.tabs.deroule') },
  { key: 'benevoles' as Tab,  Icon: HandHeart,        label: t('plan.detail.tabs.benevoles') },
  { key: 'fournisseurs' as Tab, Icon: Store,          label: t('plan.detail.tabs.fournisseurs') },
  { key: 'assemblee' as Tab,  Icon: Landmark,         label: t('plan.detail.tabs.assemblee') },
  { key: 'pere_noel' as Tab,  Icon: Gift,             label: t('plan.detail.tabs.pere_noel') },
  { key: 'quiz' as Tab,       Icon: Brain,            label: t('plan.detail.tabs.quiz') },
  { key: 'killer' as Tab,     Icon: Crosshair,        label: t('plan.detail.tabs.killer') },
  { key: 'mot_piege' as Tab,  Icon: Speech,           label: t('plan.detail.tabs.mot_piege') },
  { key: 'equipes' as Tab,    Icon: Trophy,           label: t('plan.detail.tabs.equipes') },
  { key: 'cagnotte' as Tab,   Icon: PiggyBank,        label: t('plan.detail.tabs.cagnotte') },
  { key: 'capsule' as Tab,    Icon: Hourglass,        label: t('plan.detail.tabs.capsule') },
  { key: 'mystere' as Tab,    Icon: HelpCircle,       label: t('plan.detail.tabs.mystere') },
];
// Rubriques rangées sous « + Ajouter » tant qu'elles sont vides
const EMPTYABLE: string[] = ['trajets', 'votes', 'depenses'];
const OPTIONAL_TABS: Tab[] = ['taches', 'fournisseurs', 'deroule', 'idees', 'benevoles', 'pere_noel', 'quiz', 'killer', 'mot_piege', 'equipes', 'cagnotte', 'assemblee', 'capsule', 'mystere'];

interface Props {
  plan: Plan;
  circleName: string;
  circleCode: string;
  /** Cercle personnel « Mes Plans » : on n'invite qu'au Plan, jamais dans ce Cercle */
  circlePersonal?: boolean;
  // Cercle depuis lequel le Plan est ouvert (un Plan peut appartenir à plusieurs Cercles)
  circleId?: string;
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
  /** Grand écran : le Plan occupe toute la page (listes des Cercles et des Plans masquées, pour une projection) */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function PlanDetail({ plan, circleName, circleCode, circlePersonal = false, circleId, onPlanUpdated, onPlanDeleted, onLogout, onBack, user, onlineUserIds, circleMembers = [], openTab, expanded = false, onToggleExpand }: Props) {
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
  // Message lié aux places (Plan complet, liste d'attente)
  const [placesError, setPlacesError] = useState('');
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  // Réponse touchée, colorée tout de suite pendant l'aller-retour avec le serveur
  const [pendingRsvp, setPendingRsvp] = useState<'in' | 'maybe' | 'out' | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showGoWith, setShowGoWith] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  useBackClose(() => setShowActionsMenu(false), showActionsMenu);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [showDeletePlan, setShowDeletePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  // Réponse en cours de saisie (2026-11-13) : les réponses restent dans le fil du chat, avec une citation du message
  // d'origine, et on peut répondre à une réponse (avant : fil caché sous « N réponses »)
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Signalement en cours, et messages des personnes masquées (lib/moderation.ts) cachés
  const [reporting, setReporting] = useState<Message | null>(null);
  const blocked = new Set(me?.blockedUserIds ?? []);
  const visibleMessages = messages.filter(m => !blocked.has(m.author.id));
  // Visionneuse : toutes les photos du chat dans l'ordre des messages (et celles du fil ouvert, après leur message)
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const chatPhotos: ViewerPhoto[] = visibleMessages
    .filter(m => !m.deletedAt && m.attachment?.mimeType.startsWith('image/'))
    .map(m => ({
      id: m.attachment!.id, src: chatPhotoUrl(m.attachment!.id, plan.mediaToken, 1600), download: chatPhotoUrl(m.attachment!.id, plan.mediaToken),
      filename: m.attachment!.name || 'photo-evly.jpg', canDelete: m.author.id === user.id,
    }));
  // Toucher une citation : le message d'origine défile à l'écran et s'entoure un instant
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  function jumpToMessage(id: string) {
    const el = chatScrollRef.current?.querySelector(`[data-msg="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashMsg(id);
    window.setTimeout(() => setFlashMsg(f => (f === id ? null : f)), 1600);
  }

  const myMember = plan.members.find(m => m.userId === user.id);
  const isMember = !!myMember;
  // « En bref » : participants « Je suis in » et « Peut-être »

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
    api.get(`/plans/${plan.id}/messages`, { params: { all: 1 } }).then(res => setMessages(res.data));

    const socket = getSocket(token);
    socket.emit('join-plan', plan.id);

    function onMessage(msg: Message) {
      if (msg.planId && msg.planId !== plan.id) return;
      if (msg.author?.id === user.id) stickToBottomRef.current = true;
      setMessages(prev => [...prev, msg]);
      if (tabRef.current !== 'chat' && msg.author?.id !== user.id) setChatUnseen(true);
    }
    socket.on('message', onMessage);

    function onReactionsUpdated({ messageId, reactions }: { messageId: string; reactions: Message['reactions'] }) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    }
    socket.on('reactions-updated', onReactionsUpdated);

    // Message modifié ou supprimé par son auteur
    function onMessageUpdated(msg: Message) {
      // Le message lui-même, et sa citation dans les réponses (modifié ou supprimé)
      setMessages(prev => prev.map(m => {
        if (m.id === msg.id) return { ...m, ...msg };
        const patch = (q?: Message['quote']) => q && q.id === msg.id ? { ...q, content: msg.deletedAt ? '' : (msg.content ?? '').slice(0, 160), deletedAt: msg.deletedAt, attachment: msg.attachment } : q;
        return m.quote?.id === msg.id || m.parent?.id === msg.id ? { ...m, quote: patch(m.quote), parent: patch(m.parent) } : m;
      }));
    }
    socket.on('message-updated', onMessageUpdated);

    // « Qui s'y colle ? » lancée par quelqu'un : la roue s'ouvre ici aussi, quel que soit l'onglet
    function onWheelSpin(d: { planId: string; spinId: string }) { if (d.planId === plan.id) openWheelSpin(d.planId, d.spinId, false, true); }
    socket.on('wheel-spin', onWheelSpin);

    // Après une coupure (veille, réseau, redémarrage du serveur), le serveur a oublié la room
    // du Plan : on la rejoint à nouveau et on recharge les messages manqués.
    function onReconnect() {
      socket.emit('join-plan', plan.id);
      api.get(`/plans/${plan.id}/messages`, { params: { all: 1 } }).then(res => {
        // Messages arrivés pendant la coupure : on les montre
        setMessages(prev => {
          if (res.data.length > prev.length) stickToBottomRef.current = true;
          return res.data;
        });
      }).catch(() => {});
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
      socket.off('wheel-spin', onWheelSpin);
      socket.off('connect', onReconnect);
    };
  }, [plan.id, isMember, token, scrollToBottom]);

  // Onglets masqués par les paramètres avancés du Plan (Infos et Membres toujours présents)
  // Bénévoles : fonction à activer (absente par défaut)
  // Liste des participants réservée (Mode annonce) : pas de rubrique Membres pour les participants
  // Déroulé et Planning ensemble : un seul onglet « Jour J » (DayPlanTab), sous la clé 'deroule'
  const dayMerged = hasFeature(plan, 'deroule') && hasFeature(plan, 'benevoles');
  const visibleTabs = tabs
    .filter(t => t.key === 'infos' || (t.key === 'membres' ? !plan.membersHidden : OPTIONAL_TABS.includes(t.key) ? hasFeature(plan, t.key as OptionalFeature) : isEnabled(plan, t.key as PlanFeature)))
    .filter(x => !(dayMerged && x.key === 'benevoles'))
    .map(x => dayMerged && x.key === 'deroule' ? { ...x, label: t('plan.detail.tabs.dayPlan') } : x);
  // Rubriques vides rangées sous « + Ajouter » (2026-11-03) : Trajets, Votes et Dépenses n'apparaissent que si elles ont du
  // contenu (`plan.content`, GET /plans/:id) ou si on vient de les ouvrir. Les réponses sans `content` (PUT…) gardent le dernier connu.
  const contentRef = useRef<{ id: string; content?: Plan['content'] }>({ id: plan.id });
  if (plan.content || contentRef.current.id !== plan.id) contentRef.current = { id: plan.id, content: plan.content };
  const content = contentRef.current.content;
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  useEffect(() => { setRevealed(new Set()); }, [plan.id]);
  const isEmptySection = (key: string) => EMPTYABLE.includes(key) && content?.[key as keyof NonNullable<Plan['content']>] === false && !revealed.has(key);
  const shownTabs = visibleTabs.filter(x => !isEmptySection(x.key));
  const addableTabs = visibleTabs.filter(x => isEmptySection(x.key));
  const [showAddSection, setShowAddSection] = useState(false);
  const reveal = (key: string) => { if (EMPTYABLE.includes(key)) setRevealed(r => new Set(r).add(key)); };
  // Onglet à ouvrir : avec l'onglet combiné, le Planning s'ouvre dans « Jour J »
  const [dayFocus, setDayFocus] = useState<{ section: 'deroule' | 'benevoles'; n: number } | null>(null);
  const resolveTab = (key: string): Tab => {
    if (dayMerged && (key === 'benevoles' || key === 'deroule')) { setDayFocus({ section: key, n: Date.now() }); return 'deroule'; }
    return key as Tab;
  };
  const defaultTab: Tab = isEnabled(plan, 'chat') ? 'chat' : 'infos';
  const showHub = isPhone && isMember && hub;
  const phoneSection = isPhone && isMember && !hub;
  // Rubrique réellement affichée (aucune sur la page principale)
  const activeTab: Tab | null = showHub ? null : tab;
  tabRef.current = activeTab;
  const disabledKey = [...(plan.disabledFeatures ?? []), '|', ...(plan.enabledFeatures ?? [])].join(',');

  // Onglet par défaut à l'ouverture d'un Plan, ou celui demandé par la cloche
  useEffect(() => {
    // Plan qu'on vient de créer : la fenêtre « Inviter » s'ouvre d'elle-même, sur la page principale du Plan
    if (openTab?.tab === 'invite') { setShowInvite(true); setTab(defaultTab); setHub(true); return; }
    const wanted = openTab?.tab ? resolveTab(openTab.tab) : undefined;
    const valid = !!wanted && visibleTabs.some(t => t.key === wanted);
    if (valid) reveal(wanted!); // une notification vers une rubrique encore vide l'affiche
    setTab(valid ? wanted! : defaultTab);
    setHub(!valid);
    setReplyTo(null);
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
    if (dayMerged && activeTab === 'deroule') return; // chaque rubrique est marquée vue à son ouverture (DayPlanTab)
    if (!isMember || !(plan.unseen ?? []).includes(activeTab)) return;
    api.post(`/plans/${plan.id}/seen`, { section: activeTab }).catch(() => {});
    onPlanUpdated({ ...plan, unseen: (plan.unseen ?? []).filter(s => s !== activeTab) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, activeTab, isMember, unseenKey]);

  // Retour à la page principale du Plan (flèche, bouton retour Android, glissement depuis le bord)
  function backToHub() {
    setHub(true);
    setReplyTo(null);
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
  const hasNews = (key: Tab) => (plan.unseen ?? []).includes(key) || (key === 'chat' && chatUnseen) || (dayMerged && key === 'deroule' && (plan.unseen ?? []).includes('benevoles'));
  // Rubrique de l'onglet combiné ouverte : marquée vue
  const markSectionSeen = (section: string) => {
    if (!isMember) return;
    api.post(`/plans/${plan.id}/seen`, { section }).catch(() => {});
    onPlanUpdated({ ...plan, unseen: (plan.unseen ?? []).filter(s => s !== section) });
  };

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

  // Plan pour plusieurs Cercles : avertissement avant la première réponse (rejoindre, liste d'attente)
  const [multiWarning, setMultiWarning] = useState<null | (() => void)>(null);
  const isMulti = !!plan.circles && plan.circles.length > 1;
  function withMultiWarning(action: () => void) {
    if (isMulti && !myMember) setMultiWarning(() => action);
    else action();
  }

  // Rejoindre en donnant sa réponse (« Je passe » n'occupe pas de place et ne prévient personne)
  async function handleJoin(rsvp: 'in' | 'maybe' | 'out' = 'in') {
    setJoining(true);
    setPendingRsvp(rsvp);
    setPlacesError('');
    try {
      await api.post(`/plans/${plan.id}/join`, { rsvp });
      onPlanUpdated((await api.get(`/plans/${plan.id}`)).data);
    } catch (err: any) {
      // Complet entre-temps : la fiche rechargée propose la liste d'attente
      setPlacesError(err?.response?.data?.error || t('common.retryError'));
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
    } finally {
      setJoining(false);
      setPendingRsvp(null);
    }
  }

  async function handleRsvp(rsvp: 'in' | 'maybe' | 'out') {
    if (updatingRsvp || myMember?.rsvp === rsvp) return;
    setUpdatingRsvp(true);
    setPendingRsvp(rsvp);
    setPlacesError('');
    try {
      await api.put(`/plans/${plan.id}/rsvp`, { rsvp });
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
    } catch (err: any) {
      // Revenir sur un Plan complet : la liste d'attente est proposée juste en dessous
      setPlacesError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      setUpdatingRsvp(false);
      setPendingRsvp(null);
    }
  }

  // Liste d'attente d'un Plan complet
  async function handleWaitlist(join: boolean) {
    setJoining(true);
    setPlacesError('');
    try {
      if (join) await api.post(`/plans/${plan.id}/waitlist`);
      else await api.delete(`/plans/${plan.id}/waitlist`);
    } catch (err: any) {
      setPlacesError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
      setJoining(false);
    }
  }

  function handleSend(content: string) {
    if (!token) return;
    getSocket(token).emit('send-message', { planId: plan.id, content, replyToId: replyTo?.id });
    setReplyTo(null);
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
    getSocket(token).emit('send-message', { planId: plan.id, content: caption, replyToId: replyTo?.id, attachmentId: data.id });
    setReplyTo(null);
  }

  // Message vocal : même chemin qu'une photo (fichier du Plan rattaché au message), durée dans le nom
  async function handleSendVoice(blob: Blob, seconds: number) {
    if (!token) return;
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('file', new File([blob], `vocal-${Math.max(1, Math.round(seconds))}s.${ext}`, { type: blob.type || 'audio/webm' }));
    const { data } = await api.post(`/attachments/plans/${plan.id}?via=chat`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    getSocket(token).emit('send-message', { planId: plan.id, content: '', replyToId: replyTo?.id, attachmentId: data.id });
    setReplyTo(null);
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


  async function handleExportIcal() {
    // Apps : écran « Nouvel événement » de l'agenda du téléphone ; site : fichier .ics
    await addPlanToCalendar(plan);
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
    if (!confirm(t('plan.detail.skipConfirm'))) return;
    try {
      await api.post(`/plans/${plan.id}/skip`);
      onPlanDeleted();
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.retryError'));
    }
  }

  async function stopRepeating() {
    if (!confirm(t('plan.detail.stopConfirm'))) return;
    try {
      await api.put(`/plans/${plan.id}/recurrence`, { recurrence: null });
      const { data } = await api.get(`/plans/${plan.id}`);
      onPlanUpdated(data);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.retryError'));
    }
  }
  const deleteLabel = creatorDeletes ? t('plan.detail.deleteOwn') : t('plan.detail.voteDelete');
  // Paramètre avancé : les participants (hors invités externes) peuvent modifier dates et lieu
  const canEdit = isCreator || (plan.editMode === 'all' && isMember && !plan.viewerIsGuest);
  // Plan terminé : lecture seule pendant les 24 h avant sa suppression (lib/planEnd.ts) ; seule la date de fin se repousse
  const ended = isPlanEnded(plan);

  const eventDateFmt = plan.eventDate
    ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.eventDate))
    : null;


  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  const outCount = plan.members.filter(m => m.rsvp === 'out').length;
  const isFull = isPlanFull(plan);
  const occupied = occupiedPlaces(plan);
  const myWaitPos = waitlistPosition(plan, user?.id);
  const waitingCount = plan.waitlist?.length ?? 0;

  // Liste d'attente : Plan complet (ou déjà en attente) pour quelqu'un qui n'occupe pas de place
  const waitlistCard = (
    <div className="mt-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
      {myWaitPos ? (
        <>
          <p className="text-sm text-amber-900 font-medium">{t('plan.detail.waitPos', { pos: myWaitPos })}</p>
          <p className="text-xs text-amber-800 mt-1">{t('plan.detail.waitHint')}</p>
          <button onClick={() => handleWaitlist(false)} disabled={joining} className="mt-2 text-xs text-amber-900 underline">{t('plan.detail.waitLeave')}</button>
        </>
      ) : (
        <>
          <p className="text-sm text-amber-900 font-medium">{t('plan.detail.full', { occupied, max: plan.maxParticipants })}</p>
          <p className="text-xs text-amber-800 mt-1">
            {t('plan.detail.waitJoinHint')}
            {waitingCount > 0 && t('plan.detail.waiting', { count: waitingCount })}
          </p>
          {plan.viewerIsGuest ? null : (
            <Button onClick={() => withMultiWarning(() => handleWaitlist(true))} disabled={joining} size="sm" className="mt-3">
              {joining ? '…' : t('plan.detail.waitJoin')}
            </Button>
          )}
        </>
      )}
      {placesError && <p className="text-xs text-red-600 mt-2">{placesError}</p>}
    </div>
  );

  // Téléphone, page principale : une carte par rubrique (le Chat en premier, sur toute la largeur)
  const hubCards = (
    <div className="grid grid-cols-2 gap-3 p-4">
      {shownTabs.map(({ key, Icon, label }) => (
        <button
          key={key}
          onClick={() => { setTab(key); setHub(false); }}
          className={`relative flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-300 shadow-md text-left active:bg-slate-100 transition-colors ${key === 'chat' ? 'col-span-2 py-5' : ''}`}
        >
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Icon size={20} />
          </span>
          <span className="font-semibold text-slate-800 text-sm truncate">{label}</span>
          {hasNews(key) && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500" aria-label={t('plan.detail.new')} />}
        </button>
      ))}
      {addableTabs.length > 0 && (
        <button onClick={() => setShowAddSection(true)}
          className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-white/60 text-left text-indigo-700">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0"><Plus size={20} /></span>
          <span className="font-semibold text-sm">{t('plan.detail.add.button')}</span>
        </button>
      )}
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
    catch { alert(t('plan.detail.recapError')); }
    finally { setRecapBusy(false); }
  }
  async function downloadPhotos() {
    setZipping(true);
    try { await downloadPlanPhotos(plan); }
    catch { alert(t('plan.detail.zipError')); }
    finally { setZipping(false); }
  }
  const actions = [
    ...(!ended ? [{ key: 'invite', Icon: UserPlus, label: t('plan.detail.invite'), onClick: () => setShowInvite(true) }] : []),
    ...(photoCount > 0 ? [{ key: 'photos', Icon: Images, label: zipping ? '…' : t('plan.detail.photos'), onClick: downloadPhotos }] : []),
    { key: 'ical', Icon: CalendarPlus, label: t('plan.detail.agenda'), onClick: handleExportIcal },
    { key: 'story', Icon: ImageDown, label: t('plan.detail.story'), onClick: () => setShowStory(true) },
    ...(plan.canRecap ? [{ key: 'recap', Icon: FileDown, label: recapBusy ? '…' : t('plan.detail.recap'), onClick: downloadRecap }] : []),
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
      <button onClick={backToHub} aria-label={t('plan.detail.backToPlan')} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex-shrink-0">
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
      <div className={`px-4 md:px-6 py-4 flex-shrink-0 bg-white ${showHub ? 'relative rounded-b-3xl shadow-md' : 'border-b border-slate-200'}`}>
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
                {isMember && <span className="flex mt-0.5"><MuteToggle plan={plan} size={16} /></span>}
                {canEdit && (
                  <button
                    onClick={() => setShowEditPlan(true)}
                    title={t('plan.detail.editPlan')}
                    className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Actions (2026-11-03) : « Inviter » et « Modifier » écrits, tout le reste dans le menu ⋯ (téléphone : barre en bas) */}
          {!isPhone && isMember && !ended && (
            <button onClick={() => setShowInvite(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex-shrink-0">
              <UserPlus size={15} />{t('plan.detail.invite')}
            </button>
          )}
          {!isPhone && canEdit && (
            <button onClick={() => setShowEditPlan(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex-shrink-0">
              <Pencil size={14} />{t('plan.detail.editShort')}
            </button>
          )}
          <div className="relative flex-shrink-0" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(v => !v)}
              title={t('plan.detail.menu')}
              className={`p-2 rounded-lg transition-colors ${showActionsMenu ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            >
              <MoreVertical size={18} />
            </button>
            {showActionsMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 space-y-0.5 z-20">
                {/* Plein écran (ordinateur, tablette) : masque les listes des Cercles et des Plans, pour projeter le Plan */}
                {onToggleExpand && !isPhone && (
                  <button
                    onClick={() => { setShowActionsMenu(false); onToggleExpand(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                  >
                    {expanded ? <Minimize2 size={15} className="text-slate-400" /> : <Maximize2 size={15} className="text-slate-400" />}
                    {expanded ? t('plan.detail.exitFullscreen') : t('plan.detail.fullscreen')}
                  </button>
                )}
                {plan.canPublishDiscover && (
                  <button
                    onClick={() => { setShowActionsMenu(false); setShowPublish(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                  >
                    <Compass size={15} className={plan.discover ? 'text-emerald-600' : 'text-slate-400'} />
                    {plan.discover ? t('discover.publish.menuOn') : t('discover.publish.menu')}
                  </button>
                )}
                {isMember && (
                  <>
                    {/* Téléphone : Inviter, Agenda et Story sont dans la barre d'actions en bas */}
                    {!isPhone && (
                      <>
                      {photoCount > 0 && (
                        <button
                          onClick={() => { setShowActionsMenu(false); downloadPhotos(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                        >
                          <Images size={15} className="text-slate-400" />
                          {t('plan.detail.photos')}
                        </button>
                      )}
                      <button
                        onClick={() => { setShowActionsMenu(false); handleExportIcal(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                      >
                        <CalendarPlus size={15} className="text-slate-400" />
                        {t('plan.detail.exportCalendar')}
                      </button>
                      <button
                        onClick={() => { setShowActionsMenu(false); setShowStory(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                      >
                        <ImageDown size={15} className="text-slate-400" />
                        {t('plan.detail.downloadStory')}
                      </button>
                      </>
                    )}
                    {!isPhone && plan.canRecap && (
                      <button
                        onClick={() => { setShowActionsMenu(false); downloadRecap(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                      >
                        <FileDown size={15} className="text-slate-400" />
                        {t('plan.detail.recapShort')}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowHistory(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <History size={15} className="text-slate-400" />
                      {t('plan.detail.history')}
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowSettings(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    >
                      <SlidersHorizontal size={15} className="text-slate-400" />
                      {t('plan.detail.settings')}
                    </button>
                    {canManageSeries && (
                      <>
                        <button
                          onClick={() => { setShowActionsMenu(false); skipThisTime(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                        >
                          <CalendarX size={15} className="text-slate-400" />
                          {t('plan.detail.skip')}
                        </button>
                        <button
                          onClick={() => { setShowActionsMenu(false); stopRepeating(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                        >
                          <Repeat1 size={15} className="text-slate-400" />
                          {t('plan.detail.stop')}
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
                  {t('plan.detail.logout')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Infos du Plan : sous le titre, sur toute la largeur */}
        <div>
        {/* Membre : la description est dans l'onglet Infos. Sinon, elle reste ici pour décider de rejoindre. */}
        {!isMember && plan.description && (
          <RichText text={plan.description} className="text-sm text-slate-500 mt-0.5 leading-relaxed" />
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
          {plan.circles && plan.circles.length > 1 && (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-sm md:text-xs font-medium text-indigo-700">
              <Layers size={13} /> {t('plan.multi.detail', { names: plan.circles.map(c => c.name).join(', ') })}
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
            {plan.location ? (
              <span className="flex items-center gap-1.5 text-sm md:text-xs text-slate-500">
                <MapPin size={14} className="text-indigo-400" />{plan.location}
              </span>
            ) : canEdit && !ended ? (
              // Lieu « À définir » : la personne qui peut modifier le Plan le complète d'un toucher
              <button onClick={() => setShowEditPlan(true)} className="flex items-center gap-1.5 text-sm md:text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                <MapPin size={14} />{t('plan.form.addPlace')}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm md:text-xs text-slate-400 italic">
                <MapPin size={14} className="text-slate-300" />{t('plan.form.placeTbdShown')}
              </span>
            )}
            <span className="text-sm md:text-xs text-slate-400">
              {plan.membersHidden && plan.maxParticipants == null
                ? t('plan.detail.by', { pseudo: plan.creator.pseudo }).replace(/\s*·\s*$/, '')
                : t('plan.detail.by', { pseudo: plan.creator.pseudo })}{' '}
              {!plan.membersHidden && <>
              <span className="text-emerald-600">{t('common.inCount', { count: inCount })}</span>{' '}·{' '}
              <span className="text-amber-600">{maybeCount} ?</span>{' '}·{' '}
              <span className="text-slate-400">{t('plan.detail.countOut', { count: outCount })}</span>
              {!!plan.pending?.length && <>{' '}·{' '}<span className="text-slate-400">{t('plan.detail.countPending', { count: plan.pending.length })}</span></>}
              </>}
              {plan.maxParticipants != null && (
                <>{plan.membersHidden ? ' ' : <>{' '}· </>}<span className={isFull ? 'text-red-500 font-semibold' : 'text-slate-400'}>{occupied}/{plan.maxParticipants}</span>{waitingCount > 0 && <span className="text-amber-600">{t('plan.detail.waitingCount', { count: waitingCount })}</span>}</>
              )}
            </span>
          </div>
        )}

        {/* Qui voit ce Plan : réservé à certaines personnes, caché pour une surprise, ou simplement caché à quelques-unes */}
        {(plan.visibility === 'reserved' || (plan.exclusions ?? []).length > 0) && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm md:text-xs text-indigo-800">
            {plan.visibility !== 'reserved' && plan.surprise !== false
              ? <Gift size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              : <Lock size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />}
            <span>
              {plan.visibility === 'reserved'
                ? <Trans i18nKey="plan.detail.reserved" components={{ b: <strong /> }} />
                : <Trans i18nKey={plan.surprise !== false ? 'plan.detail.surprise' : 'plan.detail.hiddenFrom'} count={(plan.exclusions ?? []).length} values={{ names: (plan.exclusions ?? []).map(e => `@${e.user.pseudo}`).join(', ') }} components={{ b: <strong /> }} />}
            </span>
          </div>
        )}

        {/* Plan créé avec « Y aller avec un Cercle » : l'événement d'origine et son inscription */}
        {plan.source && <SourceEventCard source={plan.source} />}

        {plan.viewerIsGuest && (
          <p className="mt-2 text-sm md:text-xs text-slate-500">
            <Trans i18nKey="plan.detail.guest" components={{ b: <strong /> }} />
          </p>
        )}
        </div>

        {ended && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm md:text-xs text-amber-900 flex gap-2">
            <Hourglass size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <span>
              {t('plan.expiry.banner', { date: new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(planDeletionAt(plan)) })}
              {canEdit && <span className="block mt-1 text-amber-800/80">{t('plan.expiry.bannerExtend')}</span>}
            </span>
          </div>
        )}
        {ended ? null : isMember ? (
          <div className="grid grid-cols-3 md:flex items-center gap-2 mt-3 md:flex-wrap">
            {/* Téléphone : les trois réponses sur toute la largeur, sans libellé */}
            <span className="hidden md:inline text-xs text-slate-400 font-medium">{t('plan.detail.myRsvp')}</span>
            {(['in', 'maybe', 'out'] as const).map(rsvp => (
              <button
                key={rsvp}
                onClick={() => handleRsvp(rsvp)}
                disabled={updatingRsvp}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 md:px-3 md:py-1.5 rounded-lg border-2 md:border text-sm md:text-xs font-semibold shadow-sm transition-colors ${
                  (pendingRsvp ?? myMember?.rsvp) === rsvp ? rsvpConfig[rsvp].active : rsvpConfig[rsvp].inactive
                }`}
              >
                {pendingRsvp === rsvp && <Loader2 size={13} className="animate-spin flex-shrink-0" />}
                {rsvpConfig[rsvp].label}
              </button>
            ))}
            {myMember?.rsvp === 'out' && (isFull || myWaitPos) && <div className="col-span-3 md:basis-full">{waitlistCard}</div>}
          </div>
        ) : isFull || myWaitPos ? (
          waitlistCard
        ) : (
          // Pas encore répondu : les trois réponses en grand, avant tout le reste (2026-11-03)
          <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-base font-semibold text-slate-800 mb-3">{t('plan.detail.answerFirst')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['in', 'maybe', 'out'] as const).map(rsvp => (
                <button key={rsvp} onClick={() => withMultiWarning(() => handleJoin(rsvp))} disabled={joining}
                  className={`flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl border-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 ${pendingRsvp === rsvp ? rsvpConfig[rsvp].active : rsvpConfig[rsvp].inactive}`}>
                  {pendingRsvp === rsvp && <Loader2 size={13} className="animate-spin flex-shrink-0" />}
                  {rsvpConfig[rsvp].label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Événement en Mode annonce : créer un Plan dans un de mes Cercles pour y aller avec mes amis */}
        {plan.canGoWithCircle && !ended && (
          <button
            onClick={() => setShowGoWith(true)}
            className="mt-3 w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-colors"
          >
            <Users size={16} />{t('plan.goWith.button')}
          </button>
        )}
      </div>
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden short:overflow-y-auto" {...(phoneSection ? swipeHandlers : {})}>
      {/* En-tête : page principale (téléphone) ou au-dessus des onglets (grand écran) */}
      {phoneSection ? sectionHeader : showHub ? (
        <>
          <div className="flex-1 overflow-y-auto bg-slate-100 short:flex-none short:overflow-visible">
            {header}
            {hubCards}
          </div>
          {actionBar}
        </>
      ) : header}

      {/* Tabs (only if member) */}
      {isMember && !showHub && (
        <>
          <div className="hidden md:block border-b border-slate-200 flex-shrink-0 bg-white short:sticky short:top-0 short:z-10">
            <PlanTabBar tabs={shownTabs} active={tab} onSelect={setTab} hasNews={hasNews}
              trailing={addableTabs.length > 0 && (
                <button onClick={() => setShowAddSection(true)} title={t('plan.detail.add.button')} aria-label={t('plan.detail.add.button')}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-3 text-sm font-medium text-indigo-600 border-b-2 border-transparent hover:text-indigo-700 whitespace-nowrap">
                  <Plus size={15} />{t('plan.detail.add.short')}
                </button>
              )} />
          </div>

          {activeTab === 'chat' && isEnabled(plan, 'chat') && (
            <div className="flex-1 flex flex-col overflow-hidden short:flex-none short:overflow-visible">
              <div ref={chatScrollRef} onScroll={onChatScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50 short:flex-none short:overflow-visible">
                {visibleMessages.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm pt-12">
                    {t('plan.detail.noMessage')}
                  </div>
                ) : (
                  visibleMessages.map(msg => (
                    <div key={msg.id} data-msg={msg.id} className={`rounded-2xl transition-shadow ${flashMsg === msg.id ? 'ring-4 ring-indigo-300 ring-offset-4 ring-offset-slate-50' : ''}`}>
                      <ChatMessage
                        message={msg}
                        isMe={msg.author.id === user.id}
                        myUserId={user.id}
                        onReact={handleReact}
                        onReply={ended || plan.canWriteChat === false ? undefined : setReplyTo}
                        onJumpTo={jumpToMessage}
                        hiddenAuthors={blocked}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onReport={setReporting}
                        mediaToken={plan.mediaToken}
                        onViewPhoto={setViewingPhoto}
                      />
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              {ended ? (
                <p className="px-4 py-3 text-sm text-slate-500 bg-white border-t border-slate-200 text-center short:sticky short:bottom-0">{t('plan.expiry.chatClosed')}</p>
              ) : plan.canWriteChat === false ? (
                <p className="px-4 py-3 text-sm text-slate-500 bg-white border-t border-slate-200 text-center short:sticky short:bottom-0">{t('org.plan.readOnlyChat')}</p>
              ) : <ChatInput
                onSend={handleSend}
                onSendPhoto={isEnabled(plan, 'fichiers') && (plan.filesMode !== 'managers' || plan.canManageFiles) ? handleSendPhoto : undefined}
                onSendVoice={isEnabled(plan, 'fichiers') && (plan.filesMode !== 'managers' || plan.canManageFiles) ? handleSendVoice : undefined}
                members={plan.members.map(m => ({ pseudo: m.user.pseudo }))}
                replyTo={replyTo ? { id: replyTo.id, authorPseudo: replyTo.author.pseudo, preview: (replyTo.content || (replyTo.attachment?.mimeType.startsWith('audio/') ? t('chat.message.quoteVoice') : replyTo.attachment ? t('chat.message.quotePhoto') : '')).slice(0, 60) } : null}
                onCancelReply={() => setReplyTo(null)}
              />}
            </div>
          )}

          {activeTab === 'infos' && (
            <InfosTab plan={plan} onPlanUpdated={onPlanUpdated} pseudo={user.pseudo} userId={user.id} />
          )}
          {activeTab === 'membres' && <MembresTab plan={plan} members={plan.members} onlineUserIds={onlineUserIds} waitlist={plan.waitlist} creatorId={plan.creatorId} canRemove={!!plan.canManageFiles && !plan.viewerIsGuest}
            onRemove={async userId => { await api.delete(`/plans/${plan.id}/members/${userId}`); const { data } = await api.get(`/plans/${plan.id}`); onPlanUpdated(data); }}
            onNudge={async () => { const { data } = await api.post(`/plans/${plan.id}/nudge`); api.get(`/plans/${plan.id}`).then(r => onPlanUpdated(r.data)).catch(() => {}); return data.count; }}
            onInvite={isMember && !ended ? () => setShowInvite(true) : undefined} />}
          {activeTab === 'votes' && <VotesTab plan={plan} onPlanUpdated={onPlanUpdated} userId={user.id} />}
          {activeTab === 'pere_noel' && <SecretSantaTab plan={plan} userId={user.id} />}
          {activeTab === 'quiz' && <QuizTab plan={plan} userId={user.id} />}
          {activeTab === 'killer' && <KillerTab plan={plan} userId={user.id} />}
          {activeTab === 'mot_piege' && <WordTrapTab plan={plan} userId={user.id} />}
          {activeTab === 'equipes' && <TeamsTab plan={plan} userId={user.id} />}
          {activeTab === 'cagnotte' && <GiftPotTab plan={plan} userId={user.id} />}
          {activeTab === 'assemblee' && <AssemblyTab plan={plan} userId={user.id} />}
          {activeTab === 'taches' && <TasksTab plan={plan} userId={user.id} />}
          {activeTab === 'fournisseurs' && <SuppliersTab plan={plan} userId={user.id} />}
          {activeTab === 'deroule' && (dayMerged
            ? <DayPlanTab plan={plan} userId={user.id} onPlanUpdated={onPlanUpdated} unseen={plan.unseen ?? []} onSeen={markSectionSeen} focus={dayFocus} onFocusUsed={() => setDayFocus(null)} />
            : <ProgramTab plan={plan} userId={user.id} />)}
          {activeTab === 'idees' && <IdeasTab plan={plan} userId={user.id} />}
          {activeTab === 'capsule' && <CapsuleTab planId={plan.id} />}
          {activeTab === 'mystere' && <MysteryTab plan={plan} userId={user.id} />}
          {activeTab === 'benevoles' && <VolunteersTab plan={plan} userId={user.id} onPlanUpdated={onPlanUpdated} />}
          {activeTab === 'depenses' && <DepensesTab planId={plan.id} members={plan.members} userId={user.id} plan={plan} pseudo={user.pseudo} onPlanUpdated={onPlanUpdated} />}
          {activeTab === 'trajets' && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
              <CarpoolSection planId={plan.id} userId={user.id} isAbsent={myMember?.rsvp === 'out'} />
              <TransitSection planId={plan.id} userId={user.id} isAbsent={myMember?.rsvp === 'out'} reloadKey={plan} />
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InviteModal
          circleName={circleName}
          circleCode={circleCode}
          circleId={plan.viewerIsGuest ? undefined : (circleId ?? plan.circleId)}
          planTitle={plan.title}
          planId={plan.id}
          allowGuest
          canInviteToCircle={!plan.viewerIsGuest && !circlePersonal}
          isPlanCreator={isCreator}
          canInviteGuests={plan.canInviteGuests !== false}
          onClose={() => setShowInvite(false)}
        />
      )}

      {viewingPhoto && chatPhotos.length > 0 && (
        <PhotoViewer
          photos={chatPhotos}
          startId={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
          onDelete={async id => { await api.delete(`/attachments/${id}`); }}
        />
      )}
      {reporting && (
        <ReportMessageModal kind="plan" messageId={reporting.id} author={reporting.author} onClose={() => setReporting(null)} />
      )}

      {multiWarning && plan.circles && (
        <Modal title={t('plan.multi.warnTitle')} onClose={() => setMultiWarning(null)}>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
              <Layers size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{t('plan.multi.warnCircles', { names: plan.circles.map(c => c.name).join(', ') })}</p>
            </div>
            <p className="text-sm text-slate-600">{t('plan.multi.warnText')}</p>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="ghost" onClick={() => setMultiWarning(null)}>{t('common.cancel')}</Button>
              <Button type="button" onClick={() => { const go = multiWarning; setMultiWarning(null); go(); }}>{t('plan.multi.warnConfirm')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {showHistory && (
        <Modal title={t('plan.detail.history')} onClose={() => setShowHistory(false)}>
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

      {showGoWith && <GoWithCircleModal plan={plan} onClose={() => setShowGoWith(false)} />}
      {showStory && (
        <StoryModal plan={plan} onClose={() => setShowStory(false)} />
      )}
      {showPublish && (
        <PublishDiscoverModal plan={plan} onClose={() => setShowPublish(false)}
          onChanged={() => api.get(`/plans/${plan.id}`).then(res => onPlanUpdated(res.data)).catch(() => {})} />
      )}

      {isMember && <WheelSpinHost plan={plan} />}
      {isMember && hasFeature(plan, 'quiz') && <QuizLiveHost plan={plan} />}

      {showAddSection && (
        <Modal title={t('plan.detail.add.title')} onClose={() => setShowAddSection(false)}>
          <div className="space-y-2">
            {addableTabs.map(({ key, Icon, label }) => (
              <button key={key} onClick={() => { reveal(key); setTab(key); setHub(false); setShowAddSection(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 text-left">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><Icon size={20} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-slate-800">{label}</span>
                  <span className="block text-xs text-slate-500">{t(`plan.detail.add.${key}` as any)}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
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
