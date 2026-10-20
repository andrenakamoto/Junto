import { useState, useRef } from 'react';
import { AlignLeft, MapPin, Paperclip, FileText, File, Trash2, Download, Loader2, Images, ImagePlus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Plan, Attachment } from '../../types';
import api from '../../services/api';
import { mediaUrl } from '../../lib/media';
import { isEnabled } from '../../lib/settings';
import { ImportantInfoCard } from './ImportantInfoCard';
import { downloadPlanPhotos } from '../../lib/planPhotos';
import { isVoiceNote } from '../../lib/media';
import { intlLocale, t } from '../../i18n';
import { RichText } from '../../lib/richText';

interface Props {
  plan: Plan;
  onPlanUpdated: (plan: Plan) => void;
  pseudo: string;
  userId: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return t('plan.infos.kb', { n: (bytes / 1024).toFixed(0) });
  return t('plan.infos.mb', { n: (bytes / (1024 * 1024)).toFixed(1) });
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}


export function InfosTab({ plan, onPlanUpdated, pseudo, userId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDownloadAllPhotos() {
    setZipping(true);
    setZipError('');
    try {
      await downloadPlanPhotos(plan);
    } catch {
      setZipError(t('plan.infos.zipError'));
    } finally {
      setZipping(false);
    }
  }

  async function refresh() {
    const { data } = await api.get(`/plans/${plan.id}`);
    onPlanUpdated(data);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t('plan.infos.fileTooBig'));
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/attachments/plans/${plan.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refresh();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || t('plan.infos.uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(att: Attachment) {
    setDeletingId(att.id);
    try {
      await api.delete(`/attachments/${att.id}`);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const showFiles = isEnabled(plan, 'fichiers');
  // Affiche du Plan (flyer…) : « affiche-… », une seule, en grand tout en haut (serveur : ?via=affiche)
  const poster = (plan.attachments || []).find(a => a.name.startsWith('affiche-') && isImage(a.mimeType));
  // Les messages vocaux restent dans le chat (ils ne sont pas des fichiers du Plan à consulter)
  const attachments = (plan.attachments || []).filter(a => !isVoiceNote(a) && a !== poster);
  const imageAttachments = attachments.filter(a => isImage(a.mimeType));
  const fileAttachments = attachments.filter(a => !isImage(a.mimeType));
  const isCreator = plan.creatorId === userId;
  // « Photos et fichiers » décoché : l'organisation (créateur et organisateurs) publie une affiche et des documents
  const organizerFiles = !showFiles && (attachments.length > 0 || !!plan.canManageFiles);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-6 short:flex-none short:overflow-visible">
      {(poster || plan.canManageFiles) && (
        <PosterSection plan={plan} poster={poster} onChanged={refresh} onDelete={() => poster && handleDelete(poster)} />
      )}
      {organizerFiles && (
        <div className="space-y-3">
          {imageAttachments.map(att => (
            <Poster key={att.id} att={att} token={plan.mediaToken} canDelete={!!plan.canManageFiles} onDelete={() => handleDelete(att)} />
          ))}
          {fileAttachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800 text-sm">{t('plan.infos.documents')}</h3>
              {fileAttachments.map(att => (
                <AttachmentRow key={att.id} att={att} token={plan.mediaToken} canDelete={!!plan.canManageFiles} deleting={deletingId === att.id} onDelete={() => handleDelete(att)} />
              ))}
            </div>
          )}
          {plan.canManageFiles && (
            <div>
              {uploadError && <p className="text-xs text-red-500 mb-2">{uploadError}</p>}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-indigo-300 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                {uploading ? t('plan.infos.uploading') : t('plan.infos.addPoster')}
              </button>
              <p className="text-xs text-slate-400 mt-1">{t('plan.infos.posterHint')}</p>
            </div>
          )}
        </div>
      )}

      {plan.description && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-1">
            <AlignLeft size={15} className="text-indigo-500" />
            {t('plan.infos.description')}
          </div>
          <RichText text={plan.description} className="text-slate-600 text-sm pl-5 leading-relaxed" />
        </div>
      )}

      <ImportantInfoCard plan={plan} userId={userId} onChanged={refresh} />

      {plan.location && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-1">
            <MapPin size={15} className="text-indigo-500" />
            {t('plan.infos.location')}
          </div>
          <p className="text-slate-600 text-sm pl-5">{plan.location}</p>
        </div>
      )}

      {/* Galerie photo (masquée si « Photos et fichiers » est désactivé) */}
      {showFiles && imageAttachments.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-800 text-sm mb-3">{t('plan.infos.gallery', { count: imageAttachments.length })}</h3>
          <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <button
              onClick={handleDownloadAllPhotos}
              disabled={zipping}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {zipping ? <Loader2 size={16} className="animate-spin" /> : <Images size={16} />}
              {zipping
                ? t('plan.infos.preparing')
                : t('plan.infos.downloadAll', { count: imageAttachments.length })}
            </button>
            <p className="text-xs text-indigo-700/80 text-center mt-2">
              {t('plan.infos.deletedOn', { date: new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(new Date(plan.endDate)) })}
            </p>
            {zipError && <p className="text-xs text-red-500 text-center mt-1">{zipError}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {imageAttachments.map(att => (
              <GalleryThumb
                key={att.id}
                att={att}
                token={plan.mediaToken}
                canDelete={isCreator || att.uploadedBy.toLowerCase() === pseudo.toLowerCase()}
                onDelete={() => handleDelete(att)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pièces jointes */}
      {showFiles && <div>
        <h3 className="font-semibold text-slate-800 text-sm mb-3">{t('plan.infos.attachments')}</h3>

        {fileAttachments.length > 0 && (
          <div className="space-y-2 mb-3">
            {fileAttachments.map(att => (
              <AttachmentRow
                key={att.id}
                att={att}
                token={plan.mediaToken}
                canDelete={isCreator || att.uploadedBy.toLowerCase() === pseudo.toLowerCase()}
                deleting={deletingId === att.id}
                onDelete={() => handleDelete(att)}
              />
            ))}
          </div>
        )}

        {fileAttachments.length === 0 && !uploading && (
          <p className="text-sm text-slate-400 italic mb-3">{t('plan.infos.noAttachment')}</p>
        )}

        {uploadError && (
          <p className="text-xs text-red-500 mb-2">{uploadError}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {uploading ? t('plan.infos.uploading') : t('plan.infos.addAttachment')}
        </button>
        <p className="text-xs text-slate-400 mt-1">{t('plan.infos.formats')}</p>
      </div>}
    </div>
  );
}

// Affiche du Plan (le flyer d'une soirée…) : en grand tout en haut ; le créateur et les organisateurs l'ajoutent ou la changent
function PosterSection({ plan, poster, onChanged, onDelete }: { plan: Plan; poster?: Attachment; onChanged: () => Promise<void> | void; onDelete: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError(t('plan.infos.fileTooBig')); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/attachments/plans/${plan.id}?via=affiche`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error || t('plan.infos.uploadError'));
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      {poster && <Poster att={poster} token={plan.mediaToken} canDelete={!!plan.canManageFiles} onDelete={onDelete} />}
      {plan.canManageFiles && (
        <div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          {poster ? (
            <button onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}{busy ? t('plan.infos.uploading') : t('plan.infos.changeFlyer')}
            </button>
          ) : (
            <>
              <button onClick={() => inputRef.current?.click()} disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-indigo-300 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                {busy ? t('plan.infos.uploading') : t('plan.infos.addFlyer')}
              </button>
              <p className="text-xs text-slate-400 mt-1">{t('plan.infos.flyerHint')}</p>
            </>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}

// Affiche : photo publiée par l'organisation, en grand en haut de l'onglet Infos
function Poster({ att, token, canDelete, onDelete }: { att: Attachment; token?: string; canDelete: boolean; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <a href={mediaUrl(att.id, token)} target="_blank" rel="noopener noreferrer">
        <img src={mediaUrl(att.id, token, 1200)} alt={att.name} className="w-full h-auto block" loading="lazy" />
      </a>
      {canDelete && (
        <div className="absolute top-2 right-2">
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={onDelete} aria-label={t('plan.infos.confirmDelete')} className="p-1.5 bg-red-600 text-white rounded-md"><Trash2 size={14} /></button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-white/90 text-slate-700 rounded-md text-xs">✕</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} aria-label={t('plan.infos.deletePhoto')} className="p-1.5 bg-black/50 text-white rounded-md"><Trash2 size={14} /></button>
          )}
        </div>
      )}
    </div>
  );
}

function GalleryThumb({ att, token, canDelete, onDelete }: { att: Attachment; token?: string; canDelete: boolean; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
      <a href={mediaUrl(att.id, token)} target="_blank" rel="noopener noreferrer">
        <img src={mediaUrl(att.id, token, 400)} alt={att.name} className="w-full h-full object-cover" loading="lazy" />
      </a>
      {canDelete && (
        <div className="absolute top-1 right-1">
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={onDelete}
                aria-label={t('plan.infos.confirmDelete')}
                className="p-1.5 bg-red-600 text-white rounded-md text-xs"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-white/90 text-slate-700 rounded-md text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={t('plan.infos.deletePhoto')}
              className="flex [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex p-1.5 bg-black/50 text-white rounded-md"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentRow({
  att, token, canDelete, deleting, onDelete,
}: {
  att: Attachment;
  token?: string;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const image = isImage(att.mimeType);
  const isPdf = att.mimeType === 'application/pdf';

  async function handleDownload() {
    setDownloading(true);
    setDlError('');
    try {
      if (Capacitor.isNativePlatform()) {
        // Sur Android/iOS, on obtient un token court (2 min) pour que le navigateur
        // système puisse télécharger via notre serveur sans header Authorization.
        const { data } = await api.get(`/attachments/${att.id}/download-token`);
        const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
        const downloadUrl = `${base}/attachments/${att.id}/download?token=${data.token}`;
        window.open(downloadUrl, '_system');
      } else {
        const res = await api.get(`/attachments/${att.id}/download`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('plan.infos.unknownError');
      setDlError(msg);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2.5">
        {/* Thumbnail ou icône */}
        {image ? (
          <a href={mediaUrl(att.id, token)} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img
              src={mediaUrl(att.id, token, 120)}
              alt={att.name}
              className="w-9 h-9 rounded-lg object-cover border border-slate-200"
            />
          </a>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            {isPdf ? <FileText size={17} className="text-red-400" /> : <File size={17} className="text-slate-400" />}
          </div>
        )}

        {/* Nom + ligne du bas : taille · auteur + boutons */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate leading-tight">{att.name}</p>

          {confirmDelete ? (
            /* Confirmation inline */
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-red-600 font-medium">{t('plan.infos.deleteFile')}</span>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                disabled={deleting}
                className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={12} className="animate-spin inline" /> : t('plan.infos.yesDelete')}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-0.5 gap-2">
              <p className="text-xs text-slate-400 truncate">{formatSize(att.size)} · @{att.uploadedBy}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  title={t('plan.infos.download')}
                >
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                {canDelete && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={t('plan.infos.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {dlError && <p className="text-xs text-red-500 mt-1">{dlError}</p>}
        </div>
      </div>
    </div>
  );
}
