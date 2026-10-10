import { Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { disconnectSocket } from '../lib/socket';
import { Trans, useTranslation } from 'react-i18next';

export function PendingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate('/auth');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-2xl mb-6">
          <Clock className="text-amber-400" size={28} />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">{t('ui.pending.title')}</h1>
        <p className="text-slate-400 text-sm mb-1">
          <Trans i18nKey="ui.pending.hello" values={{ pseudo: user?.pseudo }} components={{ b: <span className="text-white font-semibold" /> }} />
        </p>
        <p className="text-slate-400 text-sm mb-8">
          <Trans i18nKey="ui.pending.text" components={{ br: <br /> }} />
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
        >
          <LogOut size={14} />
          {t('ui.pending.logout')}
        </button>
      </div>
    </div>
  );
}
