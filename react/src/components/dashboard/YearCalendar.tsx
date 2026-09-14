import { useMemo, useState, type CSSProperties } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  setMonth,
  setYear,
  getYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HolidayRequest, PublicHoliday } from '@/types/holiday';
import {
  getEmployeesOnLeaveInYear,
  getPeopleOnLeaveForDay,
  halfDayDiagonalStyle,
  type EmployeeColorMap,
} from '@/lib/employeeColor';
import { cn } from '@/lib/utils';

interface YearCalendarProps {
  requests: HolidayRequest[];
  publicHolidays: PublicHoliday[];
  employeeColorMap?: EmployeeColorMap;
}

const WEEK_DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MAX_VISIBLE_DOTS = 3;

function MonthBlock({
  monthDate,
  requests,
  publicHolidays,
  employeeColorMap,
}: {
  monthDate: Date;
  requests: HolidayRequest[];
  publicHolidays: PublicHoliday[];
  employeeColorMap?: EmployeeColorMap;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });

  return (
    <div className="flex flex-col min-h-0">
      <h4 className="text-sm font-semibold text-foreground capitalize mb-2 truncate">
        {format(monthDate, 'MMMM', { locale: fr })}
      </h4>

      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEK_DAYS.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className="text-center text-[10px] font-medium text-muted-foreground leading-none py-0.5"
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-px flex-1 min-h-0"
        style={{ gridAutoRows: 'minmax(0, 1fr)' }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const people = inMonth
            ? getPeopleOnLeaveForDay(requests, day, employeeColorMap)
            : [];
          const hasLeave = people.length > 0;
          const single = people.length === 1 ? people[0] : null;
          const isHalfDayOnly = Boolean(single?.halfDay);
          const publicHoliday = inMonth
            ? publicHolidays.find((h) => isSameDay(new Date(h.date), day))
            : undefined;
          const dayToday = isToday(day);
          const leaveLabel = people
            .map((person) => `${person.name}${person.halfDay ? ' (½)' : ''}`)
            .join(', ');

          const visibleDots = people.slice(0, MAX_VISIBLE_DOTS);
          const overflow = people.length - visibleDots.length;

          let dayStyle: CSSProperties | undefined;
          if (!dayToday && single) {
            dayStyle = isHalfDayOnly
              ? halfDayDiagonalStyle(single.color)
              : { backgroundColor: single.color.soft, color: single.color.text };
          }

          return (
            <div
              key={day.toISOString()}
              title={
                inMonth
                  ? leaveLabel || publicHoliday?.name || undefined
                  : undefined
              }
              className={cn(
                'flex flex-col items-center justify-center rounded-sm text-[10px] sm:text-xs relative overflow-hidden gap-0.5 px-0.5',
                !inMonth && 'text-transparent pointer-events-none',
                inMonth && 'text-foreground',
                dayToday && inMonth && 'bg-primary text-primary-foreground font-semibold',
                publicHoliday && !dayToday && !hasLeave && 'bg-destructive/15 text-destructive font-medium',
              )}
              style={dayStyle}
            >
              {inMonth ? (
                <>
                  <span className="leading-none font-medium">{format(day, 'd')}</span>
                  {people.length > 1 && (
                    <span className="flex items-center justify-center gap-0.5 min-h-[6px]">
                      {visibleDots.map((person) => (
                        <span
                          key={person.id}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: person.color.bg }}
                        />
                      ))}
                      {overflow > 0 && (
                        <span className="text-[8px] font-semibold leading-none text-muted-foreground">
                          +{overflow}
                        </span>
                      )}
                    </span>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearCalendar({
  requests,
  publicHolidays,
  employeeColorMap,
}: YearCalendarProps) {
  const [currentYear, setCurrentYear] = useState(() => getYear(new Date()));

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) =>
        setMonth(setYear(new Date(), currentYear), monthIndex),
      ),
    [currentYear],
  );

  const employeesOnLeave = useMemo(
    () => getEmployeesOnLeaveInYear(requests, currentYear, employeeColorMap),
    [requests, currentYear, employeeColorMap],
  );

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 shadow-card animate-fade-in h-full flex flex-col min-h-0"
      style={{ animationDelay: '300ms' }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Calendrier {currentYear}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => setCurrentYear((year) => year - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCurrentYear(getYear(new Date()))}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => setCurrentYear((year) => year + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 min-h-0 content-stretch">
        {months.map((monthDate) => (
          <MonthBlock
            key={monthDate.toISOString()}
            monthDate={monthDate}
            requests={requests}
            publicHolidays={publicHolidays}
            employeeColorMap={employeeColorMap}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm leave-half-diagonal-swatch border border-border" />
            <span className="text-xs text-muted-foreground">Demi-journée</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-destructive/30" />
            <span className="text-xs text-muted-foreground">Jour férié</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/35" />
            </span>
            <span className="text-xs text-muted-foreground">Plusieurs absents</span>
          </div>
        </div>

        {employeesOnLeave.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Employés en congé ({currentYear})
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 max-h-20 overflow-y-auto pr-1">
              {employeesOnLeave.map((employee) => (
                <div key={employee.id} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: employee.color.bg }}
                  />
                  <span className="text-xs text-foreground truncate max-w-[9rem]">
                    {employee.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aucun congé approuvé sur cette année
          </p>
        )}
      </div>
    </div>
  );
}
