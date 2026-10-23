import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ChevronDown, ExternalLink, Flag, Megaphone, Search, SlidersHorizontal, Ticket, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { t } from '../../i18n';
import {
  CATEGORY_GROUPS, DiscoverData, DiscoverEvent, DiscoverPlace, DiscoverRegion, IDEAS, KIND_ORDER, REGIONS,
  catLabel, dayChips, dayKey, dayTitle, host, kindLabel, norm, regionLabel, savedRegion, saveRegion, shortDate, timeLabel,
} from '../../lib/discover';
import { DiscoverGoModal } from './DiscoverGoModal';
import { ProSoonModal } from './ProSoonModal';
import { ReportModal } from './ReportModal';

const MULTI = 'multi';
const LATER = 'later';
const ALL = 'all';

// « Découvrir » : événements publics et idées de sorties de Genève, Lausanne et du Valais. Dans l'app (colonne du
// tableau de bord) et sur la page publique /sorties (sans compte). Données : GET /api/discover (lib/discover/ du serveur).
export function DiscoverView({ mode, onBack }: { mode: 'app' | 'public'; onBack?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [region, setRegion] = useState<DiscoverRegion>(savedRegion);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(ALL);
  const [cat, setCat] = useState(ALL);
  const [q, setQ] = useState('');
  const [going, setGoing] = useState<DiscoverEvent | null>(null);
  const [reporting, setReporting] = useState<{ target: { eventId: string } | { placeId: string }; title: string } | null>(null);
  const [showPro, setShowPro] = useState(false);
  // Filtres repliés sur téléphone (sinon ils prennent tout l'écran avant le premier événement)
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    setData(null);
    setError(false);
    api.get<DiscoverData>('/discover', { params: { region, days: 14 } })
      .then(res => setData(res.data))
      .catch(() => setError(true));
  }, [region]);

  function chooseRegion(r: DiscoverRegion) { setRegion(r); saveRegion(r); setCat(ALL); }

  const chips = useMemo(() => dayChips(), [data]);
  const chipKeys = new Set(chips.map(c => c.key));
  const events = data?.events ?? [];
  const places = data?.places ?? [];
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const hit = (text: string) => terms.every(w => norm(text).includes(w));

  const has = (c: string) => c === IDEAS ? places.length > 0 : c === 'famille' ? events.some(e => e.family || e.category === c) || places.some(p => p.family) : events.some(e => e.category === c);
  const matchCat = (e: DiscoverEvent) => cat === ALL || e.category === cat || (cat === 'famille' && e.family);

  // Événements à afficher, rangés par jour (les événements sur plusieurs jours à part)
  const shown = events.filter(e => {
    if (searching) return hit([e.title, e.place, e.city, catLabel(e.category), e.priceText].join(' '));
    if (cat === IDEAS || !matchCat(e)) return false;
    if (day === ALL) return true;
    if (day === MULTI) return e.multiDay;
    const k = dayKey(e.startAt);
    if (e.multiDay) return day !== LATER && k <= day && dayKey(e.endAt ?? e.startAt) >= day;
    return day === LATER ? !chipKeys.has(k) : k === day;
  });
  const ideas = places.filter(p => searching
    ? hit([p.name, p.city, kindLabel(p.kind)].join(' '))
    : cat === IDEAS || (cat === 'famille' && p.family) || (cat === ALL && day === ALL));

  const multi = shown.filter(e => e.multiDay);
  const single = shown.filter(e => !e.multiDay);
  const byDay = new Map<string, DiscoverEvent[]>();
  for (const e of single) { const k = dayKey(e.startAt); byDay.set(k, [...(byDay.get(k) ?? []), e]); }

  const pill = (active: boolean) => `px-3 py-1.5 rounded-full border text-[13px] font-medium transition-colors ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`;

  function goWith(e: DiscoverEvent) {
    if (user) setGoing(e);
    else navigate(`/auth?redirect=${encodeURIComponent('/sorties')}`);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* En-tête */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="←">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 leading-tight">{t('discover.title')}</h2>
          <p className="text-xs text-slate-500 truncate">{t('discover.subtitle')}</p>
        </div>
        <button onClick={() => setShowPro(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100">
          <Megaphone size={14} /><span className="sm:hidden">{t('discover.post.short')}</span><span className="hidden sm:inline">{t('discover.post.button')}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {mode === 'public' && <p className="text-sm text-slate-600">{t('discover.public.intro')}</p>}

          {/* Région */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('discover.title')}>
            {REGIONS.map(r => <button key={r} onClick={() => chooseRegion(r)} aria-pressed={r === region} className={pill(r === region)}>{regionLabel(r)}</button>)}
          </div>

          {/* Recherche */}
          <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <span className="sr-only">{t('discover.searchLabel')}</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('discover.searchPlaceholder')}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none" />
          </label>

          {/* Avertissement */}
          <p className="flex gap-2 text-[13px] text-slate-600 bg-white border border-slate-200 border-l-4 border-l-indigo-500 rounded-xl px-3 py-2.5">
            <AlertTriangle size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <span><b className="font-semibold text-slate-800">{t('discover.warnTitle')}</b> {t('discover.warnText')}</span>
          </p>

          {/* Filtres */}
          {!searching && !filtersOpen && (
            <button onClick={() => setFiltersOpen(true)}
              className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-left">
              <SlidersHorizontal size={15} className="text-indigo-600 flex-shrink-0" />
              <span className="font-semibold text-slate-800">{t('discover.filters')}</span>
              <span className="flex-1 min-w-0 truncate text-slate-500">
                {[day === ALL ? t('discover.allDays') : day === MULTI ? t('discover.multi') : day === LATER ? t('discover.later') : chips.find(c => c.key === day)?.label,
                  cat === ALL ? t('discover.all') : catLabel(cat)].join(' · ')}
              </span>
              <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
            </button>
          )}
          {!searching && filtersOpen && (
            <div className="space-y-2">
              <div className="flex items-center">
                <p className="flex-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('discover.when')}</p>
                <button onClick={() => setFiltersOpen(false)} className="md:hidden text-xs font-medium text-indigo-700 flex items-center gap-1">
                  {t('discover.filters')}<ChevronDown size={14} className="rotate-180" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setDay(ALL)} className={pill(day === ALL)}>{t('discover.allDays')}</button>
                {chips.map(c => <button key={c.key} onClick={() => setDay(c.key)} className={pill(day === c.key)}>{c.label}</button>)}
                <button onClick={() => setDay(LATER)} className={pill(day === LATER)}>{t('discover.later')}</button>
                <button onClick={() => setDay(MULTI)} className={pill(day === MULTI)}>{t('discover.multi')}</button>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide pt-1">{t('discover.what')}</p>
              <div className="space-y-1.5">
                <button onClick={() => setCat(ALL)} className={pill(cat === ALL)}>{t('discover.all')}</button>
                {CATEGORY_GROUPS.map(([g, list]) => {
                  const avail = list.filter(has);
                  if (!avail.length) return null;
                  return (
                    <div key={g} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-full sm:w-24 text-xs text-slate-500">{t(`discover.groups.${g}` as any)}</span>
                      {avail.map(c => <button key={c} onClick={() => setCat(c)} className={pill(cat === c)}>{catLabel(c)}</button>)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Liste */}
          {error ? (
            <p className="text-sm text-slate-500 text-center py-8">{t('discover.error')}</p>
          ) : !data ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('common.loading')}</p>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                {searching
                  ? t('discover.results', { count: shown.length + ideas.length, q: q.trim() })
                  : [cat !== IDEAS ? t('discover.events', { count: shown.length }) : null, ideas.length ? t('discover.ideas', { count: ideas.length }) : null].filter(Boolean).join(' · ')}
              </p>
              {!searching && !events.length && places.length > 0 && cat === ALL && <p className="text-sm text-slate-600">{t('discover.noEvents')}</p>}
              {!shown.length && !ideas.length && <p className="text-sm text-slate-500 text-center py-6">{searching ? t('discover.noResult') : t('discover.empty')}</p>}

              {multi.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.multi')}</h3>
                  {multi.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} />)}
                </section>
              )}
              {[...byDay.keys()].sort().map(k => (
                <section key={k} className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide first-letter:uppercase">{dayTitle(k)}</h3>
                  {byDay.get(k)!.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} />)}
                </section>
              ))}

              {ideas.length > 0 && <IdeasSection places={ideas} onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} />}

              {data.sources.length > 0 && (
                <footer className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-600">{t('discover.sourcesTitle')}</p>
                  {data.sources.map(s => (
                    <p key={s.id}>
                      {s.attribution ?? s.name}
                      {s.license && <> · {t('discover.licence')} {s.licenseUrl
                        ? <a href={s.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">{s.license}</a>
                        : s.license}</>}
                    </p>
                  ))}
                </footer>
              )}
            </div>
          )}
        </div>
      </div>

      {going && <DiscoverGoModal event={going} onClose={() => setGoing(null)} />}
      {reporting && <ReportModal target={reporting.target} title={reporting.title} onClose={() => setReporting(null)} />}
      {showPro && (user?.canPublishDiscover
        ? <Modal title={t('discover.publish.howTitle')} onClose={() => setShowPro(false)}><p className="text-sm text-slate-700">{t('discover.publish.howText')}</p></Modal>
        : <ProSoonModal onClose={() => setShowPro(false)} />)}
    </div>
  );
}

