import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import ActivateAccountPage from '@/pages/ActivateAccountPage';

export function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const [params] = useSearchParams();

  if (params.get('token')) {
    return <ActivateAccountPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
