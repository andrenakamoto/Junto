import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { isWideScreen } from '../../lib/layout';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LocateFixed, ChevronLeft, ChevronRight, EyeOff, Lightbulb, MapPin, ExternalLink, Flag, Megaphone, Search, SlidersHorizontal, Ticket, Users, List, Map as MapIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { t } from '../../i18n';
import { QUICK_FILTERS, QUICK_EMOJI, matchesQuick, type QuickFilter, CUISINE_EMOJI, cuisineLabel,
  CATEGORY_GROUPS, DiscoverData, DiscoverEvent, DiscoverPlace, IDEAS, KIND_EMOJI, KIND_GROUPS, KIND_ORDER, SpotChoice,
  catLabel, dayChips, dayKey, dayTitle, discoverImageUrl, host, kindLabel, kmLabel, norm, savedSpot, saveSpot, shortDate, timeLabel,
} from '../../lib/discover';
import { PlacePicker } from './PlacePicker';
import { DiscoverGoModal } from './DiscoverGoModal';
import { ProSoonModal } from './ProSoonModal';
import { ReportModal } from './ReportModal';
import type { MapItem } from './DiscoverMap';

// Carte : chargée seulement quand on l'ouvre (Leaflet)
const DiscoverMap = lazy(() => import('./DiscoverMap').then(m => ({ default: m.DiscoverMap })));
const VIEW_KEY = 'evly_discover_view';

const MULTI = 'multi';
const LATER = 'later';
const ALL = 'all';

