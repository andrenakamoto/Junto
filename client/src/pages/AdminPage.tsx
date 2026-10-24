import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Check, X, ArrowLeft, Users, Clock, CheckCircle, Trash2, KeyRound, Mail, MailX, AtSign, CircleDot, Search, Calendar, MessageSquare, Activity, Pencil, UserCheck, UserPlus, CalendarDays, Compass, Flag, Lightbulb, BarChart3, HardDrive, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LogoIcon } from '../components/ui/Logo';
import { disconnectSocket } from '../lib/socket';
import api from '../services/api';
import { fullName } from '../lib/names';
import { PageVisitsPanel } from '../components/admin/PageVisitsPanel';
import { ReportsPanel } from '../components/admin/ReportsPanel';
import { PhotoReportsPanel } from '../components/admin/PhotoReportsPanel';
import { StoragePanel } from '../components/admin/StoragePanel';
import { SuggestionsPanel } from '../components/admin/SuggestionsPanel';
import { FunnelPanel } from '../components/admin/FunnelPanel';
import { PlanKindsPanel } from '../components/admin/PlanKindsPanel';
import { DiscoverPanel } from '../components/admin/DiscoverPanel';

interface AdminUser {
  id: string;
  pseudo: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  isAdmin: boolean;
  createdAt: string;
  email: string | null;
  emailVerified: boolean;
  pendingEmail?: string | null;
  canPublishDiscover?: boolean;
  _count: { createdCircles: number };
}

