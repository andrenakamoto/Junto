import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, EyeOff, Lightbulb, MapPin, ExternalLink, Flag, Megaphone, Search, SlidersHorizontal, Ticket, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { t } from '../../i18n';
import {
  CATEGORY_GROUPS, DiscoverData, DiscoverEvent, DiscoverPlace, DiscoverRegion, IDEAS, KIND_EMOJI, KIND_GROUPS, KIND_ORDER, REGIONS,
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
  // Idées de sorties : type de lieu ouvert (null = tuiles) et ville choisie dans ce type
  const [ideaKind, setIdeaKind] = useState<string | null>(null);
  const [ideaCity, setIdeaCity] = useState<string | null>(null);
  const [going, setGoing] = useState<DiscoverEvent | null>(null);
  const [reporting, setReporting] = useState<{ target: { eventId: string } | { placeId: string }; title: string } | null>(null);
  const [showPro, setShowPro] = useState(false);
  // Filtres repliés sur téléphone (sinon ils prennent tout l'écran avant le premier événement)
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    setData(null);
    setError(false);
    api.get<DiscoverData>('/discover', { params: { region, days: 14, v: 2 } })
      .then(res => setData(res.data))
      .catch(() => setError(true));
  }, [region]);

  function chooseRegion(r: DiscoverRegion) { setRegion(r); saveRegion(r); setCat(ALL); setIdeaKind(null); }
  useEffect(() => { setIdeaKind(null); }, [cat]);
  useEffect(() => { setIdeaCity(null); }, [ideaKind, region]);

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
  // Recherche : les lieux qui correspondent ; « Idées de sorties » et « En famille » : tuiles par type (IdeasBrowser) ;
  // « Tout » : un simple bandeau vers les idées
  const ideas = places.filter(p => searching
    ? hit([p.name, p.city, p.address, kindLabel(p.kind)].join(' '))
    : cat === IDEAS || (cat === 'famille' && p.family));

  const multi = shown.filter(e => e.multiDay);
  const single = shown.filter(e => !e.multiDay);
  const byDay = new Map<string, DiscoverEvent[]>();
  for (const e of single) { const k = dayKey(e.startAt); byDay.set(k, [...(byDay.get(k) ?? []), e]); }

  const pill = (active: boolean) => `px-3 py-1.5 rounded-full border text-[13px] font-medium transition-colors ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`;

  // Administrateur : masquer un événement ou un lieu sans passer par le panneau admin
  const isAdmin = !!user?.isAdmin;
  async function hideEvent(e: DiscoverEvent) {
    if (!confirm(`Masquer « ${e.title} » de Découvrir pour tout le monde ?`)) return;
    try { await api.put(`/admin/discover/events/${e.id}/state`, { state: 'hidden' }); setData(d => d && { ...d, events: d.events.filter(x => x.id !== e.id) }); }
    catch { alert('Impossible de masquer cet événement.'); }
  }
  async function hidePlace(p: DiscoverPlace) {
    if (!confirm(`Masquer « ${p.name} » de Découvrir pour tout le monde ?`)) return;
    try { await api.put(`/admin/discover/places/${p.id}/state`, { state: 'hidden' }); setData(d => d && { ...d, places: d.places.filter(x => x.id !== p.id) }); }
    catch { alert('Impossible de masquer ce lieu.'); }
  }

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
              {!shown.length && !ideas.length && !(cat === ALL && !searching && places.length > 0) && <p className="text-sm text-slate-500 text-center py-6">{searching ? t('discover.noResult') : t('discover.empty')}</p>}

              {multi.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.multi')}</h3>
                  {multi.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} onHide={isAdmin ? () => hideEvent(e) : undefined} />)}
                </section>
              )}
              {[...byDay.keys()].sort().map(k => (
                <section key={k} className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide first-letter:uppercase">{dayTitle(k)}</h3>
                  {byDay.get(k)!.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} onHide={isAdmin ? () => hideEvent(e) : undefined} />)}
                </section>
              ))}

              {!searching && cat === ALL && places.length > 0 && (
                <button onClick={() => { setCat(IDEAS); setFiltersOpen(false); }}
                  className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-3 text-left shadow-sm hover:border-indigo-300">
                  <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Lightbulb size={18} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{t('discover.ideas', { count: places.length })}</span>
                    <span className="block text-xs text-slate-500">{t('discover.ideasHint')}</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
                </button>
              )}
              {ideas.length > 0 && (searching
                ? <IdeasSection places={ideas} onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} onHide={isAdmin ? hidePlace : undefined} />
                : <IdeasBrowser places={ideas} kind={ideaKind} onKind={setIdeaKind} city={ideaCity} onCity={setIdeaCity}
                    onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} onHide={isAdmin ? hidePlace : undefined} />)}

              <footer className="pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                <p className="pb-2"><b className="font-semibold text-slate-600">{t('discover.warnTitle')}</b> {t('discover.warnText')}</p>
                {data.sources.length > 0 && <>
                  <p className="font-semibold text-slate-600">{t('discover.sourcesTitle')}</p>
                  {data.sources.map(s => (
                    <p key={s.id}>
                      {s.attribution ?? s.name}
                      {s.license && <> · {t('discover.licence')} {s.licenseUrl && /^https?:\/\//i.test(s.licenseUrl)
                        ? <a href={s.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">{s.license}</a>
                        : s.license}</>}
                    </p>
                  ))}
                </>}
              </footer>
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

function EventCard({ e, onGo, onReport, onHide }: { e: DiscoverEvent; onGo: (e: DiscoverEvent) => void; onReport: () => void; onHide?: () => void }) {
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
          {/* Administrateurs : masquer sur place (panneau admin › Découvrir › Événements pour réafficher) */}
          {onHide && <button onClick={onHide} className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"><EyeOff size={11} />Masquer</button>}
          <button onClick={onReport} className={`${onHide ? '' : 'ml-auto '}flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600`}>
            <Flag size={11} />{t('discover.report')}
          </button>
        </div>
      </div>
    </article>
  );
}

function IdeaCard({ p, onReport, onHide }: { p: DiscoverPlace; onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
        <a href={p.website} target="_blank" rel="noopener noreferrer" className="block group">
          <span className="block text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700">{p.name}</span>
          <span className="block text-xs text-slate-500 truncate">{p.address ? t('discover.website') : [p.city, t('discover.website')].filter(Boolean).join(' · ')} ↗</span>
        </a>
        {/* Adresse : ouvre la carte (recherche par adresse, rien n'est chargé tant qu'on ne touche pas) */}
        {p.address && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}`)}`} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 flex items-start gap-1 text-xs text-slate-600 hover:text-indigo-700">
            <MapPin size={12} className="mt-px flex-shrink-0 text-slate-400" /><span className="min-w-0">{p.address}</span>
          </a>
        )}
      </div>
      {onHide && <button onClick={() => onHide(p)} className="p-1 text-red-400 hover:text-red-600" aria-label="Masquer"><EyeOff size={13} /></button>}
      <button onClick={() => onReport(p)} className="p-1 text-slate-300 hover:text-slate-500" aria-label={t('discover.report')}><Flag size={12} /></button>
    </div>
  );
}

