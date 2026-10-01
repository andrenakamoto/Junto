import { useEffect, useState } from 'react';
import { ChevronRight, UserPlus } from 'lucide-react';
import { Modal } from './Modal';
import { NOTIF_CONFIG, type AppNotification } from './NotificationToast';
import api from '../../services/api';
import type { Circle, Plan } from '../../types';

// Panneau ouvert par la cloche de la barre latérale :
//  - Nouveautés dans tes Plans : onglets non consultés (serveur, `unseen`), donc aussi ce
//    qui s'est passé pendant que l'app était fermée ;
//  - Demandes pour rejoindre un Cercle en attente ;
//  - Récemment : historique des notifications reçues pendant l'utilisation de l'app,
//    gardé sur l'appareil (DashboardPage).

const SECTION_LABELS: Record<string, string> = {
  chat: 'Chat', infos: 'Infos', trajets: 'Trajets', membres: 'Membres', votes: 'Votes', depenses: 'Dépenses',
};

function timeAgo(at: number): string {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  if (h < 48) return 'hier';
  return new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short' }).format(at);
}

interface Props {
  circles: Circle[];
  history: AppNotification[];
  onClose: () => void;
  onOpenPlan: (plan: Plan) => void;
  onOpenCircle: (circleId: string) => void;
  onOpenNotification: (n: AppNotification) => void;
  onClearHistory: () => void;
}

export function NotificationCenter({ circles, history, onClose, onOpenPlan, onOpenCircle, onOpenNotification, onClearHistory }: Props) {
  const [plansWithNews, setPlansWithNews] = useState<Plan[] | null>(null);

  useEffect(() => {
    api.get<Plan[]>('/plans')
      .then(res => setPlansWithNews(res.data.filter(p => (p.unseen?.length ?? 0) > 0)))
      .catch(() => setPlansWithNews([]));
  }, []);

  const requests = circles.filter(c => (c.joinRequests?.length ?? 0) > 0);
  const nothing = plansWithNews?.length === 0 && requests.length === 0 && history.length === 0;

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="space-y-5 -mt-1">
        {plansWithNews === null && <p className="text-sm text-slate-400">Chargement…</p>}
        {nothing && <p className="text-sm text-slate-500 text-center py-6">Rien de nouveau pour l'instant.</p>}

        {plansWithNews && plansWithNews.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Nouveautés dans tes Plans</h3>
            <div className="space-y-1.5">
              {plansWithNews.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onClose(); onOpenPlan(p); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{p.title}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {p.circle?.name ?? 'Invitation'} · Nouveau : {(p.unseen ?? []).map(s => SECTION_LABELS[s] ?? s).join(', ')}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {requests.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Demandes pour rejoindre</h3>
            <div className="space-y-1.5">
              {requests.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onClose(); onOpenCircle(c.id); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left"
                >
                  <UserPlus size={16} className="text-amber-600 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-slate-800">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-500"> · {c.joinRequests!.length} demande{c.joinRequests!.length > 1 ? 's' : ''} en attente</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Récemment</h3>
              <button onClick={onClearHistory} className="text-xs text-slate-400 hover:text-slate-700">Effacer</button>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {history.map(n => {
                const cfg = NOTIF_CONFIG[n.type];
                if (!cfg) return null;
                const Icon = cfg.icon;
                const clickable = !!(n.planId || n.circleId);
                return (
                  <button
                    key={n.id}
                    disabled={!clickable}
                    onClick={() => { onClose(); onOpenNotification(n); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 bg-white hover:bg-slate-50 disabled:hover:bg-white text-left"
                  >
                    <Icon size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-slate-800 truncate">{cfg.title(n)}</span>
                      <span className="block text-xs text-slate-500 truncate">{cfg.body(n)}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0 mt-0.5">{timeAgo(n.at)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
