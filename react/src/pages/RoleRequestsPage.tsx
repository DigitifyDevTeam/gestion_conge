import { useAuth } from '@/contexts/AuthContext';
import AllRequestsPage from '@/pages/admin/AllRequestsPage';
import RequestsPage from '@/pages/RequestsPage';

export default function RoleRequestsPage() {
  const { isAdmin } = useAuth();
  return isAdmin() ? <AllRequestsPage /> : <RequestsPage />;
}
