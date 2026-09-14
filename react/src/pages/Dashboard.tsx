import { useQuery } from '@tanstack/react-query';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { NextPublicHolidayCard } from '@/components/dashboard/NextPublicHolidayCard';
import { UpcomingLeaveCard } from '@/components/dashboard/UpcomingLeaveCard';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TeamAvailability } from '@/components/dashboard/TeamAvailability';
import { useAuth } from '@/contexts/AuthContext';
import { listMyBalances } from '@/api/leaveBalances';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listPublicHolidays } from '@/api/publicHolidays';
import { listTeam } from '@/api/team';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();

  const { data: holidayBalances = [] } = useQuery({
    queryKey: ['leave-balances', 'me'],
    queryFn: listMyBalances,
    enabled: !isAdmin(),
  });
  const { data: recentRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: !isAdmin(),
  });
  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
    enabled: !isAdmin(),
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: listTeam,
    enabled: !isAdmin(),
  });

  if (isAdmin()) {
    return null;
  }

  const annualBalance = holidayBalances.find((balance) => balance.type === 'annual');
  const unpaidBalance = holidayBalances.find((balance) => balance.type === 'unpaid');

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Bon retour, {user?.name || 'Utilisateur'}</h1>
        <p className="text-muted-foreground mt-1">Voici un aperçu de votre solde de congés</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {annualBalance && <BalanceCard key={annualBalance.type} balance={annualBalance} index={0} />}
        <NextPublicHolidayCard publicHolidays={publicHolidays} index={1} />
        <UpcomingLeaveCard requests={recentRequests} index={2} />
        {unpaidBalance && <BalanceCard key={unpaidBalance.type} balance={unpaidBalance} index={3} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-[auto_auto] gap-6">
        <div className="lg:col-span-2 lg:row-span-2 min-h-[280px] h-full">
          <MiniCalendar requests={recentRequests} publicHolidays={publicHolidays} />
        </div>
        <TeamAvailability members={teamMembers} />
        <RecentActivity requests={recentRequests} />
      </div>
    </div>
  );
}
