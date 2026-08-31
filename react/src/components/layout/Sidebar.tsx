import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Palmtree,
  FileText,
  History,
  Flag,
  Shield,
  BarChart3,
  UserCog,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

const employeeNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/calendar', icon: Calendar, label: 'Calendrier' },
  { path: '/requests', icon: FileText, label: 'Mes demandes' },
  { path: '/history', icon: History, label: 'Historique' },
  { path: '/public-holidays', icon: Flag, label: 'Jours fériés' },
];

const adminNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Tableau de bord', adminOnly: true },
  { path: '/admin/users', icon: UserCog, label: 'Gestion utilisateurs', adminOnly: true },
  { path: '/admin/requests', icon: FileText, label: 'Toutes les demandes', adminOnly: true },
  { path: '/admin/balances', icon: TrendingUp, label: 'Gestion soldes', adminOnly: true },
  { path: '/admin/reports', icon: BarChart3, label: 'Rapports', adminOnly: true },
  { path: '/public-holidays', icon: Flag, label: 'Jours fériés' },
];

const employeeBottomNavItems = [
  { path: '/settings', icon: Settings, label: 'Paramètres' },
];

const adminBottomNavItems = [
  { path: '/settings', icon: Settings, label: 'Paramètres' },
];

export function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }: SidebarProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const navItems = isAdmin() ? adminNavItems : employeeNavItems;
  const footerNavItems = isAdmin() ? adminBottomNavItems : employeeBottomNavItems;
  const showLabels = !collapsed || mobileOpen;

  return (
    <aside 
      className={cn(
        "app-sidebar fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
        mobileOpen && "is-open",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <Palmtree className="w-5 h-5 text-primary-foreground" />
          </div>
          {showLabels && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-lg tracking-tight">
                Gestion de congé
              </span>
              {isAdmin() && (
                <Badge variant="default" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary"
              )} />
              {showLabels && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 space-y-1 border-t border-sidebar-border">
        {footerNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary"
              )} />
              {showLabels && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="app-sidebar-collapse absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </Button>
    </aside>
  );
}