// Idées de sorties en deux temps : des tuiles par type (avec le nombre de lieux), puis la liste d'un seul type,
// filtrable par ville dès qu'elle est longue
function IdeasBrowser({ places, kind, onKind, city, onCity, onReport, onHide }: {
  places: DiscoverPlace[]; kind: string | null; onKind: (k: string | null) => void;
  city: string | null; onCity: (c: string | null) => void; onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void;
}) {
  const count = (k: string) => places.filter(p => p.kind === k).length;
  if (!kind || !count(kind)) {
    return (
      <section className="space-y-4">
        {KIND_GROUPS.map(([g, kinds]) => {
          const avail = kinds.filter(k => count(k) > 0);
          if (!avail.length) return null;
          return (
            <div key={g} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(`discover.kindGroups.${g}` as any)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {avail.map(k => (
                  <button key={k} onClick={() => onKind(k)}
                    className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-3 text-left shadow-sm hover:border-indigo-300 min-w-0">
                    <span className="text-xl leading-none flex-shrink-0">{KIND_EMOJI[k] ?? '📍'}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 leading-tight">{kindLabel(k)}</span>
                    <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{count(k)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  }
  const list = places.filter(p => p.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  const cities = [...new Set(list.map(p => p.city).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
  const shown = city ? list.filter(p => p.city === city) : list;
  const pill = (active: boolean) => `px-3 py-1 rounded-full border text-xs font-medium ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`;
  return (
    <section className="space-y-3">
      <button onClick={() => onKind(null)} className="flex items-center gap-1 text-sm font-medium text-indigo-700">
        <ChevronLeft size={16} />{t('discover.allIdeas')}
      </button>
      <h3 className="text-base font-bold text-slate-900">{KIND_EMOJI[kind] ?? '📍'} {kindLabel(kind)} <span className="text-sm font-medium text-slate-400">{list.length}</span></h3>
      {list.length > 8 && cities.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onCity(null)} className={pill(!city)}>{t('discover.allCities')}</button>
          {cities.map(c => <button key={c} onClick={() => onCity(c)} className={pill(city === c)}>{c}</button>)}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {shown.map(p => <IdeaCard key={p.id} p={p} onReport={onReport} onHide={onHide} />)}
      </div>
    </section>
  );
}

function IdeasSection({ places, onReport, onHide }: { places: DiscoverPlace[]; onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void }) {
  const kinds = [...new Set(places.map(p => p.kind))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.ideasTitle')}</h3>
      {kinds.map(k => (
        <div key={k} className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{kindLabel(k)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {places.filter(p => p.kind === k).map(p => <IdeaCard key={p.id} p={p} onReport={onReport} onHide={onHide} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
