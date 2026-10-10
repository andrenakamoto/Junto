import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';
import { useTranslation } from 'react-i18next';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage(t('auth.confirmEmailChange.invalidLink')); return; }

    api.post('/auth/verify-email', { token })
      .then(({ data }) => {
        login(data.token, data.user);
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || t('auth.confirmEmailChange.invalidOrExpired'));
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6"><LogoIcon size={56} /></div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
            <p>{t('auth.verify.checking')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={48} className="text-emerald-400" />
            <h2 className="text-white text-xl font-semibold">{t('auth.verify.confirmed')}</h2>
            <p className="text-slate-400 text-sm">{t('auth.verify.redirecting')}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle size={48} className="text-red-400" />
            <h2 className="text-white text-xl font-semibold">{t('auth.confirmEmailChange.invalidTitle')}</h2>
            <p className="text-slate-400 text-sm">{message}</p>
            <button
              onClick={() => navigate('/resend-verification')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {t('auth.verify.resend')}
            </button>
            <button onClick={() => navigate('/auth')} className="text-sm text-slate-400 hover:text-white">
              {t('auth.verify.backToLogin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
