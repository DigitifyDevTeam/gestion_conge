export type HolidayType = 'annual' | 'sick' | 'personal' | 'unpaid';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type HalfDayPeriod = 'half';

export type LeaveReasonChoice =
  | 'illness'
  | 'vacation'
  | 'family'
  | 'travel'
  | 'personal_event'
  | 'other';

export interface HolidayBalance {
  type: HolidayType;
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveDay {
  date: Date;
  halfDayPeriod?: HalfDayPeriod | null;
}

export interface HolidayRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  type: HolidayType;
  startDate: Date;
  endDate: Date;
  /** Every day covered by the request; may be non-consecutive. */
  dates: LeaveDay[];
  days: number;
  halfDayPeriod?: HalfDayPeriod | null;
  status: RequestStatus;
  reason?: string;
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  isOnHoliday: boolean;
  leaveStart?: Date;
  leaveEnd?: Date;
}

export interface PublicHoliday {
  date: Date;
  name: string;
  isReligious?: boolean;
}
