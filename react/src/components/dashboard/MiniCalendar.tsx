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
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  requests: HolidayRequest[];
  publicHolidays: PublicHoliday[];
}

export function MiniCalendar({ requests, publicHolidays }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const getHolidayForDay = (day: Date) => {
    return requests.find(r =>
      r.status === 'approved' &&
      r.dates.some(entry => isSameDay(new Date(entry.date), day))
    );
  };

  const getPublicHolidayForDay = (day: Date) => {
    return publicHolidays.find(h => isSameDay(new Date(h.date), day));
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card animate-fade-in" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h3>
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

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const holiday = getHolidayForDay(day);
          const publicHoliday = getPublicHolidayForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDayToday = isToday(day);

          return (
            <div
              key={index}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-sm relative transition-colors",
                !isCurrentMonth && "text-muted-foreground/40",
                isCurrentMonth && "text-foreground",
                isDayToday && "bg-primary text-primary-foreground font-semibold",
                holiday && !isDayToday && "bg-primary/10 text-primary",
                publicHoliday && !isDayToday && !holiday && "bg-destructive/10 text-destructive"
              )}
            >
              {format(day, 'd')}
              {(holiday || publicHoliday) && !isDayToday && (
                <span className={cn(
                  "absolute bottom-1 w-1 h-1 rounded-full",
                  holiday ? "bg-primary" : "bg-destructive"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Vos congés</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-xs text-muted-foreground">Jour férié</span>
        </div>
      </div>
    </div>
  );
}
