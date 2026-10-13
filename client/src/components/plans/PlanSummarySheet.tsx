import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Calendar, Car, Check, Copy, HandHeart, Images, ListTodo, MapPin, PiggyBank, Receipt, ShoppingBasket, Users, X } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { shortDateTime } from '../../lib/dates';
import { publicOrigin } from '../../lib/siteUrl';

// « En bref » : synthèse du Plan vue par la personne (GET /plans/:id/summary, server/src/lib/planSummary.ts).
// Ouverte depuis la carte du Plan (PlanList) et la fiche du Plan (PlanDetail), pour « Je suis in » et
// « Peut-être ». Chaque ligne ouvre sa rubrique ; « Copier le résumé » copie un texte sans rien de
// personnel (date, lieu, qui vient, trajets, ce qui manque) avec le lien pour répondre sans compte.

type Ride =
  | { role: 'driver'; seatsFree: number; passengers: number; departure: string; departureAt: string | null }
  | { role: 'passenger'; driver: string; departure: string; departureAt: string | null }
  | { role: 'searching'; from: string }
  | { role: 'none'; offers: { driver: string; seatsFree: number }[] };

interface Summary {
  plan: { id: string; title: string; eventDate: string | null; endDate: string; location: string | null; importantInfo: string | null };
  /** null : liste des participants réservée (Mode annonce) */
  counts: { in: number; maybe: number; out: number; waitlist: number } | null;
  places?: { taken: number; max: number } | null;
  ride: Ride | null;
  rideOffers: { driver: string; seatsFree: number }[];
  bring: { mine: string[]; missing: string[] } | null;
  money: { owe: { to: string; amount: number; currency: string }[]; owed: { from: string; amount: number; currency: string }[] } | null;
  pot: { forWhom: string | null; currency: string; amount: number | null; status: 'none' | 'pledged' | 'paid' | 'received' } | null;
  shifts: { title: string; startsAt: string | null; endsAt: string | null }[];
  todo: { polls: number; matches: number };
  photos: number;
}

const money = (amount: number, currency: string) => amount.toLocaleString(intlLocale(), { style: 'currency', currency });
const time = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const longDate = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const dayDate = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(new Date(iso));
const list = (items: string[]) => (items.length > 3 ? [...items.slice(0, 3), '…'] : items).join(', ');

// « aujourd'hui », « demain », « dans 3 jours », « en cours »
function relativeDay(start: string, end: string): string | null {
  const now = new Date();
  if (new Date(start) <= now) return new Date(end) > now ? t('plan.summary.ongoing') : null;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date(start)) - day(now)) / 864e5);
  return days === 0 ? t('plan.summary.today') : new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' }).format(days, 'day');
}

type Row = { key: string; Icon: typeof Users; text: string; sub?: string; tab: string; tone?: 'warn' | 'good' };

