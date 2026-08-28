import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { HolidayRequest } from '@/types/holiday';
import { cn } from '@/lib/utils';
import { formatLeaveDates, formatLeaveDaysNumber, halfDayPeriodLabel } from '@/lib/leave';

interface UpcomingLeaveCardProps {
  requests: HolidayRequest[];
  index: number;
}

function getNextUpcomingLeave(requests: HolidayRequest[]): HolidayRequest | null {
  const today = startOfDay(new Date());
  const upcoming = requests
    .filter((request) => request.status === 'approved' && startOfDay(request.startDate) >= today)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return upcoming[0] ?? null;
}

export function UpcomingLeaveCard({ requests, index }: UpcomingLeaveCardProps) {
  const nextLeave = getNextUpcomingLeave(requests);
  const daysLeft = nextLeave
    ? differenceInCalendarDays(startOfDay(nextLeave.startDate), startOfDay(new Date()))
    : null;

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-success/10')}>
          <CalendarDays className="w-5 h-5 text-success" />
        </div>
        {daysLeft !== null && (
          <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
            {daysLeft === 0 ? "Aujourd'hui" : `dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-muted-foreground mb-1">Congés à venir</h3>

      {nextLeave ? (
        <>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-3xl font-bold text-foreground">{formatLeaveDaysNumber(nextLeave.days)}</span>
            <span className="text-sm text-muted-foreground">
              jour{nextLeave.days > 1 ? 's' : ''}
              {nextLeave.halfDayPeriod ? ` (${halfDayPeriodLabel(nextLeave.halfDayPeriod)})` : ''}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-success to-success/70 w-full" />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="truncate pr-2" title={nextLeave.reason || 'Congé'}>
              {nextLeave.reason || 'Congé approuvé'}
            </span>
            <span className="shrink-0">
              {formatLeaveDates(nextLeave.dates)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-3xl font-bold text-foreground">0</span>
            <span className="text-sm text-muted-foreground">jour</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Aucun congé prévu</span>
          </div>
        </>
      )}
    </div>
  );
}
