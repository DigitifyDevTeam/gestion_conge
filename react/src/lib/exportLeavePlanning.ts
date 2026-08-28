import {
  eachDayOfInterval,
  endOfYear,
  getDate,
  getDay,
  getMonth,
  startOfYear,
} from 'date-fns';
import { HolidayRequest, PublicHoliday } from '@/types/holiday';
import { User } from '@/types/auth';
import {
  holidayDateKeys,
  isWeekendDate,
  isWorkingDay,
  toDateKey,
} from '@/lib/leave';

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

const COLORS = {
  month: '1F4E79',
  monthFont: 'FFFFFF',
  weekend: 'D9D9D9',
  publicHoliday: '2F75B5',
  pending: 'F4B084',
  approved: '92D050',
  border: 'B7B7B7',
  legendBorder: '666666',
} as const;

type LeaveMarkStatus = 'pending' | 'approved';

interface LeaveMark {
  status: LeaveMarkStatus;
  halfDay: boolean;
}

export interface LeavePlanningExportInput {
  year: number;
  users: User[];
  requests: HolidayRequest[];
  publicHolidays: PublicHoliday[];
}

function argb(hex: string): string {
  return `FF${hex}`;
}

function dateKey(value: Date): string {
  return toDateKey(value);
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function thinBorder() {
  const edge = { style: 'thin' as const, color: { argb: argb(COLORS.border) } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function solidFill(hex: string) {
  return {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: argb(hex) },
  };
}

function mergeLeaveMark(existing: LeaveMark | undefined, next: LeaveMark): LeaveMark {
  if (!existing) {
    return next;
  }
  if (existing.status === 'approved' && next.status !== 'approved') {
    return existing;
  }
  if (next.status === 'approved' && existing.status !== 'approved') {
    return next;
  }
  return {
    status: next.status,
    halfDay: existing.halfDay && next.halfDay,
  };
}

function collectRequestDays(
  request: HolidayRequest,
  yearStart: Date,
  yearEnd: Date,
  holidayKeys: Set<string>,
): Array<{ date: Date; halfDay: boolean }> {
  return request.dates
    .map((entry) => ({
      date: startOfLocalDay(entry.date),
      halfDay: Boolean(entry.halfDayPeriod),
    }))
    .filter(
      (entry) =>
        entry.date >= yearStart &&
        entry.date <= yearEnd &&
        isWorkingDay(entry.date, holidayKeys),
    );
}

function buildOccupancy(
  requests: HolidayRequest[],
  yearStart: Date,
  yearEnd: Date,
  holidayKeys: Set<string>,
): Map<string, Map<string, LeaveMark>> {
  const occupancy = new Map<string, Map<string, LeaveMark>>();

  for (const request of requests) {
    if (request.status !== 'approved' && request.status !== 'pending') {
      continue;
    }

    const days = collectRequestDays(request, yearStart, yearEnd, holidayKeys);
    if (days.length === 0) {
      continue;
    }

    let employeeDays = occupancy.get(request.employeeId);
    if (!employeeDays) {
      employeeDays = new Map<string, LeaveMark>();
      occupancy.set(request.employeeId, employeeDays);
    }

    const markBase = {
      status: request.status,
    } as const;
    for (const day of days) {
      const key = dateKey(day.date);
      employeeDays.set(
        key,
        mergeLeaveMark(employeeDays.get(key), {
          ...markBase,
          halfDay: day.halfDay,
        }),
      );
    }
  }

  return occupancy;
}

function triggerXlsxDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadLeavePlanningExcel({
  year,
  users,
  requests,
  publicHolidays,
}: LeavePlanningExportInput): Promise<void> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HolidayHub';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Planning ${year}`, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 3, showGridLines: true }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
    },
  });

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const days = eachDayOfInterval({ start: yearStart, end: yearEnd });
  const holidayKeys = holidayDateKeys(
    publicHolidays
      .map((holiday) => ({ date: startOfLocalDay(holiday.date) }))
      .filter((holiday) => holiday.date.getFullYear() === year),
  );
  const occupancy = buildOccupancy(requests, yearStart, yearEnd, holidayKeys);
  const people = [...users].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const nameCol = 1;
  const firstDayCol = 2;
  const lastDayCol = firstDayCol + days.length - 1;

  sheet.getColumn(nameCol).width = 26;
  for (let col = firstDayCol; col <= lastDayCol; col += 1) {
    sheet.getColumn(col).width = 3.2;
  }

  sheet.mergeCells(1, nameCol, 3, nameCol);
  const nameHeader = sheet.getCell(1, nameCol);
  nameHeader.value = 'Nom';
  nameHeader.font = { bold: true, color: { argb: argb(COLORS.monthFont) }, size: 11 };
  nameHeader.fill = solidFill(COLORS.month);
  nameHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  nameHeader.border = thinBorder();

  let monthStartCol = firstDayCol;
  for (let i = 0; i < days.length; i += 1) {
    const isLastDay = i === days.length - 1;
    const monthChanged = !isLastDay && getMonth(days[i]) !== getMonth(days[i + 1]);
    if (!isLastDay && !monthChanged) {
      continue;
    }
    const monthEndCol = firstDayCol + i;
    if (monthEndCol > monthStartCol) {
      sheet.mergeCells(1, monthStartCol, 1, monthEndCol);
    }
    const monthCell = sheet.getCell(1, monthStartCol);
    monthCell.value = MONTH_NAMES[getMonth(days[monthStartCol - firstDayCol])];
    monthCell.font = { bold: true, color: { argb: argb(COLORS.monthFont) }, size: 10 };
    monthCell.fill = solidFill(COLORS.month);
    monthCell.alignment = { vertical: 'middle', horizontal: 'center' };
    for (let col = monthStartCol; col <= monthEndCol; col += 1) {
      sheet.getCell(1, col).fill = solidFill(COLORS.month);
      sheet.getCell(1, col).border = thinBorder();
      sheet.getCell(1, col).font = {
        bold: true,
        color: { argb: argb(COLORS.monthFont) },
        size: 10,
      };
    }
    monthStartCol = monthEndCol + 1;
  }

  sheet.getRow(1).height = 20;
  sheet.getRow(2).height = 16;
  sheet.getRow(3).height = 16;

  days.forEach((day, index) => {
    const col = firstDayCol + index;
    const weekend = isWeekendDate(day);
    const holiday = holidayKeys.has(dateKey(day));
    let headerFill: string | undefined;
    if (holiday) {
      headerFill = COLORS.publicHoliday;
    } else if (weekend) {
      headerFill = COLORS.weekend;
    }

    const dayCell = sheet.getCell(2, col);
    dayCell.value = getDate(day);
    dayCell.font = {
      size: 8,
      bold: holiday,
      color: holiday ? { argb: argb(COLORS.monthFont) } : undefined,
    };
    dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dayCell.border = thinBorder();
    if (headerFill) {
      dayCell.fill = solidFill(headerFill);
    }

    const weekdayCell = sheet.getCell(3, col);
    weekdayCell.value = WEEKDAY_LETTERS[getDay(day)];
    weekdayCell.font = {
      size: 8,
      bold: holiday,
      color: holiday ? { argb: argb(COLORS.monthFont) } : undefined,
    };
    weekdayCell.alignment = { vertical: 'middle', horizontal: 'center' };
    weekdayCell.border = thinBorder();
    if (headerFill) {
      weekdayCell.fill = solidFill(headerFill);
    }
  });

  people.forEach((person, personIndex) => {
    const rowNumber = 4 + personIndex;
    const row = sheet.getRow(rowNumber);
    row.height = 18;

    const nameCell = row.getCell(nameCol);
    nameCell.value = person.name;
    nameCell.font = { size: 10 };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    nameCell.border = thinBorder();

    const employeeDays = occupancy.get(person.id);

    days.forEach((day, index) => {
      const col = firstDayCol + index;
      const cell = row.getCell(col);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder();
      cell.font = { size: 7, bold: true };

      const key = dateKey(day);
      const mark = employeeDays?.get(key);
      const holiday = holidayKeys.has(key);
      const weekend = isWeekendDate(day);

      if (holiday) {
        cell.fill = solidFill(COLORS.publicHoliday);
        cell.font = { size: 7, bold: true, color: { argb: argb(COLORS.monthFont) } };
        return;
      }
      if (weekend) {
        cell.fill = solidFill(COLORS.weekend);
        return;
      }
      if (mark) {
        cell.fill = solidFill(mark.status === 'approved' ? COLORS.approved : COLORS.pending);
        if (mark.halfDay) {
          cell.value = '0,5J';
        }
      }
    });
  });

  const legendStart = 4 + people.length + 2;
  const legend = [
    { label: 'Jour férié', color: COLORS.publicHoliday, font: COLORS.monthFont },
    { label: 'Demande de congé', color: COLORS.pending, font: '000000' },
    { label: 'Congé validé', color: COLORS.approved, font: '000000' },
  ] as const;

  legend.forEach((item, index) => {
    const rowNumber = legendStart + index;
    const swatch = sheet.getCell(rowNumber, nameCol);
    swatch.value = item.label;
    swatch.fill = solidFill(item.color);
    swatch.font = { size: 10, bold: true, color: { argb: argb(item.font) } };
    swatch.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    swatch.border = {
      top: { style: 'thin', color: { argb: argb(COLORS.legendBorder) } },
      left: { style: 'thin', color: { argb: argb(COLORS.legendBorder) } },
      bottom: { style: 'thin', color: { argb: argb(COLORS.legendBorder) } },
      right: { style: 'thin', color: { argb: argb(COLORS.legendBorder) } },
    };
    sheet.getRow(rowNumber).height = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerXlsxDownload(
    buffer as ArrayBuffer,
    `Planning de congés ${year}.xlsx`,
  );
}
