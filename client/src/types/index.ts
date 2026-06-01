export interface User {
  id: string;
  pseudo: string;
  status: string;
  isAdmin: boolean;
  termsAccepted: boolean;
}

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

export interface Circle {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  creatorId: string;
  creator: User;
  members: CircleMember[];
  deleteVotes?: CircleDeleteVote[];
  _count?: { plans: number };
}

export interface PlanMember {
  userId: string;
  planId: string;
  rsvp: 'in' | 'maybe' | 'out';
  user: User;
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
  planId: string;
  options: PollOption[];
}

export interface PlanDeleteVote {
  userId: string;
  planId: string;
  user: { id: string; pseudo: string };
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  eventDate?: string | null;
  endDate: string;
  location?: string | null;
  archived: boolean;
  creatorId: string;
  creator: User;
  circleId: string;
  members: PlanMember[];
  deleteVotes?: PlanDeleteVote[];
  polls?: Poll[];
  items?: BringItem[];
  _count?: { messages: number };
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: User;
  planId: string;
}
