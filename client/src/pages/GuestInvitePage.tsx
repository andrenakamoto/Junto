import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CalendarDays, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';
import { savePendingInvite, clearPendingInvite } from '../lib/pendingInvite';

interface InvitePreview {
  planId: string;
  title: string;
  eventDate: string | null;
  creatorPseudo: string;
  alreadyMember: boolean;
  full: boolean;
}

export function GuestInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const token = params.get('token') ?? '';

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Pas connecté : on mémorise l'invitation puis on passe par la connexion / l'inscription
  useEffect(() => {
    if (loading || user || !token) return;
    savePendingInvite(token);
    navigate(`/auth?redirect=${encodeURIComponent(`/invitation?token=${token}`)}`, { replace: true });
  }, [loading, user, token, navigate]);

  useEffect(() => {
    if (!user) return;
    if (!token) { setError("Ce lien d'invitation est incomplet."); return; }
    api.get(`/plans/guest-invite/${token}`)
      .then(res => setPreview(res.data))
      .catch(err => {
        clearPendingInvite();
        setError(err.response?.data?.error || "Ce lien d'invitation n'est plus valide");
      });
  }, [user, token]);

  async function handleJoin() {
    if (!preview) return;
    if (preview.alreadyMember) {
      clearPendingInvite();
      navigate(`/dashboard?planId=${preview.planId}`);
      return;
    }
    setJoining(true);
    setError('');
    try {
      const { data } = await api.post(`/plans/guest-invite/${token}/accept`);
      clearPendingInvite();
      navigate(`/dashboard?planId=${data.planId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setJoining(false);
    }
  }

  function handleIgnore() {
    clearPendingInvite();
    navigate('/dashboard');
  }

  if (loading || !user) return null;

  const dateFmt = preview?.eventDate
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        .format(new Date(preview.eventDate))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoIcon size={72} />
          </div>
          <h1 className="text-3xl font-black text-white">Invitation</h1>
          <p className="text-slate-400 mt-1 text-sm">Tu as été invité(e) à un Plan sur EvLY</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-700/50 space-y-5">
          {!preview && !error && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          )}

          {preview && (
            <div className="flex items-start gap-3 p-4 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarDays size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm">{preview.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">Proposé par @{preview.creatorPseudo}</p>
                {dateFmt && <p className="text-indigo-300 text-xs mt-1 first-letter:uppercase">{dateFmt}</p>}
              </div>
            </div>
          )}

          {preview && !preview.alreadyMember && (
            <p className="text-xs text-slate-400 leading-relaxed">
              Tu rejoindras <strong className="text-slate-300">uniquement ce Plan</strong> : son chat, ses infos, les
              trajets et les photos. Rejoindre un Plan, c'est dire oui à ce qui y est proposé.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {preview && (preview.full && !preview.alreadyMember ? (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Ce Plan est complet.
            </p>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {joining ? 'Un instant...' : (
                <>
                  {preview.alreadyMember ? 'Ouvrir le Plan' : 'Rejoindre ce Plan'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          ))}

          <button
            onClick={handleIgnore}
            className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            {error ? 'Aller sur EvLY' : 'Ignorer'}
          </button>
        </div>
      </div>
    </div>
  );
}
