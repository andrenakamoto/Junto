import { useEffect, useRef, useState } from 'react';
import { Bus, TrainFront, TramFront, Ship, Footprints, MapPin, Moon, Users, Loader2, X, ChevronDown, Home, Landmark } from 'lucide-react';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';
import { displayName } from '../../lib/names';

// « En transports publics » (rubrique Trajets) : chacun choisit ses arrêts de départ et d'arrivée, voit les
// correspondances pour arriver à l'heure et le dernier retour de la nuit, et peut proposer de voyager
// ensemble (routes/transit.ts). Horaires de tous les transports publics suisses, bus et trams compris.

type Stop = { id: string; name: string; kind?: string | null };
type Leg = { kind: 'walk' | 'bus' | 'tram' | 'train' | 'boat' | 'other'; line: string | null; direction: string | null; from: string; to: string; platform: string | null; departureAt: string | null; arrivalAt: string | null; walkMinutes: number | null };
type Connection = { departureAt: string; arrivalAt: string; minutes: number; transfers: number; legs: Leg[] };
type Person = { id: string; pseudo: string; firstName?: string | null };
type Group = { id: string; creator: Person; fromName: string; toName: string; departureAt: string; arrivalAt: string; lines: string; platform: string | null; note: string | null; legs: Leg[] | null; members: { userId: string; user: Person }[] };
type State = { from: Stop | null; to: Stop | null; home: Stop | null; location: string | null; eventDate: string | null; groups: Group[] };

const time = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const who = (p: Person) => displayName(p) || `@${p.pseudo}`;

// Moyen de transport d'un texte de lignes (« Tram 15 › Bus 11 ») : celui de la première
function kindOfLines(lines: string): Leg['kind'] {
  const first = lines.split('›')[0].trim();
  if (first.startsWith('Bus')) return 'bus';
  if (first.startsWith('Tram')) return 'tram';
  if (/^(BAT|FAE)\b/.test(first)) return 'boat';
  return 'train';
}

function LegIcon({ kind, size = 13 }: { kind: Leg['kind']; size?: number }) {
  const Icon = kind === 'tram' ? TramFront : kind === 'train' ? TrainFront : kind === 'boat' ? Ship : kind === 'walk' ? Footprints : Bus;
  return <Icon size={size} className="flex-shrink-0" />;
}

