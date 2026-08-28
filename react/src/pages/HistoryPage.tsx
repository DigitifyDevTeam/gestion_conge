import { format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, History, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { listLeaveRequests } from '@/api/leaveRequests';
import { HolidayRequest, HolidayType, HalfDayPeriod, RequestStatus } from '@/types/holiday';
import { cn } from '@/lib/utils';
import { formatLeaveDuration } from '@/lib/leave';

interface HistoryDayEntry {
  id: string;
  date: Date;
  halfDayPeriod?: HalfDayPeriod | null;
  request: HolidayRequest;
}

function typeLabel(type: HolidayType): string {
  switch (type) {
    case 'annual':
      return 'Congés annuels';
    case 'sick':
      return 'Congés maladie';
    case 'personal':
      return 'Jour personnel';
    case 'unpaid':
      return 'Congés sans solde';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'approved':
      return 'Approuvé';
    case 'rejected':
      return 'Rejeté';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function statusIcon(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return Clock3;
    case 'approved':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function expandRequestDays(request: HolidayRequest): HistoryDayEntry[] {
  return request.dates.map((entry) => {
    const date = startOfDay(new Date(entry.date));
    return {
      id: `${request.id}-${format(date, 'yyyy-MM-dd')}`,
      date,
      halfDayPeriod: entry.halfDayPeriod || null,
      request,
    };
  });
}

function sumDays(requests: HolidayRequest[], status?: RequestStatus): number {
  return requests
    .filter((request) => (status ? request.status === status : true))
    .reduce((total, request) => total + Number(request.days), 0);
}

export default function HistoryPage() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });

  const historyDays = requests
    .flatMap(expandRequestDays)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const grouped = historyDays.reduce((acc, entry) => {
    const key = format(entry.date, 'yyyy-MM');
    const existing = acc.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      acc.set(key, {
        label: format(entry.date, 'MMMM yyyy', { locale: fr }),
        entries: [entry],
      });
    }
    return acc;
  }, new Map<string, { label: string; entries: HistoryDayEntry[] }>());

  const groups = [...grouped.values()];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
        <p className="text-muted-foreground mt-1">
          Consultez tous vos jours de congés
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total des jours</p>
          <p className="text-2xl font-bold text-foreground mt-1">{sumDays(requests)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Jours approuvés</p>
          <p className="text-2xl font-bold text-success mt-1">{sumDays(requests, 'approved')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Jours en attente</p>
          <p className="text-2xl font-bold text-warning mt-1">{sumDays(requests, 'pending')}</p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement de l'historique...</p>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-card">
          <History className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Aucun jour de congé dans l'historique</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.label} className="space-y-3 animate-fade-in">
            <h2 className="text-lg font-semibold text-foreground capitalize">{group.label}</h2>
            <div className="space-y-3">
              {group.entries.map((entry) => {
                const StatusIcon = statusIcon(entry.request.status);
                const isHalfDay = Boolean(entry.halfDayPeriod);
                return (
                  <div
                    key={entry.id}
                    className="bg-card rounded-xl border border-border p-5 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          entry.request.status === 'approved' && 'bg-success/10',
                          entry.request.status === 'pending' && 'bg-warning/10',
                          entry.request.status === 'rejected' && 'bg-destructive/10',
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            'w-4 h-4',
                            entry.request.status === 'approved' && 'text-success',
                            entry.request.status === 'pending' && 'text-warning',
                            entry.request.status === 'rejected' && 'text-destructive',
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-foreground">
                            {format(entry.date, 'EEEE d MMMM yyyy', { locale: fr })}
                          </p>
                          <Badge variant={entry.request.status} className="text-xs">
                            {statusLabel(entry.request.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {typeLabel(entry.request.type)}
                          {isHalfDay
                            ? ` · ${formatLeaveDuration(0.5, entry.halfDayPeriod)}`
                            : ''}
                        </p>
                        {isHalfDay && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Demi-journée
                          </p>
                        )}
                        {entry.request.reason && (
                          <p className="text-sm text-foreground mt-2">{entry.request.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
