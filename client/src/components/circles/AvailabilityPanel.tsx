import { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { AvailabilityEntry, AvailabilitySlot, Circle, Plan } from '../../types';
import api from '../../services/api';
import { t } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { isCircleManager } from '../../lib/settings';
import { AVAILABILITY_NOTE_MAX, AVAILABILITY_TAGS, AVAILABILITY_TAGS_MAX, readyThreshold, slotLabel, suggestedPlan, tagEmoji, tagLabel } from '../../lib/availability';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { CreatePlanModal } from '../plans/CreatePlanModal';

// « Je suis dispo » en tête de la liste des Plans d'un Cercle : qui est libre maintenant ou ce soir, et dès que le
// seuil du Cercle est atteint, « Lancer un Plan » (titre et heure proposés, les dispos s'effacent ensuite)
export function AvailabilityPanel({ circle, circles, onPlanCreated }: {
  circle: Circle; circles: Circle[]; onPlanCreated: (plan: Plan) => void;
}) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [threshold, setThreshold] = useState(circle.availabilityThreshold ?? 3);
  const [editing, setEditing] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Rechargé quand le Cercle change (temps réel : circle-updated recharge la liste des Cercles)
  const dispoKey = `${circle.id}:${circle.dispo?.count ?? 0}:${circle.dispo?.pseudos.join(',') ?? ''}`;
  function load() {
    api.get(`/availability/circles/${circle.id}`)
      .then(res => { setEntries(res.data.entries ?? []); setThreshold(res.data.threshold ?? 3); })
      .catch(() => {});
  }
  useEffect(load, [dispoKey]);

  const mine = entries.find(e => e.user.id === user?.id);
  const count = entries.length;
  const needed = readyThreshold(entries, threshold);
  const ready = count >= needed;
  const canCreate = circle.planCreationMode !== 'creator' || isCircleManager(circle, user?.id);

  async function stop() {
    await api.delete(`/availability/circles/${circle.id}`).catch(() => {});
    load();
  }

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${ready ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-slate-900">🟢 {t('circle.dispo.who')}</p>
        {mine ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">{t('circle.dispo.edit')}</button>
            <button onClick={stop} className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">{t('circle.dispo.stop')}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
            {count > 0 ? t('circle.dispo.imToo') : t('circle.dispo.button')}
          </button>
        )}
      </div>

      {count === 0 ? (
        <p className="text-xs text-slate-400 mt-1">{t('circle.dispo.alone')}</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {entries.map(e => (
            <div key={e.user.id} className="flex items-center gap-2">
              <Avatar pseudo={e.user.pseudo} size="sm" person={{ userId: e.user.id, pseudo: e.user.pseudo, firstName: e.user.firstName }} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-800 truncate">
                  <span className="font-semibold">{e.user.id === user?.id ? t('circle.dispo.youAre', { slot: slotLabel(e.slot) }) : (e.user.firstName || `@${e.user.pseudo}`)}</span>
                  {e.user.id !== user?.id && <span className="text-slate-500"> · {slotLabel(e.slot)}</span>}
                  {e.minPeople != null && e.minPeople !== threshold && <span className="text-slate-400"> · {t('circle.dispo.minShort', { count: e.minPeople })}</span>}
                </p>
                {e.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {e.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                        <span className="text-base leading-none">{tagEmoji(tag)}</span>{tagLabel(tag)}
                      </span>
                    ))}
                  </div>
                )}
                {e.note && <p className="text-[11px] text-slate-500 italic truncate">« {e.note} »</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {count > 0 && (ready ? (
        <div className="mt-2.5 flex items-center gap-2">
          <p className="flex-1 text-xs font-semibold text-emerald-800">{t('circle.dispo.ready', { count })}</p>
          {canCreate && (
            <button onClick={() => setLaunching(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              <PartyPopper size={13} />{t('circle.dispo.launch')}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">{t('circle.dispo.needMore', { count: needed - count })}</p>
      ))}

      {editing && (
        <AvailabilityModal
          current={mine ?? null}
          circle={circle}
          threshold={threshold}
          circles={circles}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
      {launching && (() => {
        const s = suggestedPlan(entries);
        return (
          <CreatePlanModal
            circleId={circle.id}
            circleMembers={circle.members}
            suggestedTitle={s.title}
            fromAvailability={{ start: s.start }}
            onClose={() => setLaunching(false)}
            onCreated={plan => { setLaunching(false); setEntries([]); onPlanCreated(plan); }}
          />
        );
      })()}
    </div>
  );
}

// Fenêtre « Je suis dispo » : quand, pour quoi (étiquettes), un petit mot, et dans quels Cercles
function AvailabilityModal({ current, circle, threshold, circles, onClose, onSaved }: {
  current: AvailabilityEntry | null; circle: Circle; threshold: number; circles: Circle[]; onClose: () => void; onSaved: () => void;
}) {
  const [slot, setSlot] = useState<AvailabilitySlot>(current?.slot ?? 'tonight');
  const [tags, setTags] = useState<string[]>(current?.tags ?? []);
  const [note, setNote] = useState(current?.note ?? '');
  // Vide = seuil du Cercle (chaque Cercle coché garde le sien)
  const [minPeople, setMinPeople] = useState<number | null>(current?.minPeople ?? null);
  const usable = circles.filter(c => !c.isPersonal && c.availabilityEnabled !== false);
  const [picked, setPicked] = useState<Set<string>>(new Set([circle.id]));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  function toggleTag(key: string) {
    setTags(prev => prev.includes(key) ? prev.filter(x => x !== key) : prev.length >= AVAILABILITY_TAGS_MAX ? prev : [...prev, key]);
  }
  function toggleCircle(id: string) {
    setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function send() {
    if (picked.size === 0) { setError(t('circle.dispo.noCircle')); return; }
    setSending(true);
    setError('');
    try {
      for (const id of picked) await api.put(`/availability/circles/${id}`, { slot, tags, note: note.trim() || null, minPeople });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      setSending(false);
    }
  }

  const chip = (active: boolean) => `px-3 py-1.5 rounded-full border text-sm transition-colors ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`;
  return (
    <Modal title={t('circle.dispo.title')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.dispo.when')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(['now', 'tonight'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSlot(s)}
                className={`rounded-xl border px-3 py-2.5 text-left ${slot === s ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="block text-sm font-semibold text-slate-900">{t(s === 'now' ? 'circle.dispo.now' : 'circle.dispo.tonight')}</span>
                <span className="block text-xs text-slate-500">{t(s === 'now' ? 'circle.dispo.nowHint' : 'circle.dispo.tonightHint')}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.dispo.what')}</p>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABILITY_TAGS.map(x => (
              <button key={x.key} type="button" onClick={() => toggleTag(x.key)} className={chip(tags.includes(x.key))}>
                <span className="text-base leading-none">{x.emoji}</span> {tagLabel(x.key)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.dispo.note')}</p>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={AVAILABILITY_NOTE_MAX} placeholder={t('circle.dispo.notePlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.dispo.minPeople')}</p>
          <select value={minPeople ?? threshold} onChange={e => { const n = Number(e.target.value); setMinPeople(n === threshold ? null : n); }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {Array.from({ length: 9 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{t('circle.dispo.people', { count: n })}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">{t('circle.dispo.minPeopleHint', { count: threshold })}</p>
        </div>

        {usable.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.dispo.circles')}</p>
            <div className="max-h-44 overflow-y-auto space-y-1">
              {usable.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggleCircle(c.id)} className="rounded accent-emerald-600" />
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                  <span className="text-sm text-slate-800 truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={send} disabled={sending}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
          🟢 {sending ? t('circle.dispo.sending') : t('circle.dispo.send')}
        </button>
      </div>
    </Modal>
  );
}
