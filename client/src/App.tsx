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
import { DemoPage } from './pages/DemoPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { DeleteAccountInfoPage } from './pages/DeleteAccountInfoPage';
import { ChildSafetyPage } from './pages/ChildSafetyPage';
import { QuizScreenPage } from './pages/QuizScreenPage';
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

export default function App() {
  return (
    <BrowserRouter>
      <NativeChrome />
      <Routes>
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
        <Route path="/demo"                  element={<DemoPage />} />
        <Route path="/sorties"               element={<DiscoverPage />} />
        {/* Même page, sans passer par l'aperçu servi par le serveur (secours, server/src/routes/share.ts) */}
        <Route path="/invitation-plan"       element={<GuestInvitePage />} />
        <Route path="/confidentialite"       element={<PrivacyPage />} />
        <Route path="/supprimer-mon-compte"  element={<DeleteAccountInfoPage />} />
        <Route path="/securite-enfants"      element={<ChildSafetyPage />} />
        <Route path="/ecran"                 element={<QuizScreenPage />} />
        <Route path="*"                      element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
