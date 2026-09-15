import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Clock, Calendar, TrendingUp, ArrowRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { YearCalendar } from '@/components/dashboard/YearCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { listUsers } from '@/api/users';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listPublicHolidays } from '@/api/publicHolidays';
import { listTeam } from '@/api/team';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatLeaveDuration, formatLeaveDurationCompact } from '@/lib/leave';
import { buildEmployeeColorMap } from '@/lib/employeeColor';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee } = useAuth();

  useEffect(() => {
    if (isEmployee()) {
      navigate('/', { replace: true });
    }
  }, [isEmployee, navigate]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers(),
    enabled: isAdmin(),
  });
  const { data: allRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: isAdmin(),
  });
  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
    enabled: isAdmin(),
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: listTeam,
    enabled: isAdmin(),
  });

  const employeeColorMap = useMemo(() => buildEmployeeColorMap(users), [users]);

  if (!isAdmin()) {
    return null;
  }

  const totalEmployees = users.filter(u => u.role === 'employee').length;
  const pendingApprovals = allRequests.filter(r => r.status === 'pending');
  const pendingRequests = pendingApprovals.length;
  const approvedRequests = allRequests.filter(r => r.status === 'approved').length;
  const employeesOnHoliday = teamMembers.filter(m => m.isOnHoliday).length;

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingHolidays = allRequests.filter(r => {
    const startDate = new Date(r.startDate);
    return startDate >= today && startDate <= nextWeek && r.status === 'approved';
  });

  const stats = [
    {
      title: 'Total Employés',
      value: totalEmployees,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Employés actifs',
    },
    {
      title: 'Demandes en attente',
      value: pendingRequests,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      description: 'Nécessitent une action',
    },
    {
      title: 'En congé',
      value: employeesOnHoliday,
      icon: Calendar,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: 'Actuellement en congé',
    },
    {
      title: 'Taux d\'approbation',
      value: `${Math.round((approvedRequests / allRequests.length) * 100) || 0}%`,
      icon: TrendingUp,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      description: 'Ce mois',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Bon retour, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de la gestion des congés</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 min-h-[520px] h-full">
          <YearCalendar
            requests={allRequests}
            publicHolidays={publicHolidays}
            employeeColorMap={employeeColorMap}
            employees={users
              .filter((user) => user.role === 'employee')
              .map((user) => ({ id: user.id, name: user.name }))}
          />
        </div>

        <div className="space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Demandes en attente</CardTitle>
                  <CardDescription>Actions requises immédiatement</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/requests')}>
                  Voir tout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="space-y-3">
                  {pendingApprovals.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-foreground truncate">{request.employeeName}</p>
                          <Badge variant="pending">En attente</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.startDate), 'd MMM', { locale: fr })} - {format(new Date(request.endDate), 'd MMM yyyy', { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {formatLeaveDuration(request.days, request.halfDayPeriod)} • {request.reason}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => navigate('/requests')}
                      >
                        Examiner
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-success mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">Aucune demande en attente</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle>Congés à venir</CardTitle>
              <CardDescription>7 prochains jours</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingHolidays.length > 0 ? (
                <div className="space-y-3">
                  {upcomingHolidays.slice(0, 5).map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{holiday.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(holiday.startDate), 'd MMM', { locale: fr })} - {format(new Date(holiday.endDate), 'd MMM', { locale: fr })}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {formatLeaveDurationCompact(holiday.days, holiday.halfDayPeriod)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun congé prévu cette semaine
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>Dernières actions sur les demandes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allRequests.slice(0, 5).map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className={cn(
                      'p-2 rounded-full',
                      request.status === 'approved' ? 'bg-success/10' :
                      request.status === 'rejected' ? 'bg-destructive/10' :
                      'bg-warning/10'
                    )}>
                      {request.status === 'approved' ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : request.status === 'rejected' ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {request.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.status === 'approved' ? 'Demande approuvée' :
                         request.status === 'rejected' ? 'Demande rejetée' :
                         'Nouvelle demande'} • {format(new Date(request.createdAt), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <Badge variant={request.status}>
                      {request.status === 'pending' ? 'En attente' :
                       request.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
