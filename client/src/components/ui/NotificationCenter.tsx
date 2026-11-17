import { useEffect, useState } from 'react';
import { Check, ChevronRight, Mail, Trash2, UserPlus, X, MessageCircle, Users } from 'lucide-react';
import { Modal } from './Modal';
import { NOTIF_CONFIG, type AppNotification } from './NotificationToast';
import api from '../../services/api';
import type { Circle, Plan } from '../../types';
import { intlLocale, t } from '../../i18n';
import { Trans } from 'react-i18next';

// Panneau ouvert par la cloche de la barre latérale :
//  - Nouveautés dans tes Plans : onglets non consultés (serveur, `unseen`), donc aussi ce
//    qui s'est passé pendant que l'app était fermée ;
//  - Demandes pour rejoindre un Cercle en attente ;
//  - À voir : notifications reçues dans l'app, gardées sur l'appareil jusqu'à ce que ce
//    qu'elles concernent soit ouvert (DashboardPage, dismissHistory).
// Toucher une notification l'efface de la cloche ; « Tout effacer » vide les Plans et « À voir »
// (les invitations et demandes d'adhésion restent : elles attendent une réponse). Les pastilles
// des onglets ne changent pas : elles disparaissent quand l'onglet est consulté.

const SECTIONS = ['chat', 'infos', 'trajets', 'membres', 'votes', 'depenses', 'benevoles', 'taches', 'deroule', 'idees', 'fournisseurs', 'materiel'];
const sectionLabel = (s: string) => SECTIONS.includes(s) ? t(`notif.center.sections.${s}` as any) : s;

// Date et heure de chaque entrée (2026-11-13, demande de l'utilisateur) : « aujourd'hui, 14:32 », « hier, 09:10 »,
// sinon « 12 nov., 14:32 » (avec l'année si ce n'est pas l'année en cours)
function whenLabel(value: number | string | null | undefined): string {
  if (value == null) return '';
  const at = new Date(value);
  if (isNaN(at.getTime())) return '';
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(at);
  const day = (d: Date) => d.toDateString();
  const now = new Date();
  if (day(at) === day(now)) return t('notif.center.todayAt', { time });
  if (day(at) === day(new Date(now.getTime() - 86_400_000))) return t('notif.center.yesterdayAt', { time });
  const date = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(at);
  return `${date}, ${time}`;
}

const When = ({ at }: { at: number | string | null | undefined }) => {
  const label = whenLabel(at);
  return label ? <span className="text-[11px] text-slate-400 flex-shrink-0 mt-0.5 whitespace-nowrap">{label}</span> : null;
};

interface Props {
  circles: Circle[];
  /** Plans avec des onglets non vus, sans ceux effacés de la cloche (DashboardPage) */
  plansWithNews: Plan[];
  history: AppNotification[];
  onClose: () => void;
  /** tab : rubrique touchée dans la carte (sinon la première non vue) */
  onOpenPlan: (plan: Plan, tab?: string) => void;
  onOpenCircle: (circleId: string) => void;
  /** Discussion d'un Cercle avec des messages non lus */
  onOpenChat: (circleId: string) => void;
  onOpenNotification: (n: AppNotification) => void;
  /** « Tout effacer » : vide la cloche (sans toucher aux pastilles des onglets) */
  onClearAll: () => void;
  /** Invitation acceptée (Cercle rejoint, ou demande d'adhésion envoyée) ; nombre d'invitations restantes */
  onInvitationsChanged: (remaining: number, joinedCircleId?: string) => void;
}

interface CircleInvite {
  id: string;
  circle: { id: string; name: string; color: string | null; description: string | null; _count: { members: number } };
  inviter: { pseudo: string; firstName: string | null };
  createdAt?: string;
}

