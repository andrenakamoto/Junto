import { useEffect, useRef, useState } from 'react';
import { Heart, X, Undo2, ExternalLink, ImagePlus, Loader2, Plus, Trash2, Check } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';
import { DateTimeField } from '../ui/DateTimeField';
import { intlLocale, t } from '../../i18n';

// Match de groupe (serveur : routes/matchPoll.ts), dans l'onglet Votes à côté des sondages. Chacun fait
// défiler les propositions (oui à droite, non à gauche) ; oui de tout le monde = « C'est un match ! ».
// Le créateur du Plan applique ensuite le choix au Plan (lieu, informations importantes).

type Person = { id: string; pseudo: string; firstName?: string | null };
type Card = { id: string; label: string; note: string | null; url: string | null; attachmentId: string | null; createdBy: Person | null };
type Result = Card & { yes: number; no: number; canDelete: boolean; likers?: string[] };
export interface Match {
  id: string; question: string; anonymous: boolean; deadline: string | null; closed: boolean; chosenOptionId: string | null;
  createdBy: Person | null; canDelete: boolean; canChoose: boolean; isPlayer: boolean;
  playerCount: number; finishedCount: number; allFinished: boolean;
  deck: Card[]; myLikes: string[]; matchedIds: string[]; results: Result[] | null; optionCount: number;
}
type OptionDraft = { label: string; note: string; url: string; attachmentId: string | null; preview: string | null };

const emptyOption = (): OptionDraft => ({ label: '', note: '', url: '', attachmentId: null, preview: null });
const fmtDay = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';

// Photo d'une proposition : un fichier du Plan réservé au match (?via=match, masqué de l'onglet Infos)
async function uploadMatchPhoto(planId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file, `match-${file.name || 'photo.jpg'}`);
  const { data } = await api.post(`/attachments/plans/${planId}?via=match`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.id;
}

