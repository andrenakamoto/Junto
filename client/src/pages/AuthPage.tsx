import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';

type Mode = 'login' | 'register';

export function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);

  // Redirect to setup if no admin exists yet
  useEffect(() => {
    api.get('/auth/needs-setup').then(res => {
      if (res.data.needsSetup) navigate('/setup');
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRegistered(false);
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { pseudo, password });
        setRegistered(true);
        setPseudo('');
        setPassword('');
        setMode('login');
      } else {
        const { data } = await api.post('/auth/login', { pseudo, password });
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      const code = err.response?.data?.error;
      if (code === 'pending') {
        setError('Ton compte est en attente de validation par un admin.');
      } else if (code === 'rejected') {
        setError('Ton inscription a été refusée par un admin.');
      } else {
        setError(err.response?.data?.error || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setRegistered(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoIcon size={72} />
          </div>
          <h1
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700 }}
            className="text-4xl text-white tracking-wide"
          >
            Estelle
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Retrouve tes proches. Organise tes Plans.</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-700/50">
          <div className="flex rounded-xl bg-slate-900/80 p-1 mb-6">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {registered && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm mb-4">
              Inscription envoyée ! Un admin validera ton compte prochainement.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Pseudo</label>
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                placeholder="ton_pseudo"
                required
                autoFocus
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            {mode === 'register' && !error && (
              <p className="text-xs text-slate-500">
                Ton compte sera activé après validation par un administrateur.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {loading
                ? 'Chargement...'
                : mode === 'login'
                ? 'Se connecter'
                : 'Envoyer ma demande'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
