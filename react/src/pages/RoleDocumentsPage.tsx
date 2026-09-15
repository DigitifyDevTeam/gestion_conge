import { useAuth } from '@/contexts/AuthContext';
import MyDocumentsPage from './MyDocumentsPage';
import DocumentManagementPage from './admin/DocumentManagementPage';

export default function RoleDocumentsPage() {
  const { isAdmin } = useAuth();
  return isAdmin() ? <DocumentManagementPage /> : <MyDocumentsPage />;
}
