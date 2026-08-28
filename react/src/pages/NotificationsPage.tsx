import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  deleteNotification,
  listNotifications,
  markNotificationRead,
} from '@/api/notifications';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

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

  const markAllRead = async () => {
    await Promise.all(
      notifications.filter(n => !n.read).map(n => markNotificationRead(n.id, true)),
    );
    invalidate();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">Restez informé de vos demandes et de l'activité de l'équipe</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {unreadCount > 0 && (
        <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Badge variant="default">{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Badge>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={cn(
              "bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in",
              !notification.read && "border-l-4 border-l-primary"
            )}
            style={{ animationDelay: `${(index + 2) * 100}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                notification.type === 'success' && "bg-success/10",
                notification.type === 'info' && "bg-primary/10",
                notification.type === 'reminder' && "bg-warning/10"
              )}>
                <Bell className={cn(
                  "w-5 h-5",
                  notification.type === 'success' && "text-success",
                  notification.type === 'info' && "text-primary",
                  notification.type === 'reminder' && "text-warning"
                )} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">{notification.title}</h3>
                  {!notification.read && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(notification.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => markReadMutation.mutate(notification.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(notification.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-border animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bell className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Aucune notification</p>
            <p className="text-muted-foreground mt-1">Vous êtes à jour !</p>
          </div>
        )}
      </div>
    </div>
  );
}
