import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import Dashboard from '@/pages/Dashboard';

export default function HomeDashboard() {
  const { isAdmin } = useAuth();
  return isAdmin() ? <AdminDashboard /> : <Dashboard />;
}