function EventCard({ e, onGo, onReport }: { e: DiscoverEvent; onGo: (e: DiscoverEvent) => void; onReport: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const where = [e.place, e.city && !(e.place ?? '').includes(e.city) ? e.city : null].filter(Boolean).join(', ');
  const status = e.status !== 'scheduled' ? t(`discover.status.${e.status}` as any) : null;
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-3.5 flex gap-3 shadow-sm">
      <div className="w-14 flex-shrink-0 self-start text-center rounded-xl bg-indigo-50 text-indigo-700 py-2 tabular-nums">
        {e.multiDay
          ? <><span className="block text-[10px] uppercase tracking-wide">{t('discover.until')}</span><span className="block text-[13px] font-bold">{shortDate(e.endAt ?? e.startAt)}</span></>
          : <span className="block text-[15px] font-bold">{timeLabel(e.startAt)}</span>}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-semibold text-slate-900 break-words">{e.title}</p>
        {(where || e.dateLabel) && <p className="text-[13px] text-slate-500 break-words">{[where, e.multiDay ? e.dateLabel : null].filter(Boolean).join(' · ')}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{catLabel(e.category)}</span>
          {e.family && e.category !== 'famille' && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">{catLabel('famille')}</span>}
          {status && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">{status}</span>}
          {e.priceText && <span className="text-xs text-slate-500">{e.priceText}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {e.status !== 'cancelled' && (
            <button onClick={() => onGo(e)} title={user ? undefined : t('discover.loginToGo')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              <Users size={13} />{t('discover.goWith')}
            </button>
          )}
          {e.signupPath && e.status !== 'cancelled' && (
            <button onClick={() => navigate(e.signupPath!)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
              <Ticket size={13} />{t('discover.publish.signup')}
            </button>
          )}
          {e.url && (
            <a href={e.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 max-w-full">
              <ExternalLink size={13} className="flex-shrink-0" /><span className="truncate">{t('discover.moreInfo', { site: host(e.url) })}</span>
            </a>
          )}
          <button onClick={onReport} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
            <Flag size={11} />{t('discover.report')}
          </button>
        </div>
      </div>
    </article>
  );
}

function IdeasSection({ places, onReport }: { places: DiscoverPlace[]; onReport: (p: DiscoverPlace) => void }) {
  const kinds = [...new Set(places.map(p => p.kind))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.ideasTitle')}</h3>
      {kinds.map(k => (
        <div key={k} className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{kindLabel(k)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {places.filter(p => p.kind === k).map(p => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2 min-w-0">
                <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 group">
                  <span className="block text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700">{p.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{[p.city, t('discover.website')].filter(Boolean).join(' · ')} ↗</span>
                </a>
                <button onClick={() => onReport(p)} className="p-1 text-slate-300 hover:text-slate-500" aria-label={t('discover.report')}><Flag size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
