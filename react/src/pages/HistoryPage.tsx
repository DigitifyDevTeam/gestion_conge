import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LeaveHistoryArchive } from '@/components/history/LeaveHistoryArchive';
import { listLeaveRequests } from '@/api/leaveRequests';
import { useAuth } from '@/contexts/AuthContext';

/** Employee personal leave history — kept across years, with year filter. */
export default function HistoryPage() {
  const { isAdmin } = useAuth();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: !isAdmin(),
  });

  if (isAdmin()) {
    return <Navigate to="/archive" replace />;
  }

  return (
    <LeaveHistoryArchive
      mode="employee"
      requests={requests}
      isLoading={isLoading}
    />
  );
}