export function NotificationCenter({ circles, plansWithNews, history, onClose, onOpenPlan, onOpenCircle, onOpenChat, onOpenNotification, onClearAll, onInvitationsChanged }: Props) {
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
          ? t('notif.center.invitePending', { name: inv.circle.name })
          : t('notif.center.welcome', { name: inv.circle.name }));
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
  // Les notifications reçues d'un Plan qui a du nouveau sont montrées dans sa carte (ce qui s'est passé), pas en double plus bas
  const newsIds = new Set(plansWithNews.map(p => p.id));
  const historyOf = (planId: string) => history.filter(n => n.planId === planId && NOTIF_CONFIG[n.type]);
  const otherHistory = history.filter(n => !n.planId || !newsIds.has(n.planId));
  const chats = circles.filter(c => c.chatUnseen);
  const clearable = plansWithNews.length > 0 || history.length > 0 || chats.length > 0;
  const nothing = plansWithNews.length === 0 && requests.length === 0 && chats.length === 0 && history.length === 0 && invites.length === 0 && !inviteMsg;

  return (
    <Modal title={t('notif.center.title')} onClose={onClose}>
      <div className="space-y-5 -mt-1">
        {clearable && (
          <div className="flex justify-end -mb-2">
            <button onClick={onClearAll} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              <Trash2 size={13} /> {t('notif.center.clearAll')}
            </button>
          </div>
        )}
        {nothing && <p className="text-sm text-slate-500 text-center py-6">{t('notif.center.nothing')}</p>}

        {inviteMsg && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{inviteMsg}</p>
        )}

        {invites.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('notif.center.invitations')}</h3>
            <div className="space-y-1.5">
              {invites.map(inv => (
                <div key={inv.id} className="p-3 rounded-xl border border-indigo-200 bg-indigo-50 space-y-2">
                  <div className="flex items-start gap-3">
                    <Mail size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 text-sm text-slate-800">
                      <Trans i18nKey="notif.center.invitesYou" values={{ from: inv.inviter.pseudo, name: inv.circle.name }} components={{ b: <strong /> }} />
                      <span className="block text-xs text-slate-500">{t('notif.center.members', { count: inv.circle._count.members })}{inv.circle.description ? ` · ${inv.circle.description}` : ''}</span>
                    </div>
                    <When at={inv.createdAt} />
                  </div>
                  <div className="flex gap-2 pl-7">
                    <button disabled={busyInvite === inv.id} onClick={() => answerInvite(inv, true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Check size={12} /> {t('notif.center.accept')}
                    </button>
                    <button disabled={busyInvite === inv.id} onClick={() => answerInvite(inv, false)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                      <X size={12} /> {t('notif.center.refuse')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {plansWithNews.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('notif.center.plansNews')}</h3>
            <div className="space-y-2.5">
              {plansWithNews.map(p => {
                // Carte d'un Plan (refaite le 2026-11-17, « on ne voit pas grand-chose ») : titre en entier, ce qui s'est passé
                // (nouveaux messages et de qui, nouvelles réponses, notifications reçues), et une pastille par rubrique
                // qui ouvre directement la rubrique concernée
                const counts = p.unseenCounts;
                const events = historyOf(p.id).filter(n => n.type !== 'new_message' && n.type !== 'mention' || !counts?.chat).slice(0, 3);
                return (
                  <div key={p.id} className="rounded-xl border border-orange-200 bg-orange-50/40 overflow-hidden">
                    <button onClick={() => { onClose(); onOpenPlan(p); }} className="w-full flex items-start gap-3 p-3 text-left hover:bg-orange-50">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" aria-hidden />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold text-slate-900 leading-snug break-words">{p.title}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{p.circle?.name ?? t('notif.center.invitation')}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1 flex-shrink-0">
                        <When at={p.unseenAt} />
                        <ChevronRight size={16} className="text-slate-300" />
                      </span>
                    </button>
                    {(counts?.chat || counts?.membres || events.length > 0) && (
                      <ul className="px-3 pb-2 -mt-1 space-y-1 text-[13px] text-slate-700">
                        {counts?.chat && (
                          <li className="flex items-start gap-2"><MessageCircle size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                            <span>{t('notif.center.newMessages', { count: counts.chat.count, from: counts.chat.from.map(x => `@${x}`).join(', ') })}</span></li>
                        )}
                        {counts?.membres && (
                          <li className="flex items-start gap-2"><Users size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                            <span>{t('notif.center.newAnswers', { count: counts.membres.count, who: counts.membres.who.map(x => `@${x}`).join(', ') })}</span></li>
                        )}
                        {events.map(n => {
                          const cfg = NOTIF_CONFIG[n.type]!;
                          const Icon = cfg.icon;
                          return (
                            <li key={n.id} className="flex items-start gap-2"><Icon size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                              <span className="min-w-0 break-words">{cfg.body(n)}</span></li>
                          );
                        })}
                      </ul>
                    )}
                    {(p.unseen ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                        {(p.unseen ?? []).map(sec => (
                          <button key={sec} onClick={() => { onClose(); onOpenPlan(p, sec); }}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500 text-white hover:bg-orange-600">
                            {sectionLabel(sec)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {requests.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('notif.center.requests')}</h3>
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
                    <span className="text-slate-500">{t('notif.center.pending', { count: c.joinRequests!.length })}</span>
                  </span>
                  <When at={c.joinRequests!.reduce<string | null>((last, r) => (!last || r.createdAt > last ? r.createdAt : last), null)} />
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {chats.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('notif.center.chats')}</h3>
            <div className="space-y-1.5">
              {chats.map(c => (
                <button key={c.id} onClick={() => { onClose(); onOpenChat(c.id); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left">
                  <MessageCircle size={16} className="text-indigo-500 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="block font-medium text-slate-800 truncate">{c.name}</span>
                    {c.chatLast && <span className="block text-xs text-slate-500 truncate">{c.chatLast.author} : {c.chatLast.text}</span>}
                  </span>
                  <When at={c.chatLast?.at} />
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {otherHistory.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('notif.center.toSee')}</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {otherHistory.map(n => {
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
                    <When at={n.at} />
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
