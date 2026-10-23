import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogoFull } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { DiscoverView } from '../components/discover/DiscoverView';
import { t } from '../i18n';

// Page publique /sorties : Découvrir sans compte (« Y aller avec un Cercle » demande de se connecter)
export function DiscoverPage() {
  const { user } = useAuth();
  return (
    <div className="app-screen flex flex-col bg-slate-50">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
        <Link to={user ? '/dashboard' : '/auth'} className="flex-shrink-0"><LogoFull light iconSize={26} /></Link>
        <div className="flex-1" />
        <LanguagePicker compact loggedIn={!!user} />
        {user ? (
          <Link to="/dashboard" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">EvLY</Link>
        ) : (
          <>
            <Link to="/auth?redirect=/sorties" className="hidden sm:inline px-3 py-1.5 rounded-lg text-slate-700 text-sm font-semibold hover:bg-slate-100">{t('discover.public.login')}</Link>
            <Link to="/auth?mode=inscription" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">{t('discover.public.signup')}</Link>
          </>
        )}
      </header>
      <DiscoverView mode="public" />
    </div>
  );
}
