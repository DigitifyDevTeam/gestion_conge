import { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HolidayRequest, PublicHoliday } from '@/types/holiday';
import { isHalfDayOnlyOnDate } from '@/lib/leave';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  requests: HolidayRequest[];
  publicHolidays: PublicHoliday[];
  /** `team` shows company-wide leave (admin); `personal` is the employee view */
  variant?: 'personal' | 'team';
}

export function MiniCalendar({
  requests,
  publicHolidays,
  variant = 'personal',
}: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isTeam = variant === 'team';

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const getLeavesForDay = (day: Date) => {
    return requests.filter(r =>
      r.status === 'approved' &&
      r.dates.some(entry => isSameDay(new Date(entry.date), day))
    );
  };

  const getPublicHolidayForDay = (day: Date) => {
    return publicHolidays.find(h => isSameDay(new Date(h.date), day));
  };

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 shadow-card animate-fade-in h-full flex flex-col min-h-0"
      style={{ animationDelay: '300ms' }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 shrink-0">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-1 flex-1 min-h-0"
        style={{ gridAutoRows: 'minmax(0, 1fr)' }}
      >
        {days.map((day, index) => {
          const leaves = getLeavesForDay(day);
          const hasLeave = leaves.length > 0;
          const isHalfDayOnly = hasLeave && isHalfDayOnlyOnDate(leaves, day);
          const publicHoliday = getPublicHolidayForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDayToday = isToday(day);
          const leaveLabel = isTeam
            ? leaves.map((leave) => {
                const entry = leave.dates.find((d) => isSameDay(new Date(d.date), day));
                const half = entry?.halfDayPeriod ? ' (demi-journée)' : '';
                return `${leave.employeeName}${half}`;
              }).filter(Boolean).join(', ')
            : hasLeave
              ? (isHalfDayOnly ? 'Congé (demi-journée)' : 'Congé')
              : undefined;

          return (
            <div
              key={index}
              title={leaveLabel || publicHoliday?.name || undefined}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg text-sm relative transition-colors gap-0.5 overflow-hidden",
                !isCurrentMonth && "text-muted-foreground/40",
                isCurrentMonth && "text-foreground",
                isDayToday && "bg-primary text-primary-foreground font-semibold",
                hasLeave && !isDayToday && !isHalfDayOnly && "bg-primary/10 text-primary",
                hasLeave && !isDayToday && isHalfDayOnly && "leave-half-diagonal",
                publicHoliday && !isDayToday && !hasLeave && "bg-destructive/10 text-destructive"
              )}
            >
              <span>{format(day, 'd')}</span>
              {isTeam && hasLeave && !isDayToday && leaves.length > 1 && (
                <span className="text-[10px] font-semibold leading-none opacity-80">
                  {leaves.length}
                </span>
              )}
              {(hasLeave || publicHoliday) && !isDayToday && !(isTeam && leaves.length > 1) && !isHalfDayOnly && (
                <span className={cn(
                  "absolute bottom-1 w-1 h-1 rounded-full",
                  hasLeave ? "bg-primary" : "bg-destructive"
                )} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary/30" />
          <span className="text-xs text-muted-foreground">
            {isTeam ? 'Congés équipe' : 'Vos congés'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm leave-half-diagonal-swatch border border-border" />
          <span className="text-xs text-muted-foreground">Demi-journée</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-destructive/30" />
          <span className="text-xs text-muted-foreground">Jour férié</span>
        </div>
      </div>
    </div>
  );
}
