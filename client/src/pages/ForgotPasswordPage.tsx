import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><LogoIcon size={56} /></div>

        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-7 shadow-2xl border border-slate-700/50">
          <button onClick={() => navigate('/auth')} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>

          <h2 className="text-white font-semibold text-lg mb-1">Mot de passe oublié</h2>
          <p className="text-slate-400 text-sm mb-5">Entre ton email et on t'envoie un lien pour réinitialiser ton mot de passe.</p>

          {sent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-4 text-emerald-400 text-sm text-center">
              Si cet email est associé à un compte, tu recevras un lien dans quelques instants.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="toi@example.com"
                required
                autoFocus
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Envoyer le lien
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
