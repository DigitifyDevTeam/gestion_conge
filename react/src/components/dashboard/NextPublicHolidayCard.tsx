import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PartyPopper } from 'lucide-react';
import { PublicHoliday } from '@/types/holiday';
import { cn } from '@/lib/utils';

interface NextPublicHolidayCardProps {
  publicHolidays: PublicHoliday[];
  index: number;
}

function getNextPublicHoliday(publicHolidays: PublicHoliday[]): PublicHoliday | null {
  const today = startOfDay(new Date());
  const upcoming = publicHolidays
    .filter((holiday) => startOfDay(holiday.date) >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0] ?? null;
}

export function NextPublicHolidayCard({ publicHolidays, index }: NextPublicHolidayCardProps) {
  const nextHoliday = getNextPublicHoliday(publicHolidays);
  const daysLeft = nextHoliday
    ? differenceInCalendarDays(startOfDay(nextHoliday.date), startOfDay(new Date()))
    : null;

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10')}>
          <PartyPopper className="w-5 h-5 text-warning" />
        </div>
        {daysLeft !== null && (
          <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
            {daysLeft === 0 ? "Aujourd'hui" : `dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-muted-foreground mb-1">Prochain jour férié</h3>

      {nextHoliday ? (
        <>
          <div className="mb-3">
            <p className="text-2xl font-bold text-foreground truncate" title={nextHoliday.name}>
              {nextHoliday.name}
            </p>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-warning to-warning/70 w-full" />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground gap-2">
            <span className="truncate">
              {format(nextHoliday.date, 'EEEE d MMMM', { locale: fr })}
            </span>
            <span className="shrink-0">
              {daysLeft === 0
                ? "Aujourd'hui"
                : `${daysLeft} j restant${daysLeft > 1 ? 's' : ''}`}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3">
            <p className="text-2xl font-bold text-foreground">Aucun</p>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Pas de jour férié à venir</span>
          </div>
        </>
      )}
    </div>
  );
}
