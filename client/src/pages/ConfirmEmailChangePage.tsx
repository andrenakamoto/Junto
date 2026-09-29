import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';

// Lien reçu à la nouvelle adresse lors d'un changement d'email (/confirmer-email?token=…)
export function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('Lien invalide.'); return; }
    api.post('/auth/confirm-email-change', { token })
      .then(({ data }) => { setStatus('success'); setMessage(data.email); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.error || 'Lien invalide ou expiré.'); });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6"><LogoIcon size={56} /></div>
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
            <p>Confirmation en cours…</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle size={48} className="text-emerald-400" />
            <h2 className="text-white text-xl font-semibold">Adresse email modifiée</h2>
            <p className="text-slate-400 text-sm">Ton compte utilise maintenant <strong className="text-slate-200 break-all">{message}</strong>.</p>
            <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Ouvrir EvLY
            </button>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle size={48} className="text-red-400" />
            <h2 className="text-white text-xl font-semibold">Lien invalide</h2>
            <p className="text-slate-400 text-sm">{message}</p>
            <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Ouvrir EvLY
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
