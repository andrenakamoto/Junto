import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import api from '../../services/api';
import { photoUrl } from '../../lib/photos';

interface PhotoReport {
  id: string;
  kind: 'user' | 'circle';
  createdAt: string;
  reason: string | null;
  reporter: string;
  photoKey: string;
  stillOnline: boolean;
  target: string;
}

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Photos de profil et de Cercle signalées (serveur : routes /admin/photo-reports). Retirer : la personne ou le
// Cercle revient aux initiales / à la lettre, le fichier est effacé. Classer : rien ne change.
export function PhotoReportsPanel() {
  const [reports, setReports] = useState<PhotoReport[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/photo-reports').then(res => setReports(res.data)).catch(() => setReports([]));
  }, []);

  async function resolve(r: PhotoReport, action: 'remove' | 'dismiss') {
    if (action === 'remove' && !confirm(`Retirer cette photo (${r.target}) ?`)) return;
    setBusy(r.id);
    try {
      await api.post(`/admin/photo-reports/${r.id}/resolve`, { action });
      setReports(prev => (prev ?? []).filter(x => x.photoKey !== r.photoKey));
    } finally {
      setBusy(null);
    }
  }

  if (!reports) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
        <ImageOff size={17} className="text-slate-400" />Photos signalées
        {reports.length > 0 && <span className="text-xs font-semibold bg-red-500 text-white rounded-full px-2 py-0.5">{reports.length}</span>}
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Photos de profil et de Cercle signalées par des membres. Retirer la photo remet les initiales (ou la lettre du
        Cercle) et efface le fichier ; classer ne change rien.
      </p>
      {reports.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl px-4 py-3">Aucune photo signalée.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map(r => (
            <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="text-xs text-slate-500">
                {dateFmt.format(new Date(r.createdAt))} · {r.kind === 'user' ? 'Photo de profil de ' : ''}{r.target} · signalée par @{r.reporter}
              </div>
              {r.stillOnline ? (
                <img src={photoUrl(r.photoKey)} alt="" className={`${r.kind === 'user' ? 'w-32 h-32 rounded-full' : 'w-64 aspect-[2/1] rounded-lg'} object-cover bg-slate-100`} />
              ) : (
                <p className="text-sm italic text-slate-400">La photo a déjà été changée ou retirée.</p>
              )}
              {r.reason && <p className="text-xs text-slate-600"><strong>Motif :</strong> {r.reason}</p>}
              <div className="flex gap-2 pt-1">
                {r.stillOnline && <button disabled={busy === r.id} onClick={() => resolve(r, 'remove')} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Retirer la photo</button>}
                <button disabled={busy === r.id} onClick={() => resolve(r, 'dismiss')} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">Classer sans suite</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