interface Stats {
  pending: number; approved: number; rejected: number;
  totalCircles: number; activePlans: number; messagesLast7Days: number; activeUsersLast7Days: number; lightGuests?: number; newUsersLast7Days?: number;
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

type Section = 'membres' | 'signalements' | 'suggestions' | 'decouvrir' | 'statistiques' | 'stockage';

const SECTIONS: { key: Section; label: string; hint: string; icon: typeof Users }[] = [
  { key: 'membres',      label: 'Membres',      hint: 'Comptes, admissions, emails, mots de passe',      icon: Users },
  { key: 'signalements', label: 'Signalements', hint: 'Messages et photos signalés',                      icon: Flag },
  { key: 'suggestions',  label: 'Suggestions',  hint: 'Idées et problèmes envoyés par les utilisateurs', icon: Lightbulb },
  { key: 'decouvrir',    label: 'Découvrir',    hint: 'Sources, annonces à valider, saisie',             icon: Compass },
  { key: 'statistiques', label: 'Statistiques', hint: "Parcours d'inscription, visites, brochures",      icon: BarChart3 },
  { key: 'stockage',     label: 'Stockage',     hint: 'Base, fichiers, sauvegardes, disque',             icon: HardDrive },
];

export function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, totalCircles: 0, activePlans: 0, messagesLast7Days: 0, activeUsersLast7Days: 0 });
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [editingPseudoId, setEditingPseudoId] = useState<string | null>(null);
  const [pseudoInput, setPseudoInput] = useState('');
  const [pseudoError, setPseudoError] = useState('');
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.find(x => x.key === params.get('s')) ?? null;
  // Éléments à traiter, affichés sur les boutons de la vue d'ensemble
  const [todo, setTodo] = useState<Partial<Record<Section, number>>>({});

  function openSection(key: Section | null) {
    setParams(key ? { s: key } : {});
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    if (section) return;
    const count = (url: string, params?: object, keep?: (x: any) => boolean) =>
      api.get(url, { params }).then(r => (keep ? r.data.filter(keep) : r.data).length as number).catch(() => 0);
    Promise.all([
      count('/admin/reports'),
      count('/admin/photo-reports'),
      count('/admin/suggestions', undefined, s => s.status === 'new'),
      count('/admin/discover/events', { state: 'pending' }),
    ]).then(([reports, photos, suggestions, discover]) =>
      setTodo({ signalements: reports + photos, suggestions, decouvrir: discover }));
  }, [section]);

  async function fetchData() {
    setLoading(true);
    const [usersRes, statsRes, allUsersRes] = await Promise.all([
      api.get(`/admin/users${filter !== 'all' ? `?status=${filter}` : ''}`),
      api.get('/admin/stats'),
      api.get('/admin/users'),
    ]);
    setUsers(usersRes.data.filter((u: AdminUser) => !u.isAdmin));
    setAdminUsers(allUsersRes.data.filter((u: AdminUser) => u.isAdmin));
    setStats(statsRes.data);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [filter]);

  function startEditPseudo(u: AdminUser) {
    setEditingPseudoId(u.id);
    setPseudoInput(u.pseudo);
    setPseudoError('');
  }

  async function handleSavePseudo(u: AdminUser) {
    const newPseudo = pseudoInput.trim();
    if (!newPseudo || newPseudo === u.pseudo) { setEditingPseudoId(null); return; }
    try {
      await api.put(`/admin/users/${u.id}/pseudo`, { pseudo: newPseudo });
      setEditingPseudoId(null);
      if (u.id === user?.id) {
        // Le pseudo est encodé dans le token JWT — il faut se reconnecter pour qu'il se mette à jour partout.
        disconnectSocket();
        logout();
        navigate('/auth');
        return;
      }
      fetchData();
    } catch (err: any) {
      setPseudoError(err.response?.data?.error || 'Erreur');
    }
  }

  async function handleApprove(id: string) {
    await api.put(`/admin/users/${id}/approve`);
    fetchData();
  }

  async function handleReject(id: string) {
    await api.put(`/admin/users/${id}/reject`);
    fetchData();
  }

  // Découvrir : autoriser un compte à publier ses Plans (en Mode annonce)
  async function toggleDiscover(u: AdminUser) {
    await api.put(`/admin/users/${u.id}/discover`, { allowed: !u.canPublishDiscover });
    fetchData();
  }

  async function handleDelete(id: string) {
    await api.delete(`/admin/users/${id}`);
    setConfirmDelete(null);
    fetchData();
  }

  // Secours : proposer une nouvelle adresse email (la personne confirme via le lien reçu)
  const [emailEditId, setEmailEditId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  async function handleChangeEmail(id: string) {
    try {
      await api.put(`/admin/users/${id}/email`, { email: emailInput });
      setEmailMsg({ id, ok: true, text: `Lien de confirmation envoyé à ${emailInput.trim().toLowerCase()}` });
      setEmailEditId(null); setEmailInput('');
      fetchData();
    } catch (err: any) {
      setEmailMsg({ id, ok: false, text: err.response?.data?.error || 'Envoi impossible' });
    }
    setTimeout(() => setEmailMsg(null), 6000);
  }

  async function handleResetPassword(id: string) {
    setConfirmReset(null);
    try {
      await api.put(`/admin/users/${id}/reset-password`);
      setResetDone({ id, ok: true, message: 'Lien envoyé par email ✓' });
    } catch (err: any) {
      setResetDone({ id, ok: false, message: err.response?.data?.error || 'Envoi impossible' });
    }
    setTimeout(() => setResetDone(null), 4000);
  }

  function PseudoField({ u }: { u: AdminUser }) {
    if (editingPseudoId === u.id) {
      return (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={pseudoInput}
            onChange={e => setPseudoInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSavePseudo(u); if (e.key === 'Escape') setEditingPseudoId(null); }}
            className="font-semibold text-slate-800 border border-indigo-300 rounded-lg px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
          />
          <button onClick={() => handleSavePseudo(u)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={14} /></button>
          <button onClick={() => setEditingPseudoId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
        </div>
      );
    }
    return (
      <p className="flex items-center gap-1.5 group">
        @{u.pseudo}
        <button
          onClick={() => startEditPseudo(u)}
          title="Modifier le pseudo"
          className="p-0.5 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil size={12} />
        </button>
      </p>
    );
  }

  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const visibleUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.pseudo, u.email, u.firstName, u.lastName].some(v => v?.toLowerCase().includes(q));
  }).sort((a, b) => sort === 'name'
    ? (fullName(a) ?? a.pseudo).localeCompare(fullName(b) ?? b.pseudo, 'fr')
    : b.createdAt.localeCompare(a.createdAt));

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
          <LogoIcon size={20} />
          <span className="text-slate-500 mx-1">/</span>
          <span className="text-slate-300 text-sm flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-indigo-400" />
            Administration
          </span>
        </div>
        <span className="ml-auto text-xs text-slate-500">@{user?.pseudo}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {!section ? (<>
        <h1 className="text-xl font-bold text-slate-800 mb-4">Vue d'ensemble</h1>

        {/* Activity stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard icon={UserCheck} label="Utilisateurs approuvés" value={stats.approved} highlight />
          <StatCard icon={UserPlus} label="Inscriptions (7j)" value={stats.newUsersLast7Days ?? 0} />
          <StatCard icon={CircleDot} label="Cercles créés" value={stats.totalCircles} />
          <StatCard icon={Calendar} label="Plans actifs" value={stats.activePlans} />
          <StatCard icon={MessageSquare} label="Messages (7j)" value={stats.messagesLast7Days} />
          <StatCard icon={Activity} label="Membres actifs (7j)" value={stats.activeUsersLast7Days} />
        </div>
        <p className="-mt-6 mb-8 text-xs text-slate-500">
          Utilisateurs approuvés : comptes qui peuvent utiliser EvLY (sans les administrateurs ni les réponses sans compte).
          Membres actifs : personnes qui ont utilisé EvLY ces 7 derniers jours. Messages : envoyés ces 7 derniers
          jours dans les chats des Plans et des sondages, même si le Plan a été supprimé depuis. Comptés depuis
          le 29 septembre 2026. Personnes sans compte en cours (réponses à un Plan ou sorties organisées
          sans s'inscrire) : <strong>{stats.lightGuests ?? 0}</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTIONS.map(({ key, label, hint, icon: Icon }) => {
            const n = key === 'membres' ? stats.pending : todo[key] ?? 0;
            return (
              <button key={key} onClick={() => openSection(key)}
                className="flex items-center gap-3 text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><Icon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    {label}
                    {n > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{n}</span>}
                  </p>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
        </>) : (<>
        <button onClick={() => openSection(null)} className="mb-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-700">
          <ArrowLeft size={14} />Vue d'ensemble
        </button>
        <h1 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><section.icon size={20} className="text-indigo-600" />{section.label}</h1>

        {section.key === 'stockage' && <StoragePanel />}
        {section.key === 'signalements' && <><ReportsPanel /><PhotoReportsPanel /></>}
        {section.key === 'suggestions' && <SuggestionsPanel />}
        {section.key === 'decouvrir' && <DiscoverPanel />}
        {section.key === 'statistiques' && <>
        <FunnelPanel />
        <PlanKindsPanel />
        <PageVisitsPanel
          page="decouvrir"
          title="Page « Découvrir »"
          description="Visites de evly.ch/decouvrir.html par jour. Comptage anonyme : ni cookie, ni adresse IP ; robots et personnes connectées à EvLY exclus."
        />
        <PageVisitsPanel
          page="brochure"
          title="Brochure associations (PDF)"
          description="Ouvertures du PDF par jour, via evly.ch/brochure, l'ancienne adresse du PDF et le lien de la page de connexion. Comptage anonyme : ni cookie, ni adresse IP ; robots exclus."
          unit="ouverture"
        />
        <PageVisitsPanel
          page="brochure-pro"
          title="Brochure professionnels (PDF)"
          description="Ouvertures du PDF par jour, via evly.ch/brochure-pro et le lien de la page de connexion. Comptage anonyme : ni cookie, ni adresse IP ; robots exclus."
          unit="ouverture"
        />
        </>}

        {section.key === 'membres' && <>
        {adminUsers.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Comptes admin</h2>
            <div className="space-y-3 mb-8">
              {adminUsers.map(u => (
                <div key={u.id} className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800"><PseudoField u={u} /></div>
                  {fullName(u) && <p className="text-xs text-slate-500">{fullName(u)}</p>}
                    {u.id === user?.id && <span className="text-xs text-indigo-500">C'est toi</span>}
                  </div>
                </div>
              ))}
            </div>
            {pseudoError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{pseudoError}</p>}
          </>
        )}

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">Gestion des membres</h2>
          {!loading && <span className="text-sm text-slate-400">{visibleUsers.length} compte{visibleUsers.length > 1 ? 's' : ''}</span>}
          <select value={sort} onChange={e => setSort(e.target.value as 'recent' | 'name')} className="ml-auto text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="recent">Plus récents</option>
            <option value="name">Par nom</option>
          </select>
        </div>
        {adminUsers.length === 0 && pseudoError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{pseudoError}</p>}

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, pseudo ou email…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

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
        ) : visibleUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {search ? 'Aucun résultat pour cette recherche.' : 'Aucun utilisateur dans cette catégorie.'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleUsers.map(u => {
              const name = fullName(u);
              const btn = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors';
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Identité */}
                  <div className="p-4 flex gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                      u.status === 'approved' ? 'bg-indigo-100 text-indigo-700' : u.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {(u.firstName?.[0] ?? u.pseudo[0]).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold text-slate-900 truncate">{name ?? <span className="text-slate-400 font-normal italic">Sans prénom</span>}</p>
                        <StatusBadge status={u.status} />
                      </div>
                      <div className="text-sm text-slate-500"><PseudoField u={u} /></div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.email ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${u.emailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {u.emailVerified ? <Mail size={11} /> : <MailX size={11} />}
                            <span className="break-all">{u.email}</span>
                            {!u.emailVerified && <span>· non vérifié</span>}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500"><MailX size={11} /> Pas d'email</span>
                        )}
                        {u.pendingEmail && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">→ {u.pendingEmail} · à confirmer</span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                          <CalendarDays size={11} />
                          Inscrit le {new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(u.createdAt))}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                          <CircleDot size={11} />
                          {u._count.createdCircles} Cercle{u._count.createdCircles !== 1 ? 's' : ''} créé{u._count.createdCircles !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {u.status === 'pending' && (<>
                      <button onClick={() => handleApprove(u.id)} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><Check size={13} />Approuver</button>
                      <button onClick={() => handleReject(u.id)} className={`${btn} bg-white border border-slate-200 text-red-600 hover:bg-red-50`}><X size={13} />Refuser</button>
                    </>)}
                    {u.status === 'approved' && (
                      <button onClick={() => handleReject(u.id)} className={`${btn} bg-white border border-slate-200 text-slate-600 hover:text-red-700 hover:bg-red-50`}><X size={13} />Révoquer</button>
                    )}
                    {u.status === 'approved' && (
                      <button onClick={() => toggleDiscover(u)}
                        title={u.canPublishDiscover ? 'Retirer l’autorisation : ses annonces publiées depuis ses Plans disparaissent de Découvrir' : 'Autoriser ce compte à publier ses Plans (en Mode annonce) dans Découvrir'}
                        className={`${btn} border ${u.canPublishDiscover ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                        <Compass size={13} />{u.canPublishDiscover ? 'Publie dans Découvrir ✓' : 'Autoriser Découvrir'}
                      </button>
                    )}
                    {u.status === 'rejected' && (
                      <button onClick={() => handleApprove(u.id)} className={`${btn} bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50`}><Check size={13} />Approuver</button>
                    )}

                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {emailMsg?.id === u.id ? (
                        <span className={`text-xs font-medium ${emailMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{emailMsg.text}</span>
                      ) : resetDone?.id === u.id ? (
                        <span className={`text-xs font-medium ${resetDone.ok ? 'text-emerald-600' : 'text-red-500'}`}>{resetDone.message}</span>
                      ) : emailEditId === u.id ? (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <input
                            autoFocus
                            type="email"
                            value={emailInput}
                            onChange={e => setEmailInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && emailInput.trim()) handleChangeEmail(u.id); if (e.key === 'Escape') setEmailEditId(null); }}
                            placeholder="Nouvelle adresse"
                            className="w-52 px-2 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button onClick={() => handleChangeEmail(u.id)} disabled={!emailInput.trim()} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`}>Envoyer le lien</button>
                          <button onClick={() => setEmailEditId(null)} className={`${btn} bg-white border border-slate-200 text-slate-600`}>Annuler</button>
                        </div>
                      ) : confirmReset === u.id ? (
                        <div className="flex gap-1.5 items-center">
                          <span className="text-xs text-amber-700 font-medium">Envoyer un lien pour changer le mot de passe ?</span>
                          <button onClick={() => handleResetPassword(u.id)} className={`${btn} bg-amber-500 text-white hover:bg-amber-600`}>Envoyer</button>
                          <button onClick={() => setConfirmReset(null)} className={`${btn} bg-white border border-slate-200 text-slate-600`}>Annuler</button>
                        </div>
                      ) : confirmDelete === u.id ? (
                        <div className="flex gap-1.5 items-center">
                          <span className="text-xs text-red-700 font-medium">Supprimer définitivement ce compte ?</span>
                          <button onClick={() => handleDelete(u.id)} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Supprimer</button>
                          <button onClick={() => setConfirmDelete(null)} className={`${btn} bg-white border border-slate-200 text-slate-600`}>Annuler</button>
                        </div>
                      ) : (<>
                        <button onClick={() => { setEmailEditId(u.id); setEmailInput(''); }} title="Un lien de confirmation est envoyé à la nouvelle adresse"
                          className={`${btn} text-slate-600 hover:text-indigo-700 hover:bg-indigo-50`}><AtSign size={13} />Email</button>
                        <button onClick={() => setConfirmReset(u.id)} title="Envoyer un lien de réinitialisation du mot de passe"
                          className={`${btn} text-slate-600 hover:text-amber-700 hover:bg-amber-50`}><KeyRound size={13} />Mot de passe</button>
                        <button onClick={() => setConfirmDelete(u.id)} title="Supprimer définitivement"
                          className={`${btn} text-slate-500 hover:text-red-700 hover:bg-red-50`}><Trash2 size={13} />Supprimer</button>
                      </>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>}
        </>)}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
      <div className={`flex items-center gap-1.5 mb-1.5 ${highlight ? 'text-indigo-600' : 'text-slate-400'}`}>
        <Icon size={13} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
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
