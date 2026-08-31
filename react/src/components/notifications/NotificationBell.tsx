import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationItem } from '@/components/notifications/NotificationItem';

const PREVIEW_LIMIT = 5;

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
    refetchInterval: 20000,
  });

  const unreadCount = notifications.filter((item) => !item.read).length;
  const preview = notifications.slice(0, PREVIEW_LIMIT);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const openNotification = (id: string, isRead: boolean) => {
    if (!isRead) {
      markReadMutation.mutate(id);
    }
    setOpen(false);
    navigate(isAdmin() ? '/admin/requests' : '/requests');
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const seeAll = () => {
    setOpen(false);
    navigate('/notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Notifications'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 sm:w-96" sideOffset={8}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Tout lu
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucune notification</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Vous êtes à jour !</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {preview.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem
                    notification={notification}
                    compact
                    onClick={() => openNotification(notification.id, notification.read)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={seeAll}>
              Voir tout
              {notifications.length > PREVIEW_LIMIT
                ? ` (${notifications.length})`
                : ''}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
