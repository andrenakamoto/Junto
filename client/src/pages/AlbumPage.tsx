import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Download, EyeOff, Eye, Heart, Loader2, Images } from 'lucide-react';
import api from '../services/api';
import { LogoFull } from '../components/ui/Logo';
import { Modal } from '../components/ui/Modal';
import { PhotoViewer, type ViewerPhoto } from '../components/chat/PhotoViewer';
import { albumDevice, albumName, albumPhotoUrl, albumZipUrl, saveAlbumName, shrinkPhoto, type AlbumView } from '../lib/album';
import { intlLocale, t } from '../i18n';

// Album souvenir d'une soirée (serveur : routes/albums.ts), page publique /album?t=<lien> : sans compte ni app, on y ajoute ses
// photos (réduites dans le téléphone avant l'envoi), on les voit toutes, on met des cœurs et on télécharge tout en ZIP.
// L'organisation (créateur du Plan, organisateurs du Cercle, connectés) masque ou retire n'importe quelle photo.

const dayFmt = () => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

export default function AlbumPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const device = useMemo(() => albumDevice(), []);
  const headers = useMemo(() => ({ 'x-album-device': device }), [device]);
  const [album, setAlbum] = useState<AlbumView | null>(null);
  const [missing, setMissing] = useState(false);
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState(albumName());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const loggedIn = (() => { try { return !!localStorage.getItem('estelle_token'); } catch { return false; } })();

  const load = useCallback(async () => {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) { setMissing(true); return; }
    try {
      const { data } = await api.get<AlbumView>(`/albums/public/${token}`, { headers });
      setAlbum(data); setMissing(false);
      document.title = `${data.title} · ${t('album.page.title')} · EvLY`;
    } catch (e: any) {
      if (e?.response?.status === 404) setMissing(true);
    }
  }, [token, headers]);

  // Chargé à l'ouverture, puis toutes les 30 s tant que la page est affichée (les photos des autres arrivent pendant la soirée)
  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  function pick() {
    setError('');
    if (!album?.me && !albumName()) { setAskName(true); return; }
    input.current?.click();
  }

  async function upload(files: FileList | null) {
    if (!files?.length || !album) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = Math.max(0, album.maxPerDevice - album.myCount);
    const todo = list.slice(0, room);
    if (!todo.length) { setError(album.full ? t('album.page.full') : t('album.page.mine', { count: album.myCount, max: album.maxPerDevice })); return; }
    setFailed(0); setError('');
    let done = 0, bad = 0;
    setProgress({ done, total: todo.length });
    // Deux envois à la fois : rapide sans saturer le réseau de la salle
    const queue = [...todo];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        try {
          const blob = await shrinkPhoto(f);
          const form = new FormData();
          form.append('name', album?.me?.name ?? albumName());
          form.append('photo', blob, f.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg') || 'photo.jpg');
          await api.post(`/albums/public/${token}/photos`, form, { headers });
        } catch (e: any) {
          bad++;
          const msg = e?.response?.data?.error;
          if (msg) setError(msg);
        }
        done++; setProgress({ done, total: todo.length });
      }
    };
    await Promise.all([worker(), worker()]);
    setProgress(null); setFailed(bad);
    if (input.current) input.current.value = '';
    await load();
  }

  async function like(id: string) {
    if (!album) return;
    setAlbum({ ...album, photos: album.photos.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p) });
    try { await api.post(`/albums/public/${token}/photos/${id}/like`, {}, { headers }); } catch { load(); }
  }
  async function remove(id: string) {
    await api.delete(`/albums/public/${token}/photos/${id}`, { headers });
    await load();
  }
  async function setHidden(id: string, hidden: boolean) {
    try { await api.put(`/albums/public/${token}/photos/${id}/hidden`, { hidden }, { headers }); } catch { /* rechargé ci-dessous */ }
    await load();
  }

  if (missing) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-6">
      <LogoFull light iconSize={44} />
      <p className="text-slate-600 max-w-sm">{t('album.page.notFound')}</p>
      <Link to="/" className="text-indigo-600 font-semibold">www.evly.ch</Link>
    </div>
  );
  if (!album) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const visible = album.photos.filter(p => !p.hidden);
  const viewerPhotos: ViewerPhoto[] = album.photos.map(p => ({
    id: p.id, src: albumPhotoUrl(token, p.key), download: `${albumPhotoUrl(token, p.key)}?dl=1`, filename: `evly-${p.key.slice(0, 8)}.jpg`,
    canDelete: p.mine || album.canManage, caption: t('album.page.by', { name: p.author }),
  }));
  const photosLabel = t('album.card.count', { count: album.photoCount });
  const peopleLabel = t('album.page.people', { count: album.contributorCount });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* En-tête */}
      <header className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-rose-500 text-white px-5 pt-6 pb-8" style={{ paddingTop: 'calc(1.5rem + var(--sa-top, 0px))' }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            {album.canOpenPlan && album.planId ? (
              <Link to={`/dashboard?planId=${encodeURIComponent(album.planId)}&tab=infos`} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-3.5 py-2 text-sm font-semibold backdrop-blur-sm">
                <ArrowLeft size={16} /> {t('album.page.backToPlan')}
              </Link>
            ) : <span />}
            <Link to="/" className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm"><LogoFull light iconSize={24} /></Link>
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-white/80">📸 {t('album.page.title')}</p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-extrabold leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{album.title}</h1>
          <p className="mt-2 text-white/90 font-medium">{t('album.page.stats', { photos: photosLabel, people: peopleLabel })}</p>
          <p className="mt-1 text-sm text-white/75">{t('album.page.until', { date: dayFmt().format(new Date(album.expiresAt)) })}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-32 -mt-5 space-y-4">
        {/* Ajouter */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-3">
          <button onClick={pick} disabled={!!progress || album.full}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-indigo-600 text-white text-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-70">
            {progress ? <Loader2 size={20} className="animate-spin" /> : <Camera size={22} />}
            {progress ? t('album.page.adding', { done: progress.done, total: progress.total }) : t('album.page.add')}
          </button>
          {progress && <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress.done / progress.total * 100}%` }} /></div>}
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
          {album.myCount > 0 && <p className="text-xs text-slate-500 text-center">{t('album.page.mine', { count: album.myCount, max: album.maxPerDevice })}</p>}
          {failed > 0 && <p className="text-sm text-red-600 text-center">{t('album.page.failed', { count: failed })}</p>}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {album.canManage && <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">{t('album.page.organiser')}</p>}
        </div>

        {/* Photos */}
        {album.photos.length === 0 ? (
          <div className="text-center text-slate-500 py-12 px-6"><Images className="mx-auto mb-3 text-slate-300" size={40} />{t('album.page.empty')}</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {album.photos.map(p => (
              <div key={p.id} className={`relative aspect-square overflow-hidden rounded-lg bg-slate-200 ${p.hidden ? 'opacity-40' : ''}`}>
                <button onClick={() => setViewing(p.id)} className="absolute inset-0" aria-label={t('album.page.by', { name: p.author })}>
                  <img src={albumPhotoUrl(token, p.key, true)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
                <span className="absolute left-1.5 bottom-1.5 max-w-[60%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-semibold text-white pointer-events-none">{p.author}</span>
                <button onClick={() => like(p.id)} aria-pressed={p.liked}
                  className={`absolute right-1 bottom-1 flex items-center gap-0.5 rounded-full px-1.5 py-1 text-[11px] font-bold ${p.liked ? 'bg-rose-500 text-white' : 'bg-black/45 text-white'}`}>
                  <Heart size={13} fill={p.liked ? 'currentColor' : 'none'} />{p.likes > 0 && p.likes}
                </button>
                {album.canManage && (
                  <button onClick={() => setHidden(p.id, !p.hidden)} title={p.hidden ? t('album.page.show') : t('album.page.hide')} aria-label={p.hidden ? t('album.page.show') : t('album.page.hide')}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1.5 text-white">
                    {p.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                {p.hidden && <span className="absolute left-1.5 top-1.5 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{t('album.page.hidden')}</span>}
              </div>
            ))}
          </div>
        )}

        {visible.length > 0 && (
          <a href={albumZipUrl(token)} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
            <Download size={18} />{t('album.page.zip')}
          </a>
        )}

        {!loggedIn && (
          <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-2">
            <p className="font-bold text-lg">{t('album.page.ctaTitle')}</p>
            <p className="text-sm text-slate-300">{t('album.page.ctaText')}</p>
            <Link to="/auth?mode=inscription" className="inline-block mt-1 px-4 py-2.5 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">{t('album.page.ctaButton')}</Link>
          </div>
        )}
        <p className="text-xs text-slate-400 text-center px-4">{t('album.page.privacy')}</p>
      </main>

      {askName && (
        <Modal title={t('album.page.namePrompt')} onClose={() => setAskName(false)}>
          <form onSubmit={e => { e.preventDefault(); const n = name.trim(); if (!n) return; saveAlbumName(n.slice(0, 30)); setAskName(false); setTimeout(() => input.current?.click(), 50); }} className="space-y-3">
            <input autoFocus value={name} maxLength={30} onChange={e => setName(e.target.value)} placeholder={t('album.page.namePrompt')}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="text-sm text-slate-500">{t('album.page.nameHint')}</p>
            <button type="submit" disabled={!name.trim()} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">{t('album.page.nameContinue')}</button>
          </form>
        </Modal>
      )}

      {viewing && (
        <PhotoViewer photos={viewerPhotos} startId={viewing} onClose={() => setViewing(null)}
          onDelete={async id => { await remove(id); setViewing(null); }} />
      )}
    </div>
  );
}
