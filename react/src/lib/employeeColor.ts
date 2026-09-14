import type { CSSProperties } from 'react';
import { getYear, isSameDay } from 'date-fns';
import { HolidayRequest } from '@/types/holiday';

/** Distinct, calendar-friendly palette (stable across sessions). */
export const EMPLOYEE_COLOR_PALETTE = [
  { bg: 'hsl(234 89% 58%)', soft: 'hsl(234 89% 58% / 0.22)', text: 'hsl(234 89% 42%)' },
  { bg: 'hsl(162 72% 36%)', soft: 'hsl(162 72% 36% / 0.22)', text: 'hsl(162 72% 28%)' },
  { bg: 'hsl(24 95% 50%)', soft: 'hsl(24 95% 50% / 0.22)', text: 'hsl(24 90% 38%)' },
  { bg: 'hsl(280 65% 52%)', soft: 'hsl(280 65% 52% / 0.22)', text: 'hsl(280 60% 40%)' },
  { bg: 'hsl(350 75% 52%)', soft: 'hsl(350 75% 52% / 0.22)', text: 'hsl(350 70% 40%)' },
  { bg: 'hsl(190 80% 40%)', soft: 'hsl(190 80% 40% / 0.22)', text: 'hsl(190 80% 30%)' },
  { bg: 'hsl(45 93% 42%)', soft: 'hsl(45 93% 42% / 0.25)', text: 'hsl(45 90% 30%)' },
  { bg: 'hsl(330 70% 50%)', soft: 'hsl(330 70% 50% / 0.22)', text: 'hsl(330 65% 38%)' },
  { bg: 'hsl(210 70% 45%)', soft: 'hsl(210 70% 45% / 0.22)', text: 'hsl(210 70% 32%)' },
  { bg: 'hsl(85 55% 40%)', soft: 'hsl(85 55% 40% / 0.22)', text: 'hsl(85 55% 28%)' },
  { bg: 'hsl(15 80% 50%)', soft: 'hsl(15 80% 50% / 0.22)', text: 'hsl(15 75% 38%)' },
  { bg: 'hsl(255 60% 55%)', soft: 'hsl(255 60% 55% / 0.22)', text: 'hsl(255 55% 42%)' },
] as const;

export type EmployeeColor = (typeof EMPLOYEE_COLOR_PALETTE)[number];

function hashEmployeeId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getEmployeeColor(employeeId: string): EmployeeColor {
  const index = hashEmployeeId(String(employeeId)) % EMPLOYEE_COLOR_PALETTE.length;
  return EMPLOYEE_COLOR_PALETTE[index];
}

export interface CalendarEmployee {
  id: string;
  name: string;
  color: EmployeeColor;
}

/** Unique employees with approved leave overlapping the given year. */
export function getEmployeesOnLeaveInYear(
  requests: HolidayRequest[],
  year: number,
): CalendarEmployee[] {
  const byId = new Map<string, CalendarEmployee>();

  for (const request of requests) {
    if (request.status !== 'approved' || !request.employeeId) {
      continue;
    }
    const hasDayInYear = request.dates.some(
      (entry) => getYear(new Date(entry.date)) === year,
    );
    if (!hasDayInYear) {
      continue;
    }
    if (!byId.has(request.employeeId)) {
      byId.set(request.employeeId, {
        id: request.employeeId,
        name: request.employeeName || 'Employé',
        color: getEmployeeColor(request.employeeId),
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

export interface DayLeavePerson {
  id: string;
  name: string;
  color: EmployeeColor;
  halfDay: boolean;
}

/** People on approved leave for a specific day (deduped by employee). */
export function getPeopleOnLeaveForDay(
  requests: HolidayRequest[],
  day: Date,
): DayLeavePerson[] {
  const byId = new Map<string, DayLeavePerson>();

  for (const request of requests) {
    if (request.status !== 'approved' || !request.employeeId) {
      continue;
    }
    const entry = request.dates.find((d) => isSameDay(new Date(d.date), day));
    if (!entry) {
      continue;
    }
    const existing = byId.get(request.employeeId);
    const halfDay = Boolean(entry.halfDayPeriod);
    if (!existing) {
      byId.set(request.employeeId, {
        id: request.employeeId,
        name: request.employeeName || 'Employé',
        color: getEmployeeColor(request.employeeId),
        halfDay,
      });
      continue;
    }
    // If any request for that person that day is full, treat as full.
    if (existing.halfDay && !halfDay) {
      existing.halfDay = false;
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

export function halfDayDiagonalStyle(color: EmployeeColor): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color.soft} 0%, ${color.soft} 50%, transparent 50%)`,
    color: color.text,
  };
}