// « Découvrir » : événements publics et idées de sorties de toute la Suisse et de la France voisine (Ain, Haute-Savoie), autour d'un lieu choisi (ville, village ou
// « Autour de moi ») et dans un rayon de 10, 25 ou 50 km. Dans l'app (colonne du tableau de bord) et sur la page publique
// /sorties (sans compte). Données : GET /api/discover?lat=&lon=&radius= (lib/discover/ du serveur).
export function DiscoverView({ mode, onBack }: { mode: 'app' | 'public'; onBack?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<SpotChoice>(savedSpot);
  // « Autour de moi » : position demandée au navigateur à chaque ouverture (jamais gardée), arrondie par le serveur
  const [herePos, setHerePos] = useState<{ lat: number; lon: number } | null>(null);
  const [hereError, setHereError] = useState(false);
  const [picking, setPicking] = useState(false);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [error, setError] = useState(false);
  // Nombre d'événements à moins de 50 km, quand il y en a nettement plus que dans le rayon choisi
  const [wider, setWider] = useState<number | null>(null);
  const [day, setDay] = useState(ALL);
  const [cat, setCat] = useState(ALL);
  const [q, setQ] = useState('');
  // Idées de sorties : type de lieu ouvert (null = tuiles) et ville choisie dans ce type
  const [ideaKind, setIdeaKind] = useState<string | null>(null);
  const [going, setGoing] = useState<DiscoverEvent | null>(null);
  const [goingPlace, setGoingPlace] = useState<DiscoverPlace | null>(null);
  // Liste ou carte, mémorisé sur l'appareil
  const [view, setView] = useState<'list' | 'map'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'list'; } catch { return 'list'; } });
  function chooseView(v: 'list' | 'map') { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* rien */ } }
  const [reporting, setReporting] = useState<{ target: { eventId: string } | { placeId: string }; title: string } | null>(null);
  const [showPro, setShowPro] = useState(false);
  // Filtres repliés sur téléphone (sinon ils prennent tout l'écran avant le premier événement)
  const [filtersOpen, setFiltersOpen] = useState(() => isWideScreen());

  useEffect(() => {
    if (!choice.here) return;
    setHerePos(null);
    setHereError(false);
    if (!navigator.geolocation) { setHereError(true); setPicking(true); return; }
    navigator.geolocation.getCurrentPosition(
      p => setHerePos({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => { setHereError(true); setPicking(true); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  }, [choice.here]);

  const center = choice.here ? herePos : choice.spot;
  const canton = !choice.here ? choice.spot?.canton : undefined;
  useEffect(() => {
    if (!center) return;
    setData(null);
    setError(false);
    setWider(null);
    if (canton) {
      api.get<DiscoverData>('/discover', { params: { canton, days: 14, v: 5 } }).then(res => setData(res.data)).catch(() => setError(true));
      return;
    }
    // Position arrondie au centième (~1 km) sur l'appareil : rien de plus précis ne quitte le téléphone
    const round = (x: number) => Math.round(x * 100) / 100;
    const params = { lat: round(center.lat), lon: round(center.lon), days: 14, v: 5 };
    api.get<DiscoverData>('/discover', { params: { ...params, radius: choice.radius } })
      .then(res => {
        setData(res.data);
        // Peu de choses dans le rayon (vallée, village) : on regarde jusqu'à 50 km et on propose d'élargir
        if (choice.radius < 50 && res.data.events.length < 20) {
          api.get<DiscoverData>('/discover', { params: { ...params, radius: 50 } })
            .then(w => { if (w.data.events.length >= res.data.events.length + 10) setWider(w.data.events.length); })
            .catch(() => { /* rien à proposer */ });
        }
      })
      .catch(() => setError(true));
  }, [center?.lat, center?.lon, choice.radius, canton]);

  function choosePlace(c: SpotChoice) {
    setChoice(c); saveSpot(c);
    if (c.here !== choice.here || c.spot?.name !== choice.spot?.name) { setCat(ALL); setIdeaKind(null); }
  }
  useEffect(() => { setIdeaKind(null); }, [cat]);

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
    if (searching) return hit([e.title, ...(e.aliases ?? []), e.place, e.city, catLabel(e.category), e.priceText].join(' '));
    if (cat === IDEAS || !matchCat(e)) return false;
    if (day === ALL) return true;
    if (day === MULTI) return e.multiDay;
    const k = dayKey(e.startAt);
    // Plusieurs dates sans le détail des séances : rangées sous aucun jour précis
    if (e.sessions) return false;
    if (e.multiDay) return day !== LATER && k <= day && dayKey(e.endAt ?? e.startAt) >= day;
    return day === LATER ? !chipKeys.has(k) : k === day;
  });
  // Recherche : les lieux qui correspondent ; « Idées de sorties » et « En famille » : tuiles par type (IdeasBrowser) ;
  // « Tout » : un simple bandeau vers les idées
  const ideas = places.filter(p => searching
    ? hit([p.name, p.city, p.address, kindLabel(p.kind)].join(' '))
    : cat === IDEAS || (cat === 'famille' && p.family));

  // Carte : les événements filtrés et les idées de sorties (toutes dans « Tout », celles du type ouvert dans « Idées de sorties »)
  const mapItems = useMemo<MapItem[]>(() => {
    const ps = searching || cat !== ALL ? ideas.filter(p => !ideaKind || searching || p.kind === ideaKind) : places;
    return [...shown.map(e => ({ type: 'event' as const, e })), ...ps.map(p => ({ type: 'place' as const, p }))];
  }, [data, q, cat, day, ideaKind]);
  const multi = shown.filter(e => e.multiDay && !e.sessions);
  const sessions = shown.filter(e => e.sessions);
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

  // Partenaires qui demandent un crédit sur chaque événement (GeNEVERsleep : « Source : GeNEVERsleep » + lien vers sa page)
  const CREDITED = new Set(['geneversleep', 'partner']);
  // DATAtourisme : l'auteur de chaque donnée (office de tourisme) et sa date de mise à jour, exigés par la licence
  const creditOf = (e: DiscoverEvent) => {
    if (e.credit) return e.credit;
    const s = data?.sources.find(x => x.id === e.sourceId);
    return s && CREDITED.has(s.type) ? (s.attribution ?? s.name).replace(/^Source\s*:\s*/i, '') : null;
  };

  function goWith(e: DiscoverEvent) {
    if (user) setGoing(e);
    else navigate(`/auth?redirect=${encodeURIComponent('/sorties')}`);
  }
  function goWithPlace(p: DiscoverPlace) {
    if (user) setGoingPlace(p);
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

          {/* Lieu et rayon */}
          <button onClick={() => setPicking(true)} aria-label={t('discover.place.choose')}
            className="inline-flex items-center gap-1.5 max-w-full px-3.5 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-800 hover:border-indigo-300">
            {choice.here ? <LocateFixed size={15} className="text-indigo-600 flex-shrink-0" /> : <MapPin size={15} className="text-indigo-600 flex-shrink-0" />}
            <span className="truncate">{choice.here ? (herePos || hereError ? t('discover.place.here') : t('discover.place.locating')) : choice.spot?.name}</span>
            {!canton && <span className="text-slate-400 font-medium flex-shrink-0">· {choice.radius} km</span>}
            <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
          </button>

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
          {choice.here && hereError && !data ? (
            <p className="text-sm text-slate-500 text-center py-8">{t('discover.place.denied')}</p>
          ) : error ? (
            <p className="text-sm text-slate-500 text-center py-8">{t('discover.error')}</p>
          ) : !data ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('common.loading')}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
              <p className="flex-1 min-w-0 text-xs text-slate-500">
                {searching
                  ? t('discover.results', { count: shown.length + ideas.length, q: q.trim() })
                  : [cat !== IDEAS ? t('discover.events', { count: shown.length }) : null, ideas.length ? t('discover.ideas', { count: ideas.length }) : null].filter(Boolean).join(' · ')}
              </p>
              <div className="flex-shrink-0 inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label={t('discover.map.view')}>
                {(['list', 'map'] as const).map(v => (
                  <button key={v} onClick={() => chooseView(v)} aria-pressed={view === v}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {v === 'list' ? <List size={13} /> : <MapIcon size={13} />}{t(`discover.map.${v}` as any)}
                  </button>
                ))}
              </div>
              </div>
              {wider != null && !searching && cat !== IDEAS && (
                <button onClick={() => choosePlace({ ...choice, radius: 50 })}
                  className="w-full flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 text-left hover:bg-indigo-100">
                  <span className="flex-1 min-w-0 text-sm text-slate-700">{t('discover.wider', { count: wider, km: choice.radius })}</span>
                  <span className="flex-shrink-0 text-sm font-semibold text-indigo-700">{t('discover.widerButton')}</span>
                </button>
              )}
              {view === 'map' ? (
                <Suspense fallback={<p className="text-sm text-slate-400 text-center py-8">{t('common.loading')}</p>}>
                  <DiscoverMap items={mapItems} center={canton ? null : center} radiusKm={canton ? null : choice.radius} here={choice.here}
                    renderSelected={it => it.type === 'event'
                      ? <EventCard showDate e={it.e} onGo={goWith} onReport={() => setReporting({ target: { eventId: it.e.id }, title: it.e.title })} onHide={isAdmin ? () => hideEvent(it.e) : undefined} credit={creditOf(it.e)} />
                      : <IdeaCard p={it.p} onGo={goWithPlace} onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} onHide={isAdmin ? hidePlace : undefined} />} />
                </Suspense>
              ) : (<>
              {!searching && !events.length && places.length > 0 && cat === ALL && <p className="text-sm text-slate-600">{t('discover.noEvents')}</p>}
              {!shown.length && !ideas.length && !(cat === ALL && !searching && places.length > 0) && <p className="text-sm text-slate-500 text-center py-6">{searching ? t('discover.noResult') : t('discover.empty')}</p>}

              {multi.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.multi')}</h3>
                  {multi.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} onHide={isAdmin ? () => hideEvent(e) : undefined} credit={creditOf(e)} />)}
                </section>
              )}
              {sessions.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.sessions')}</h3>
                  {sessions.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} onHide={isAdmin ? () => hideEvent(e) : undefined} credit={creditOf(e)} />)}
                </section>
              )}
              {[...byDay.keys()].sort().map(k => (
                <section key={k} className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide first-letter:uppercase">{dayTitle(k)}</h3>
                  {byDay.get(k)!.map(e => <EventCard key={e.id} e={e} onGo={goWith} onReport={() => setReporting({ target: { eventId: e.id }, title: e.title })} onHide={isAdmin ? () => hideEvent(e) : undefined} credit={creditOf(e)} />)}
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
                ? <IdeasSection places={ideas} onGo={goWithPlace} onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} onHide={isAdmin ? hidePlace : undefined} />
                : <IdeasBrowser places={ideas} onGo={goWithPlace} kind={ideaKind} onKind={setIdeaKind}
                    onReport={p => setReporting({ target: { placeId: p.id }, title: p.name })} onHide={isAdmin ? hidePlace : undefined} />)}
              </>)}

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

      {picking && <PlacePicker value={choice} onChange={choosePlace} onClose={() => setPicking(false)} hereError={choice.here && hereError} />}
      {going && <DiscoverGoModal event={going} onClose={() => setGoing(null)} />}
      {goingPlace && <DiscoverGoModal place={goingPlace} onClose={() => setGoingPlace(null)} />}
      {reporting && <ReportModal target={reporting.target} title={reporting.title} onClose={() => setReporting(null)} />}
      {showPro && (user?.canPublishDiscover
        ? <Modal title={t('discover.publish.howTitle')} onClose={() => setShowPro(false)}><p className="text-sm text-slate-700">{t('discover.publish.howText')}</p></Modal>
        : <ProSoonModal onClose={() => setShowPro(false)} />)}
    </div>
  );
}

