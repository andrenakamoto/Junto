import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChevronDown, ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, FolderInput, Loader2, Paperclip, Presentation, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';
import { isDemo } from '../../lib/demo';
import { NEW_CLASS, NewBadge, useIsNew } from '../../lib/newSince';
import { PlanTaskDoc, PlanTaskGroup } from '../../types';
import { intlLocale, t } from '../../i18n';

// Rubrique « Documents » des Tâches : PDF, Word, Excel, photos… communs à l'équipe, rangés par lot si l'on veut.
// Serveur : POST /attachments/plans/:id?via=taches[&groupId=], PUT /plans/task-docs/:id, DELETE /attachments/:id, ZIP.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,image/*';
const MAX_BYTES = 20 * 1024 * 1024;
const OPEN_KEY = 'evly_task_docs_open';
const dateFmt = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' });

const sizeLabel = (n: number) => n < 1024 * 1024 ? t('tasks.docs.kb', { n: Math.max(1, Math.round(n / 1024)) }) : t('tasks.docs.mb', { n: (n / 1024 / 1024).toFixed(1) });

function DocIcon({ doc, token }: { doc: PlanTaskDoc; token?: string }) {
  const m = doc.mimeType;
  if (m.startsWith('image/') && !m.includes('heic') && !m.includes('heif')) {
    return <img src={mediaUrl(doc.id, token, 120)} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 flex-shrink-0" />;
  }
  const [Icon, color] =
    m === 'application/pdf' ? [FileText, 'text-red-500'] :
    /sheet|excel|csv/.test(m) ? [FileSpreadsheet, 'text-emerald-600'] :
    /presentation|powerpoint/.test(m) ? [Presentation, 'text-orange-500'] :
    /word|opendocument\.text|rtf|text\/plain/.test(m) ? [FileText, 'text-sky-600'] :
    m.startsWith('image/') ? [FileImage, 'text-violet-500'] : [File, 'text-slate-400'];
  return <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><Icon size={18} className={color} /></div>;
}

