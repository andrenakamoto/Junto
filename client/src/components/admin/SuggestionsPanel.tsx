import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import api from '../../services/api';
import { kindLabel, statusOf, Suggestion, SuggestionStatus, SUGGESTION_STATUSES } from '../../lib/suggestions';

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const PLATFORMS: Record<string, string> = { web: 'site', android: 'Android', ios: 'iPhone' };

// Suggestions des membres (« Proposer une amélioration »). Passer en « Prévue » ou « Réalisée »
// envoie une notification à la personne (routes/admin.ts).
export function SuggestionsPanel() {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  useEffect(() => {
    api.get('/admin/suggestions').then(res => setList(res.data)).catch(() => setList([]));
  }, []);

  function replaceItem(s: Suggestion) {
    setList(prev => (prev ?? []).map(x => x.id === s.id ? { ...x, ...s } : x));
  }

  const shown = (list ?? []).filter(s => filter === 'all' || !['done', 'declined'].includes(s.status));
  const newCount = (list ?? []).filter(s => s.status === 'new').length;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={18} className="text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-800">Suggestions</h2>
        {newCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white">{newCount} nouvelle{newCount > 1 ? 's' : ''}</span>}
        <select value={filter} onChange={e => setFilter(e.target.value as 'open' | 'all')} className="ml-auto text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value="open">À traiter</option>
          <option value="all">Toutes</option>
        </select>
      </div>
      {list === null && <p className="text-sm text-slate-400">Chargement…</p>}
      {list && shown.length === 0 && <p className="text-sm text-slate-500">Aucune suggestion {filter === 'open' ? 'à traiter' : 'pour l’instant'}.</p>}
      <div className="space-y-3">
        {shown.map(s => <SuggestionRow key={s.id} s={s} onSaved={replaceItem} />)}
      </div>
    </section>
  );
}

function SuggestionRow({ s, onSaved }: { s: Suggestion; onSaved: (s: Suggestion) => void }) {
  const [status, setStatus] = useState<SuggestionStatus>(s.status);
  const [reply, setReply] = useState(s.reply ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = status !== s.status || reply.trim() !== (s.reply ?? '');
  const notifies = status !== s.status && (status === 'planned' || status === 'done');

  async function save() {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/suggestions/${s.id}`, { status, reply });
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  const st = statusOf(s.status);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{kindLabel(s.kind)}</span>
        <span>· @{s.user?.pseudo}{s.user?.firstName ? ` (${s.user.firstName})` : ''}</span>
        <span>· {dateFmt.format(new Date(s.createdAt))}</span>
        {s.platform && <span>· {PLATFORMS[s.platform] ?? s.platform}{s.appVersion ? ` ${s.appVersion}` : ''}</span>}
        <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${st.className}`}>{st.label}</span>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-line break-words">{s.content}</p>
      <div className="flex flex-wrap gap-2 items-start pt-1">
        <select value={status} onChange={e => setStatus(e.target.value as SuggestionStatus)} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          {SUGGESTION_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          value={reply}
          onChange={e => setReply(e.target.value.slice(0, 500))}
          placeholder="Réponse visible par la personne (facultatif)"
          className="flex-1 min-w-[12rem] text-sm border border-slate-200 rounded-lg px-2.5 py-1.5"
        />
        <button onClick={save} disabled={!dirty || saving} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-40">
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
      {notifies && <p className="text-xs text-amber-700">La personne sera prévenue par une notification.</p>}
    </div>
  );
}
