import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { SetupPage } from './pages/SetupPage';
import { PendingPage } from './pages/PendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { JoinPage } from './pages/JoinPage';

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
      <Routes>
        <Route path="/auth"    element={<AuthPage />} />
        <Route path="/setup"   element={<SetupPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/admin"    element={<Protected><AdminOnly><AdminPage /></AdminOnly></Protected>} />
        <Route path="/rejoindre" element={<JoinPage />} />
        <Route path="*"         element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