function OptionFields({ planId, value, onChange, onRemove }: { planId: string; value: OptionDraft; onChange: (v: OptionDraft) => void; onRemove?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError(t('votes.match.photoTooBig')); return; }
    setUploading(true); setError('');
    try { onChange({ ...value, attachmentId: await uploadMatchPhoto(planId, file), preview: URL.createObjectURL(file) }); }
    catch (err: any) { setError(err?.response?.data?.error || t('votes.match.photoFailed')); }
    finally { setUploading(false); }
  }
  return (
    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
      <div className="flex gap-2 items-start">
        <button type="button" onClick={() => fileRef.current?.click()} className="w-14 h-14 flex-shrink-0 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden text-slate-400" title={t('votes.match.photo')}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : value.preview ? <img src={value.preview} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={18} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <input value={value.label} onChange={e => onChange({ ...value, label: e.target.value })} maxLength={80} placeholder={t('votes.match.labelPlaceholder')} className={input} />
          <input value={value.note} onChange={e => onChange({ ...value, note: e.target.value })} maxLength={200} placeholder={t('votes.match.notePlaceholder')} className={input} />
          <input value={value.url} onChange={e => onChange({ ...value, url: e.target.value })} placeholder={t('votes.match.urlPlaceholder')} className={input} />
        </div>
        {onRemove && <button type="button" onClick={onRemove} className="p-1 text-slate-400 hover:text-red-500" aria-label={t('votes.match.remove')}><X size={15} /></button>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const toPayload = (o: OptionDraft) => ({ label: o.label.trim(), note: o.note.trim() || null, url: o.url.trim() || null, attachmentId: o.attachmentId });

export function MatchCreateForm({ plan, onDone, onCancel }: { plan: Plan; onDone: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()]);
  const [anonymous, setAnonymous] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = options.filter(o => o.label.trim());
  async function create() {
    if (!question.trim() || valid.length < 2) { setError(t('votes.match.needOptions')); return; }
    setBusy(true); setError('');
    try {
      await api.post(`/plans/${plan.id}/matches`, { question: question.trim(), options: valid.map(toPayload), anonymous, deadline: deadline ? new Date(deadline).toISOString() : null });
      onDone();
    } catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
    finally { setBusy(false); }
  }
  return (
    <div className="bg-white rounded-xl border border-pink-200 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-slate-800 text-sm">{t('votes.match.newMatch')}</p>
      <p className="text-xs text-slate-500">{t('votes.match.intro')}</p>
      <input autoFocus value={question} onChange={e => setQuestion(e.target.value)} maxLength={150} placeholder={t('votes.match.questionPlaceholder')} className={input} />
      {options.map((o, i) => (
        <OptionFields key={i} planId={plan.id} value={o} onChange={v => setOptions(options.map((x, j) => (j === i ? v : x)))} onRemove={options.length > 2 ? () => setOptions(options.filter((_, j) => j !== i)) : undefined} />
      ))}
      {options.length < 15 && (
        <button type="button" onClick={() => setOptions([...options, emptyOption()])} className="text-sm text-indigo-600 font-medium flex items-center gap-1"><Plus size={14} /> {t('votes.match.addOption')}</button>
      )}
      <p className="text-xs text-slate-400">{t('votes.match.everyoneCanAdd')}</p>
      <div>
        <p className="text-sm text-slate-600 mb-1">{t('votes.match.deadline')}</p>
        <DateTimeField value={deadline} onChange={setDeadline} placeholder={t('votes.match.noDeadline')} clearable defaultTime="18:00" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} className="accent-indigo-600" />
        {t('votes.match.anonymous')}
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? t('common.creating') : t('votes.match.launch')}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-600">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// Les cartes à faire glisser (plein écran)
function SwipeDeck({ match, plan, onClose }: { match: Match; plan: Plan; onClose: () => void }) {
  const [cards, setCards] = useState(match.deck);
  const [history, setHistory] = useState<Card[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const start = useRef<number | null>(null);
  const total = match.optionCount;
  const top = cards[0];

  async function decide(like: boolean) {
    if (!top || leaving) return;
    setLeaving(like ? 'right' : 'left');
    try { await api.post(`/plans/matches/options/${top.id}/swipe`, { like }); } catch { /* rechargé à la fermeture */ }
    window.setTimeout(() => { setHistory(h => [top, ...h]); setCards(c => c.slice(1)); setLeaving(null); setDx(0); }, 220);
  }
  async function undo() {
    const last = history[0];
    if (!last) return;
    try { await api.delete(`/plans/matches/options/${last.id}/swipe`); } catch { return; }
    setHistory(h => h.slice(1)); setCards(c => [last, ...c]);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') decide(true); else if (e.key === 'ArrowLeft') decide(false); else if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const x = leaving === 'right' ? 600 : leaving === 'left' ? -600 : dx;
  const done = total - cards.length;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col" style={{ paddingTop: 'var(--sa-top)', paddingBottom: 'var(--sa-bottom)' }}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/10" aria-label={t('common.close')}><X size={18} /></button>
        <p className="flex-1 font-semibold truncate">{match.question}</p>
        <span className="text-xs text-white/60">{Math.min(done + 1, total)} / {total}</span>
      </div>
      <div className="h-1 mx-4 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-pink-400" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} /></div>
      <div className="flex-1 flex items-center justify-center px-6 py-4 select-none">
        {top ? (
          <div
            className="relative w-full max-w-sm aspect-[3/4] rounded-3xl bg-white shadow-2xl overflow-hidden touch-none"
            style={{ transform: `translateX(${x}px) rotate(${x / 20}deg)`, transition: start.current === null ? 'transform .22s ease-out' : 'none' }}
            onPointerDown={e => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={e => { if (start.current !== null) setDx(e.clientX - start.current); }}
            onPointerUp={() => { const d = dx; start.current = null; if (d > 90) decide(true); else if (d < -90) decide(false); else setDx(0); }}
            onPointerCancel={() => { start.current = null; setDx(0); }}
          >
            {top.attachmentId
              ? <img src={mediaUrl(top.attachmentId, plan.mediaToken, 800)} alt="" draggable={false} className="w-full h-3/5 object-cover" />
              : <div className="w-full h-3/5 bg-gradient-to-br from-pink-500 to-rose-700 flex items-center justify-center text-6xl">❤️</div>}
            <div className="p-4">
              <p className="text-xl font-bold text-slate-900">{top.label}</p>
              {top.note && <p className="text-sm text-slate-600 mt-1">{top.note}</p>}
              {top.url && <a href={top.url} target="_blank" rel="noopener noreferrer" onPointerDown={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-sm text-indigo-600 mt-2">{t('votes.match.see')} <ExternalLink size={13} /></a>}
              {top.createdBy && <p className="text-xs text-slate-400 mt-2">{t('votes.match.proposedBy', { name: top.createdBy.firstName ?? `@${top.createdBy.pseudo}` })}</p>}
            </div>
            {dx > 30 && <span className="absolute top-5 left-5 px-3 py-1 rounded-xl border-4 border-emerald-500 text-emerald-500 text-2xl font-black rotate-[-12deg] bg-white/80">{t('votes.match.yesStamp')}</span>}
            {dx < -30 && <span className="absolute top-5 right-5 px-3 py-1 rounded-xl border-4 border-rose-500 text-rose-500 text-2xl font-black rotate-[12deg] bg-white/80">{t('votes.match.noStamp')}</span>}
          </div>
        ) : (
          <div className="text-center text-white">
            <p className="text-5xl">🎉</p>
            <p className="text-lg font-semibold mt-2">{t('votes.match.allSeen')}</p>
            <p className="text-sm text-white/70 mt-1">{t('votes.match.waiting', { n: match.finishedCount + (match.deck.length ? 1 : 0), total: match.playerCount })}</p>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold">{t('votes.match.seeResults')}</button>
          </div>
        )}
      </div>
      {top && (
        <div className="flex items-center justify-center gap-6 pb-6">
          <button onClick={() => decide(false)} className="w-16 h-16 rounded-full bg-white text-rose-500 shadow-lg flex items-center justify-center" aria-label={t('votes.match.no')}><X size={30} strokeWidth={3} /></button>
          <button onClick={undo} disabled={!history.length} className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-30" aria-label={t('votes.match.undo')}><Undo2 size={18} /></button>
          <button onClick={() => decide(true)} className="w-16 h-16 rounded-full bg-white text-emerald-500 shadow-lg flex items-center justify-center" aria-label={t('votes.match.yes')}><Heart size={28} fill="currentColor" /></button>
        </div>
      )}
    </div>
  );
}

function ChooseModal({ match, option, plan, onClose, onDone }: { match: Match; option: Result; plan: Plan; onClose: () => void; onDone: () => void }) {
  const [setLocation, setSetLocation] = useState(true);
  const [addToInfo, setAddToInfo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    setBusy(true); setError('');
    try { await api.post(`/plans/matches/${match.id}/choose`, { optionId: option.id, setLocation, addToInfo }); onDone(); }
    catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-slate-900">{t('votes.match.decided', { label: option.label })}</p>
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={setLocation} onChange={e => setSetLocation(e.target.checked)} className="accent-indigo-600 mt-0.5" />
          <span>{t('votes.match.setLocation', { label: option.label })}{plan.location ? <span className="block text-xs text-slate-400">{t('votes.match.replaces', { location: plan.location })}</span> : null}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={addToInfo} onChange={e => setAddToInfo(e.target.checked)} className="accent-indigo-600 mt-0.5" />
          <span>{t('votes.match.addToInfo')}</span>
        </label>
        <p className="text-xs text-slate-500">{t('votes.match.chooseHint')}</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-slate-600">{t('common.cancel')}</button>
          <button onClick={confirm} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

export function MatchCard({ match, plan, onChanged }: { match: Match; plan: Plan; onChanged: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<OptionDraft>(emptyOption());
  const [choosing, setChoosing] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const matched = match.results?.filter(r => match.matchedIds.includes(r.id)) ?? [];
  const chosen = match.results?.find(r => r.id === match.chosenOptionId);

  async function addOption() {
    if (!draft.label.trim()) return;
    setError('');
    try { await api.post(`/plans/matches/${match.id}/options`, toPayload(draft)); setDraft(emptyOption()); setAdding(false); onChanged(); }
    catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
  }
  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); onChanged(); } catch (err: any) { setError(err?.response?.data?.error || t('common.retryError')); }
  }

  return (
    <div className="bg-white rounded-xl border border-pink-200 shadow-sm p-4">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold text-slate-800 text-sm">❤️ {match.question}</p>
        {match.canDelete && <button onClick={() => { if (confirm(t('votes.match.deleteConfirm'))) run(() => api.delete(`/plans/matches/${match.id}`)); }} className="text-slate-300 hover:text-red-500" aria-label={t('votes.match.delete')}><Trash2 size={14} /></button>}
      </div>
      <p className="text-xs text-slate-400 mt-0.5">
        {match.closed ? t('votes.match.ended') : t('votes.match.finished', { count: match.finishedCount, total: match.playerCount })}
        {match.deadline && !match.closed && t('votes.match.resultOn', { date: fmtDay(match.deadline) })}
        {match.anonymous && t('votes.match.anonymousTag')}
      </p>

      {chosen ? (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium flex items-center gap-2"><Check size={16} /> {t('votes.match.decided', { label: chosen.label })}</div>
      ) : matched.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white">
          <p className="font-bold">{matched.length > 1 ? t('votes.match.itsAMatchMany') : t('votes.match.itsAMatch')}</p>
          <p className="text-sm">{matched.map(m => m.label).join(' · ')}</p>
        </div>
      )}
      {!match.results && match.matchedIds.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-sm font-semibold">{t('votes.match.alreadyMatch')}</div>
      )}

      {match.deck.length > 0 && (
        <button onClick={() => setPlaying(true)} className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold flex items-center justify-center gap-2">
          <Heart size={17} fill="currentColor" /> {match.deck.length === match.optionCount ? t('votes.match.play') : t('votes.match.continue')} {t('votes.match.cards', { count: match.deck.length })}
        </button>
      )}
      {!match.isPlayer && !match.closed && <p className="mt-2 text-xs text-slate-500">{t('votes.match.answerToPlay')}</p>}

      {match.results && (
        <div className="mt-3 space-y-2">
          {!match.allFinished && !match.closed && <p className="text-xs text-slate-400">{t('votes.match.provisional')}</p>}
          {match.results.map(r => {
            const isMatch = match.matchedIds.includes(r.id);
            return (
              <div key={r.id} className={`flex gap-2.5 p-2 rounded-xl border ${isMatch ? 'border-pink-300 bg-pink-50' : 'border-slate-200'}`}>
                {r.attachmentId
                  ? <img src={mediaUrl(r.attachmentId, plan.mediaToken, 200)} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-lg bg-pink-100 text-pink-600 font-bold text-lg flex items-center justify-center flex-shrink-0">{isMatch ? '❤️' : r.label.charAt(0).toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                  {r.note && <p className="text-xs text-slate-500 truncate">{r.note}</p>}
                  <p className="text-xs text-slate-400">
                    <span className="text-emerald-600 font-semibold">{t('votes.match.yesCount', { count: r.yes })}</span>{t('votes.match.outOf', { total: match.playerCount })}
                    {r.likers && r.likers.length > 0 && ` · ${r.likers.join(', ')}`}
                    {r.url && <> · <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600">{t('votes.match.see')}</a></>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {match.canChoose && <button onClick={() => setChoosing(r)} className="text-xs font-semibold text-indigo-600">{t('votes.match.choose')}</button>}
                  {r.canDelete && !match.closed && <button onClick={() => { if (confirm(t('votes.match.removeConfirm'))) run(() => api.delete(`/plans/matches/options/${r.id}`)); }} className="text-slate-300 hover:text-red-500" aria-label={t('votes.match.remove')}><Trash2 size={12} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!match.closed && match.isPlayer && (adding ? (
        <div className="mt-3 space-y-2">
          <OptionFields planId={plan.id} value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <button onClick={addOption} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium">{t('common.add')}</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600">{t('common.cancel')}</button>
          </div>
        </div>
      ) : match.optionCount < 15 && (
        <button onClick={() => setAdding(true)} className="mt-3 text-sm text-indigo-600 font-medium flex items-center gap-1"><Plus size={14} /> {t('votes.match.proposeMore')}</button>
      ))}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {playing && <SwipeDeck match={match} plan={plan} onClose={() => { setPlaying(false); onChanged(); }} />}
      {choosing && <ChooseModal match={match} option={choosing} plan={plan} onClose={() => setChoosing(null)} onDone={() => { setChoosing(null); onChanged(); }} />}
    </div>
  );
}
