export interface User {
  id: string;
  pseudo: string;
  firstName?: string | null;
  lastName?: string | null;
  /** Faux pour un compte créé avec Google (pas de mot de passe) */
  hasPassword?: boolean;
  status: string;
  isAdmin: boolean;
  termsAccepted: boolean;
  email: string | null;
  emailVerified: boolean;
  /** Nouvelle adresse en attente de confirmation (changement d'email) */
  pendingEmail?: string | null;
  weeklyDigestEnabled: boolean;
  /** Récapitulatif PDF par email avant la suppression des Plans gérés */
  recapEmailEnabled?: boolean;
  /** Discussions des Cercles : un push pour chaque message */
  circleChatPush?: boolean;
  /** Canal des notifications : push, push + email (défaut) ou email */
  notificationChannel?: NotificationChannel;
  /** Personnes masquées : leurs messages ne sont pas affichés (serveur : lib/moderation.ts) */
  blockedUserIds?: string[];
  /** Langue choisie (fr, de, it, en) ; null = pas encore choisie */
  locale?: string | null;
}

export type NotificationChannel = 'push' | 'both' | 'email';

export interface CircleMember {
  userId: string;
  circleId: string;
  role: string;
  user: User;
}

export interface CircleDeleteVote {
  userId: string;
  circleId: string;
  user: { id: string; pseudo: string };
}

export interface CircleJoinRequest {
  id: string;
  createdAt: string;
  user: { id: string; pseudo: string };
  votes: { userId: string }[];
}

export type DeletionMode = 'vote' | 'creator';
export type AdmissionMode = 'vote' | 'creator' | 'open';
export type EditMode = 'creator' | 'all';
export type PlanCreationMode = 'all' | 'creator';
export type PlanFeature = 'chat' | 'trajets' | 'votes' | 'depenses' | 'fichiers';
/** Fonctions à activer (absentes par défaut) */
export type OptionalFeature = 'benevoles' | 'pere_noel' | 'killer' | 'equipes' | 'cagnotte' | 'mot_piege' | 'assemblee' | 'quiz';

export interface Circle {
  /** Dernière activité (GET /circles) : sert à l'ordre de la liste */
  lastActivityAt?: string | null;
  id: string;
  name: string;
  code: string;
  description?: string | null;
  color?: string | null;
  /** Photo de couverture 2:1 (lib/photos.ts), null = lettre colorée */
  /** Discussion du Cercle : open (tout le monde écrit), announce (créateur et organisateurs), off */
  chatMode?: 'open' | 'announce' | 'off';
  /** Message de la discussion non lu */
  chatUnseen?: boolean;
  /** Dernier message (7 derniers jours) : auteur, aperçu, date */
  chatLast?: { author: string; text: string; at: string } | null;
  photoKey?: string | null;
  /** Paramètres avancés : suppression à la majorité ou par le créateur seul */
  deletionMode?: DeletionMode;
  /** Admission : vote à la majorité, validation par le créateur, ou entrée libre avec le code */
  admissionMode?: AdmissionMode;
  /** Qui peut créer des Plans */
  planCreationMode?: PlanCreationMode;
  /** Qui peut lancer des sondages de dates (mêmes valeurs) */
  pollCreationMode?: PlanCreationMode;
  creatorId: string;
  creator: User;
  members: CircleMember[];
  /** Cercle personnel « Mes Plans » (Plan express) */
  isPersonal?: boolean;
  deleteVotes?: CircleDeleteVote[];
  joinRequests?: CircleJoinRequest[];
  /** Un de mes Plans dans ce Cercle a du nouveau depuis ma dernière visite */
  hasUnseen?: boolean;
  /** Sondages de dates ouverts, et ceux qui attendent ma réponse (ni vote ni « Pas disponible ») */
  pollCount?: number;
  pendingPolls?: { id: string; question: string }[];
  _count?: { plans: number };
  plans?: { id: string; title: string; eventDate?: string | null; endDate: string }[];
}

export interface PlanMember {
  userId: string;
  planId: string;
  rsvp: 'in' | 'maybe' | 'out';
  /** Arrivée dans le Plan (inchangée quand la réponse change) */
  joinedAt?: string;
  user: User;
  /** Invité externe : membre du Plan sans être membre du Cercle */
  isGuest?: boolean;
}

