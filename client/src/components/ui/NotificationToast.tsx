import { useEffect } from 'react';
import { Bell, MessageSquare, AtSign, UserPlus, PartyPopper, CalendarRange, X } from 'lucide-react';

export interface AppNotification {
  id: string;
  type: 'new_plan' | 'new_message' | 'mention' | 'join_request' | 'join_accepted' | 'new_circle_poll';
  planId?: string;
  planTitle?: string;
  circleId?: string;
  circleName?: string;
  from?: string;
  preview?: string;
  at: number;
}

const NOTIF_CONFIG: Record<AppNotification['type'], { icon: typeof Bell; iconClass: string; bgClass: string; title: (n: AppNotification) => string; body: (n: AppNotification) => string }> = {
  new_plan: {
    icon: Bell, iconClass: 'text-indigo-400', bgClass: 'bg-indigo-600/30',
    title: n => `Nouveau plan — ${n.circleName}`,
    body: n => `@${n.from} a créé « ${n.planTitle} »`,
  },
  new_message: {
    icon: MessageSquare, iconClass: 'text-emerald-400', bgClass: 'bg-emerald-600/30',
    title: n => `Nouveau message — ${n.planTitle}`,
    body: n => `@${n.from} : ${n.preview}`,
  },
  mention: {
    icon: AtSign, iconClass: 'text-amber-400', bgClass: 'bg-amber-600/30',
    title: n => `@${n.from} t'a mentionné — ${n.planTitle}`,
    body: n => n.preview ?? '',
  },
  join_request: {
    icon: UserPlus, iconClass: 'text-indigo-400', bgClass: 'bg-indigo-600/30',
    title: n => `Demande — ${n.circleName}`,
    body: n => `@${n.from} veut rejoindre le Cercle`,
  },
  join_accepted: {
    icon: PartyPopper, iconClass: 'text-emerald-400', bgClass: 'bg-emerald-600/30',
    title: () => 'Demande acceptée',
    body: n => `Tu as rejoint « ${n.circleName} »`,
  },
  new_circle_poll: {
    icon: CalendarRange, iconClass: 'text-indigo-400', bgClass: 'bg-indigo-600/30',
    title: n => `Sondage de dates — ${n.circleName}`,
    body: n => `@${n.from} propose : ${n.planTitle}`,
  },
};

interface Props {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onClickNotification: (n: AppNotification) => void;
}

export function NotificationToast({ notifications, onDismiss, onClickNotification }: Props) {
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map(n => setTimeout(() => onDismiss(n.id), 5000));
    return () => timers.forEach(clearTimeout);
  }, [notifications.map(n => n.id).join(',')]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-80">
      {notifications.slice(-3).map(n => {
        const cfg = NOTIF_CONFIG[n.type];
        const Icon = cfg.icon;
        return (
          <div
            key={n.id}
            className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-3 flex gap-3 items-start cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={() => { onClickNotification(n); onDismiss(n.id); }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgClass}`}>
              <Icon size={14} className={cfg.iconClass} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">{cfg.title(n)}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{cfg.body(n)}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); onDismiss(n.id); }} className="text-slate-500 hover:text-white flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
