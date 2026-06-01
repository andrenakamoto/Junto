import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';

export function JoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const circleName = params.get('name') ?? '';
  const circleCode = params.get('code') ?? '';
  const planTitle  = params.get('plan') ?? '';

  const [joining, setJoining] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  // Redirect to /auth if not logged in, preserving the join URL
  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
    }
  }, [loading, user, navigate]);

  async function handleJoin() {
    if (!circleName || !circleCode) return;
    setJoining(true);
    setError('');
    try {
      await api.post('/circles/join', { name: circleName, code: circleCode });
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Erreur';
      // Already a member → just go to dashboard
      if (msg === 'Tu es déjà dans ce Cercle') {
        navigate('/dashboard');
      } else {
        setError(msg);
      }
    } finally {
      setJoining(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoIcon size={72} />
          </div>
          <h1 className="text-3xl font-black text-white">Invitation</h1>
          <p className="text-slate-400 mt-1 text-sm">Tu as été invité(e) sur Junto</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-700/50 space-y-5">
          {/* Circle info */}
          <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-xl border border-slate-700/40">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{circleName}</p>
              <p className="text-slate-400 text-xs">Code : <span className="font-mono tracking-widest text-slate-300">{circleCode}</span></p>
            </div>
          </div>

          {/* Plan info */}
          {planTitle && (
            <div className="px-4 py-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
              <p className="text-xs text-indigo-400 font-medium mb-0.5">Plan associé</p>
              <p className="text-sm text-indigo-200 font-semibold">"{planTitle}"</p>
              <p className="text-xs text-indigo-400 mt-1">Tu y auras accès après avoir rejoint le Cercle.</p>
            </div>
          )}

          {done ? (
            <div className="py-4 text-center">
              <p className="text-emerald-400 font-semibold text-sm">✓ Tu as rejoint le Cercle !</p>
              <p className="text-slate-400 text-xs mt-1">Redirection vers Junto...</p>
            </div>
          ) : (
            <>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                onClick={handleJoin}
                disabled={joining || !circleName || !circleCode}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {joining ? 'Rejoindre...' : (
                  <>
                    Rejoindre le Cercle
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Ignorer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
