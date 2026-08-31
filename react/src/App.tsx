import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell, AdminOnly } from "@/components/auth/AppShell";
import ActivateAccountPage from "./pages/ActivateAccountPage";
import HomeDashboard from "./pages/HomeDashboard";
import CalendarPage from "./pages/CalendarPage";
import RoleRequestsPage from "./pages/RoleRequestsPage";
import HistoryPage from "./pages/HistoryPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import PublicHolidaysPage from "./pages/PublicHolidaysPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import BalanceManagementPage from "./pages/admin/BalanceManagementPage";
import ReportsPage from "./pages/admin/ReportsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function IndexHtmlRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search }} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="gestion-conges-theme">
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/activate" element={<ActivateAccountPage />} />
            <Route path="/index.html" element={<IndexHtmlRedirect />} />

            {/* Legacy URLs */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/users" element={<Navigate to="/users" replace />} />
            <Route path="/admin/requests" element={<Navigate to="/requests" replace />} />
            <Route path="/admin/balances" element={<Navigate to="/balances" replace />} />
            <Route path="/admin/reports" element={<Navigate to="/reports" replace />} />

            <Route element={<AppShell />}>
              <Route path="/" element={<HomeDashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/requests" element={<RoleRequestsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/approvals" element={<Navigate to="/requests" replace />} />
              <Route path="/public-holidays" element={<PublicHolidaysPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route
                path="/users"
                element={(
                  <AdminOnly>
                    <UserManagementPage />
                  </AdminOnly>
                )}
              />
              <Route
                path="/balances"
                element={(
                  <AdminOnly>
                    <BalanceManagementPage />
                  </AdminOnly>
                )}
              />
              <Route
                path="/reports"
                element={(
                  <AdminOnly>
                    <ReportsPage />
                  </AdminOnly>
                )}
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
