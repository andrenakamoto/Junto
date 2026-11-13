import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, CalendarDays, ChevronRight, ClipboardList, Gauge, Landmark, Megaphone, RefreshCw, Settings, UserPlus, Users, Vote, Wallet, Package,
} from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useResync } from '../../hooks/useResync';
import { AnnouncementModal } from './AnnouncementModal';
import { OrganisationModal } from './OrganisationModal';
import { EquipmentBookModal } from '../plans/EquipmentBookModal';

// Cockpit d'une Organisation (2026-11-13) : direction et administrateurs. À traiter, agenda de 14 jours, santé des
// équipes, annonces, tâches en retard, paiements des fournisseurs, et le résumé du lundi par email.
// Serveur : GET /organisations/:id/cockpit (lib/cockpit.ts). Seulement des Plans que la personne voit déjà, et des
// chiffres par équipe (pas de suivi individuel).

type Status = 'ok' | 'watch' | 'quiet';
interface Cockpit {
  organisation: { id: string; name: string };
  isAdmin: boolean;
  digest: boolean;
  myCircleIds: string[];
  todo: {
    joinRequests: { id: string; circleId: string; circleName: string | null; createdAt: string; user: { pseudo: string; firstName: string | null } }[];
    noRole: { circleId: string; circleName: string; count: number }[];
    noResponsible: { circleId: string; circleName: string }[];
    pollsEnding: { id: string; circleId: string; circleName: string | null; question: string; expiresAt: string }[];
    lowAnswers: { planId: string; title: string; circleId: string; circleName: string | null; eventDate: string | null; pending: number; answered: number }[];
  };
  agenda: {
    id: string; title: string; eventDate: string | null; endDate: string; circleId: string; circleName: string | null; circles: number;
    coming: number; maybe: number; max: number | null; occupied: number; waitlist: number; pending: number; shiftsMissing: number; assembly: boolean; full: boolean;
  }[];
  teams: { id: string; name: string; color: string | null; orgKind: string | null; members: number; newMembers: number; upcoming: number; lastActivityAt: string | null; responseRate: number | null; status: Status }[];
  communication: { announcementId: string; content: string; createdAt: string; author: string; circles: string[]; reach: number }[];
  tasks: { overdue: number; items: { id: string; planId: string; circleId: string; planTitle: string; title: string; dueDate: string }[] };
  equipment: {
    items: number;
    late: { bookingId: string; itemName: string; quantity: number; endsAt: string; planId: string | null; planTitle: string; circleId: string; holder: string | null }[];
    conflicts: { itemId: string; itemName: string; shortBy: number; startsAt: string; plans: { planId: string | null; planTitle: string; circleId: string; quantity: number }[] }[];
    repair: { id: string; name: string; status: string }[];
  } | null;
  suppliers: { planId: string; circleId: string; planTitle: string; name: string; kind: 'deposit' | 'balance'; due: string; amount: number; currency: string; late: boolean }[] | null;
}

const STATUS_STYLE: Record<Status, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-700',
  quiet: 'bg-red-100 text-red-700',
};
const STATUS_DOT: Record<Status, string> = { ok: 'bg-emerald-500', watch: 'bg-amber-500', quiet: 'bg-red-500' };

const dateTime = (iso: string | null) => iso
  ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '';
const dayOnly = (ymd: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(`${ymd}T12:00:00`));
const money = (n: number, cur: string) => new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: cur, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
function ago(iso: string | null): string {
  if (!iso) return t('org.cockpit.never');
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return t('org.cockpit.lastActivity', { when: days < 1 ? t('org.cockpit.today') : t('org.cockpit.daysAgo', { count: days }) });
}

