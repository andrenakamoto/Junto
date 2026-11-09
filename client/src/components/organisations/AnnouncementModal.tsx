import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';

const MAX = 2000;
interface Options { unitLabel: string | null; teamLabel: string | null; circles: { id: string; name: string; orgKind: 'unit' | 'team' | 'auto' }[] }
interface Sent { announcementId: string; content: string; createdAt: string; circles: string[] }

const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`;

// Annonce d'une Organisation : un message dans la Discussion de chaque Cercle choisi
export function AnnouncementModal({ organisationId, onClose }: { organisationId: string; onClose: () => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [text, setText] = useState('');
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [recent, setRecent] = useState<Sent[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fail = (e: any) => setError(e.response?.data?.error ?? t('common.error'));
  const loadRecent = useCallback(() => api.get(`/organisations/${organisationId}/announcements`).then(r => setRecent(r.data)).catch(() => {}), [organisationId]);
  useEffect(() => {
    api.get(`/organisations/${organisationId}/audience`, { params: { action: 'send_announcement' } }).then(r => setOptions(r.data)).catch(fail);
    loadRecent();
  }, [organisationId, loadRecent]);

  const key = circleIds.join(',');
  useEffect(() => {
    if (!circleIds.length) { setCount(null); return; }
    const timer = setTimeout(() => {
      api.post(`/organisations/${organisationId}/audience-count`, { circleIds }).then(r => setCount(r.data.count)).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [key]);

  async function send() {
    setResult('');
    if (!text.trim()) { setError(t('org.announce.empty')); return; }
    if (!circleIds.length) { setError(t('org.announce.none')); return; }
    setError('');
    setSending(true);
    try {
      const { data } = await api.post(`/organisations/${organisationId}/announcements`, { content: text.trim(), circleIds });
      setResult([t('org.announce.sent', { count: data.sent }), data.skipped.length ? t('org.announce.skipped', { names: data.skipped.join(', ') }) : ''].filter(Boolean).join(' '));
      setText('');
      setCircleIds([]);
      loadRecent();
    } catch (e) { fail(e); } finally { setSending(false); }
  }
  async function saveEdit() {
    if (!editing) return;
    if (!editing.text.trim()) { setError(t('org.announce.empty')); return; }
    await api.put(`/organisations/${organisationId}/announcements/${editing.id}`, { content: editing.text.trim() }).then(() => { setEditing(null); setError(''); loadRecent(); }).catch(fail);
  }
  async function remove(id: string) {
    await api.delete(`/organisations/${organisationId}/announcements/${id}`).then(() => { setConfirming(null); loadRecent(); }).catch(fail);
  }

  const everyone = options?.circles.map(c => c.id) ?? [];
  const isAll = everyone.length > 0 && everyone.every(id => circleIds.includes(id));
  const sections = options ? ([['unit', options.unitLabel || t('org.words.units')], ['auto', t('org.words.auto')], ['team', options.teamLabel || t('org.words.teams')]] as const) : [];

  return (
    <Modal title={t('org.announce.title')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">{t('org.announce.intro')}</p>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t('org.announce.message')}</span>
        <textarea value={text} maxLength={MAX} rows={4} placeholder={t('org.announce.placeholder')} onChange={e => { setText(e.target.value); setError(''); }}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </label>
      {options && (
        <div className="mt-3 space-y-2.5">
          <p className="text-sm font-medium text-slate-700">{t('org.announce.forWho')}</p>
          <button type="button" aria-pressed={isAll} onClick={() => setCircleIds(isAll ? [] : everyone)} className={chip(isAll)}>{t('org.announce.all')}</button>
          {sections.map(([kind, label]) => {
            const list = options.circles.filter(c => c.orgKind === kind);
            if (!list.length) return null;
            return (
              <div key={kind}>
                <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map(c => { const on = circleIds.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => { setError(''); setCircleIds(on ? circleIds.filter(x => x !== c.id) : [...circleIds, c.id]); }} className={chip(on)}>{c.name}</button>; })}
                </div>
              </div>
            );
          })}
          {count !== null && <p className="text-sm font-medium text-indigo-800">{t('org.announce.count', { count })}</p>}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {result && <p className="mt-3 text-sm text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg">{result}</p>}
      <div className="flex justify-end mt-4">
        <button type="button" onClick={send} disabled={sending} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">{sending ? t('org.announce.sending') : t('org.announce.send')}</button>
      </div>
      {recent.length > 0 && (
        <section className="mt-5 pt-4 border-t border-slate-100 space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('org.announce.recent')}</h3>
          {recent.map(a => (
            <div key={a.announcementId} className="rounded-xl border border-slate-200 p-3">
              {editing?.id === a.announcementId ? (
                <textarea value={editing.text} maxLength={MAX} rows={3} aria-label={t('org.announce.edit')} onChange={e => setEditing({ id: a.announcementId, text: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900" />
              ) : <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{a.content}</p>}
              <p className="text-xs text-slate-500 mt-1">{t('org.announce.in', { names: a.circles.join(', ') })}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-sm font-medium">
                {editing?.id === a.announcementId ? (<>
                  <button type="button" onClick={saveEdit} className="text-indigo-700">{t('org.announce.save')}</button>
                  <button type="button" onClick={() => setEditing(null)} className="text-slate-500">{t('common.cancel')}</button>
                </>) : confirming === a.announcementId ? (<>
                  <button type="button" onClick={() => remove(a.announcementId)} className="text-red-600">{t('org.announce.confirmRemove')}</button>
                  <button type="button" onClick={() => setConfirming(null)} className="text-slate-500">{t('common.cancel')}</button>
                </>) : (<>
                  <button type="button" onClick={() => setEditing({ id: a.announcementId, text: a.content })} className="text-indigo-700">{t('org.announce.edit')}</button>
                  <button type="button" onClick={() => setConfirming(a.announcementId)} className="text-red-600">{t('org.announce.remove')}</button>
                </>)}
              </div>
            </div>
          ))}
        </section>
      )}
    </Modal>
  );
}