// Horaire d'une séance d'une série « plusieurs dates »
function sessionTime(e: DiscoverEvent) {
  const a = timeLabel(e.startAt), b = e.endAt ? timeLabel(e.endAt) : null;
  return b && b !== a ? `${a} – ${b}` : a;
}

// showDate : sur la carte, il n'y a pas de titre de jour au-dessus de la fiche, la date s'affiche avec l'heure
function EventCard({ e, onGo, onReport, onHide, credit, showDate }: { e: DiscoverEvent; onGo: (e: DiscoverEvent) => void; onReport: () => void; onHide?: () => void; credit?: string | null; showDate?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const where = [[e.place, e.city && !(e.place ?? '').includes(e.city) ? e.city : null].filter(Boolean).join(', '), kmLabel(e.distanceKm)].filter(Boolean).join(' · ');
  const status = e.status !== 'scheduled' ? t(`discover.status.${e.status}` as any) : null;
  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Image (Eventfrog) : copie chez nous, crédit affiché avec elle (règle de la source) */}
      {e.imageKey && (
        <figure className="relative bg-slate-100">
          <img src={discoverImageUrl(e.imageKey)} alt="" loading="lazy" className="w-full aspect-[2/1] max-h-52 object-cover" />
          {e.imageCredit && <figcaption className="absolute right-1.5 bottom-1.5 max-w-[80%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">© {e.imageCredit}</figcaption>}
        </figure>
      )}
      <div className="p-3.5 flex gap-3">
      <div className="w-14 flex-shrink-0 self-start text-center rounded-xl bg-indigo-50 text-indigo-700 py-2 tabular-nums">
        {e.sessions
          ? <><span className="block text-[10px] uppercase tracking-wide leading-tight">{t('discover.sessionsTop')}</span><span className="block text-[12px] font-bold leading-tight">{t('discover.sessionsBottom')}</span></>
          : e.multiDay
          ? <><span className="block text-[10px] uppercase tracking-wide">{t('discover.until')}</span><span className="block text-[13px] font-bold">{shortDate(e.endAt ?? e.startAt)}</span></>
          : <>{showDate && <span className="block text-[10px] uppercase tracking-wide leading-tight">{shortDate(e.startAt)}</span>}<span className="block text-[15px] font-bold">{timeLabel(e.startAt)}</span></>}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-semibold text-slate-900 break-words">{e.title}</p>
        {(where || e.dateLabel) && <p className="text-[13px] text-slate-500 break-words">{[where, e.multiDay && !e.sessions ? e.dateLabel : null].filter(Boolean).join(' · ')}</p>}
        {/* Adresse du lieu (2026-11-17) : touchée, elle ouvre la carte ; sans adresse, la position exacte */}
        {(e.address || (e.lat != null && e.lon != null)) && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address ? `${e.place ?? e.title}, ${e.address}` : `${e.lat},${e.lon}`)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-1 text-xs text-slate-600 hover:text-indigo-700">
            <MapPin size={12} className="mt-px flex-shrink-0 text-slate-400" /><span className="min-w-0 break-words">{e.address ?? t('discover.onMap')}</span>
          </a>
        )}
        {e.sessions && <p className="text-[13px] text-slate-600 break-words">{t('discover.sessionsLine', { from: shortDate(e.startAt), to: shortDate(e.endAt ?? e.startAt), time: sessionTime(e) })}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">{catLabel(e.category)}</span>
          {e.family && e.category !== 'famille' && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">{catLabel('famille')}</span>}
          {status && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">{status}</span>}
          {e.priceText && <span className="text-xs text-slate-500">{e.priceText}</span>}
          {credit && (e.url
            ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 underline underline-offset-2">{t('discover.credit', { name: credit })}</a>
            : <span className="text-xs text-slate-500">{t('discover.credit', { name: credit })}</span>)}
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
    </div>
    </article>
  );
}

// showKind : le type de lieu devant le nom (« Autres », qui mélange les types)
function IdeaCard({ p, onGo, onReport, onHide, showKind = false }: { p: DiscoverPlace; onGo: (p: DiscoverPlace) => void; onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void; showKind?: boolean }) {
  const { user } = useAuth();
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
        <a href={p.website} target="_blank" rel="noopener noreferrer" className="block group">
          <span className="block text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-700">{showKind && <span className="mr-1">{KIND_EMOJI[p.kind] ?? '📍'}</span>}{p.name}</span>
          {showKind && <span className="block text-[11px] font-medium text-indigo-700 truncate">{kindLabel(p.kind)}</span>}
          <span className="block text-xs text-slate-500 truncate">{[p.kind === 'restaurant' ? `${CUISINE_EMOJI[p.cuisine ?? 'autre'] ?? ''} ${cuisineLabel(p.cuisine ?? 'autre')}` : null, p.address || (p.lat != null && p.lon != null) ? null : p.city, kmLabel(p.distanceKm), host(p.website) === 'openstreetmap.org' ? t('discover.onMap') : host(p.website) === 'myswitzerland.com' ? 'MySwitzerland.com' : t('discover.website')].filter(Boolean).join(' · ')} ↗</span>
        </a>
        {/* Adresse : ouvre la carte (recherche par adresse, rien n'est chargé tant qu'on ne touche pas). Sans adresse (place de
            grillade, point de vue…) : la localité, et la carte s'ouvre sur la position exacte */}
        {(p.address || (p.lat != null && p.lon != null)) && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address ? `${p.name}, ${p.address}` : `${p.lat},${p.lon}`)}`} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 flex items-start gap-1 text-xs text-slate-600 hover:text-indigo-700">
            <MapPin size={12} className="mt-px flex-shrink-0 text-slate-400" /><span className="min-w-0">{p.address ?? (p.city ? t('discover.near', { city: p.city }) : t('discover.onMap'))}</span>
          </a>
        )}
        <button onClick={() => onGo(p)} title={user ? undefined : t('discover.loginToGo')}
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          <Users size={12} />{t('discover.goWith')}
        </button>
      </div>
      {onHide && <button onClick={() => onHide(p)} className="p-1 text-red-400 hover:text-red-600" aria-label="Masquer"><EyeOff size={13} /></button>}
      <button onClick={() => onReport(p)} className="p-1 text-slate-300 hover:text-slate-500" aria-label={t('discover.report')}><Flag size={12} /></button>
    </div>
  );
}

// Idées de sorties en deux temps : des tuiles par type (avec le nombre de lieux), puis la liste d'un seul type,
// filtrable par ville dès qu'elle est longue
function IdeasBrowser({ places, onGo, kind, onKind, onReport, onHide }: {
  places: DiscoverPlace[]; onGo: (p: DiscoverPlace) => void; kind: string | null; onKind: (k: string | null) => void;
  onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void;
}) {
  // Refait le 2026-11-17 (« on s'y perd ») : filtres rapides, 5 groupes dont chacun montre une ligne de tuiles
  // (dans l'ordre du groupe, « + N autres » pour déplier) ; les types à un seul lieu sont réunis dans « Autres ».
  const [quick, setQuick] = useState<QuickFilter | null>(null);
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  // Restaurants : filtre par spécialité (2026-11-17), remis à zéro quand on change de type
  const [cuisine, setCuisine] = useState<string | null>(null);
  useEffect(() => setCuisine(null), [kind]);
  const pool = places.filter(p => matchesQuick(p, quick));
  const count = (k: string) => pool.filter(p => p.kind === k).length;
  const groupKinds = (g: string) => KIND_GROUPS.find(([x]) => x === g)?.[1] ?? [];
  const singlesOf = (g: string) => { const one = groupKinds(g).filter(k => count(k) === 1); return one.length >= 2 ? one : []; };
  const othersGroup = kind?.startsWith('others:') ? kind.slice(7) : null;
  const inKind = (p: DiscoverPlace) => othersGroup ? singlesOf(othersGroup).includes(p.kind) : p.kind === kind;
  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_FILTERS.map(f => (
        <button key={f} onClick={() => setQuick(quick === f ? null : f)}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${quick === f ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
          {QUICK_EMOJI[f]} {t(`discover.quick.${f}` as any)}
        </button>
      ))}
    </div>
  );
  if (!kind || !pool.some(inKind)) {
    const slots = isWideScreen() ? 3 : 4;
    return (
      <section className="space-y-4">
        {chips}
        {pool.length === 0 && <p className="text-sm text-slate-500">{t('discover.noIdeasFilter')}</p>}
        {KIND_GROUPS.map(([g]) => {
          const singles = singlesOf(g);
          // Ordre choisi par groupe (la neige en tête l'hiver, musées avant bibliothèques…), pas le nombre de lieux
          const tiles: [string, number][] = groupKinds(g).filter(k => count(k) > 0 && !singles.includes(k)).map(k => [k, count(k)] as [string, number]);
          if (singles.length) tiles.push([`others:${g}`, singles.length]);
          if (!tiles.length) return null;
          const open = unfolded.has(g);
          const folded = !open && tiles.length > slots;
          const shown = folded ? tiles.slice(0, slots - 1) : tiles;
          const toggle = () => setUnfolded(prev => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; });
          return (
            <div key={g} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t(`discover.kindGroups.${g}` as any)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shown.map(([k, n]) => (
                  <button key={k} onClick={() => onKind(k)}
                    className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-3 text-left shadow-sm hover:border-indigo-300 min-w-0">
                    <span className="text-xl leading-none flex-shrink-0">{k.startsWith('others:') ? '✨' : KIND_EMOJI[k] ?? '📍'}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 leading-tight">{k.startsWith('others:') ? t('discover.otherKinds') : kindLabel(k)}</span>
                    <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{n}</span>
                  </button>
                ))}
                {folded && (
                  <button onClick={toggle} className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                    {t('discover.moreKinds', { count: tiles.length - shown.length })}
                  </button>
                )}
              </div>
              {open && tiles.length > slots && (
                <button onClick={toggle} className="text-xs font-medium text-slate-500 hover:text-indigo-700">{t('discover.lessKinds')}</button>
              )}
            </div>
          );
        })}
      </section>
    );
  }
  // Le plus proche d'abord (lieux sans position à la fin), sinon par nom
  const list = pool.filter(inKind).sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.name.localeCompare(b.name));
  // Pas de filtre par localité (2026-11-17, demande de l'utilisateur) : c'est le lieu choisi en haut de Découvrir qui fait foi
  const inCity = list;
  const cuisines = kind === 'restaurant'
    ? Object.keys(CUISINE_EMOJI).map(c => [c, inCity.filter(p => (p.cuisine ?? 'autre') === c).length] as const).filter(([, n]) => n > 0)
    : [];
  const shown = cuisine ? inCity.filter(p => (p.cuisine ?? 'autre') === cuisine) : inCity;
  const pill = (active: boolean) => `px-3 py-1 rounded-full border text-xs font-medium ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`;
  return (
    <section className="space-y-3">
      <button onClick={() => onKind(null)} className="flex items-center gap-1 text-sm font-medium text-indigo-700">
        <ChevronLeft size={16} />{t('discover.allIdeas')}
      </button>
      {chips}
      <h3 className="text-base font-bold text-slate-900">{othersGroup ? `✨ ${t('discover.otherKinds')} · ${t(`discover.kindGroups.${othersGroup}` as any)}` : `${KIND_EMOJI[kind] ?? '📍'} ${kindLabel(kind)}`} <span className="text-sm font-medium text-slate-400">{list.length}</span></h3>
      {cuisines.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCuisine(null)} className={pill(!cuisine)}>{t('discover.allCuisines')}</button>
          {cuisines.map(([c, n]) => (
            <button key={c} onClick={() => setCuisine(cuisine === c ? null : c)} className={pill(cuisine === c)}>
              {CUISINE_EMOJI[c]} {cuisineLabel(c)} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {shown.map(p => <IdeaCard key={p.id} p={p} onGo={onGo} onReport={onReport} onHide={onHide} showKind={!!othersGroup} />)}
      </div>
    </section>
  );
}

function IdeasSection({ places, onGo, onReport, onHide }: { places: DiscoverPlace[]; onGo: (p: DiscoverPlace) => void; onReport: (p: DiscoverPlace) => void; onHide?: (p: DiscoverPlace) => void }) {
  const kinds = [...new Set(places.map(p => p.kind))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('discover.ideasTitle')}</h3>
      {kinds.map(k => (
        <div key={k} className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{kindLabel(k)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {places.filter(p => p.kind === k).map(p => <IdeaCard key={p.id} p={p} onGo={onGo} onReport={onReport} onHide={onHide} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
