import { useState, useRef } from 'react';
import { MapPin, Plus, Check, Paperclip, FileText, File, Trash2, Download, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Plan, BringItem, Attachment } from '../../types';
import api from '../../services/api';

interface Props {
  plan: Plan;
  onPlanUpdated: (plan: Plan) => void;
  pseudo: string;
  userId: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}


export function InfosTab({ plan, onPlanUpdated, pseudo, userId }: Props) {
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { data } = await api.get(`/plans/${plan.id}`);
    onPlanUpdated(data);
  }

  async function handleAddItem() {
    if (!newItem.trim()) return;
    await api.post(`/plans/${plan.id}/items`, { label: newItem.trim() });
    setNewItem('');
    setAddingItem(false);
    await refresh();
  }

  async function handleClaim(itemId: string) {
    await api.put(`/plans/items/${itemId}/claim`);
    await refresh();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 10 Mo)');
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
      setUploadError(err.response?.data?.error || "Erreur lors de l'envoi");
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

  const items = plan.items || [];
  const attachments = plan.attachments || [];
  const isCreator = plan.creatorId === userId;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-6">
      {plan.location && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-1">
            <MapPin size={15} className="text-indigo-500" />
            Lieu du rendez-vous
          </div>
          <p className="text-slate-600 text-sm pl-5">{plan.location}</p>
        </div>
      )}

      {/* Qui apporte quoi */}
      <div>
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Qui apporte quoi ?</h3>
        <div className="space-y-2">
          {items.length === 0 && !addingItem && (
            <p className="text-sm text-slate-400 italic">Rien de prévu pour l'instant.</p>
          )}
          {items.map(item => (
            <BringItemRow key={item.id} item={item} myPseudo={pseudo} onClaim={() => handleClaim(item.id)} />
          ))}
        </div>

        {addingItem ? (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              placeholder="Ex: bouteille de vin"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <button onClick={handleAddItem} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">OK</button>
            <button onClick={() => { setAddingItem(false); setNewItem(''); }} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">Annuler</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-1.5 mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus size={14} />
            Ajouter un élément
          </button>
        )}
      </div>

      {/* Pièces jointes */}
      <div>
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Pièces jointes</h3>

        {attachments.length > 0 && (
          <div className="space-y-2 mb-3">
            {attachments.map(att => (
              <AttachmentRow
                key={att.id}
                att={att}
                canDelete={isCreator || att.uploadedBy === pseudo}
                deleting={deletingId === att.id}
                onDelete={() => handleDelete(att)}
              />
            ))}
          </div>
        )}

        {attachments.length === 0 && !uploading && (
          <p className="text-sm text-slate-400 italic mb-3">Aucune pièce jointe pour l'instant.</p>
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
          {uploading ? 'Envoi en cours…' : 'Ajouter une pièce jointe'}
        </button>
        <p className="text-xs text-slate-400 mt-1">PDF, images, Word, Excel… · max 10 Mo</p>
      </div>
    </div>
  );
}

function AttachmentRow({
  att, canDelete, deleting, onDelete,
}: {
  att: Attachment;
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
      const msg = err?.response?.data?.error || err?.message || 'Erreur inconnue';
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
          <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img
              src={att.url}
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
              <span className="text-xs text-red-600 font-medium">Supprimer ce fichier ?</span>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                disabled={deleting}
                className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={12} className="animate-spin inline" /> : 'Oui, supprimer'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Annuler
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
                  title="Télécharger"
                >
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                {canDelete && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Supprimer"
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

function BringItemRow({ item, myPseudo, onClaim }: { item: BringItem; myPseudo: string; onClaim: () => void }) {
  const isMe = item.claimedBy === myPseudo;
  const taken = !!item.claimedBy;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${taken ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${taken ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
        {taken && <Check size={11} className="text-white" />}
      </div>
      <span className={`flex-1 text-sm ${taken ? 'text-slate-600' : 'text-slate-800'}`}>{item.label}</span>
      {taken && <span className="text-xs text-slate-500">@{item.claimedBy}</span>}
      <button
        onClick={onClaim}
        disabled={taken && !isMe}
        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
          isMe ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
          taken ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
          'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
        }`}
      >
        {isMe ? 'Je prends ça ✓' : taken ? 'Pris' : 'Je prends ça'}
      </button>
    </div>
  );
}
