import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Camera, Copy, Download, Images, Link2, Loader2, MoreHorizontal, Printer, QrCode, Share2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { Modal } from '../ui/Modal';
import { albumLink, type OwnAlbum } from '../../lib/album';
import { albumPosterBlob, posterFileName } from '../../lib/albumPoster';
import { saveFile } from '../../lib/saveFile';
import { intlLocale, t } from '../../i18n';
import type { Plan } from '../../types';

// Carte « Album souvenir » de l'onglet Infos d'un Plan (serveur : routes/albums.ts). Le créateur du Plan et les organisateurs du
// Cercle l'ouvrent ; ensuite tout le monde voit le lien, le partage et le QR code (à imprimer pour les tables de la soirée).

type State = { album: OwnAlbum | null; canCreate: boolean; canManage: boolean };
const dayFmt = () => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' });

export function AlbumCard({ plan }: { plan: Plan }) {
  const navigate = useNavigate();
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [poster, setPoster] = useState<{ blob: Blob; url: string } | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try { setSt((await api.get<State>(`/albums/plan/${plan.id}`)).data); } catch { setSt(null); }
  }
  useEffect(() => { load(); }, [plan.id]);

  if (!st || (!st.album && !st.canCreate)) return null;
  const a = st.album;

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); } catch (e: any) { setError(e?.response?.data?.error || t('common.retryError')); }
    setBusy(false);
  }

  async function share() {
    if (!a) return;
    const link = albumLink(a.token), text = t('album.share.text', { title: a.title, link });
    if (navigator.share) { try { await navigator.share({ title: a.title, text }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* presse-papiers indisponible */ }
  }
  // Affiche A4 avec le QR code (lib/albumPoster.ts) : aperçu, puis télécharger (partage dans les apps) ou imprimer
  async function openPoster() {
    if (!a) return;
    setPosterBusy(true); setError('');
    try {
      const blob = await albumPosterBlob(a);
      setPoster({ blob, url: URL.createObjectURL(blob) });
    } catch { setError(t('common.retryError')); }
    setPosterBusy(false);
  }
  function closePoster() { if (poster) URL.revokeObjectURL(poster.url); setPoster(null); }
  async function downloadPoster() {
    if (!a || !poster) return;
    try { await saveFile(poster.blob, posterFileName(a.title), t('album.poster.kicker')); } catch { setError(t('common.retryError')); }
  }
  function printPoster() {
    if (!a || !poster) return;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${a.title.replace(/</g, '&lt;')}</title>
      <style>@page{size:A4;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100vh;object-fit:contain}</style>
      <img src="${poster.url}"><script>document.querySelector('img').onload=()=>setTimeout(()=>window.print(),200)<\/script>`);
    w.document.close();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0"><Camera size={22} className="text-rose-500" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800">{t('album.card.title')}</p>
          {a
            ? <p className="text-sm text-slate-500">{t('album.card.count', { count: a.photoCount })} · {t('album.card.until', { date: dayFmt().format(new Date(a.expiresAt)) })}</p>
            : <p className="text-sm text-slate-500">{t('album.card.intro')}</p>}
        </div>
        {a && st.canManage && (
          <div className="relative">
            <button onClick={() => setMenu(m => !m)} aria-label="⋯" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><MoreHorizontal size={18} /></button>
            {menu && (
              <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-sm">
                <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50" onClick={() => { setMenu(false); if (confirm(t('album.card.newLinkConfirm'))) run(() => api.post(`/albums/${a.id}/token`)); }}><Link2 size={15} />{t('album.card.newLink')}</button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50" onClick={() => { setMenu(false); if (confirm(t('album.card.deleteConfirm'))) run(() => api.delete(`/albums/${a.id}`)); }}><Trash2 size={15} />{t('album.card.delete')}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {a ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => navigate(`/album?t=${encodeURIComponent(a.token)}`)} className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"><Images size={17} />{t('album.card.open')}</button>
          <button onClick={share} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">{copied ? <Copy size={16} /> : <Share2 size={16} />}{copied ? t('album.card.copied') : t('album.card.share')}</button>
          <button onClick={openPoster} disabled={posterBusy} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{posterBusy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}{t('album.card.poster')}</button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => run(() => api.post(`/albums/plan/${plan.id}`))} className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"><Camera size={17} />{t('album.card.create')}</button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {poster && a && (
        <Modal title={t('album.poster.title')} onClose={closePoster}>
          <div className="text-center space-y-3">
            <img src={poster.url} alt="" className="mx-auto w-full max-w-[300px] rounded-lg border border-slate-200 shadow-sm" />
            <p className="text-sm text-slate-500">{t('album.poster.hint')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={downloadPoster} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"><Download size={16} />{Capacitor.isNativePlatform() ? t('album.poster.share') : t('album.poster.download')}</button>
              {!Capacitor.isNativePlatform() && (
                <button onClick={printPoster} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"><Printer size={16} />{t('album.card.print')}</button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