export interface BringItem {
  id: string;
  label: string;
  claimedBy?: string | null;
  /** Auteur (peut retirer l'élément, comme le créateur du Plan) ; absent pour les anciens éléments */
  createdById?: string | null;
  /** Quantité facultative, en texte libre (« 3 kg ») */
  quantity?: string | null;
  planId: string;
}

export interface PollVote {
  userId: string;
  pollOptionId: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: PollVote[];
}

export interface Poll {
  id: string;
  question: string;
  anonymous: boolean;
  planId: string;
  options: PollOption[];
}

export interface PlanDeleteVote {
  userId: string;
  planId: string;
  user: { id: string; pseudo: string };
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
}

export interface PlanChangeLog {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy?: { id: string; pseudo: string } | null;
}

export interface Plan {
  /** Qui voit les participants : tout le monde, ou le créateur et les organisateurs (Mode annonce) */
  membersVisibility?: 'all' | 'managers';
  /** La liste est réservée et la personne ne la voit pas : `members` ne contient que sa propre réponse */
  membersHidden?: boolean;
  /** Places occupées d'un Plan limité, quand la liste est masquée */
  participantCount?: number;
  /** Créateur ou organisateur : ajoute photos et fichiers même si la fonction est décochée (affiche) */
  canManageFiles?: boolean;
  /** Plan pour plusieurs Cercles : les Cercles réunis (absent sinon, et pour un invité externe) */
  circles?: { id: string; name: string; color?: string | null }[];
  /** Dernière activité (GET /circles/:id/plans) : sert à l'ordre de la liste du Cercle */
  lastActivityAt?: string | null;
  id: string;
  title: string;
  /** Onglets avec du nouveau depuis ma dernière visite (chat, infos, trajets, membres, votes, depenses) */
  unseen?: string[];
  /** Date de la dernière activité non vue (cloche) */
  unseenAt?: string | null;
  description: string;
  eventDate?: string | null;
  endDate: string;
  location?: string | null;
  maxParticipants?: number | null;
  /** Liste d'attente (Plan complet), dans l'ordre ; `user` seulement dans le détail du Plan */
  waitlist?: { userId: string; createdAt?: string; user?: { id: string; pseudo: string; firstName?: string | null } }[];
  deletionMode?: DeletionMode;
  /** Fonctions masquées (les données sont conservées) */
  disabledFeatures?: PlanFeature[];
  /** Fonctions activées en plus (planning des bénévoles) */
  enabledFeatures?: OptionalFeature[];
  /** Qui peut modifier les dates et le lieu (titre, description, etc. : créateur seul) */
  editMode?: EditMode;
  /** Informations importantes (après la description) */
  importantInfo?: string | null;
  /** Qui peut modifier les informations importantes (indépendant d'editMode) */
  importantInfoMode?: EditMode;
  /** Plan récurrent : weekly | biweekly | monthly (null = ne se répète pas) */
  recurrence?: 'weekly' | 'biweekly' | 'monthly' | null;
  recurrenceUntil?: string | null;
  /** Plan suivant déjà créé (« ended » : la série s'arrête là) */
  nextOccurrenceId?: string | null;
  archived: boolean;
  creatorId: string;
  creator: User;
  circleId: string;
  circle?: { id: string; name: string } | null;
  members: PlanMember[];
  deleteVotes?: PlanDeleteVote[];
  polls?: Poll[];
  items?: BringItem[];
  changeLogs?: PlanChangeLog[];
  attachments?: Attachment[];
  _count?: { messages: number };
  /** Plan surprise : membres du Cercle pour qui le Plan est invisible */
  exclusions?: { userId: string; user: { id: string; pseudo: string } }[];
  /** Liste « Tous mes plans » : Plan où je suis invité externe (nom du Cercle masqué) */
  isGuest?: boolean;
  /** Détail d'un Plan : l'utilisateur courant y est invité externe */
  viewerIsGuest?: boolean;
  /** Jeton (12 h) pour afficher les photos/fichiers via /api/attachments/:id/view */
  mediaToken?: string;
  /** Peut télécharger le récapitulatif PDF (créateur du Plan, gestionnaires du Cercle) */
  canRecap?: boolean;
  /** Supprimer les sondages : créateur, gestionnaires du Cercle, ou tous si le Plan laisse modifier dates et lieu */
  canDeletePolls?: boolean;
  /** Mode annonce : les membres peuvent y aller avec un de leurs Cercles */
  allowCirclePlans?: boolean;
  /** Détail : « Y aller avec un Cercle » est possible pour la personne */
  canGoWithCircle?: boolean;
  /** Plan créé avec « Y aller avec un Cercle » : l'événement d'origine (rien de son Cercle) */
  source?: PlanSource;
}

