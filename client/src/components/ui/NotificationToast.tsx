import { useEffect } from 'react';
import { Bell, MessageSquare, X } from 'lucide-react';

export interface AppNotification {
  id: string;
  type: 'new_plan' | 'new_message';
  planId: string;
  planTitle: string;
  circleName?: string;
  from: string;
  preview?: string;
  at: number;
}

interface Props {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onClickNotification: (n: AppNotification) => void;
}

export function NotificationToast({ notifications, onDismiss, onClickNotification }: Props) {
  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[notifications.length - 1];
    const timer = setTimeout(() => onDismiss(latest.id), 5000);
    return () => clearTimeout(timer);
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {notifications.slice(-3).map(n => (
        <div
          key={n.id}
          className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 flex gap-3 items-start animate-slide-in cursor-pointer hover:bg-slate-750"
          onClick={() => { onClickNotification(n); onDismiss(n.id); }}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            n.type === 'new_plan' ? 'bg-indigo-600/30' : 'bg-emerald-600/30'
          }`}>
            {n.type === 'new_plan'
              ? <Bell size={14} className="text-indigo-400" />
              : <MessageSquare size={14} className="text-emerald-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">
              {n.type === 'new_plan' ? `Nouveau plan dans ${n.circleName}` : `Nouveau message — ${n.planTitle}`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {n.type === 'new_plan'
                ? `@${n.from} a créé « ${n.planTitle} »`
                : `@${n.from} : ${n.preview}`}
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(n.id); }}
            className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
