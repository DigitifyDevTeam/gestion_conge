import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Clock, Calendar, TrendingUp, ArrowRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { listUsers } from '@/api/users';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listTeam } from '@/api/team';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatLeaveDuration, formatLeaveDurationCompact } from '@/lib/leave';

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
    queryFn: listUsers,
    enabled: isAdmin(),
  });
  const { data: allRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: isAdmin(),
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: listTeam,
    enabled: isAdmin(),
  });

  if (!isAdmin()) {
    return null;
  }

  const totalEmployees = users.filter(u => u.role === 'employee').length;
  const pendingApprovals = allRequests.filter(r => r.status === 'pending');
  const pendingRequests = pendingApprovals.length;
  const approvedRequests = allRequests.filter(r => r.status === 'approved').length;
  const rejectedRequests = allRequests.filter(r => r.status === 'rejected').length;
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

  const quickActions = [
    {
      title: 'Gérer les utilisateurs',
      description: 'Créer et modifier les comptes employés',
      icon: Users,
      onClick: () => navigate('/users'),
      color: 'text-primary',
    },
    {
      title: 'Toutes les demandes',
      description: 'Voir et gérer toutes les demandes',
      icon: Clock,
      onClick: () => navigate('/requests'),
      color: 'text-warning',
    },
    {
      title: 'Gérer les soldes',
      description: 'Ajuster les soldes de congés',
      icon: TrendingUp,
      onClick: () => navigate('/balances'),
      color: 'text-success',
    },
    {
      title: 'Rapports',
      description: 'Analyses et statistiques',
      icon: TrendingUp,
      onClick: () => navigate('/reports'),
      color: 'text-chart-1',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Bon retour, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de la gestion des congés</p>
      </div>

      {/* Stats Grid */}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Pending Approvals */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
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
                  {pendingApprovals.slice(0, 5).map((request, index) => (
                    <div
                      key={request.id}
                      className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{request.employeeName}</p>
                          <Badge variant="pending">En attente</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.startDate), 'd MMM', { locale: fr })} - {format(new Date(request.endDate), 'd MMM yyyy', { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatLeaveDuration(request.days, request.halfDayPeriod)} • {request.reason}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
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

          {/* Recent Activity */}
          <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
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
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
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

        {/* Right Column - Quick Actions & Upcoming */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
              <CardDescription>Accès rapide aux fonctionnalités</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.title}
                      variant="outline"
                      className="w-full justify-start h-auto p-4"
                      onClick={action.onClick}
                    >
                      <Icon className={cn('w-5 h-5 mr-3', action.color)} />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{action.title}</p>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Holidays */}
          <Card className="animate-fade-in" style={{ animationDelay: '700ms' }}>
            <CardHeader>
              <CardTitle>Congés à venir</CardTitle>
              <CardDescription>7 prochains jours</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingHolidays.length > 0 ? (
                <div className="space-y-3">
                  {upcomingHolidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">{holiday.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(holiday.startDate), 'd MMM', { locale: fr })} - {format(new Date(holiday.endDate), 'd MMM', { locale: fr })}
                        </p>
                      </div>
                      <Badge variant="outline">{formatLeaveDurationCompact(holiday.days, holiday.halfDayPeriod)}</Badge>
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
        </div>
      </div>
    </div>
  );
}

