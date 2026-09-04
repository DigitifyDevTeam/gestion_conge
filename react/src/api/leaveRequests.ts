import { eachDayOfInterval } from 'date-fns';
import { HalfDayPeriod, HolidayRequest, HolidayType, LeaveDay, RequestStatus } from '@/types/holiday';
import { apiFetch, parseDate, toDateString } from './client';

interface ApiLeaveDay {
  date: string;
  half_day_period?: HalfDayPeriod | null;
}

interface ApiLeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_avatar?: string;
  type: HolidayType;
  dates?: Array<ApiLeaveDay | string>;
  start_date: string;
  end_date: string;
  days: number | string;
  half_day_period?: HalfDayPeriod | null;
  status: RequestStatus;
  reason?: string;
  emergency?: boolean;
  employee_balance?: {
    total: number | string;
    used: number | string;
    pending: number | string;
    remaining: number | string;
  } | null;
  created_at: string;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_comment?: string;
}

function normalizeHalfDayPeriod(value?: string | null): HalfDayPeriod | null {
  if (!value) {
    return null;
  }
  if (value === 'half' || value === 'morning' || value === 'afternoon') {
    return 'half';
  }
  return null;
}

function mapLeaveDay(value: ApiLeaveDay | string, fallbackPeriod?: HalfDayPeriod | null): LeaveDay {
  if (typeof value === 'string') {
    return {
      date: parseDate(value)!,
      halfDayPeriod: fallbackPeriod || null,
    };
  }
  return {
    date: parseDate(value.date)!,
    halfDayPeriod: normalizeHalfDayPeriod(value.half_day_period) || fallbackPeriod || null,
  };
}

function resolveDates(r: ApiLeaveRequest, start: Date, end: Date): LeaveDay[] {
  const fallback =
    r.half_day_period && Number(r.days) === 0.5
      ? normalizeHalfDayPeriod(r.half_day_period)
      : null;
  if (r.dates?.length) {
    return r.dates.map((value) => mapLeaveDay(value, fallback));
  }
  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    halfDayPeriod: fallback,
  }));
}

export function mapLeaveRequest(r: ApiLeaveRequest): HolidayRequest {
  const startDate = parseDate(r.start_date)!;
  const endDate = parseDate(r.end_date)!;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    employeeName: r.employee_name,
    employeeAvatar: r.employee_avatar || undefined,
    type: r.type,
    startDate,
    endDate,
    dates: resolveDates(r, startDate, endDate),
    days: Number(r.days),
    halfDayPeriod: normalizeHalfDayPeriod(r.half_day_period) || undefined,
    status: r.status,
    reason: r.reason || undefined,
    emergency: Boolean(r.emergency),
    employeeBalance: r.employee_balance
      ? {
          type: r.type,
          total: Number(r.employee_balance.total),
          used: Number(r.employee_balance.used),
          pending: Number(r.employee_balance.pending),
          remaining: Number(r.employee_balance.remaining),
        }
      : undefined,
    createdAt: new Date(r.created_at),
    reviewedBy: r.reviewed_by_name || undefined,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : undefined,
    reviewComment: r.review_comment || undefined,
  };
}

export async function listLeaveRequests(status?: RequestStatus): Promise<HolidayRequest[]> {
  const qs = status ? `?status=${status}` : '';
  const data = await apiFetch<ApiLeaveRequest[]>(`/leave-requests/${qs}`);
  return data.map(mapLeaveRequest);
}

export interface LeaveRequestPayload {
  type: HolidayType;
  dates: LeaveDay[];
  reason: string;
  emergency?: boolean;
  /** Admin-only: create leave on behalf of this employee */
  employeeId?: string;
}

function serializePayload(payload: LeaveRequestPayload) {
  return JSON.stringify({
    type: payload.type,
    dates: payload.dates.map((day) => ({
      date: toDateString(day.date),
      half_day_period: day.halfDayPeriod || null,
    })),
    reason: payload.reason.trim(),
    emergency: Boolean(payload.emergency),
    ...(payload.employeeId ? { employee_id: Number(payload.employeeId) } : {}),
  });
}

export async function createLeaveRequest(
  payload: LeaveRequestPayload,
): Promise<HolidayRequest> {
  const data = await apiFetch<ApiLeaveRequest>('/leave-requests/', {
    method: 'POST',
    body: serializePayload(payload),
  });
  return mapLeaveRequest(data);
}

export async function updateLeaveRequest(
  id: string,
  payload: LeaveRequestPayload,
): Promise<HolidayRequest> {
  const data = await apiFetch<ApiLeaveRequest>(`/leave-requests/${id}/`, {
    method: 'PATCH',
    body: serializePayload(payload),
  });
  return mapLeaveRequest(data);
}

export async function approveLeaveRequest(
  id: string,
  reviewComment = '',
): Promise<HolidayRequest> {
  const data = await apiFetch<ApiLeaveRequest>(`/leave-requests/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ review_comment: reviewComment }),
  });
  return mapLeaveRequest(data);
}

export async function rejectLeaveRequest(
  id: string,
  reviewComment = '',
): Promise<HolidayRequest> {
  const data = await apiFetch<ApiLeaveRequest>(`/leave-requests/${id}/reject/`, {
    method: 'POST',
    body: JSON.stringify({ review_comment: reviewComment }),
  });
  return mapLeaveRequest(data);
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await apiFetch<void>(`/leave-requests/${id}/`, { method: 'DELETE' });
}
