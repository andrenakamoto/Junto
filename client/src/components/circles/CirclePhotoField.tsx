import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import api from '../../services/api';
import { t } from '../../i18n';
import { photoUrl } from '../../lib/photos';
import { PhotoCropper } from '../ui/PhotoCropper';

// Photo du Cercle dans un formulaire (création, réglages) : recadrée en 2:1, gardée en attente et envoyée seulement
// au clic sur « Créer » / « Enregistrer » (applyCirclePhoto). null = rien à faire, 'remove' = retirer la photo.
export type PendingPhoto = { blob: Blob; url: string } | 'remove' | null;

export function CirclePhotoField({ currentKey, pending, onPending }: {
  currentKey: string | null; pending: PendingPhoto; onPending: (p: PendingPhoto) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  // Aperçu local libéré quand il change ou que le formulaire se ferme
  useEffect(() => () => { if (pending && pending !== 'remove') URL.revokeObjectURL(pending.url); }, [pending]);

  const preview = pending && pending !== 'remove' ? pending.url : pending === 'remove' ? null : currentKey ? photoUrl(currentKey) : null;
  const pick = (
    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }} />
  );

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('photos.circleLabel')}</label>
      {preview ? (
        <img src={preview} alt="" className="w-full aspect-[2/1] object-cover rounded-xl bg-slate-200" />
      ) : (
        <label className="w-full aspect-[2/1] rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer hover:border-indigo-300 hover:text-indigo-500">
          <ImagePlus size={24} />
          <span className="text-sm font-medium">{t('photos.add')}</span>
          {pick}
        </label>
      )}
      {preview && (
        <div className="flex gap-2 mt-2">
          <label className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer">
            {t('photos.change')}
            {pick}
          </label>
          <button type="button" onClick={() => onPending(currentKey ? 'remove' : null)} className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100">{t('photos.remove')}</button>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-1">{t('photos.circleHint')}</p>
      {file && (
        <PhotoCropper file={file} aspect={2} title={t('photos.circleTitle')} onCancel={() => setFile(null)}
          onDone={async blob => { onPending({ blob, url: URL.createObjectURL(blob) }); setFile(null); }} />
      )}
    </div>
  );
}

// Envoie la photo en attente ; renvoie la nouvelle clé (null si retirée), ou undefined s'il n'y avait rien à faire
export async function applyCirclePhoto(circleId: string, pending: PendingPhoto): Promise<string | null | undefined> {
  if (!pending) return undefined;
  if (pending === 'remove') { await api.delete(`/photos/circles/${circleId}`); return null; }
  const fd = new FormData();
  fd.append('file', pending.blob, 'photo.jpg');
  const { data } = await api.put(`/photos/circles/${circleId}`, fd);
  return data.photoKey as string;
}
