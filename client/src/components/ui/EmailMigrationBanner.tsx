import { useState } from 'react';
import { Mail, X, Loader2, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export function EmailMigrationBanner() {
  const { user, setUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (!user || user.email || dismissed) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.put('/auth/add-email', { email });
      setSent(true);
      // Mettre à jour le user local
      setUser({ ...user!, email, emailVerified: false });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'ajout de l\'email');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3 flex items-center gap-3 text-sm text-emerald-400">
        <CheckCircle size={16} className="flex-shrink-0" />
        <span>Email ajouté ! Vérifie ta boîte mail pour confirmer ton adresse.</span>
        <button onClick={() => setDismissed(true)} className="ml-auto text-emerald-400 hover:text-emerald-300">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 text-sm">
      {!expanded ? (
        <div className="flex items-center gap-3">
          <Mail size={15} className="text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 flex-1">
            Ajoute un email à ton compte pour sécuriser ta connexion et récupérer ton mot de passe.
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs font-semibold px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex-shrink-0"
          >
            Ajouter
          </button>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-200 flex-shrink-0">
            <X size={15} />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Mail size={15} className="text-amber-400" />
            <span className="text-amber-300 font-medium">Ajouter un email</span>
            <button onClick={() => setExpanded(false)} className="ml-auto text-amber-400 hover:text-amber-200">
              <X size={15} />
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="toi@example.com"
              required
              autoFocus
              className="flex-1 px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm flex items-center gap-1.5"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Confirmer
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
