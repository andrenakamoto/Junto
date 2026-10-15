import { useEffect, useState } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface Storage {
  database: number;
  files: number;
  photos: number;
  backups: number;
  disk: { total: number; free: number } | null;
  attachments: { count: number; size: number };
  at: string;
}

const size = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} Go` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`;

// Espace utilisé sur le serveur (routes /admin/storage) : base, fichiers, sauvegardes, disque libre
export function StoragePanel() {
  const [data, setData] = useState<Storage | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); api.get('/admin/storage').then(r => setData(r.data)).catch(() => {}).finally(() => setBusy(false)); };
  useEffect(load, []);

  const used = data?.disk ? data.disk.total - data.disk.free : 0;
  const pct = data?.disk ? Math.round((used / data.disk.total) * 100) : 0;
  const bar = pct >= 85 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
        <HardDrive size={17} className="text-slate-400" />Stockage
        <button onClick={load} disabled={busy} title="Actualiser" className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
        </button>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Espace occupé sur le serveur. Les Plans (et leurs fichiers) sont effacés 24 h après leur fin, la discussion des Cercles
        après 7 jours : l'espace se libère tout seul. Au-delà de 70 % du disque, la barre passe à l'orange.
      </p>
      {!data ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl px-4 py-3">Chargement…</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          {data.disk && (
            <div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-800">Disque du serveur</span>
                <span className="text-slate-600">{size(used)} utilisés sur {size(data.disk.total)} · <strong>{size(data.disk.free)} libres</strong></span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${bar}`} style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-50"><dt className="text-xs text-slate-500">Base de données</dt><dd className="font-semibold text-slate-800">{size(data.database)}</dd></div>
            <div className="p-3 rounded-lg bg-slate-50"><dt className="text-xs text-slate-500">Fichiers des Plans</dt><dd className="font-semibold text-slate-800">{size(Math.max(0, data.files - data.photos))}</dd>
              <dd className="text-[11px] text-slate-400">{data.attachments.count} fichier{data.attachments.count > 1 ? 's' : ''}</dd></div>
            <div className="p-3 rounded-lg bg-slate-50"><dt className="text-xs text-slate-500">Photos de profil, de Cercle et de discussion</dt><dd className="font-semibold text-slate-800">{size(data.photos)}</dd></div>
            <div className="p-3 rounded-lg bg-slate-50"><dt className="text-xs text-slate-500">Sauvegardes sur le serveur</dt><dd className="font-semibold text-slate-800">{size(data.backups)}</dd></div>
          </dl>
          <p className="text-[11px] text-slate-400">Mesuré le {new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(data.at))}. Les fichiers comprennent les miniatures et les messages vocaux convertis.</p>
        </div>
      )}
    </section>
  );
}
