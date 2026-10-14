import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { t } from '../../i18n';
import { CROP_OUTPUT } from '../../lib/photos';

// Recadrage d'une photo avant l'envoi : carré (photo de profil, masque rond) ou 2:1 (photo de Cercle).
// On déplace l'image au doigt ou à la souris, on zoome à deux doigts, à la molette ou avec le curseur.
// Le résultat est un JPEG (CROP_OUTPUT) ; le serveur le refait de toute façon (et en retire les métadonnées).
export function PhotoCropper({ file, aspect, title, onCancel, onDone }: {
  file: File; aspect: 1 | 2; title: string; onCancel: () => void; onDone: (blob: Blob) => Promise<void>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: 300, h: 300 / aspect });
  // zoom : 1 = l'image couvre juste le cadre ; x, y : décalage du centre de l'image, en px du cadre
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    let alive = true;
    i.onload = () => { if (alive) setImg(i); };
    i.onerror = () => { if (alive) setError(t('photos.unreadable')); };
    i.src = url;
    return () => { alive = false; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    const w = Math.min(boxRef.current?.parentElement?.clientWidth ?? 300, 340);
    setBox({ w, h: w / aspect });
  }, [aspect]);

  // Échelle qui couvre le cadre, puis bornes du déplacement pour ne jamais laisser de vide
  const cover = img ? Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) : 1;
  const scale = cover * view.zoom;
  function clampView(v: { zoom: number; x: number; y: number }) {
    if (!img) return v;
    const zoom = Math.min(5, Math.max(1, v.zoom));
    const s = cover * zoom;
    const mx = Math.max(0, (img.naturalWidth * s - box.w) / 2), my = Math.max(0, (img.naturalHeight * s - box.h) / 2);
    return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }
  const setZoom = (zoom: number) => setView(v => clampView({ ...v, zoom }));

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoom(pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist);
    } else if (pointers.current.size === 1) {
      setView(v => clampView({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  async function save() {
    if (!img) return;
    setBusy(true); setError('');
    const [W, H] = CROP_OUTPUT[aspect];
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // Partie de l'image visible dans le cadre, en px de l'image
    const sw = box.w / scale, sh = box.h / scale;
    const sx = img.naturalWidth / 2 - view.x / scale - sw / 2, sy = img.naturalHeight / 2 - view.y / scale - sh / 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) { setError(t('photos.unreadable')); setBusy(false); return; }
    try { await onDone(blob); } catch (err: any) { setError(err?.response?.data?.error || t('common.error')); setBusy(false); }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div ref={boxRef} className="mx-auto relative overflow-hidden bg-slate-900 touch-none select-none cursor-grab active:cursor-grabbing rounded-xl"
          style={{ width: box.w, height: box.h }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onWheel={e => setZoom(view.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}>
          {img && (
            <img src={img.src} alt="" draggable={false} className="absolute max-w-none pointer-events-none"
              style={{ width: img.naturalWidth * scale, height: img.naturalHeight * scale, left: box.w / 2 - img.naturalWidth * scale / 2 + view.x, top: box.h / 2 - img.naturalHeight * scale / 2 + view.y }} />
          )}
          {/* Masque rond de la photo de profil */}
          {aspect === 1 && <div className="absolute inset-0 pointer-events-none rounded-full" style={{ boxShadow: '0 0 0 999px rgba(15,23,42,.55)' }} />}
        </div>
        <div className="flex items-center gap-3 px-2">
          <ZoomOut size={16} className="text-slate-400" />
          <input type="range" min={1} max={5} step={0.01} value={view.zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-indigo-600" />
          <ZoomIn size={16} className="text-slate-400" />
        </div>
        <p className="text-xs text-slate-400 text-center">{t('photos.cropHint')}</p>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="button" onClick={save} disabled={!img || busy}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
