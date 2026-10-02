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
  /** Canal des notifications : push, push + email (défaut) ou email */
  notificationChannel?: NotificationChannel;
  /** Personnes masquées : leurs messages ne sont pas affichés (serveur : lib/moderation.ts) */
  blockedUserIds?: string[];
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

export interface Circle {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  color?: string | null;
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
  deleteVotes?: CircleDeleteVote[];
  joinRequests?: CircleJoinRequest[];
  /** Un de mes Plans dans ce Cercle a du nouveau depuis ma dernière visite */
  hasUnseen?: boolean;
  _count?: { plans: number };
  plans?: { id: string; title: string; eventDate?: string | null; endDate: string }[];
}

export interface PlanMember {
  userId: string;
  planId: string;
  rsvp: 'in' | 'maybe' | 'out';
  user: User;
  /** Invité externe : membre du Plan sans être membre du Cercle */
  isGuest?: boolean;
}

export interface BringItem {
  id: string;
  label: string;
  claimedBy?: string | null;
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
  id: string;
  title: string;
  /** Onglets avec du nouveau depuis ma dernière visite (chat, infos, trajets, membres, votes, depenses) */
  unseen?: string[];
  description: string;
  eventDate?: string | null;
  endDate: string;
  location?: string | null;
  maxParticipants?: number | null;
  deletionMode?: DeletionMode;
  /** Fonctions masquées (les données sont conservées) */
  disabledFeatures?: PlanFeature[];
  /** Qui peut modifier les dates et le lieu (titre, description, etc. : créateur seul) */
  editMode?: EditMode;
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
  /** « Pas intéressé(e) » */
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
}
