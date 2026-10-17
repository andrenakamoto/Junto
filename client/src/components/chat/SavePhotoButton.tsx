import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { saveImage } from '../../lib/saveFile';
import { t } from '../../i18n';

// « Enregistrer la photo » dans la visionneuse d'un chat (Plan ou discussion du Cercle) : dans les apps, la photo va
// dans les photos du téléphone (la WebView ne propose pas l'enregistrement d'un appui long) ; sur le site, téléchargement.
export function SavePhotoButton({ url, filename }: { url: string; filename: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  async function save(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === 'busy') return;
    setState('busy');
    try {
      const blob = await (await fetch(url)).blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      await saveImage(dataUrl, filename);
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('idle');
      alert(t('chat.message.photoSaveFailed'));
    }
  }

  return (
    <button type="button" onClick={save} disabled={state === 'busy'}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/65 backdrop-blur text-white text-sm font-medium shadow-lg hover:bg-black/80 disabled:opacity-60">
      {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : state === 'done' ? <Check size={16} /> : <Download size={16} />}
      {state === 'done' ? t('chat.message.photoSaved') : t('chat.message.savePhoto')}
    </button>
  );
}
