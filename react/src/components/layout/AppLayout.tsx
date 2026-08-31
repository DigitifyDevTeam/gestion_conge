import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NewRequestDialog } from '@/components/requests/NewRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const { isEmployee } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'app-main transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
        )}
      >
        <Header
          onNewRequest={() => setShowNewRequest(true)}
          onMenuClick={() => setMobileOpen((open) => !open)}
        />

        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {isEmployee() && (
        <NewRequestDialog
          open={showNewRequest}
          onOpenChange={setShowNewRequest}
        />
      )}
    </div>
  );
}