export interface PlanSource {
  /** L'événement a été annulé ou supprimé */
  gone: boolean;
  title: string;
  eventDate?: string | null;
  endDate?: string;
  location?: string | null;
  ended?: boolean;
  /** Jeton du lien d'invitation de l'événement (absent si l'organisateur ne le permet plus) */
  token?: string | null;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  user: User;
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: User;
  planId: string;
  parentId?: string | null;
  /** Modifié par son auteur (dans les 15 min) */
  editedAt?: string | null;
  /** Supprimé par son auteur : contenu vide, affiché « Message supprimé » */
  deletedAt?: string | null;
  reactions?: MessageReaction[];
  _count?: { replies: number };
  /** Photo envoyée dans le chat (aussi dans l'onglet Infos) ; null si retirée depuis Infos */
  attachment?: { id: string; name: string; mimeType: string } | null;
}

export type Currency = 'CHF' | 'EUR';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  createdAt: string;
  paidById: string;
  paidBy: { id: string; pseudo: string };
  splitWith: { userId: string; user: { id: string; pseudo: string } }[];
}

export interface Reimbursement {
  id: string;
  amount: number;
  currency: Currency;
  createdAt: string;
  fromUserId: string;
  toUserId: string;
}

export interface ExpenseBalance {
  userId: string;
  pseudo: string;
  /** Un solde par devise utilisée dans le Plan (pas de conversion) */
  amounts: { currency: Currency; balance: number }[];
}

export interface SuggestedTransfer {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: Currency;
  fromPseudo?: string;
  toPseudo?: string;
}

export interface ExpensesData {
  /** Devise proposée pour une nouvelle dépense : celle de la dernière saisie */
  defaultCurrency: Currency;
  expenses: Expense[];
  reimbursements: Reimbursement[];
  balances: ExpenseBalance[];
  suggestedTransfers: SuggestedTransfer[];
}

export interface RidePassenger {
  userId: string;
  user: { id: string; pseudo: string };
}

export interface Ride {
  id: string;
  departure: string;
  departureAt?: string | null;
  seats: number;
  note?: string | null;
  driver: { id: string; pseudo: string };
  passengers: RidePassenger[];
}

export interface RideRequest {
  id: string;
  fromLocation: string;
  user: { id: string; pseudo: string };
}

export interface CirclePollVote {
  userId: string;
  user: { id: string; pseudo: string };
}

export interface CirclePollOption {
  id: string;
  label: string;
  eventDate?: string | null;
  votes: CirclePollVote[];
}

export interface CirclePoll {
  id: string;
  question: string;
  createdAt: string;
  resolvedAt?: string | null;
  /** Supprimé à cette date s'il n'a pas été converti en Plan (dernière date + 1 jour, 30 jours max) */
  expiresAt: string;
  creator: { id: string; pseudo: string };
  options: CirclePollOption[];
  /** Sondage surprise : membres du Cercle à qui il est caché */
  exclusions?: { userId: string; user: { id: string; pseudo: string } }[];
  /** « Pas disponible » */
  declines?: { userId: string; user: { id: string; pseudo: string } }[];
  _count?: { messages: number };
}

export interface CirclePollMessage {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author: { id: string; pseudo: string };
  /** Réactions (absentes des anciennes données de la démo) */
  reactions?: { emoji: string; userId: string }[];
}

// Planning des bénévoles : poste d'un Plan et ses inscrits
export interface VolunteerShift {
  id: string;
  title: string;
  needed: number;
  note: string | null;
  startsAt: string | null;
  endsAt: string | null;
  signups: { userId: string; user: { id: string; pseudo: string; firstName?: string | null } }[];
  /** Commentaires (« il manque du matériel ») ; absents des anciennes données de la démo */
  comments?: { id: string; content: string; createdAt: string; author: { id: string; pseudo: string; firstName?: string | null } }[];
  doneAt?: string | null;
  doneBy?: { pseudo: string } | null;
}

// Message de la discussion d'un Cercle (effacé après 7 jours)
export interface CircleMessage {
  id: string;
  circleId: string;
  author: { id: string; pseudo: string; firstName?: string | null };
  content: string;
  imageKey: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions: { emoji: string; userId: string }[];
}