function StopPicker({ planId, label, value, initialQuery, onChange }: { planId: string; label: string; value: Stop | null; initialQuery?: string; onChange: (s: Stop | null) => void }) {
  const [editing, setEditing] = useState(!value);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Stop[]>([]);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number>();
  useEffect(() => { if (!value) setEditing(true); }, [value]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    // Sans saisie, au toucher du champ : arrêts proches du lieu du Plan
    const query = q.trim() || (focused && !value ? initialQuery ?? '' : '');
    if (query.length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(() => {
      api.get(`/plans/${planId}/transit/stops`, { params: { q: query } }).then(r => setResults(r.data)).catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(timer.current);
  }, [q, focused, value, initialQuery, planId]);

  if (!editing && value) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
        <span className="flex-1 min-w-0 flex items-start gap-1.5 text-sm font-medium text-slate-800 break-words"><MapPin size={13} className="text-indigo-500 flex-shrink-0 mt-0.5" /><span className="min-w-0">{value.name}</span></span>
        <button onClick={() => { setEditing(true); setQ(''); }} className="text-xs text-indigo-600 hover:underline flex-shrink-0">{t('plan.transit.change')}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('plan.transit.search')}
          onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 200)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {value && <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={14} /></button>}
      </div>
      {results.length > 0 && (q.trim() || focused) && (
        <div className="mt-1 ml-[6.5rem] bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {results.map(s => (
            <button key={s.id} onClick={() => { onChange({ id: s.id, name: s.name }); setEditing(false); setQ(''); setResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2 border-b border-slate-100 last:border-0">
              {s.kind === 'address' ? <Home size={13} className="flex-shrink-0" /> : s.kind === 'poi' ? <Landmark size={13} className="flex-shrink-0" />
                : <LegIcon kind={s.kind === 'tram' ? 'tram' : s.kind === 'train' ? 'train' : s.kind === 'ship' ? 'boat' : 'bus'} />}{s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Étapes d'un trajet : chaque ligne avec sa montée (heure, arrêt, quai) et sa descente, et les bouts à pied
function LegSteps({ legs }: { legs: Leg[] }) {
  return (
    <ol className="mt-2 space-y-2 border-l-2 border-slate-200 ml-1.5 pl-3">
      {legs.map((l, i) => l.kind === 'walk' ? (
        <li key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
          <Footprints size={12} className="flex-shrink-0" />
          {l.to ? t('plan.transit.walkTo', { count: l.walkMinutes ?? 1, to: l.to }) : t('plan.transit.walk', { count: l.walkMinutes ?? 1 })}
        </li>
      ) : (
        <li key={i} className="text-xs text-slate-700">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-800"><LegIcon kind={l.kind} size={12} />{l.line}</span>
            {l.direction && <span className="text-slate-500">{t('plan.transit.towards', { dir: l.direction })}</span>}
          </p>
          <p className="mt-1"><span className="font-semibold tabular-nums">{l.departureAt ? time(l.departureAt) : ''}</span> {l.from}{l.platform ? <span className="text-slate-500"> · {t('plan.transit.platform', { p: l.platform })}</span> : null}</p>
          <p><span className="font-semibold tabular-nums">{l.arrivalAt ? time(l.arrivalAt) : ''}</span> {l.to}</p>
        </li>
      ))}
    </ol>
  );
}

function StepsToggle({ legs }: { legs: Leg[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(o => !o)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />{open ? t('plan.transit.hideSteps') : t('plan.transit.steps')}
      </button>
      {open && <LegSteps legs={legs} />}
    </>
  );
}

function ConnectionLine({ c }: { c: Connection }) {
  const rides = c.legs.filter(l => l.kind !== 'walk');
  const firstRide = rides[0];
  const walk = c.legs[0]?.kind === 'walk' ? c.legs[0].walkMinutes : null;
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-800">
        {time(c.departureAt)} → {time(c.arrivalAt)}
        <span className="font-normal text-slate-500"> · {t('plan.transit.duration', { count: c.minutes })} · {c.transfers ? t('plan.transit.transfers', { count: c.transfers }) : t('plan.transit.direct')}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        {rides.map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700"><LegIcon kind={l.kind} size={12} />{l.line}</span>
        ))}
        {firstRide && <span className="text-xs text-slate-500">{firstRide.from}{firstRide.platform ? ` · ${t('plan.transit.platform', { p: firstRide.platform })}` : ''}</span>}
        {walk ? <span className="text-xs text-slate-400">· {t('plan.transit.walk', { count: walk })}</span> : null}
      </div>
      {c.legs.length > 1 && <StepsToggle legs={c.legs} />}
    </div>
  );
}

export function TransitSection({ planId, userId, isAbsent, reloadKey }: { planId: string; userId: string; isAbsent: boolean; reloadKey?: unknown }) {
  const [state, setState] = useState<State | null>(null);
  const [conns, setConns] = useState<{ go: Connection[]; last: Connection | null; noDate?: boolean } | null>(null);
  const [loadingConns, setLoadingConns] = useState(false);
  const [error, setError] = useState('');
  const [proposing, setProposing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [remember, setRemember] = useState(false);

  // Départ mémorisé : repris tout seul dans un Plan où la personne n'a pas encore choisi de départ (une fois par ouverture)
  const homeApplied = useRef(false);
  async function load() {
    try {
      const { data } = await api.get(`/plans/${planId}/transit`);
      if (!data.from && data.home && !homeApplied.current) {
        homeApplied.current = true;
        await api.put(`/plans/${planId}/transit/me`, { from: data.home });
        data.from = data.home;
      }
      setState(data);
      setRemember(!!data.home && !!data.from && data.home.id === data.from.id);
    } catch { setState(null); }
  }
  useEffect(() => { load(); }, [planId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromId = state?.from?.id, toId = state?.to?.id;
  useEffect(() => {
    if (!fromId || !toId) { setConns(null); return; }
    setLoadingConns(true); setError('');
    api.get(`/plans/${planId}/transit/connections`).then(r => setConns(r.data)).catch(() => setError(t('plan.transit.unavailable'))).finally(() => setLoadingConns(false));
  }, [planId, fromId, toId]);

  if (!state || isAbsent) return null;

  async function save(patch: { from?: Stop | null; to?: Stop | null }, rememberIt?: boolean) {
    const body: any = { ...patch };
    if (rememberIt !== undefined) body.remember = rememberIt;
    await api.put(`/plans/${planId}/transit/me`, body);
    await load();
  }

  async function propose(c: Connection) {
    try {
      await api.post(`/plans/${planId}/transit/groups`, { connection: c, note });
      setProposing(null); setNote('');
      await load();
    } catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); }
  }

  async function toggleJoin(g: Group, mine: boolean) {
    try {
      if (mine) await api.delete(`/plans/transit-groups/${g.id}/join`); else await api.post(`/plans/transit-groups/${g.id}/join`);
      await load();
    } catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); }
  }

  return (
    <div className="mt-8">
      <h3 className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-1.5"><Bus size={15} className="text-indigo-500" />{t('plan.transit.title')}</h3>
      <p className="text-xs text-slate-500 mb-3">{t('plan.transit.intro')}</p>

      {/* Voyages partagés */}
      {state.groups.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Users size={12} />{t('plan.transit.groupsTitle')}</p>
          {state.groups.map(g => {
            const mine = g.members.some(m => m.userId === userId);
            return (
              <div key={g.id} className={`p-3 rounded-xl border ${mine ? 'bg-indigo-50/60 border-indigo-200' : 'bg-white border-slate-200'}`}>
                <p className="text-xs text-slate-500">{t('plan.transit.groupBy', { name: who(g.creator) })}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5"><span className="text-indigo-500"><LegIcon kind={kindOfLines(g.lines)} size={14} /></span>{g.lines}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {t('plan.transit.departure', { time: time(g.departureAt), from: g.fromName })}{g.platform ? ` · ${t('plan.transit.platform', { p: g.platform })}` : ''} · {t('plan.transit.arrival', { time: time(g.arrivalAt) })}
                </p>
                {g.legs && g.legs.length > 1 && <LegSteps legs={g.legs} />}
                {g.note && <p className="text-xs text-slate-500 mt-1 italic">{g.note}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {g.members.map(m => (
                    <span key={m.userId} className={`px-2 py-0.5 rounded-full text-xs ${m.userId === userId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{who(m.user)}</span>
                  ))}
                  <button onClick={() => toggleJoin(g, mine)}
                    className={`ml-auto px-3 py-1 rounded-lg text-xs font-semibold ${mine ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                    {mine ? t('plan.transit.leave') : t('plan.transit.join')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mes arrêts */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
        {!state.from && state.home && (
          <button onClick={() => save({ from: state.home }, true)} className="text-xs font-medium text-indigo-600 hover:underline">
            {t('plan.transit.useHome', { name: state.home.name })}
          </button>
        )}
        <StopPicker planId={planId} label={t('plan.transit.from')} value={state.from} onChange={s => save({ from: s }, remember ? true : undefined)} />
        {state.from && (
          <label className="flex items-center gap-2 text-xs text-slate-600 ml-[6.5rem]">
            <input type="checkbox" checked={remember} onChange={e => { setRemember(e.target.checked); save({ from: state.from }, e.target.checked); }} className="accent-indigo-600" />
            {t('plan.transit.remember')}
          </label>
        )}
        <StopPicker planId={planId} label={t('plan.transit.to')} value={state.to} initialQuery={state.location ?? undefined} onChange={s => save({ to: s })} />
        {!state.to && state.location && <p className="text-xs text-slate-500 ml-[6.5rem]">{t('plan.transit.placeHint', { place: state.location })}</p>}
      </div>

      {/* Correspondances */}
      {state.from && state.to && (
        <div className="mt-3 space-y-2">
          {loadingConns && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />{t('plan.transit.loading')}</p>}
          {conns?.noDate && <p className="text-xs text-slate-500">{t('plan.transit.noDate')}</p>}
          {conns && !conns.noDate && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('plan.transit.goTitle')}</p>
              {conns.go.length === 0 && <p className="text-xs text-slate-500">{t('plan.transit.none')}</p>}
              {conns.go.map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-slate-200">
                  <ConnectionLine c={c} />
                  {proposing === i ? (
                    <div className="mt-2 flex gap-2">
                      <input autoFocus value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder={t('plan.transit.notePlaceholder')}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white" />
                      <button onClick={() => propose(c)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">{t('plan.transit.proposeConfirm')}</button>
                      <button onClick={() => { setProposing(null); setNote(''); }} className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs">{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setProposing(i)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">{t('plan.transit.propose')}</button>
                  )}
                </div>
              ))}
              {conns.last && (
                <div className="px-1">
                  <p className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Moon size={12} className="text-indigo-500" />
                    {t('plan.transit.last', { to: state.from.name, time: time(conns.last.departureAt) })}
                    <span className="text-slate-400">({conns.last.legs.filter(l => l.kind !== 'walk').map(l => l.line).join(' › ')})</span>
                  </p>
                  {conns.last.legs.length > 1 && <StepsToggle legs={conns.last.legs} />}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <p className="mt-3 text-[11px] text-slate-400">{t('plan.transit.source')}</p>
    </div>
  );
}
