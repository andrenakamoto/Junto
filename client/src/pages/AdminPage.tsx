import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Check, X, ArrowLeft, Users, Clock, CheckCircle, Trash2, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface AdminUser {
  id: string;
  pseudo: string;
  status: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Stats { pending: number; approved: number; rejected: number; }

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    const [usersRes, statsRes] = await Promise.all([
      api.get(`/admin/users${filter !== 'all' ? `?status=${filter}` : ''}`),
      api.get('/admin/stats'),
    ]);
    setUsers(usersRes.data.filter((u: AdminUser) => !u.isAdmin));
    setStats(statsRes.data);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [filter]);

  async function handleApprove(id: string) {
    await api.put(`/admin/users/${id}/approve`);
    fetchData();
  }

  async function handleReject(id: string) {
    await api.put(`/admin/users/${id}/reject`);
    fetchData();
  }

  async function handleDelete(id: string) {
    await api.delete(`/admin/users/${id}`);
    setConfirmDelete(null);
    fetchData();
  }

  async function handleResetPassword(id: string) {
    await api.put(`/admin/users/${id}/reset-password`);
    setConfirmReset(null);
    setResetDone(id);
    setTimeout(() => setResetDone(null), 3000);
  }

  const filters: { key: Filter; label: string; icon: typeof Users; count?: number; color: string }[] = [
    { key: 'pending',  label: 'En attente', icon: Clock,       count: stats.pending,  color: 'text-amber-500' },
    { key: 'approved', label: 'Approuvés',  icon: CheckCircle, count: stats.approved, color: 'text-emerald-500' },
    { key: 'rejected', label: 'Refusés',    icon: X,           count: stats.rejected, color: 'text-red-500' },
    { key: 'all',      label: 'Tous',       icon: Users,       color: 'text-slate-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">E</span>
          </div>
          <span className="text-white font-bold">Estelle</span>
          <span className="text-slate-500 mx-1">/</span>
          <span className="text-slate-300 text-sm flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-indigo-400" />
            Administration
          </span>
        </div>
        <span className="ml-auto text-xs text-slate-500">@{user?.pseudo}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-slate-800 mb-6">Gestion des membres</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map(({ key, label, icon: Icon, count, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                filter === key
                  ? 'bg-white border-indigo-300 text-indigo-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icon size={14} className={filter === key ? 'text-indigo-500' : color} />
              {label}
              {count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  key === 'pending' && count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User list */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Chargement...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Aucun utilisateur dans cette catégorie.
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold text-sm">{u.pseudo[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">@{u.pseudo}</p>
                  <p className="text-xs text-slate-400">
                    Inscrit le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(u.createdAt))}
                  </p>
                </div>
                <StatusBadge status={u.status} />
                {u.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Check size={14} />
                      Approuver
                    </button>
                    <button
                      onClick={() => handleReject(u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <X size={14} />
                      Refuser
                    </button>
                  </div>
                )}
                {u.status === 'approved' && (
                  <button
                    onClick={() => handleReject(u.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <X size={14} />
                    Révoquer
                  </button>
                )}
                {u.status === 'rejected' && (
                  <button
                    onClick={() => handleApprove(u.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Check size={14} />
                    Approuver
                  </button>
                )}
                {resetDone === u.id ? (
                  <span className="text-xs text-emerald-600 font-medium px-2">Mot de passe : 123 ✓</span>
                ) : confirmReset === u.id ? (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-amber-600 font-medium">Réinitialiser ?</span>
                    <button onClick={() => handleResetPassword(u.id)} className="px-2.5 py-1.5 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-xs font-medium transition-colors">Oui</button>
                    <button onClick={() => setConfirmReset(null)} className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors">Non</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(u.id)}
                    title="Réinitialiser le mot de passe"
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <KeyRound size={15} />
                  </button>
                )}

                {confirmDelete === u.id ? (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="px-2.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Oui
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(u.id)}
                    title="Supprimer définitivement"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    pending:  { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approuvé',   cls: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
  }[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>;
}
