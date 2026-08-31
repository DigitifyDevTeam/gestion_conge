import { Check, CheckCheck, Trash2, Bell, ArrowLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationItem } from '@/components/notifications/NotificationItem';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, true),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      invalidate();
      toast({ title: 'Notification supprimée' });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Suppression impossible.',
        variant: 'destructive',
      });
    },
  });

  const openRelatedPage = (id: string, isRead: boolean) => {
    if (!isRead) {
      markReadMutation.mutate(id);
    }
    navigate(isAdmin() ? '/admin/requests' : '/requests');
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    invalidate();
  };

  const goBack = () => {
    navigate(isAdmin() ? '/admin' : '/');
  };

  return (
    <div className="space-y-6">
      <div className="page-toolbar flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={goBack} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="mt-1 text-muted-foreground">
              Toutes vos notifications de demandes et d&apos;activité
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Badge variant="default">
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Aucune notification</p>
            <p className="mt-1 text-muted-foreground">Vous êtes à jour !</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <ul className="divide-y divide-border">
              {notifications.map((notification, index) => (
                <li
                  key={notification.id}
                  className={cn(
                    'flex items-start animate-fade-in',
                    !notification.read && 'border-l-4 border-l-primary',
                  )}
                  style={{ animationDelay: `${(index + 2) * 50}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <NotificationItem
                      notification={notification}
                      onClick={() => openRelatedPage(notification.id, notification.read)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1 py-3 pr-3">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Marquer comme lu"
                        onClick={() => markReadMutation.mutate(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer la notification"
                      onClick={() => deleteMutation.mutate(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
