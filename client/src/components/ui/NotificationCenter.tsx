import { useEffect, useState } from 'react';
import { Check, ChevronRight, Mail, Trash2, UserPlus, X } from 'lucide-react';
import { Modal } from './Modal';
import { NOTIF_CONFIG, type AppNotification } from './NotificationToast';
import api from '../../services/api';
import type { Circle, Plan } from '../../types';

// Panneau ouvert par la cloche de la barre latérale :
//  - Nouveautés dans tes Plans : onglets non consultés (serveur, `unseen`), donc aussi ce
//    qui s'est passé pendant que l'app était fermée ;
//  - Demandes pour rejoindre un Cercle en attente ;
//  - À voir : notifications reçues dans l'app, gardées sur l'appareil jusqu'à ce que ce
//    qu'elles concernent soit ouvert (DashboardPage, dismissHistory).
// Toucher une notification l'efface de la cloche ; « Tout effacer » vide les Plans et « À voir »
// (les invitations et demandes d'adhésion restent : elles attendent une réponse). Les pastilles
// des onglets ne changent pas : elles disparaissent quand l'onglet est consulté.

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
  /** Plans avec des onglets non vus, sans ceux effacés de la cloche (DashboardPage) */
  plansWithNews: Plan[];
  history: AppNotification[];
  onClose: () => void;
  onOpenPlan: (plan: Plan) => void;
  onOpenCircle: (circleId: string) => void;
  onOpenNotification: (n: AppNotification) => void;
  /** « Tout effacer » : vide la cloche (sans toucher aux pastilles des onglets) */
  onClearAll: () => void;
  /** Invitation acceptée (Cercle rejoint, ou demande d'adhésion envoyée) ; nombre d'invitations restantes */
  onInvitationsChanged: (remaining: number, joinedCircleId?: string) => void;
}

interface CircleInvite {
  id: string;
  circle: { id: string; name: string; color: string | null; description: string | null; _count: { members: number } };
  inviter: { pseudo: string; firstName: string | null; lastName: string | null };
}

export function NotificationCenter({ circles, plansWithNews, history, onClose, onOpenPlan, onOpenCircle, onOpenNotification, onClearAll, onInvitationsChanged }: Props) {
  // Invitations à rejoindre un Cercle (CircleInvitation, envoyées par pseudo ou email)
  const [invites, setInvites] = useState<CircleInvite[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    api.get<CircleInvite[]>('/circles/invitations/mine').then(res => setInvites(res.data)).catch(() => {});
  }, []);

  async function answerInvite(inv: CircleInvite, accept: boolean) {
    setBusyInvite(inv.id);
    try {
      const remaining = invites.filter(i => i.id !== inv.id);
      if (accept) {
        const { data } = await api.post(`/circles/invitations/${inv.id}/accept`);
        setInviteMsg(data.pending
          ? `Demande envoyée : les membres de « ${inv.circle.name} » doivent encore valider ton arrivée.`
          : `Bienvenue dans « ${inv.circle.name} » !`);
        onInvitationsChanged(remaining.length, data.pending ? undefined : inv.circle.id);
      } else {
        await api.delete(`/circles/invitations/${inv.id}`);
        onInvitationsChanged(remaining.length);
      }
      setInvites(remaining);
    } finally {
      setBusyInvite(null);
    }
  }

  const requests = circles.filter(c => (c.joinRequests?.length ?? 0) > 0);
  const clearable = plansWithNews.length > 0 || history.length > 0;
  const nothing = plansWithNews.length === 0 && requests.length === 0 && history.length === 0 && invites.length === 0 && !inviteMsg;

  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="space-y-5 -mt-1">
        {clearable && (
          <div className="flex justify-end -mb-2">
            <button onClick={onClearAll} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              <Trash2 size={13} /> Tout effacer
            </button>
          </div>
        )}
        {nothing && <p className="text-sm text-slate-500 text-center py-6">Rien de nouveau pour l'instant.</p>}

        {inviteMsg && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{inviteMsg}</p>
        )}

        {invites.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Invitations</h3>
            <div className="space-y-1.5">
              {invites.map(inv => (
                <div key={inv.id} className="p-3 rounded-xl border border-indigo-200 bg-indigo-50 space-y-2">
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 text-sm text-slate-800">
                      <strong>@{inv.inviter.pseudo}</strong> t'invite à rejoindre le Cercle <strong>« {inv.circle.name} »</strong>
                      <span className="block text-xs text-slate-500">{inv.circle._count.members} membre{inv.circle._count.members > 1 ? 's' : ''}{inv.circle.description ? ` · ${inv.circle.description}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pl-7">
                    <button disabled={busyInvite === inv.id} onClick={() => answerInvite(inv, true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Check size={12} /> Accepter
                    </button>
                    <button disabled={busyInvite === inv.id} onClick={() => answerInvite(inv, false)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                      <X size={12} /> Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {plansWithNews.length > 0 && (
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">À voir</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {history.map(n => {
                const cfg = NOTIF_CONFIG[n.type];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => { onClose(); onOpenNotification(n); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 bg-white hover:bg-slate-50 text-left"
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
