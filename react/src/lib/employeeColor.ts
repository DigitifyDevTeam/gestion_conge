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

/** Hex presets for the admin color picker (aligned with the HSL palette). */
export const EMPLOYEE_COLOR_HEX_PRESETS = [
  '#4F6EF7',
  '#1AA37A',
  '#F97316',
  '#A855F7',
  '#E11D48',
  '#149BB8',
  '#D4A017',
  '#DB2777',
  '#2B7BBF',
  '#6B9A2E',
  '#E85D2A',
  '#8B5CF6',
] as const;

export type EmployeeColor = {
  bg: string;
  soft: string;
  text: string;
};

export type EmployeeColorMap = Map<string, string | undefined>;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function hashEmployeeId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX_COLOR_RE.test(hex)) {
    return null;
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / delta + 2) / 6;
        break;
      default:
        h = ((rn - gn) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToEmployeeColor(hex: string): EmployeeColor | null {
  const rgb = hexToRgb(hex.trim());
  if (!rgb) {
    return null;
  }
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const textL = Math.max(22, Math.min(42, l - 12));
  return {
    bg: hex.toUpperCase(),
    soft: `hsl(${h} ${s}% ${l}% / 0.22)`,
    text: `hsl(${h} ${Math.max(40, s - 5)}% ${textL}%)`,
  };
}

export function getEmployeeColor(employeeId: string): EmployeeColor {
  const index = hashEmployeeId(String(employeeId)) % EMPLOYEE_COLOR_PALETTE.length;
  return EMPLOYEE_COLOR_PALETTE[index];
}

export function buildEmployeeColorMap(
  users: Array<{ id: string; calendarColor?: string | null }>,
): EmployeeColorMap {
  return new Map(users.map((user) => [user.id, user.calendarColor || undefined]));
}

export function resolveEmployeeColor(
  employeeId: string,
  colorMap?: EmployeeColorMap,
): EmployeeColor {
  const hex = colorMap?.get(String(employeeId));
  if (hex) {
    const custom = hexToEmployeeColor(hex);
    if (custom) {
      return custom;
    }
  }
  return getEmployeeColor(employeeId);
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
  colorMap?: EmployeeColorMap,
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
        color: resolveEmployeeColor(request.employeeId, colorMap),
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
  colorMap?: EmployeeColorMap,
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
        color: resolveEmployeeColor(request.employeeId, colorMap),
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