function rows(s: Summary): Row[] {
  const out: Row[] = [];
  if (s.counts) {
    const who = t('plan.summary.who', { in: s.counts.in, maybe: s.counts.maybe, out: s.counts.out }) + (s.counts.waitlist ? t('plan.summary.whoWaiting', { count: s.counts.waitlist }) : '');
    out.push({ key: 'who', Icon: Users, text: who, tab: 'membres' });
  } else if (s.places) {
    out.push({ key: 'who', Icon: Users, text: t('plan.summary.places', { taken: s.places.taken, max: s.places.max }), tab: 'infos' });
  }
  if (s.plan.importantInfo) out.push({ key: 'info', Icon: AlertTriangle, text: s.plan.importantInfo, tab: 'infos', tone: 'warn' });
  const r = s.ride;
  if (r) {
    const departure = (place: string, at: string | null) => (at ? t('plan.summary.rideDeparture', { when: shortDateTime(at), place }) : place);
    if (r.role === 'driver') out.push({ key: 'ride', Icon: Car, text: r.seatsFree ? t('plan.summary.rideDriver', { count: r.seatsFree }) : t('plan.summary.rideDriverFull'), sub: departure(r.departure, r.departureAt), tab: 'trajets' });
    else if (r.role === 'passenger') out.push({ key: 'ride', Icon: Car, text: t('plan.summary.ridePassenger', { driver: r.driver }), sub: departure(r.departure, r.departureAt), tab: 'trajets' });
    else if (r.role === 'searching') out.push({ key: 'ride', Icon: Car, text: t('plan.summary.rideSearching', { from: r.from }), tab: 'trajets' });
    else out.push({ key: 'ride', Icon: Car, text: t('plan.summary.rideOffer', { count: r.offers[0].seatsFree, driver: r.offers[0].driver }), tab: 'trajets' });
  }
  if (s.bring?.mine.length) out.push({ key: 'bring', Icon: ShoppingBasket, text: t('plan.summary.bringMine', { items: list(s.bring.mine) }), tab: 'depenses' });
  if (s.bring?.missing.length) out.push({ key: 'missing', Icon: ShoppingBasket, text: t('plan.summary.bringMissing', { items: list(s.bring.missing) }), tab: 'depenses' });
  if (s.money) {
    for (const o of s.money.owe) out.push({ key: `owe-${o.to}-${o.currency}`, Icon: Receipt, text: t('plan.summary.owe', { amount: money(o.amount, o.currency), name: o.to }), tab: 'depenses', tone: 'warn' });
    for (const o of s.money.owed) out.push({ key: `owed-${o.from}-${o.currency}`, Icon: Receipt, text: t('plan.summary.owed', { amount: money(o.amount, o.currency), name: o.from }), tab: 'depenses' });
    if (!s.money.owe.length && !s.money.owed.length) out.push({ key: 'settled', Icon: Receipt, text: t('plan.summary.settled'), tab: 'depenses', tone: 'good' });
  }
  if (s.pot) {
    const head = s.pot.forWhom ? t('plan.summary.potFor', { name: s.pot.forWhom }) : t('plan.summary.pot');
    const amount = s.pot.amount != null ? money(s.pot.amount, s.pot.currency) : '';
    const sub = s.pot.status === 'none' ? t('plan.summary.potNone')
      : s.pot.status === 'pledged' ? t('plan.summary.potPledged', { amount })
      : s.pot.status === 'paid' ? t('plan.summary.potPaid', { amount })
      : t('plan.summary.potReceived', { amount });
    out.push({ key: 'pot', Icon: PiggyBank, text: head, sub, tab: 'cagnotte', tone: s.pot.status === 'none' || s.pot.status === 'pledged' ? 'warn' : undefined });
  }
  // Postes : le détail s'il n'y en a qu'un ; sinon le nombre et le prochain (pour ne pas allonger le résumé)
  const shiftWhen = (sh: Summary['shifts'][number]) => sh.startsAt ? `${shortDateTime(sh.startsAt)}${sh.endsAt ? ` – ${time(sh.endsAt)}` : ''}` : undefined;
  if (s.shifts.length === 1) {
    out.push({ key: 'shift', Icon: HandHeart, text: t('plan.summary.shift', { title: s.shifts[0].title }), sub: shiftWhen(s.shifts[0]), tab: 'benevoles' });
  } else if (s.shifts.length > 1) {
    const now = Date.now();
    const next = s.shifts.find(sh => sh.startsAt && new Date(sh.endsAt ?? sh.startsAt).getTime() >= now) ?? s.shifts.find(sh => sh.startsAt);
    const sub = next ? t('plan.summary.shiftNext', { title: next.title, when: shiftWhen(next) }) : t('plan.summary.shiftFirst', { title: s.shifts[0].title });
    out.push({ key: 'shifts', Icon: HandHeart, text: t('plan.summary.shiftsMany', { count: s.shifts.length }), sub, tab: 'benevoles' });
  }
  if (s.todo.polls) out.push({ key: 'polls', Icon: ListTodo, text: t('plan.summary.polls', { count: s.todo.polls }), tab: 'votes', tone: 'warn' });
  if (s.todo.matches) out.push({ key: 'matches', Icon: ListTodo, text: t('plan.summary.matches', { count: s.todo.matches }), tab: 'votes', tone: 'warn' });
  if (s.photos) out.push({ key: 'photos', Icon: Images, text: t('plan.summary.photos', { count: s.photos }), sub: t('plan.summary.erased', { date: dayDate(s.plan.endDate) }), tab: 'infos' });
  return out;
}

