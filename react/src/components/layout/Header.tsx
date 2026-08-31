import { Menu, Search, Plus, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface HeaderProps {
  onNewRequest: () => void;
  onMenuClick: () => void;
}

export function Header({ onNewRequest, onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="app-header h-16 bg-card border-b border-border px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="app-menu-btn shrink-0"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="app-header-search flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher des demandes, membres de l'équipe..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!isAdmin() && (
          <Button variant="gradient" onClick={onNewRequest} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle demande</span>
          </Button>
        )}

        <ThemeToggle />

        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-3 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>{user ? getInitials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{user?.name || 'Utilisateur'}</p>
                  {isAdmin() && (
                    <Badge variant="default" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{user?.position || user?.role || ''}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Paramètres du profil
            </DropdownMenuItem>
            {!isAdmin() && (
              <DropdownMenuItem onClick={() => navigate('/history')}>
                Historique des congés
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
