import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/api/notifications';

interface NotificationItemProps {
  notification: AppNotification;
  compact?: boolean;
  onClick?: () => void;
}

export function NotificationItem({
  notification,
  compact = false,
  onClick,
}: NotificationItemProps) {
  const content = (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          compact ? 'h-7 w-7' : 'h-9 w-9',
          notification.type === 'success' && 'bg-success/10',
          notification.type === 'info' && 'bg-primary/10',
          notification.type === 'reminder' && 'bg-warning/10',
        )}
      >
        <Bell
          className={cn(
            compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
            notification.type === 'success' && 'text-success',
            notification.type === 'info' && 'text-primary',
            notification.type === 'reminder' && 'text-warning',
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate font-medium text-foreground',
              compact ? 'text-sm' : 'text-base',
            )}
          >
            {notification.title}
          </span>
          {!notification.read && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p
          className={cn(
            'mt-0.5 text-muted-foreground',
            compact ? 'line-clamp-2 text-xs leading-snug' : 'text-sm',
          )}
        >
          {notification.message}
        </p>
        <p className={cn('mt-1 text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}>
          {format(notification.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-2.5 text-left transition-colors hover:bg-muted/50',
          compact ? 'px-3 py-2.5' : 'gap-3 px-4 py-3',
          !notification.read && 'bg-primary/5',
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5',
        compact ? 'px-3 py-2.5' : 'gap-3 px-4 py-3',
        !notification.read && 'bg-primary/5',
      )}
    >
      {content}
    </div>
  );
}
