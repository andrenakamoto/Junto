import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { t } from './i18n';
import { NativeChrome } from './components/NativeChrome';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { SetupPage } from './pages/SetupPage';
import { PendingPage } from './pages/PendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { JoinPage } from './pages/JoinPage';
import { GuestInvitePage } from './pages/GuestInvitePage';
import { OrganizePage } from './pages/OrganizePage';
import { SantaPage } from './pages/SantaPage';
import { LandingPage } from './pages/LandingPage';
import { Capacitor } from '@capacitor/core';
import { DemoPage } from './pages/DemoPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { DeleteAccountInfoPage } from './pages/DeleteAccountInfoPage';
import { ChildSafetyPage } from './pages/ChildSafetyPage';
import { QuizScreenPage } from './pages/QuizScreenPage';
import AlbumPage from './pages/AlbumPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ConfirmEmailChangePage } from './pages/ConfirmEmailChangePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ResendVerificationPage } from './pages/ResendVerificationPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-sm">{t('common.loading')}</div>
      </div>
    );
  }
  // Lien vers une page précise (QR code d'une assemblée, email…) : on y revient après la connexion
  if (!user) {
    const back = location.pathname + location.search;
    return <Navigate to={back !== '/dashboard' && back.startsWith('/dashboard') ? `/auth?redirect=${encodeURIComponent(back)}` : '/auth'} replace />;
  }
  if (user.status === 'pending') return <Navigate to="/pending" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Accueil (2026-11-17) : site d'EvLY sur le web ; les apps ouvrent la connexion, une personne connectée va à ses Plans
function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Connecté : le tableau de bord, dans les apps comme sur le site. (Le 17 novembre, les apps allaient toujours sur /auth :
  // chaque relance de l'app affichait la connexion alors que la session était encore valable.)
  if (user) return <Navigate to="/dashboard" replace />;
  if (Capacitor.isNativePlatform()) return <Navigate to="/auth" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NativeChrome />
      <Routes>
        <Route path="/"                      element={<Home />} />
        <Route path="/auth"                  element={<AuthPage />} />
        <Route path="/setup"                 element={<SetupPage />} />
        <Route path="/pending"               element={<PendingPage />} />
        <Route path="/verify-email"          element={<VerifyEmailPage />} />
        <Route path="/confirmer-email"       element={<ConfirmEmailChangePage />} />
        <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
        <Route path="/reset-password"        element={<ResetPasswordPage />} />
        <Route path="/resend-verification"   element={<ResendVerificationPage />} />
        <Route path="/dashboard"             element={<Protected><DashboardPage /></Protected>} />
        <Route path="/admin"                 element={<Protected><AdminOnly><AdminPage /></AdminOnly></Protected>} />
        <Route path="/rejoindre"             element={<JoinPage />} />
        <Route path="/rejoindre-cercle"      element={<JoinPage />} />
        <Route path="/invitation"            element={<GuestInvitePage />} />
        <Route path="/organiser"             element={<OrganizePage />} />
        <Route path="/pere-noel"             element={<SantaPage />} />
        {/* Secret Santa en ligne sans compte : essayé puis abandonné le 2026-11-17 (fragile, faux tirages, ne menait pas à l'app) */}
        <Route path="/secret-santa/*"        element={<Navigate to="/pere-noel" replace />} />
        <Route path="/demo"                  element={<DemoPage />} />
        <Route path="/sorties"               element={<DiscoverPage />} />
        {/* Même page, sans passer par l'aperçu servi par le serveur (secours, server/src/routes/share.ts) */}
        <Route path="/invitation-plan"       element={<GuestInvitePage />} />
        <Route path="/confidentialite"       element={<PrivacyPage />} />
        <Route path="/supprimer-mon-compte"  element={<DeleteAccountInfoPage />} />
        <Route path="/securite-enfants"      element={<ChildSafetyPage />} />
        <Route path="/ecran"                 element={<QuizScreenPage />} />
        <Route path="/album"                 element={<AlbumPage />} />
        <Route path="*"                      element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
