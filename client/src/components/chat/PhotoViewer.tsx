import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useBackClose } from '../../lib/backClose';
import { SavePhotoButton } from './SavePhotoButton';
import { t } from '../../i18n';

// Visionneuse des photos d'un chat (Plan ou discussion du Cercle) : toutes les photos du chat, dans l'ordre des messages.
// Glisser à gauche / à droite (ou flèches, clavier ← →) pour passer à la suivante ; zoom en pinçant, d'un double toucher /
// double clic ou à la molette, puis glisser pour se déplacer dans la photo zoomée. Fermer : croix, Échap ou retour Android.

export type ViewerPhoto = {
  id: string;
  /** Photo affichée (grande taille) */
  src: string;
  /** Photo d'origine, pour « Enregistrer la photo » */
  download: string;
  filename: string;
  /** L'auteur peut retirer sa photo à tout moment */
  canDelete?: boolean;
};

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_MIN = 60;

export function PhotoViewer({ photos, startId, onClose, onDelete }: {
  photos: ViewerPhoto[]; startId: string; onClose: () => void; onDelete?: (id: string) => Promise<void> | void;
}) {
  useBackClose(onClose);
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex(p => p.id === startId)));
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [swipe, setSwipe] = useState(0);
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; startX: number; startY: number; pos: { x: number; y: number }; moved: boolean } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  // La liste peut changer (photo retirée, nouveau message) : on garde la même photo si elle existe encore
  const current = photos[Math.min(index, photos.length - 1)];
  useEffect(() => { if (!photos.length) onClose(); }, [photos.length, onClose]);
  useEffect(() => { if (index >= photos.length && photos.length) setIndex(photos.length - 1); }, [index, photos.length]);

  function reset() { setScale(1); setPos({ x: 0, y: 0 }); setSwipe(0); }
  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= photos.length) { setSwipe(0); return; }
    setIndex(next); reset();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Déplacement limité pour que la photo zoomée ne sorte pas de l'écran
  function clamp(p: { x: number; y: number }, s: number) {
    const el = box.current;
    if (!el || s <= 1) return { x: 0, y: 0 };
    const mx = (el.clientWidth * (s - 1)) / 2, my = (el.clientHeight * (s - 1)) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }
  // Zoom autour d'un point de l'écran (doigt, souris)
  function zoomAt(next: number, clientX: number, clientY: number) {
    const el = box.current;
    const s = Math.max(1, Math.min(MAX_SCALE, next));
    if (!el) { setScale(s); return; }
    const r = el.getBoundingClientRect();
    const cx = clientX - r.left - r.width / 2, cy = clientY - r.top - r.height / 2;
    const k = s / scale;
    setPos(p => clamp({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }, s));
    setScale(s);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    setMoving(true);
    gesture.current = {
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      scale, startX: e.clientX, startY: e.clientY, pos, moved: false,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.dist) {
      g.moved = true;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomAt(g.scale * (d / g.dist), (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      return;
    }
    const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (scale > 1) setPos(clamp({ x: g.pos.x + dx, y: g.pos.y + dy }, scale));
    else setSwipe(dx);
  }
  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // Fin d'un pincement : le doigt restant repart de sa position
      const [p] = [...pointers.current.values()];
      gesture.current = { dist: 0, scale, startX: p.x, startY: p.y, pos, moved: true };
      return;
    }
    setMoving(false);
    gesture.current = null;
    if (!g) return;
    if (scale <= 1 && Math.abs(swipe) > SWIPE_MIN) { go(swipe < 0 ? 1 : -1); return; }
    setSwipe(0);
    if (g.moved) return;
    // Double toucher / double clic : zoom sur le point touché, ou retour à la taille normale
    const now = Date.now(), last = lastTap.current;
    if (last && now - last.time < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
      lastTap.current = null;
      if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); } else zoomAt(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
    } else lastTap.current = { time: now, x: e.clientX, y: e.clientY };
  }
  function onWheel(e: React.WheelEvent) {
    zoomAt(scale * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
  }

  if (!current) return null;
  const neighbours = [photos[index - 1], photos[index + 1]].filter(Boolean) as ViewerPhoto[];
  const arrow = 'absolute top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-0';
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black select-none" role="dialog" aria-modal="true">
      <div
        ref={box}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none', paddingTop: 'var(--sa-top, 0px)', paddingBottom: 'var(--sa-bottom, 0px)' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
      >
        <img
          key={current.id}
          src={current.src} alt={current.filename} draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${pos.x + swipe}px, ${pos.y}px) scale(${scale})`,
            transition: moving ? 'none' : 'transform 0.2s ease-out',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>
      {/* Photos voisines chargées d'avance */}
      {neighbours.map(p => <link key={p.id} rel="preload" as="image" href={p.src} />)}

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 pointer-events-none" style={{ marginTop: 'var(--sa-top, 0px)' }}>
        <span className="text-sm text-white/80 font-medium">{photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}</span>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X size={20} /></button>
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label={t('chat.viewer.previous')} className={`${arrow} left-3 hidden sm:block`}><ChevronLeft size={26} /></button>
          <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label={t('chat.viewer.next')} className={`${arrow} right-3 hidden sm:block`}><ChevronRight size={26} /></button>
        </>
      )}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ bottom: 'calc(1.5rem + var(--sa-bottom, 0px))' }}>
        <SavePhotoButton url={current.download} filename={current.filename} />
        {current.canDelete && onDelete && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(t('chat.message.deletePhotoConfirm'))) return;
              try { await onDelete(current.id); }
              catch (err: any) { alert(err?.response?.data?.error || t('chat.message.deletePhotoFailed')); }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/65 backdrop-blur text-white text-sm font-medium shadow-lg hover:bg-red-600"
          >
            <Trash2 size={16} /> {t('chat.message.deletePhoto')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
