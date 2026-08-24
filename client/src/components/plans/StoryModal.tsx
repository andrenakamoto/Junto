import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Camera, Loader2, Check, Download } from 'lucide-react';
import { Plan } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface Props {
  plan: Plan;
  onClose: () => void;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

export function StoryModal({ plan, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const imageAttachments = (plan.attachments || []).filter(a => isImage(a.mimeType));

  useEffect(() => {
    if (!coverSrc && imageAttachments[0]) setCoverSrc(imageAttachments[0].url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTakePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // data: URL plutôt que blob: — html-to-image ne sait pas embarquer les blob: (fetch() les rejette)
    const reader = new FileReader();
    reader.onload = () => setCoverSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  const presentNames = plan.members.filter(m => m.rsvp === 'in').map(m => m.user.pseudo);
  const dateFmt = plan.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(plan.eventDate))
    : null;

  async function handleDownload() {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 4, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${plan.title.replace(/[^a-z0-9]/gi, '_')}_story.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('[story generation]', e);
      alert("Erreur lors de la génération de la story. Réessaie.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal title="Story du Plan" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div
          ref={cardRef}
          className="relative w-[240px] h-[426px] rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#431a11] to-[#c2410c]"
        >
          {coverSrc && (
            <img
              key={coverSrc}
              src={coverSrc}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.15), rgba(15,10,8,.85))' }}
          />

          <div className="absolute top-4 left-4 text-sm text-white" style={{ fontFamily: "'Fraunces', serif" }}>
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Ev</span>
            <span style={{ fontWeight: 800, color: '#fb7a4d' }}>LY</span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p className="text-xl font-bold leading-tight mb-1">{plan.title}</p>
            {dateFmt && <p className="text-xs text-white/80 mb-1 capitalize">{dateFmt}</p>}
            {plan.location && <p className="text-xs text-white/70 mb-2">{plan.location}</p>}
            {presentNames.length > 0 && (
              <p className="text-xs text-white/90 leading-snug">
                <span className="text-white/60">Présents : </span>
                {presentNames.join(', ')}
              </p>
            )}
          </div>
        </div>

        {imageAttachments.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {imageAttachments.slice(0, 6).map(att => (
              <button
                key={att.id}
                onClick={() => setCoverSrc(att.url)}
                className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 ${coverSrc === att.url ? 'border-indigo-600' : 'border-transparent'}`}
              >
                <img src={att.url} className="w-full h-full object-cover" />
                {coverSrc === att.url && (
                  <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleTakePhoto}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Camera size={15} />
          Prendre une photo sur le moment
        </button>

        <Button onClick={handleDownload} disabled={generating} className="w-full flex items-center justify-center gap-2">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Télécharger la story
        </Button>
      </div>
    </Modal>
  );
}
