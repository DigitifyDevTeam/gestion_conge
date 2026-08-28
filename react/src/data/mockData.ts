import { eachDayOfInterval } from 'date-fns';
import { HolidayBalance, HolidayRequest, TeamMember, PublicHoliday } from '@/types/holiday';

type MockRequest = Omit<HolidayRequest, 'dates'>;

function withDates(request: MockRequest): HolidayRequest {
  return {
    ...request,
    dates: eachDayOfInterval({ start: request.startDate, end: request.endDate }).map((date) => ({
      date,
      halfDayPeriod: null,
    })),
  };
}

export const holidayBalances: HolidayBalance[] = [
  { type: 'annual', total: 18, used: 8, pending: 3, remaining: 7 },
  { type: 'sick', total: 10, used: 2, pending: 0, remaining: 8 },
  { type: 'personal', total: 5, used: 1, pending: 0, remaining: 4 },
  { type: 'unpaid', total: 0, used: 0, pending: 0, remaining: 0 },
];

const recentRequestsData: MockRequest[] = [
  {
    id: '1',
    employeeId: 'emp1',
    employeeName: 'Sarah Johnson',
    type: 'annual',
    startDate: new Date(2025, 0, 6),
    endDate: new Date(2025, 0, 10),
    days: 5,
    status: 'approved',
    reason: 'Family vacation',
    createdAt: new Date(2024, 11, 20),
    reviewedBy: 'John Manager',
    reviewedAt: new Date(2024, 11, 21),
  },
  {
    id: '2',
    employeeId: 'emp1',
    employeeName: 'Sarah Johnson',
    type: 'personal',
    startDate: new Date(2025, 1, 14),
    endDate: new Date(2025, 1, 14),
    days: 1,
    status: 'pending',
    reason: 'Personal appointment',
    createdAt: new Date(2024, 11, 23),
  },
  {
    id: '3',
    employeeId: 'emp1',
    employeeName: 'Sarah Johnson',
    type: 'annual',
    startDate: new Date(2025, 2, 24),
    endDate: new Date(2025, 2, 28),
    days: 5,
    status: 'pending',
    reason: 'Spring break trip',
    createdAt: new Date(2024, 11, 24),
  },
];

export const recentRequests: HolidayRequest[] = recentRequestsData.map(withDates);

export const teamMembers: TeamMember[] = [
  {
    id: 'tm1',
    name: 'Alex Chen',
    role: 'Senior Developer',
    department: 'Engineering',
    isOnHoliday: false,
    leaveStart: new Date(2025, 0, 15),
    leaveEnd: new Date(2025, 0, 20),
  },
  {
    id: 'tm2',
    name: 'Maria Garcia',
    role: 'Product Designer',
    department: 'Design',
    isOnHoliday: true,
    leaveStart: new Date(2025, 0, 10),
    leaveEnd: new Date(2025, 0, 18),
  },
  {
    id: 'tm3',
    name: 'James Wilson',
    role: 'QA Engineer',
    department: 'Engineering',
    isOnHoliday: false,
    leaveStart: new Date(2025, 1, 3),
    leaveEnd: new Date(2025, 1, 7),
  },
  {
    id: 'tm4',
    name: 'Emily Brown',
    role: 'Frontend Developer',
    department: 'Engineering',
    isOnHoliday: false,
  },
  {
    id: 'tm5',
    name: 'Michael Lee',
    role: 'Backend Developer',
    department: 'Engineering',
    isOnHoliday: false,
    leaveStart: new Date(2025, 0, 20),
    leaveEnd: new Date(2025, 0, 24),
  },
];

const pendingApprovalsData: MockRequest[] = [
  {
    id: 'pa1',
    employeeId: 'tm1',
    employeeName: 'Alex Chen',
    type: 'annual',
    startDate: new Date(2025, 0, 15),
    endDate: new Date(2025, 0, 17),
    days: 3,
    status: 'pending',
    reason: 'Long weekend trip',
    createdAt: new Date(2024, 11, 22),
  },
  {
    id: 'pa2',
    employeeId: 'tm3',
    employeeName: 'James Wilson',
    type: 'sick',
    startDate: new Date(2025, 0, 8),
    endDate: new Date(2025, 0, 8),
    days: 1,
    status: 'pending',
    reason: 'Medical appointment',
    createdAt: new Date(2024, 11, 24),
  },
];

export const pendingApprovals: HolidayRequest[] = pendingApprovalsData.map(withDates);

export const publicHolidays: PublicHoliday[] = [
  { date: new Date(2025, 0, 1), name: "New Year's Day" },
  { date: new Date(2025, 0, 20), name: 'Martin Luther King Jr. Day' },
  { date: new Date(2025, 1, 17), name: "Presidents' Day" },
  { date: new Date(2025, 4, 26), name: 'Memorial Day' },
  { date: new Date(2025, 6, 4), name: 'Independence Day' },
  { date: new Date(2025, 8, 1), name: 'Labor Day' },
  { date: new Date(2025, 10, 27), name: 'Thanksgiving Day' },
  { date: new Date(2025, 11, 25), name: 'Christmas Day' },
];

// Jours fériés officiels tunisiens (triés par date)
export const tunisianPublicHolidays: PublicHoliday[] = [
  { date: new Date(2025, 0, 1), name: 'Jour de l\'An', isReligious: false },
  { date: new Date(2025, 0, 14), name: 'Fête de la Révolution et de la Jeunesse', isReligious: false },
  { date: new Date(2025, 2, 20), name: 'Fête de l\'Indépendance', isReligious: false },
  { date: new Date(2025, 2, 30), name: 'Aïd el-Fitr', isReligious: true },
  { date: new Date(2025, 3, 9), name: 'Fête des Martyrs', isReligious: false },
  { date: new Date(2025, 4, 1), name: 'Fête du Travail', isReligious: false },
  { date: new Date(2025, 5, 6), name: 'Aïd el-Adha', isReligious: true },
  { date: new Date(2025, 6, 19), name: 'Jour de l\'An de l\'Hégire', isReligious: true },
  { date: new Date(2025, 6, 25), name: 'Fête de la République', isReligious: false },
  { date: new Date(2025, 7, 13), name: 'Fête de la Femme et de la Famille', isReligious: false },
  { date: new Date(2025, 8, 15), name: 'Mouled (Anniversaire du Prophète)', isReligious: true },
  { date: new Date(2025, 9, 15), name: 'Fête de l\'Évacuation', isReligious: false },
  { date: new Date(2025, 11, 17), name: 'Jour de la Révolution', isReligious: false },
];