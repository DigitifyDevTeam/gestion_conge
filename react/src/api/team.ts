import { TeamMember } from '@/types/holiday';
import { apiFetch, parseDate } from './client';

interface ApiTeamMember {
  id: number;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  is_on_holiday: boolean;
  leave_start?: string | null;
  leave_end?: string | null;
  leave_days?: number | string | null;
}

export function mapTeamMember(m: ApiTeamMember): TeamMember {
  return {
    id: String(m.id),
    name: m.name,
    role: m.role,
    department: m.department,
    avatar: m.avatar || undefined,
    isOnHoliday: m.is_on_holiday,
    leaveStart: m.leave_start ? parseDate(m.leave_start) : undefined,
    leaveEnd: m.leave_end ? parseDate(m.leave_end) : undefined,
    leaveDays:
      m.leave_days === null || m.leave_days === undefined
        ? undefined
        : Number(m.leave_days),
  };
}

export async function listTeam(): Promise<TeamMember[]> {
  const data = await apiFetch<ApiTeamMember[]>('/team/');
  return data.map(mapTeamMember);
}
