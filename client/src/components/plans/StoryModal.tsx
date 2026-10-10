import { useEffect, useRef, useState } from 'react';
import { saveImage } from '../../lib/saveFile';
import { toJpeg } from 'html-to-image';
import { Camera, Loader2, Check, Download, ZoomOut, ZoomIn, Move, RectangleVertical, RectangleHorizontal } from 'lucide-react';
import { Plan } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { mediaUrl } from '../../lib/media';
import { intlLocale, t } from '../../i18n';

interface Props {
  plan: Plan;
  onClose: () => void;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

type Orientation = 'portrait' | 'landscape';
const FRAMES: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 202, h: 360 },
  landscape: { w: 260, h: 146 },
};

export function StoryModal({ plan, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  // Tant qu'aucune photo n'a été prise, « Prendre la photo » est le bouton principal
  const [photoTaken, setPhotoTaken] = useState(false);

  const imageAttachments = (plan.attachments || []).filter(a => isImage(a.mimeType));
  // 1600 px suffisent pour l'export de la story (cadre ~400 px, rendu x4)
  const coverUrl = (id: string) => mediaUrl(id, plan.mediaToken, 1600);
  const frame = FRAMES[orientation];

  useEffect(() => {
    if (!coverSrc && imageAttachments[0]) setCoverSrc(coverUrl(imageAttachments[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Taille de l'image en mode "contenu entier visible" (contain) dans le cadre actuel
  const baseSize = naturalSize
    ? (naturalSize.w / naturalSize.h > frame.w / frame.h
        ? { w: frame.w, h: frame.w * naturalSize.h / naturalSize.w }
        : { h: frame.h, w: frame.h * naturalSize.w / naturalSize.h })
    : null;
  // Zoom nécessaire pour remplir tout le cadre (équivalent à l'ancien object-fit: cover)
  const coverZoom = baseSize ? Math.max(frame.w / baseSize.w, frame.h / baseSize.h) : 1;
  const maxZoom = Math.max(4, coverZoom + 1);

  // Réinitialise le cadrage à chaque nouvelle photo ou changement de format
  useEffect(() => {
    if (!baseSize) return;
    setZoom(Math.min(coverZoom, maxZoom));
    setPos({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalSize?.w, naturalSize?.h, orientation]);

  function selectCover(src: string) {
    setCoverSrc(src);
    setNaturalSize(null);
  }

  function handleTakePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // data: URL plutôt que blob: — html-to-image ne sait pas embarquer les blob: (fetch() les rejette)
    const reader = new FileReader();
    reader.onload = () => { selectCover(reader.result as string); setPhotoTaken(true); };
    reader.readAsDataURL(file);
  }

  function clampPos(p: { x: number; y: number }, z: number) {
    if (!baseSize) return { x: 0, y: 0 };
    const overflowX = Math.max(0, baseSize.w * z - frame.w);
    const overflowY = Math.max(0, baseSize.h * z - frame.h);
    return {
      x: Math.min(overflowX / 2, Math.max(-overflowX / 2, p.x)),
      y: Math.min(overflowY / 2, Math.max(-overflowY / 2, p.y)),
    };
  }

  function handleZoomChange(newZoom: number) {
    setZoom(newZoom);
    setPos(p => clampPos(p, newZoom));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!coverSrc) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPos(clampPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy }, zoom));
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  const isLandscape = orientation === 'landscape';
  const allPresentNames = plan.members.filter(m => m.rsvp === 'in').map(m => m.user.pseudo);
  const nameLimit = isLandscape ? 3 : 8;
  const presentNames = allPresentNames.length > nameLimit
    ? [...allPresentNames.slice(0, nameLimit), `+${allPresentNames.length - nameLimit}`]
    : allPresentNames;
  const dateFmt = plan.eventDate
    ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(plan.eventDate))
    : null;

  async function handleDownload() {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toJpeg(cardRef.current, { pixelRatio: 4, cacheBust: true, quality: 0.92, backgroundColor: '#431a11' });
      // Apps : enregistrée dans la galerie du téléphone ; site : téléchargement
      const where = await saveImage(dataUrl, `${plan.title.replace(/[^a-z0-9]/gi, '_')}_story.jpg`);
      if (where === 'gallery') alert(t('plan.story.saved'));
    } catch (e) {
      console.error('[story generation]', e);
      alert(t('plan.story.error'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal title={t('plan.story.title')} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setOrientation('portrait')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${orientation === 'portrait' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <RectangleVertical size={13} />
            {t('plan.story.portrait')}
          </button>
          <button
            onClick={() => setOrientation('landscape')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${orientation === 'landscape' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <RectangleHorizontal size={13} />
            {t('plan.story.landscape')}
          </button>
        </div>

        <div
          ref={cardRef}
          className="relative rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#431a11] to-[#c2410c]"
          style={{ width: frame.w, height: frame.h }}
        >
          {coverSrc && (
            <div
              className="absolute inset-0 overflow-hidden touch-none cursor-move"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                key={coverSrc}
                src={coverSrc}
                draggable={false}
                onLoad={e => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="absolute top-1/2 left-1/2 select-none"
                style={
                  baseSize
                    ? {
                        width: baseSize.w,
                        height: baseSize.h,
                        transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                        transformOrigin: 'center',
                      }
                    : { opacity: 0 }
                }
              />
            </div>
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.15), rgba(15,10,8,.85))' }}
          />

          <div
            className={`absolute text-white pointer-events-none ${isLandscape ? 'top-2 left-2.5 text-[11px]' : 'top-4 left-4 text-sm'}`}
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Ev</span>
            <span style={{ fontWeight: 800, color: '#fb7a4d' }}>LY</span>
          </div>

          <div className={`absolute bottom-0 left-0 right-0 text-white pointer-events-none ${isLandscape ? 'p-2.5' : 'p-3.5'}`}>
            <p className={`font-bold leading-tight ${isLandscape ? 'text-xs mb-0.5' : 'text-lg mb-1'}`}>{plan.title}</p>
            {dateFmt && <p className={`text-white/80 capitalize ${isLandscape ? 'text-[9px] mb-0.5' : 'text-[11px] mb-1'}`}>{dateFmt}</p>}
            {plan.location && <p className={`text-white/70 ${isLandscape ? 'text-[9px] mb-1' : 'text-[11px] mb-1.5'}`}>{plan.location}</p>}
            {presentNames.length > 0 && (
              <p className={`text-white/90 leading-snug ${isLandscape ? 'text-[9px]' : 'text-[11px]'}`}>
                <span className="text-white/60">{t('plan.story.present')}</span>
                {presentNames.join(', ')}
              </p>
            )}
          </div>
        </div>

        {coverSrc && baseSize && (
          <div className="w-full flex items-center gap-2">
            <ZoomOut size={15} className="text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={maxZoom}
              step={0.02}
              value={zoom}
              onChange={e => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <ZoomIn size={15} className="text-slate-400 flex-shrink-0" />
          </div>
        )}
        {coverSrc && (
          <p className="flex items-center gap-1 text-xs text-slate-400 -mt-2">
            <Move size={11} />
            {t('plan.story.drag')}
          </p>
        )}

        {imageAttachments.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {imageAttachments.slice(0, 6).map(att => (
              <button
                key={att.id}
                onClick={() => selectCover(coverUrl(att.id))}
                className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 ${coverSrc === coverUrl(att.id) ? 'border-indigo-600' : 'border-transparent'}`}
              >
                <img src={mediaUrl(att.id, plan.mediaToken, 120)} className="w-full h-full object-cover" />
                {coverSrc === coverUrl(att.id) && (
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
        {/* Boutons toujours visibles en bas de la fenêtre, même quand l'aperçu dépasse l'écran */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 px-6 pt-3 pb-6 w-[calc(100%+3rem)] bg-white border-t border-slate-100 flex flex-col items-center gap-3">
        {!photoTaken ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-indigo-600 text-white text-base font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 active:scale-[0.98] transition"
            >
              <Camera size={22} />
              {t('plan.story.takePhoto')}
            </button>
            <p className="text-xs text-slate-500 -mt-2 text-center">{t('plan.story.takeHint')}</p>
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {imageAttachments.length > 0 ? t('plan.story.withPlanPhoto') : t('plan.story.withoutPhoto')}
            </button>
          </>
        ) : (
          <>
            <Button onClick={handleDownload} disabled={generating} className="w-full flex items-center justify-center gap-2 !py-3 !text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {t('plan.story.download')}
            </Button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Camera size={15} />
              {t('plan.story.retake')}
            </button>
          </>
        )}
        </div>
      </div>
    </Modal>
  );
}
