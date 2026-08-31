import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { HalfDayPeriod, LeaveDay, LeaveReasonChoice } from '@/types/holiday';

export const MIN_LEAVE_NOTICE_DAYS = 5;

export function earliestLeaveDate(today: Date, emergency: boolean): Date {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return emergency ? start : addDays(start, MIN_LEAVE_NOTICE_DAYS);
}

export const LEAVE_REASON_OPTIONS: { value: LeaveReasonChoice; label: string }[] = [
  { value: 'illness', label: 'Maladie' },
  { value: 'vacation', label: 'Vacances' },
  { value: 'family', label: 'Raisons familiales' },
  { value: 'travel', label: 'Voyage' },
  { value: 'personal_event', label: 'Événement personnel' },
  { value: 'other', label: 'Autre' },
];

export function isLeaveReasonChoice(value: string): value is LeaveReasonChoice {
  return LEAVE_REASON_OPTIONS.some((option) => option.value === value);
}

export function composeLeaveReason(
  choice: LeaveReasonChoice,
  otherDetail = '',
): string {
  switch (choice) {
    case 'illness':
      return 'Maladie';
    case 'vacation':
      return 'Vacances';
    case 'family':
      return 'Raisons familiales';
    case 'travel':
      return 'Voyage';
    case 'personal_event':
      return 'Événement personnel';
    case 'other':
      return `Autre : ${otherDetail.trim()}`;
    default: {
      const exhaustive: never = choice;
      return exhaustive;
    }
  }
}

export function parseLeaveReason(reason: string): {
  choice: LeaveReasonChoice | '';
  otherDetail: string;
} {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { choice: '', otherDetail: '' };
  }

  for (const option of LEAVE_REASON_OPTIONS) {
    if (option.value === 'other') {
      continue;
    }
    if (composeLeaveReason(option.value) === trimmed) {
      return { choice: option.value, otherDetail: '' };
    }
  }

  const prefix = 'Autre :';
  if (trimmed.startsWith(prefix)) {
    return { choice: 'other', otherDetail: trimmed.slice(prefix.length).trim() };
  }
  if (trimmed === 'Autre') {
    return { choice: 'other', otherDetail: '' };
  }
  return { choice: 'other', otherDetail: trimmed };
}
export function formatLeaveDaysNumber(value: number): string {
  const n = Number(value);
  if (Number.isInteger(n)) {
    return String(n);
  }
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function halfDayPeriodLabel(period: HalfDayPeriod): string {
  switch (period) {
    case 'half':
      return 'demi-journée';
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

export function formatLeaveDateRange(start: Date, end: Date): string {
  const startLabel = format(start, 'd MMM', { locale: fr });
  if (isSameDay(start, end)) {
    return startLabel;
  }
  return `${startLabel} - ${format(end, 'd MMM', { locale: fr })}`;
}

export function sortLeaveDays(days: LeaveDay[]): LeaveDay[] {
  return [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function leaveDayValue(day: LeaveDay): number {
  return day.halfDayPeriod ? 0.5 : 1;
}

export function sumLeaveDayValues(days: LeaveDay[]): number {
  return days.reduce((total, day) => total + leaveDayValue(day), 0);
}

function formatHalfDayLabel(day: LeaveDay): string {
  const dateLabel = format(day.date, 'd MMM', { locale: fr });
  if (!day.halfDayPeriod) {
    return dateLabel;
  }
  return `${dateLabel} (${halfDayPeriodLabel(day.halfDayPeriod)})`;
}

/** Renders possibly non-consecutive days, collapsing consecutive full days into ranges. */
export function formatLeaveDates(days: LeaveDay[], withYear = false): string {
  if (days.length === 0) {
    return '';
  }
  const sorted = sortLeaveDays(days);
  const parts: string[] = [];
  let runStart: Date | null = null;
  let runEnd: Date | null = null;

  const flushRun = () => {
    if (runStart && runEnd) {
      parts.push(formatLeaveDateRange(runStart, runEnd));
    }
    runStart = null;
    runEnd = null;
  };

  for (const day of sorted) {
    if (day.halfDayPeriod) {
      flushRun();
      parts.push(formatHalfDayLabel(day));
      continue;
    }
    if (runEnd && differenceInCalendarDays(day.date, runEnd) === 1) {
      runEnd = day.date;
      continue;
    }
    flushRun();
    runStart = day.date;
    runEnd = day.date;
  }
  flushRun();

  const text = parts.join(' · ');
  if (!withYear) {
    return text;
  }
  const lastYear = new Date(
    Math.max(...sorted.map((day) => day.date.getTime())),
  ).getFullYear();
  return `${text} ${lastYear}`;
}

export function formatLeaveDuration(
  days: number,
  period?: HalfDayPeriod | null,
): string {
  const n = Number(days);
  const count = formatLeaveDaysNumber(n);
  const unit = n > 1 ? 'jours' : 'jour';
  if (period && n === 0.5) {
    return `${count} ${unit} (${halfDayPeriodLabel(period)})`;
  }
  return `${count} ${unit}`;
}

export function formatLeaveDurationCompact(
  days: number,
  period?: HalfDayPeriod | null,
): string {
  const n = Number(days);
  const count = formatLeaveDaysNumber(n);
  if (period && n === 0.5) {
    return `${count}j · ${halfDayPeriodLabel(period)}`;
  }
  return `${count}j`;
}

export function toDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekendDate(value: Date): boolean {
  const day = value.getDay();
  return day === 0 || day === 6;
}

export function holidayDateKeys(holidays: { date: Date }[]): Set<string> {
  return new Set(holidays.map((holiday) => toDateKey(holiday.date)));
}

export function isWorkingDay(value: Date, holidayKeys: Set<string>): boolean {
  return !isWeekendDate(value) && !holidayKeys.has(toDateKey(value));
}

export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  holidayKeys: Set<string>,
): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (end < start) {
    return 0;
  }
  return eachDayOfInterval({ start, end }).filter((day) => isWorkingDay(day, holidayKeys)).length;
}
