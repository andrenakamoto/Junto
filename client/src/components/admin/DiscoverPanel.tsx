import { useEffect, useState } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { DateTimeField } from '../ui/DateTimeField';
import { isoToLocal, localToISO } from '../plans/PlanFormParts';
import { CATEGORY_GROUPS, IDEAS, KIND_ORDER, catLabel, kindLabel, regionLabel, REGIONS } from '../../lib/discover';

// Panneau admin « Découvrir » (routes/adminDiscover.ts) : sources, file « À valider », saisie manuelle (Lausanne,
// Valais, associations), idées de sorties masquées, organisateurs qui veulent publier. Français seulement.

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
const STATUS_LABELS: Record<string, string> = { active: 'Active', pending: 'En attente', disabled: 'Coupée' };
const TYPE_LABELS: Record<string, string> = { openagenda: 'OpenAgenda', osm: 'OpenStreetMap', ical: 'Flux iCal', manual: 'Saisie', partner: 'Partenaire' };
const CATEGORIES = CATEGORY_GROUPS.flatMap(([, l]) => l).filter(c => c !== IDEAS);
const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

export function DiscoverPanel() {
  const [tab, setTab] = useState<'sources' | 'pending' | 'manual' | 'places' | 'pros'>('sources');
  const tabs: [typeof tab, string][] = [['sources', 'Sources'], ['pending', 'À valider'], ['manual', 'Saisie'], ['places', 'Idées de sorties'], ['pros', 'Organisateurs intéressés']];
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Compass size={18} className="text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-800">Découvrir</h2>
        <a href="/sorties" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-indigo-700 underline">Voir la page publique</a>
      </div>
      <p className="text-xs text-slate-500 mb-3">Seulement des sources sous licence ouverte ou avec l'accord de l'organisateur. Saisie manuelle : des faits (titre, date, lieu, prix) et le lien de l'organisateur, jamais de texte ni d'image recopiés.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-sm border ${tab === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>{l}</button>
        ))}
      </div>
      {tab === 'sources' && <Sources />}
      {tab === 'pending' && <Pending />}
      {tab === 'manual' && <Manual />}
      {tab === 'places' && <Places />}
      {tab === 'pros' && <Pros />}
    </section>
  );
}

function Sources() {
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/discover/sources').then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function update(id: string, data: any) {
    try { await api.put(`/admin/discover/sources/${id}`, data); load(); } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Erreur'); }
  }
  async function sync(id: string) {
    setBusy(id); setMsg('');
    try {
      const { data } = await api.post(`/admin/discover/sources/${id}/sync`);
      setMsg(data.error ? `Erreur : ${data.error}` : `${data.count} éléments synchronisés.`);
      load();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{msg}</p>}
      {list === null && <p className="text-sm text-slate-400">Chargement…</p>}
      {list?.map(s => (
        <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">{s.name}</span>
            <span className="text-xs text-slate-500">{TYPE_LABELS[s.type] ?? s.type}{s.region ? ` · ${regionLabel(s.region)}` : ''}</span>
            <select value={s.status} onChange={e => update(s.id, { status: e.target.value })} className="ml-auto text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {s.license && <span>Licence : {s.license}</span>}
            {s.type !== 'osm' && <span>Événements : {s.events?.published ?? 0} publiés{s.events?.pending ? `, ${s.events.pending} à valider` : ''}{s.events?.hidden ? `, ${s.events.hidden} masqués` : ''}</span>}
            {s.places > 0 && <span>Lieux : {s.places}</span>}
            {s.lastSyncAt && <span>Synchronisée le {dateFmt.format(new Date(s.lastSyncAt))}{s.lastCount != null ? ` (${s.lastCount})` : ''}</span>}
            {s.lastError && <span className="text-red-600">Erreur : {s.lastError}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {['openagenda', 'ical'].includes(s.type) && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={s.autoPublish} onChange={e => update(s.id, { autoPublish: e.target.checked })} />
                Publication automatique (sinon : « À valider »)
              </label>
            )}
            {['openagenda', 'ical', 'osm'].includes(s.type) && s.status === 'active' && (
              <button onClick={() => sync(s.id)} disabled={busy === s.id} className="ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={12} className={busy === s.id ? 'animate-spin' : ''} />Synchroniser maintenant
              </button>
            )}
          </div>
        </div>
      ))}
      <AddSource onAdded={load} />
    </div>
  );
}

