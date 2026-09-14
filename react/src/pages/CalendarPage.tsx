import { useMemo, useState } from 'react';
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
  endOfWeek,
  isWeekend,
  getYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listPublicHolidays } from '@/api/publicHolidays';
import { listUsers } from '@/api/users';
import {
  buildEmployeeColorMap,
  resolveEmployeeColor,
  getEmployeesOnLeaveInYear,
  halfDayDiagonalStyle,
} from '@/lib/employeeColor';
import { cn } from '@/lib/utils';

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: recentRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });
  const { data: tunisianPublicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
  });
  const teamView = isAdmin();
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers(),
    enabled: teamView,
  });

  const employeeColorMap = useMemo(
    () => (teamView ? buildEmployeeColorMap(users) : undefined),
    [teamView, users],
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const employeesOnLeave = useMemo(
    () =>
      teamView
        ? getEmployeesOnLeaveInYear(recentRequests, getYear(currentMonth), employeeColorMap)
        : [],
    [teamView, recentRequests, currentMonth, employeeColorMap],
  );

  const getEventsForDay = (day: Date) => {
    const holidays = recentRequests.filter(r =>
      r.status === 'approved' &&
      r.dates.some(entry => isSameDay(new Date(entry.date), day))
    );
    
    const publicHol = tunisianPublicHolidays.find(h => isSameDay(new Date(h.date), day));
    
    return { holidays, publicHoliday: publicHol };
  };

  return (
    <div className="space-y-6">
      <div className="page-toolbar flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendrier</h1>
          <p className="text-muted-foreground mt-1">
            {teamView
              ? 'Vue d’ensemble des congés de l’équipe et des jours fériés'
              : 'Consultez vos congés et la disponibilité de l’équipe'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => setCurrentMonth(new Date())}
          >
            Aujourd&apos;hui
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <Calendar className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-semibold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h2>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map(day => (
            <div 
              key={day} 
              className="px-2 py-3 text-center text-sm font-semibold text-muted-foreground bg-secondary/30"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const { holidays, publicHoliday } = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDayToday = isToday(day);
            const isDayWeekend = isWeekend(day);

            return (
              <div
                key={index}
                className={cn(
                  "month-cal-cell min-h-[100px] p-2 border-b border-r border-border transition-colors",
                  !isCurrentMonth && "bg-muted/30",
                  isDayWeekend && isCurrentMonth && "bg-secondary/20",
                  "hover:bg-accent/50"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                    !isCurrentMonth && "text-muted-foreground/40",
                    isCurrentMonth && "text-foreground",
                    isDayToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {publicHoliday && (
                    <div className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium truncate">
                      {publicHoliday.name}
                    </div>
                  )}
                  {holidays.slice(0, 2).map((holiday) => {
                    const dayEntry = holiday.dates.find((entry) =>
                      isSameDay(new Date(entry.date), day),
                    );
                    const isHalfDay = Boolean(dayEntry?.halfDayPeriod);
                    const color = teamView
                      ? resolveEmployeeColor(holiday.employeeId, employeeColorMap)
                      : null;
                    const label = teamView
                      ? holiday.employeeName
                      : (holiday.reason || 'Congé');

                    return (
                      <div
                        key={holiday.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium truncate border',
                          !teamView && isHalfDay && 'leave-half-diagonal text-primary border-primary/20',
                          !teamView && !isHalfDay && 'bg-primary/10 text-primary border-transparent',
                          teamView && 'border-transparent',
                        )}
                        style={
                          teamView && color
                            ? isHalfDay
                              ? {
                                  ...halfDayDiagonalStyle(color),
                                  borderColor: `${color.bg}33`,
                                }
                              : {
                                  backgroundColor: color.soft,
                                  color: color.text,
                                }
                            : undefined
                        }
                        title={isHalfDay ? `${label} (demi-journée)` : label}
                      >
                        {isHalfDay ? `${label} · ½` : label}
                      </div>
                    );
                  })}
                  {holidays.length > 2 && (
                    <div className="text-xs text-muted-foreground px-1.5">
                      +{holidays.length - 2} de plus
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="flex flex-wrap items-center gap-6">
          {!teamView && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-sm text-muted-foreground">Vos congés</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded leave-half-diagonal-swatch border border-border" />
            <span className="text-sm text-muted-foreground">Demi-journée</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-sm text-muted-foreground">Jour férié</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-secondary" />
            <span className="text-sm text-muted-foreground">Week-end</span>
          </div>
        </div>

        {teamView && employeesOnLeave.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <p className="text-sm font-medium text-foreground mb-3">
              Employés en congé ({getYear(currentMonth)})
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {employeesOnLeave.map((employee) => (
                <div key={employee.id} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: employee.color.bg }}
                  />
                  <span className="text-sm text-foreground">{employee.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
