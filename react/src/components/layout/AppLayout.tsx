import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NewRequestDialog } from '@/components/requests/NewRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const { isEmployee } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "ml-16" : "ml-64"
      )}>
        <Header onNewRequest={() => setShowNewRequest(true)} />
        
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