function AddSource({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<any[]>([]);
  const [region, setRegion] = useState('ge');
  const [icalUrl, setIcalUrl] = useState('');
  const [icalName, setIcalName] = useState('');
  const [icalCat, setIcalCat] = useState('concert');
  const [msg, setMsg] = useState('');

  async function search() { const { data } = await api.get('/admin/discover/openagenda-search', { params: { q } }); setFound(data); }
  async function add(body: any) {
    setMsg('');
    try { await api.post('/admin/discover/sources', body); setMsg('Source ajoutée « En attente » : vérifie la licence, puis active-la.'); onAdded(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Erreur'); }
  }

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3">
      <p className="text-sm font-medium text-slate-800">Ajouter une source</p>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500">Région</span>
        <select value={region} onChange={e => setRegion(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
          {REGIONS.map(r => <option key={r} value={r}>{regionLabel(r)}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-slate-600">Agenda OpenAgenda (licence ouverte seulement)</p>
        <div className="flex gap-2">
          <input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un agenda (ex. Lausanne, Victoria Hall)" />
          <button onClick={search} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm">Chercher</button>
        </div>
        {found.map(a => (
          <div key={a.uid} className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2">
            <span className="flex-1 min-w-0 truncate">{a.title}{a.official ? ' · officiel' : ''}</span>
            <button onClick={() => add({ type: 'openagenda', agendaUid: a.uid, region })} className="text-xs font-medium text-indigo-700">Ajouter</button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-slate-600">Flux iCal d'une salle ou d'un organisateur (avec son accord)</p>
        <input className={input} value={icalUrl} onChange={e => setIcalUrl(e.target.value)} placeholder="https://…/agenda.ics" />
        <div className="flex gap-2">
          <input className={input} value={icalName} onChange={e => setIcalName(e.target.value)} placeholder="Nom de la salle" />
          <select value={icalCat} onChange={e => setIcalCat(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 bg-white">
            {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <button onClick={() => add({ type: 'ical', url: icalUrl, name: icalName, category: icalCat, region })} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm">Ajouter</button>
        </div>
      </div>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  );
}

function Pending() {
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/admin/discover/events', { params: { state: 'pending' } }).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  async function set(id: string, state: string) { await api.put(`/admin/discover/events/${id}/state`, { state }); setList(l => (l ?? []).filter(e => e.id !== id)); }
  if (list === null) return <p className="text-sm text-slate-400">Chargement…</p>;
  if (!list.length) return <p className="text-sm text-slate-500">Rien à valider.</p>;
  return (
    <div className="space-y-2">
      {list.map(e => (
        <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{e.title}</p>
            <p className="text-xs text-slate-500">{dateFmt.format(new Date(e.startAt))} · {[e.place, e.city].filter(Boolean).join(', ')} · {catLabel(e.category)} · {e.source?.name}</p>
            {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">{e.url}</a>}
          </div>
          <button onClick={() => set(e.id, 'published')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Publier</button>
          <button onClick={() => set(e.id, 'hidden')} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs">Masquer</button>
        </div>
      ))}
    </div>
  );
}

const EMPTY = { title: '', region: 'la', category: 'concert', startAt: '', endAt: '', place: '', city: '', priceText: '', url: '', family: false, status: 'scheduled' };

function Manual() {
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/discover/events', { params: { manual: '1' } }).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function save() {
    setMsg('');
    if (!form.title.trim()) { setMsg('Indique le titre.'); return; }
    if (!form.startAt) { setMsg('Indique la date et l’heure de début.'); return; }
    const body = { ...form, startAt: localToISO(form.startAt), endAt: form.endAt ? localToISO(form.endAt) : null };
    try {
      if (editing) await api.put(`/admin/discover/events/${editing}`, body); else await api.post('/admin/discover/events', body);
      setForm({ ...EMPTY, region: form.region }); setEditing(null); setMsg('Enregistré.'); load();
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Erreur'); }
  }
  function edit(e: any) {
    setEditing(e.id);
    setForm({ title: e.title, region: e.region, category: e.category, startAt: isoToLocal(e.startAt), endAt: isoToLocal(e.endAt), place: e.place ?? '', city: e.city ?? '', priceText: e.priceText ?? '', url: e.url ?? '', family: e.family, status: e.status });
  }
  async function remove(id: string) { await api.delete(`/admin/discover/events/${id}`); load(); }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-800">{editing ? 'Modifier l’événement' : 'Nouvel événement'}</p>
        <input className={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre de l’événement" maxLength={160} />
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={form.region} onChange={e => set('region', e.target.value)}>{REGIONS.map(r => <option key={r} value={r}>{regionLabel(r)}</option>)}</select>
          <select className={input} value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}</select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <DateTimeField value={form.startAt} onChange={v => set('startAt', v)} placeholder="Début" />
          <DateTimeField value={form.endAt} onChange={v => set('endAt', v)} placeholder="Fin (facultatif)" clearable />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={form.place} onChange={e => set('place', e.target.value)} placeholder="Lieu (salle, bar…)" />
          <input className={input} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Ville" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={form.priceText} onChange={e => set('priceText', e.target.value)} placeholder="Prix (ex. CHF 20, entrée libre)" />
          <select className={input} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="scheduled">Prévu</option><option value="full">Complet</option><option value="cancelled">Annulé</option><option value="postponed">Reporté</option>
          </select>
        </div>
        <input className={input} value={form.url} onChange={e => set('url', e.target.value)} placeholder="Lien vers la page de l’organisateur (https://…)" />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.family} onChange={e => set('family', e.target.checked)} />Adapté aux familles</label>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">{editing ? 'Enregistrer' : 'Publier'}</button>
          {editing && <button onClick={() => { setEditing(null); setForm(EMPTY); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Annuler</button>}
        </div>
      </div>
      {list?.map(e => (
        <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{e.title}</p>
            <p className="text-xs text-slate-500">{regionLabel(e.region)} · {dateFmt.format(new Date(e.startAt))} · {[e.place, e.city].filter(Boolean).join(', ')} · {catLabel(e.category)}{e.state !== 'published' ? ` · ${e.state}` : ''}</p>
          </div>
          <button onClick={() => edit(e)} className="text-xs text-indigo-700">Modifier</button>
          <button onClick={() => remove(e.id)} className="text-xs text-red-600">Supprimer</button>
        </div>
      ))}
    </div>
  );
}

function Places() {
  const [region, setRegion] = useState('ge');
  const [list, setList] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', kind: 'escape', city: '', website: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/discover/places', { params: { region } }).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { setList(null); load(); }, [region]);
  async function toggle(p: any) { await api.put(`/admin/discover/places/${p.id}/state`, { state: p.state === 'hidden' ? 'published' : 'hidden' }); load(); }
  async function add() {
    setMsg('');
    try { await api.post('/admin/discover/places', { ...form, region }); setForm({ name: '', kind: form.kind, city: '', website: '' }); load(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Erreur'); }
  }
  async function remove(id: string) { await api.delete(`/admin/discover/places/${id}`); load(); }
  const shown = (list ?? []).filter(p => !q || `${p.name} ${p.city ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={region} onChange={e => setRegion(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 bg-white">{REGIONS.map(r => <option key={r} value={r}>{regionLabel(r)}</option>)}</select>
        <input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrer" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-800">Ajouter un lieu</p>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom" />
          <select className={input} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KIND_ORDER.map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
          <input className={input} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ville" />
          <input className={input} value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="Site web (https://…)" />
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button onClick={add} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Ajouter</button>
      </div>
      {list === null && <p className="text-sm text-slate-400">Chargement…</p>}
      {shown.map(p => (
        <div key={p.id} className={`bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2 ${p.state === 'hidden' ? 'opacity-50' : ''}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
            <p className="text-xs text-slate-500 truncate">{kindLabel(p.kind)} · {p.city ?? '—'} · <a href={p.website} target="_blank" rel="noopener noreferrer" className="underline">{p.website}</a> · {p.source?.name}</p>
          </div>
          <button onClick={() => toggle(p)} className="text-xs text-indigo-700">{p.state === 'hidden' ? 'Réafficher' : 'Masquer'}</button>
          {p.source?.type === 'manual' && <button onClick={() => remove(p.id)} className="text-xs text-red-600">Supprimer</button>}
        </div>
      ))}
    </div>
  );
}

function Pros() {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { api.get('/admin/discover/pro-interests').then(r => setList(r.data)).catch(() => setList([])); }, []);
  if (list === null) return <p className="text-sm text-slate-400">Chargement…</p>;
  if (!list.length) return <p className="text-sm text-slate-500">Personne pour l’instant.</p>;
  return (
    <div className="space-y-2">
      {list.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-800">{p.name}{p.company ? ` · ${p.company}` : ''}{p.city ? ` · ${p.city}` : ''}</p>
          <p className="text-xs text-slate-500">{p.email} · {dateFmt.format(new Date(p.createdAt))}{p.user ? ` · @${p.user.pseudo}` : ''}</p>
          {p.message && <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{p.message}</p>}
        </div>
      ))}
    </div>
  );
}
