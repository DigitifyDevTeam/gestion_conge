import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Calendar, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listUsers } from '@/api/users';
import { listPublicHolidays } from '@/api/publicHolidays';
import { HolidayType } from '@/types/holiday';
import { toast } from '@/hooks/use-toast';
import { downloadLeavePlanningExcel } from '@/lib/exportLeavePlanning';

const typeLabels: Record<Extract<HolidayType, 'annual' | 'unpaid'>, string> = {
  annual: 'Congés annuels',
  unpaid: 'Congés sans solde',
};

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);
  const { data: allRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });
  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
  });

  const employees = users.filter(u => u.role === 'employee');

  const totalRequests = allRequests.length;
  const approvedRequests = allRequests.filter(r => r.status === 'approved').length;
  const pendingRequests = allRequests.filter(r => r.status === 'pending').length;
  const rejectedRequests = allRequests.filter(r => r.status === 'rejected').length;
  const totalDays = allRequests.reduce((sum, r) => sum + r.days, 0);
  const avgDaysPerRequest = totalRequests > 0 ? (totalDays / totalRequests).toFixed(1) : '0';

  const requestsByType = Object.entries(typeLabels).map(([type, label]) => ({
    type: label,
    count: allRequests.filter(r => r.type === type).length,
    days: allRequests.filter(r => r.type === type).reduce((sum, r) => sum + r.days, 0),
  }));

  const requestsByStatus = [
    { name: 'Approuvées', value: approvedRequests, color: 'hsl(var(--success))' },
    { name: 'En attente', value: pendingRequests, color: 'hsl(var(--warning))' },
    { name: 'Rejetées', value: rejectedRequests, color: 'hsl(var(--destructive))' },
  ];
  const statusChartData = requestsByStatus.filter((entry) => entry.value > 0);

  const departmentData = employees.reduce((acc, emp) => {
    const dept = emp.department || 'Autre';
    if (!acc[dept]) {
      acc[dept] = { name: dept, requests: 0, days: 0 };
    }
    const empRequests = allRequests.filter(r => r.employeeId === emp.id);
    acc[dept].requests += empRequests.length;
    acc[dept].days += empRequests.reduce((s, r) => s + r.days, 0);
    return acc;
  }, {} as Record<string, { name: string; requests: number; days: number }>);

  const departmentChartData = Object.values(departmentData);

  // Monthly trend (mock data for last 6 months)
  const monthlyTrend = [
    { month: 'Juil', requests: 12, approved: 10 },
    { month: 'Août', requests: 15, approved: 13 },
    { month: 'Sep', requests: 18, approved: 16 },
    { month: 'Oct', requests: 14, approved: 12 },
    { month: 'Nov', requests: 16, approved: 14 },
    { month: 'Déc', requests: totalRequests, approved: approvedRequests },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadLeavePlanningExcel({
        year,
        users,
        requests: allRequests,
        publicHolidays,
      });
      toast({
        title: 'Planning exporté',
        description: `Le fichier Planning de congés ${year}.xlsx a été téléchargé.`,
      });
    } catch {
      toast({
        title: 'Erreur',
        description: "L'export Excel a échoué.",
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapports et analyses</h1>
          <p className="text-muted-foreground mt-1">Statistiques et tendances des congés</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Export...' : 'Exporter le planning'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des demandes</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Toutes les demandes</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jours totaux</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDays}</div>
            <p className="text-xs text-muted-foreground mt-1">Jours de congé demandés</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne par demande</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDaysPerRequest}</div>
            <p className="text-xs text-muted-foreground mt-1">Jours en moyenne</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'approbation</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Demandes approuvées</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests by Type */}
        <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader>
            <CardTitle>Demandes par type</CardTitle>
            <CardDescription>Répartition des demandes selon le type de congé</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[300px] w-full"
              config={{
                count: { label: 'Demandes' },
                days: { label: 'Jours' },
              }}
            >
              <BarChart data={requestsByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Requests by Status */}
        <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader>
            <CardTitle>Statut des demandes</CardTitle>
            <CardDescription>Répartition par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[300px] w-full"
              config={{
                value: { label: 'Demandes' },
              }}
            >
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card className="animate-fade-in" style={{ animationDelay: '700ms' }}>
          <CardHeader>
            <CardTitle>Par département</CardTitle>
            <CardDescription>Demandes et jours par département</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[300px] w-full"
              config={{
                requests: { label: 'Demandes' },
                days: { label: 'Jours' },
              }}
            >
              <BarChart data={departmentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="left" dataKey="requests" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="right" dataKey="days" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="animate-fade-in" style={{ animationDelay: '800ms' }}>
          <CardHeader>
            <CardTitle>Tendance mensuelle</CardTitle>
            <CardDescription>Évolution des demandes sur 6 mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[300px] w-full"
              config={{
                requests: { label: 'Demandes' },
                approved: { label: 'Approuvées' },
              }}
            >
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" stroke="hsl(var(--success))" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

