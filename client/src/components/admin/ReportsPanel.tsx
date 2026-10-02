import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import api from '../../services/api';

interface Report {
  id: string;
  kind: 'plan' | 'poll';
  messageId: string;
  createdAt: string;
  reason: string | null;
  content: string;
  reporter: string;
  author: { id: string; pseudo: string; firstName: string | null; lastName: string | null };
  where: string;
}

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Messages signalés par les membres (serveur : lib/moderation.ts, routes /admin/reports).
// Supprimer : le message devient « Message supprimé » pour tout le monde. Classer : rien ne change.
// Dans les deux cas, la copie du texte gardée pour le signalement est effacée.
export function ReportsPanel() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/reports').then(res => setReports(res.data)).catch(() => setReports([]));
  }, []);

  async function resolve(r: Report, action: 'delete' | 'dismiss') {
    if (action === 'delete' && !confirm(`Supprimer ce message de @${r.author.pseudo} pour tout le monde ?`)) return;
    setBusy(r.id);
    try {
      await api.post(`/admin/reports/${r.id}/resolve`, { action });
      setReports(prev => (prev ?? []).filter(x => x.messageId !== r.messageId || x.kind !== r.kind));
    } finally {
      setBusy(null);
    }
  }

  if (!reports) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
        <Flag size={17} className="text-slate-400" />Signalements
        {reports.length > 0 && <span className="text-xs font-semibold bg-red-500 text-white rounded-full px-2 py-0.5">{reports.length}</span>}
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Messages signalés par des membres. L'auteur ne sait pas qui l'a signalé. Supprimer le message le remplace
        par « Message supprimé » ; classer le signalement ne change rien. Les personnes concernées peuvent aussi se
        masquer entre elles.
      </p>
      {reports.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl px-4 py-3">Aucun signalement en attente.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map(r => (
            <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="text-xs text-slate-500">
                {dateFmt.format(new Date(r.createdAt))} · {r.where} · signalé par @{r.reporter}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-800">@{r.author.pseudo}</span>
                <p className="mt-1 whitespace-pre-wrap break-words bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700">
                  {r.content || <em className="text-slate-400">(message déjà supprimé par son auteur)</em>}
                </p>
              </div>
              {r.reason && <p className="text-xs text-slate-600"><strong>Motif :</strong> {r.reason}</p>}
              <div className="flex gap-2 pt-1">
                <button disabled={busy === r.id} onClick={() => resolve(r, 'delete')} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Supprimer le message</button>
                <button disabled={busy === r.id} onClick={() => resolve(r, 'dismiss')} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">Classer sans suite</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