// Texte à partager : rien de personnel (ni comptes, ni trajet de la personne)
function shareText(s: Summary, link: string | null): string {
  const lines = [s.plan.title];
  if (s.plan.eventDate) lines.push(`📅 ${longDate(s.plan.eventDate)}`);
  if (s.plan.location) lines.push(`📍 ${s.plan.location}`);
  if (s.counts) lines.push(`✅ ${t('plan.summary.who', { in: s.counts.in, maybe: s.counts.maybe, out: s.counts.out })}`);
  else if (s.places) lines.push(`✅ ${t('plan.summary.places', { taken: s.places.taken, max: s.places.max })}`);
  if (s.plan.importantInfo) lines.push(`⚠️ ${s.plan.importantInfo}`);
  for (const o of s.rideOffers.slice(0, 2)) lines.push(`🚗 ${t('plan.summary.rideOffer', { count: o.seatsFree, driver: o.driver })}`);
  if (s.bring?.missing.length) lines.push(`🛒 ${t('plan.summary.bringMissing', { items: list(s.bring.missing) })}`);
  if (link) lines.push('', t('plan.summary.copyRespond'), link);
  return lines.join('\n');
}

export function PlanSummarySheet({ planId, onClose, onOpenTab }: { planId: string; onClose: () => void; onOpenTab: (tab: string) => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    let alive = true;
    api.get(`/plans/${planId}/summary`).then(r => { if (alive) setData(r.data); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [planId]);
  // Échap, et bouton retour Android (NativeChrome → DashboardPage) : fermer la fenêtre d'abord
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    const onBack = (e: Event) => { e.preventDefault(); onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('evly-back-plan', onBack);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('evly-back-plan', onBack); };
  }, []);

  async function copy() {
    if (!data) return;
    let link: string | null = null;
    try { link = `${publicOrigin()}/invitation?token=${(await api.post(`/plans/${planId}/guest-link`)).data.token}`; } catch { /* texte sans lien */ }
    try { await navigator.clipboard.writeText(shareText(data, link)); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* presse-papiers refusé */ }
  }

  const when = data?.plan.eventDate ? relativeDay(data.plan.eventDate, data.plan.endDate) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-indigo-600 rounded-t-3xl sm:rounded-3xl p-4 pb-[calc(1rem+var(--sa-bottom,0px))] sm:pb-4 max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-1 pb-3 text-white">
          <span className="font-semibold">{t('plan.summary.title')}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15" aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="bg-white rounded-2xl overflow-y-auto">
          {error ? (
            <p className="p-6 text-sm text-red-600 text-center">{t('plan.summary.error')}</p>
          ) : !data ? (
            <p className="p-6 text-sm text-slate-400 text-center">{t('common.loading')}</p>
          ) : (
            <>
              <div className="p-5 pb-3">
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{data.plan.title}</h3>
                <div className="mt-1.5 space-y-1 text-sm text-slate-600">
                  {data.plan.eventDate && (
                    <p className="flex items-start gap-2"><Calendar size={15} className="mt-0.5 flex-shrink-0 text-indigo-500" />
                      <span><span className="first-letter:uppercase inline-block">{longDate(data.plan.eventDate)}</span>{when && <span className="ml-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{when}</span>}</span>
                    </p>
                  )}
                  {data.plan.location && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.plan.location)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:text-indigo-600">
                      <MapPin size={15} className="mt-0.5 flex-shrink-0 text-indigo-500" /><span className="underline decoration-slate-300 underline-offset-2">{data.plan.location}</span>
                    </a>
                  )}
                </div>
              </div>
              <ul className="px-3 pb-3">
                {rows(data).map(({ key, Icon, text, sub, tab, tone }) => (
                  <li key={key}>
                    <button onClick={() => onOpenTab(tab)} className="w-full flex items-start gap-3 px-2 py-2.5 border-t border-slate-100 text-left rounded-lg hover:bg-slate-50 active:bg-slate-100">
                      <Icon size={18} className={`mt-0.5 flex-shrink-0 ${tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-indigo-500'}`} />
                      <span className="min-w-0">
                        <span className={`block text-sm ${tone === 'warn' ? 'text-slate-900 font-semibold' : 'text-slate-800'}`}>{text}</span>
                        {sub && <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {data && (
          <div className="pt-3">
            <button onClick={copy} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-indigo-700 font-semibold active:bg-indigo-50">
              {copied ? <Check size={18} /> : <Copy size={18} />}{copied ? t('plan.summary.copied') : t('plan.summary.copy')}
            </button>
            <p className="text-center text-xs text-white/80 mt-2">{t('plan.summary.copyHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