// Ouvrir : PDF et photos s'affichent ; Word, Excel… se téléchargent (apps : navigateur du téléphone, qui propose de les ouvrir)
async function openDoc(doc: PlanTaskDoc, token?: string) {
  if (Capacitor.isNativePlatform()) {
    const { data } = await api.get(`/attachments/${doc.id}/download-token`);
    window.open(`${API_BASE}/attachments/${doc.id}/download?token=${data.token}`, '_system');
    return;
  }
  const inline = doc.mimeType === 'application/pdf' || (doc.mimeType.startsWith('image/') && !/heic|heif/.test(doc.mimeType));
  if (inline) { window.open(mediaUrl(doc.id, token), '_blank', 'noopener'); return; }
  const res = await api.get(`/attachments/${doc.id}/download`, { responseType: 'blob' });
  saveBlob(res.data, doc.name);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAll(plan: { id: string; title: string }) {
  if (Capacitor.isNativePlatform()) {
    const { data } = await api.get(`/attachments/plans/${plan.id}/task-docs-token`);
    window.open(`${API_BASE}/attachments/plans/${plan.id}/task-docs/download?token=${data.token}`, '_system');
    return;
  }
  const res = await api.get(`/attachments/plans/${plan.id}/task-docs/download`, { responseType: 'blob' });
  saveBlob(res.data, `${plan.title.replace(/[/\\:*?"<>|]/g, '_')} - documents.zip`);
}

export function TaskDocuments({ plan, docs, groups, pseudo, canManage, onChanged }: {
  plan: { id: string; title: string; mediaToken?: string };
  docs: PlanTaskDoc[];
  groups: PlanTaskGroup[];
  pseudo: string;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(OPEN_KEY); return v === null ? docs.length > 0 : v === '1'; } catch { return docs.length > 0; }
  });
  const [groupId, setGroupId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isNew = useIsNew();

  function toggle() {
    setOpen(o => { try { localStorage.setItem(OPEN_KEY, o ? '0' : '1'); } catch { /* stockage indisponible */ } return !o; });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    if (isDemo()) { setError(t('tasks.docs.demo')); return; }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) { setError(t('tasks.docs.tooBig', { name: file.name })); continue; }
        const form = new FormData();
        form.append('file', file);
        const q = new URLSearchParams({ via: 'taches', ...(groupId ? { groupId } : {}) });
        await api.post(`/attachments/plans/${plan.id}?${q}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('tasks.docs.uploadError'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
      await onChanged();
    }
  }

  async function act(action: () => Promise<unknown>) {
    setError('');
    try { await action(); } catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); }
    await onChanged();
  }

  const lots = [{ id: null as string | null, title: t('tasks.docs.general') }, ...groups.map(g => ({ id: g.id as string | null, title: g.title }))]
    .map(l => ({ ...l, docs: docs.filter(d => (d.groupId ?? null) === l.id) }))
    .filter(l => l.docs.length > 0);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <button onClick={toggle} aria-expanded={open} className="w-full flex items-center gap-2 px-3.5 py-3 text-left">
        <Paperclip size={16} className="text-indigo-600 flex-shrink-0" />
        <span className="font-semibold text-sm text-slate-800">{t('tasks.docs.title')}</span>
        {docs.length > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{docs.length}</span>}
        <span className="flex-1" />
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          <p className="text-xs text-slate-500">{t('tasks.docs.intro')}</p>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => input.current?.click()} disabled={busy}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              {busy ? t('tasks.docs.uploading') : t('tasks.docs.add')}
            </button>
            {groups.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                {t('tasks.docs.into')}
                <select value={groupId} onChange={e => setGroupId(e.target.value)}
                  className="max-w-[11rem] px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t('tasks.docs.general')}</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </label>
            )}
            <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => upload(e.target.files)} />
          </div>
          <p className="text-[11px] text-slate-400">{t('tasks.docs.formats')}</p>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {docs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t('tasks.docs.empty')}</p>
          ) : (
            <div className="space-y-3">
              {lots.map(lot => (
                <div key={lot.id ?? 'general'}>
                  {(groups.length > 0 || lot.id) && <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{lot.title}</p>}
                  <div className="space-y-1.5">
                    {lot.docs.map(d => {
                      const fresh = isNew('taches', d.createdAt) && d.uploadedBy.toLowerCase() !== pseudo.toLowerCase();
                      const canDelete = canManage || d.uploadedBy.toLowerCase() === pseudo.toLowerCase();
                      return (
                        <div key={d.id} className={`rounded-xl border border-slate-200 bg-slate-50/60 ${fresh ? NEW_CLASS : ''}`}>
                          <div className="flex items-center gap-2.5 p-2">
                            <button onClick={() => act(() => openDoc(d, plan.mediaToken))} className="flex items-center gap-2.5 flex-1 min-w-0 text-left" title={t('tasks.docs.open')}>
                              <DocIcon doc={d} token={plan.mediaToken} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="block text-sm font-medium text-slate-800 truncate">{d.name}</span>
                                  {fresh && <NewBadge />}
                                </span>
                                <span className="block text-xs text-slate-400 truncate">
                                  {sizeLabel(d.size)} · @{d.uploadedBy} · {dateFmt.format(new Date(d.createdAt))}
                                </span>
                              </span>
                            </button>
                            {groups.length > 0 && (
                              <button onClick={() => setMoving(moving === d.id ? null : d.id)} title={t('tasks.docs.move')} aria-label={t('tasks.docs.move')}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white">
                                <FolderInput size={16} />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { if (confirm(t('tasks.docs.deleteConfirm', { name: d.name }))) act(() => api.delete(`/attachments/${d.id}`)); }}
                                title={t('tasks.docs.delete')} aria-label={t('tasks.docs.delete')}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-white">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          {moving === d.id && (
                            <div className="flex items-center gap-2 px-2 pb-2">
                              <span className="text-xs text-slate-500">{t('tasks.docs.into')}</span>
                              <select autoFocus value={d.groupId ?? ''}
                                onChange={e => { setMoving(null); act(() => api.put(`/plans/task-docs/${d.id}`, { groupId: e.target.value || null })); }}
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">{t('tasks.docs.general')}</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <button disabled={zipping} onClick={async () => { setZipping(true); await act(() => downloadAll(plan)); setZipping(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{t('tasks.docs.downloadAll')}
              </button>
              <p className="text-[11px] text-slate-400">{t('tasks.docs.expiry')}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
