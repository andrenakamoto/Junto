import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NativeChrome } from './components/NativeChrome';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { SetupPage } from './pages/SetupPage';
import { PendingPage } from './pages/PendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { JoinPage } from './pages/JoinPage';
import { GuestInvitePage } from './pages/GuestInvitePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { DeleteAccountInfoPage } from './pages/DeleteAccountInfoPage';
import { ChildSafetyPage } from './pages/ChildSafetyPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ConfirmEmailChangePage } from './pages/ConfirmEmailChangePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ResendVerificationPage } from './pages/ResendVerificationPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-sm">Chargement...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
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
        <Route path="/invitation"            element={<GuestInvitePage />} />
        {/* Même page, sans passer par l'aperçu servi par le serveur (secours, server/src/routes/share.ts) */}
        <Route path="/invitation-plan"       element={<GuestInvitePage />} />
        <Route path="/confidentialite"       element={<PrivacyPage />} />
        <Route path="/supprimer-mon-compte"  element={<DeleteAccountInfoPage />} />
        <Route path="/securite-enfants"      element={<ChildSafetyPage />} />
        <Route path="*"                      element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
