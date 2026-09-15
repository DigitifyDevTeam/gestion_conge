import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LeaveHistoryArchive } from '@/components/history/LeaveHistoryArchive';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listUsers } from '@/api/users';

/**
 * Admin leave archive — all employees' leave history across years.
 * Year renewal only resets balances; requests are never deleted.
 */
export default function LeaveArchivePage() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users', 'employee'],
    queryFn: () => listUsers('employee'),
  });

  const employees = useMemo(
    () => users.map((user) => ({ id: user.id, name: user.name })),
    [users],
  );

  return (
    <LeaveHistoryArchive
      mode="admin"
      requests={requests}
      isLoading={isLoading}
      employees={employees}
    />
  );
}