export function CockpitView({ organisationId, onBack, onOpenPlan, onOpenCircle, onOpenPoll }: {
  organisationId: string;
  onBack: () => void;
  onOpenPlan: (planId: string, circleId: string, tab?: string) => void;
  onOpenCircle: (circleId: string) => void;
  onOpenPoll: (circleId: string, pollId: string) => void;
}) {
  const [data, setData] = useState<Cockpit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [manage, setManage] = useState<null | 'circles' | 'people'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gear, setGear] = useState<null | 'all' | 'out'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/organisations/${organisationId}/cockpit`);
      setData(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.retryError'));
    } finally {
      setLoading(false);
    }
  }, [organisationId]);
  useEffect(() => { setData(null); load(); }, [load]);
  useResync(load);
  // Un Cercle de l'Organisation change (Plan, réponse, demande…) : rechargé, regroupé sur 1,5 s
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const orgCircles = useRef(new Set<string>());
  orgCircles.current = new Set(data?.teams.map(x => x.id) ?? []);
  useSocketEvent<{ circleId: string }>('circle-updated', ({ circleId }) => {
    if (!orgCircles.current.has(circleId)) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(load, 1500);
  });

  const mine = new Set(data?.myCircleIds ?? []);
  // Ouvrir un Cercle dont on n'est pas membre : on l'explique (« Gérer » pour l'intégrer)
  const openCircle = (circleId: string) => {
    if (mine.has(circleId)) onOpenCircle(circleId);
    else { setNotice(circleId); window.setTimeout(() => setNotice(n => (n === circleId ? null : n)), 4000); }
  };

  async function toggleDigest(enabled: boolean) {
    if (!data) return;
    setData({ ...data, digest: enabled });
    try { await api.put(`/organisations/${organisationId}/cockpit/digest`, { enabled }); }
    catch { setData(d => (d ? { ...d, digest: !enabled } : d)); }
  }

  const todo = data?.todo;
  const requestsByCircle = new Map<string, { circleId: string; circleName: string | null; names: string[] }>();
  for (const r of todo?.joinRequests ?? []) {
    const g = requestsByCircle.get(r.circleId) ?? { circleId: r.circleId, circleName: r.circleName, names: [] };
    g.names.push(r.user.firstName ? `${r.user.firstName} (@${r.user.pseudo})` : `@${r.user.pseudo}`);
    requestsByCircle.set(r.circleId, g);
  }
  const todoCount = todo ? requestsByCircle.size + todo.noResponsible.length + todo.noRole.length + todo.pollsEnding.length + todo.lowAnswers.length : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
      <header className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <button onClick={onBack} className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={t('org.cockpit.back')}><ArrowLeft size={18} /></button>
        <Gauge size={20} className="text-indigo-600 flex-shrink-0" />
        <h1 className="flex-1 min-w-0 truncate text-lg font-bold text-slate-900">{t('org.cockpit.title')}{data ? ` · ${data.organisation.name}` : ''}</h1>
        <button onClick={() => setAnnounce(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Megaphone size={14} />{t('org.cockpit.newAnnouncement')}</button>
        <button onClick={() => setManage('circles')} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Settings size={14} />{t('org.block.manageShort')}</button>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50" title={t('org.cockpit.refresh')} aria-label={t('org.cockpit.refresh')}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
        {!data ? (!error && <p className="text-sm text-slate-400">…</p>) : (
          <div className="max-w-6xl mx-auto space-y-5">
            <div className="flex sm:hidden gap-2">
              <button onClick={() => setAnnounce(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"><Megaphone size={14} />{t('org.cockpit.newAnnouncement')}</button>
              <button onClick={() => setManage('circles')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"><Settings size={14} />{t('org.block.manageShort')}</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* À traiter */}
              <Card icon={<AlertTriangle size={16} />} title={t('org.cockpit.todo')} count={todoCount} accent={todoCount > 0}>
                {todoCount === 0 && <Empty text={t('org.cockpit.todoEmpty')} />}
                {[...requestsByCircle.values()].map(g => (
                  <Row key={`jr-${g.circleId}`} icon={<UserPlus size={15} className="text-amber-600" />} onClick={() => openCircle(g.circleId)}
                    title={`${t('org.cockpit.joinRequests', { count: g.names.length })} · ${g.circleName ?? ''}`} sub={g.names.join(', ')}
                    note={notice === g.circleId ? t('org.cockpit.notMember') : undefined} />
                ))}
                {todo!.noResponsible.map(x => (
                  <Row key={`nr-${x.circleId}`} icon={<Users size={15} className="text-amber-600" />} onClick={() => setManage('people')} title={`${t('org.cockpit.noResponsible')} · ${x.circleName}`} />
                ))}
                {todo!.noRole.map(x => (
                  <Row key={`nro-${x.circleId}`} icon={<Users size={15} className="text-slate-500" />} onClick={() => setManage('people')} title={`${t('org.cockpit.noRole', { count: x.count })} · ${x.circleName}`} />
                ))}
                {todo!.pollsEnding.map(p => (
                  <Row key={`p-${p.id}`} icon={<Vote size={15} className="text-indigo-500" />} onClick={() => mine.has(p.circleId) ? onOpenPoll(p.circleId, p.id) : openCircle(p.circleId)}
                    title={p.question} sub={`${t('org.cockpit.pollEnding')} · ${p.circleName ?? ''} · ${dateTime(p.expiresAt)}`} note={notice === p.circleId ? t('org.cockpit.notMember') : undefined} />
                ))}
                {todo!.lowAnswers.map(p => (
                  <Row key={`la-${p.planId}`} icon={<CalendarDays size={15} className="text-amber-600" />} onClick={() => onOpenPlan(p.planId, p.circleId, 'membres')}
                    title={p.title} sub={`${dateTime(p.eventDate)} · ${t('org.cockpit.lowAnswers', { pending: p.pending, answered: p.answered })}`} />
                ))}
              </Card>

              {/* Agenda */}
              <Card icon={<CalendarDays size={16} />} title={t('org.cockpit.agenda')} count={data.agenda.length}>
                {data.agenda.length === 0 && <Empty text={t('org.cockpit.agendaEmpty')} />}
                {data.agenda.map(p => (
                  <Row key={p.id} icon={p.assembly ? <Landmark size={15} className="text-indigo-500" /> : <CalendarDays size={15} className="text-slate-400" />}
                    onClick={() => onOpenPlan(p.id, p.circleId)} title={p.title}
                    sub={[dateTime(p.eventDate ?? p.endDate), p.circleName, p.circles > 1 ? t('org.cockpit.circles', { count: p.circles }) : null].filter(Boolean).join(' · ')}
                    tags={[
                      <Tag key="in" className="bg-emerald-50 text-emerald-700">{t('org.cockpit.coming', { count: p.coming })}</Tag>,
                      p.maybe > 0 && <Tag key="m" className="bg-amber-50 text-amber-700">{t('org.cockpit.maybe', { count: p.maybe })}</Tag>,
                      p.pending > 0 && <Tag key="p" className="bg-slate-100 text-slate-600">{t('org.cockpit.pending', { count: p.pending })}</Tag>,
                      p.max !== null && <Tag key="pl" className={p.full ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}>{p.full ? t('org.cockpit.full') : t('org.cockpit.places', { occupied: p.occupied, max: p.max })}</Tag>,
                      p.waitlist > 0 && <Tag key="w" className="bg-amber-50 text-amber-700">{t('org.cockpit.waitlist', { count: p.waitlist })}</Tag>,
                      p.shiftsMissing > 0 && <Tag key="s" className="bg-red-50 text-red-700">{t('org.cockpit.shifts', { count: p.shiftsMissing })}</Tag>,
                      p.assembly && <Tag key="a" className="bg-indigo-50 text-indigo-700">{t('org.cockpit.assembly')}</Tag>,
                    ]} />
                ))}
              </Card>
            </div>

            {/* Équipes */}
            <Card icon={<Users size={16} />} title={t('org.cockpit.teams')} count={data.teams.length} hint={t('org.cockpit.statusHint')}>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {data.teams.map(team => (
                  <button key={team.id} onClick={() => openCircle(team.id)} className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                    <span className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[team.status]}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{team.name}</span>
                        {team.orgKind && <span className="block text-[11px] text-slate-400">{t(`org.cockpit.kinds.${team.orgKind}` as any)}</span>}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[team.status]}`}>{t(`org.cockpit.status.${team.status}` as any)}</span>
                    </span>
                    <span className="block mt-2 text-xs text-slate-600 leading-relaxed">
                      {t('org.cockpit.teamMembers', { count: team.members })}{team.newMembers > 0 ? ` (${t('org.cockpit.newMembers', { count: team.newMembers })})` : ''}
                      {' · '}{team.upcoming > 0 ? t('org.cockpit.upcoming', { count: team.upcoming }) : t('org.cockpit.noUpcoming')}
                      {team.responseRate !== null ? ` · ${t('org.cockpit.responseRate', { rate: team.responseRate })}` : ''}
                      <span className="block text-slate-400">{ago(team.lastActivityAt)}</span>
                    </span>
                    {notice === team.id && <span className="block mt-1 text-[11px] text-amber-700">{t('org.cockpit.notMember')}</span>}
                  </button>
                ))}
              </div>
            </Card>

            <div className={`grid gap-5 ${data.suppliers ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {/* Annonces */}
              <Card icon={<Megaphone size={16} />} title={t('org.cockpit.communication')}>
                {data.communication.length === 0 && <Empty text={t('org.cockpit.communicationEmpty')} />}
                {data.communication.map(a => (
                  <div key={a.announcementId} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm text-slate-800 line-clamp-3 whitespace-pre-wrap break-words">{a.content}</p>
                    <p className="mt-1 text-[11px] text-slate-400">@{a.author} · {dateTime(a.createdAt)} · {a.circles.join(', ')} · {t('org.cockpit.reach', { count: a.reach })}</p>
                  </div>
                ))}
                <button onClick={() => setAnnounce(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"><Megaphone size={14} />{t('org.cockpit.newAnnouncement')}</button>
              </Card>

              {/* Tâches en retard */}
              <Card icon={<ClipboardList size={16} />} title={t('org.cockpit.tasks')} count={data.tasks.overdue} accent={data.tasks.overdue > 0}>
                {data.tasks.overdue === 0 && <Empty text={t('org.cockpit.tasksEmpty')} />}
                {data.tasks.items.map(task => (
                  <Row key={task.id} icon={<ClipboardList size={15} className="text-red-500" />} onClick={() => onOpenPlan(task.planId, task.circleId, 'taches')}
                    title={task.title} sub={`${task.planTitle} · ${t('org.cockpit.due', { date: dayOnly(task.dueDate) })}`} />
                ))}
              </Card>

              {/* Paiements des fournisseurs (administrateurs et droit « voir les montants ») */}
              {data.suppliers && (
                <Card icon={<Wallet size={16} />} title={t('org.cockpit.suppliers')} count={data.suppliers.length}>
                  {data.suppliers.length === 0 && <Empty text={t('org.cockpit.suppliersEmpty')} />}
                  {data.suppliers.map((s, i) => (
                    <Row key={i} icon={<Wallet size={15} className={s.late ? 'text-red-500' : 'text-slate-400'} />} onClick={() => onOpenPlan(s.planId, s.circleId, 'fournisseurs')}
                      title={`${s.name} · ${t(s.kind === 'deposit' ? 'org.cockpit.deposit' : 'org.cockpit.balance')} ${money(s.amount, s.currency)}`}
                      sub={`${s.planTitle} · ${dayOnly(s.due)}${s.late ? ` · ${t('org.cockpit.late')}` : ''}`} />
                  ))}
                </Card>
              )}
            </div>

            {/* Matériel de l'Organisation : pas rendu, conflits, en réparation */}
            {data.equipment && (
              <Card icon={<Package size={16} />} title={t('equipment.cockpit.title')} count={data.equipment.late.length + data.equipment.conflicts.length}
                accent={data.equipment.late.length + data.equipment.conflicts.length > 0}>
                <p className="text-xs text-slate-500 px-1">{t('equipment.cockpit.items', { count: data.equipment.items })}</p>
                {data.equipment.late.length + data.equipment.conflicts.length + data.equipment.repair.length === 0 && <Empty text={t('equipment.cockpit.ok')} />}
                {data.equipment.late.length > 0 && <p className="text-xs font-semibold text-slate-600 px-1 pt-1">{t('equipment.cockpit.late')}</p>}
                {data.equipment.late.map(x => (
                  <Row key={x.bookingId} icon={<Package size={15} className="text-red-500" />} onClick={() => setGear('out')}
                    title={`${x.quantity > 1 ? `${x.quantity} × ` : ''}${x.itemName}`} sub={`${x.holder ?? '?'} · « ${x.planTitle} » · ${dateTime(x.endsAt)}`} />
                ))}
                {data.equipment.conflicts.length > 0 && <p className="text-xs font-semibold text-slate-600 px-1 pt-1">{t('equipment.cockpit.conflicts')}</p>}
                {data.equipment.conflicts.map((x, i) => (
                  <Row key={`${x.itemId}-${i}`} icon={<AlertTriangle size={15} className="text-amber-600" />}
                    onClick={() => { const p = x.plans.find(pl => pl.planId); if (p?.planId) onOpenPlan(p.planId, p.circleId, 'materiel'); }}
                    title={`${x.itemName} · ${t('equipment.cockpit.shortBy', { count: x.shortBy })}`}
                    sub={`${dateTime(x.startsAt)} · ${x.plans.map(pl => `« ${pl.planTitle} » (${pl.quantity})`).join(', ')}`} />
                ))}
                {data.equipment.repair.length > 0 && <p className="text-xs font-semibold text-slate-600 px-1 pt-1">{t('equipment.cockpit.repair')}</p>}
                {data.equipment.repair.map(x => (
                  <Row key={x.id} icon={<Package size={15} className="text-slate-400" />} onClick={() => setGear('all')} title={x.name} sub={t(`equipment.inventory.statuses.${x.status}` as any)} />
                ))}
                {data.myCircleIds.length > 0 && (
                  <button onClick={() => setGear('all')} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"><Package size={14} />{t('equipment.cockpit.open')}</button>
                )}
              </Card>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
              <input type="checkbox" checked={data.digest} onChange={e => toggleDigest(e.target.checked)} className="mt-0.5 accent-indigo-600" />
              <span>
                <span className="block text-sm font-medium text-slate-800">{t('org.cockpit.digest')}</span>
                <span className="block text-xs text-slate-500">{t('org.cockpit.digestHint')}</span>
              </span>
            </label>
            <p className="text-xs text-slate-400 text-center pb-4">{t('org.cockpit.privacy')}</p>
          </div>
        )}
      </div>

      {announce && <AnnouncementModal organisationId={organisationId} onClose={() => { setAnnounce(false); load(); }} />}
      {gear && data && data.myCircleIds.length > 0 && <EquipmentBookModal circleId={data.myCircleIds[0]} initialFilter={gear} onClose={() => { setGear(null); load(); }} />}
      {manage && <OrganisationModal organisationId={organisationId} initialTab={manage} onClose={() => { setManage(null); load(); }} />}
    </div>
  );
}

function Card({ icon, title, count, accent, hint, children }: { icon: ReactNode; title: string; count?: number; accent?: boolean; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-100/60 p-3 md:p-4 space-y-2 min-w-0">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <span className="text-indigo-600">{icon}</span>{title}
        {count !== undefined && count > 0 && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${accent ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{count}</span>}
      </h2>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function Row({ icon, title, sub, tags, note, onClick }: { icon: ReactNode; title: string; sub?: string; tags?: ReactNode[]; note?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-800 break-words">{title}</span>
        {sub && <span className="block text-xs text-slate-500 break-words">{sub}</span>}
        {tags && tags.some(Boolean) && <span className="flex flex-wrap gap-1 mt-1.5">{tags}</span>}
        {note && <span className="block mt-1 text-[11px] text-amber-700">{note}</span>}
      </span>
      <ChevronRight size={15} className="text-slate-300 flex-shrink-0 mt-0.5" />
    </button>
  );
}

const Tag = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${className}`}>{children}</span>
);

const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500 px-1 py-2">{text}</p>;
