import { useMemo, useState, type ReactNode } from 'react';
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
import { HolidayRequest } from '@/types/holiday';
import { toast } from '@/hooks/use-toast';
import { downloadLeavePlanningExcel } from '@/lib/exportLeavePlanning';

const typeLabels: Record<'annual' | 'sick' | 'unpaid', string> = {
  annual: 'Congés annuels',
  sick: 'Maladie',
  unpaid: 'Sans solde',
};

const REPORT_TYPES = Object.keys(typeLabels) as Array<keyof typeof typeLabels>;

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function overlapsYear(request: HolidayRequest, year: number): boolean {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  return request.startDate <= yearEnd && request.endDate >= yearStart;
}

function buildMonthlyTrend(requests: HolidayRequest[], year: number) {
  const counts = MONTH_LABELS.map((month) => ({
    month,
    requests: 0,
    approved: 0,
  }));

  for (const request of requests) {
    if (request.startDate.getFullYear() !== year) {
      continue;
    }
    const monthIndex = request.startDate.getMonth();
    counts[monthIndex].requests += 1;
    if (request.status === 'approved') {
      counts[monthIndex].approved += 1;
    }
  }

  return counts;
}

function ChartEmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ChartPanel({
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: Readonly<{
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}>) {
  if (isLoading) {
    return <ChartEmptyState message="Chargement…" />;
  }
  if (isEmpty) {
    return <ChartEmptyState message={emptyMessage} />;
  }
  return children;
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);
  const { data: allRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers(),
  });
  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
  });

  const isLoading = requestsLoading || usersLoading;
  const employees = users.filter((u) => u.role === 'employee');

  const yearRequests = useMemo(
    () => allRequests.filter((request) => overlapsYear(request, year)),
    [allRequests, year],
  );

  const totalRequests = yearRequests.length;
  const approvedRequests = yearRequests.filter((r) => r.status === 'approved').length;
  const pendingRequests = yearRequests.filter((r) => r.status === 'pending').length;
  const rejectedRequests = yearRequests.filter((r) => r.status === 'rejected').length;
  const decidedRequests = approvedRequests + rejectedRequests;
  const totalDays = yearRequests.reduce((sum, r) => sum + r.days, 0);
  const approvedDays = yearRequests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + r.days, 0);
  const avgDaysPerRequest = totalRequests > 0 ? (totalDays / totalRequests).toFixed(1) : '0';
  const approvalRate =
    decidedRequests > 0 ? Math.round((approvedRequests / decidedRequests) * 100) : 0;

  const requestsByType = REPORT_TYPES.map((type) => ({
    type: typeLabels[type],
    count: yearRequests.filter((r) => r.type === type).length,
    days: yearRequests.filter((r) => r.type === type).reduce((sum, r) => sum + r.days, 0),
  }));

  const requestsByStatus = [
    { name: 'Approuvées', value: approvedRequests, color: 'hsl(var(--success))' },
    { name: 'En attente', value: pendingRequests, color: 'hsl(var(--warning))' },
    { name: 'Rejetées', value: rejectedRequests, color: 'hsl(var(--destructive))' },
  ];
  const statusChartData = requestsByStatus.filter((entry) => entry.value > 0);

  const departmentData = employees.reduce(
    (acc, emp) => {
      const dept = emp.department?.trim() || 'Autre';
      if (!acc[dept]) {
        acc[dept] = { name: dept, requests: 0, days: 0 };
      }
      const empRequests = yearRequests.filter((r) => r.employeeId === emp.id);
      acc[dept].requests += empRequests.length;
      acc[dept].days += empRequests.reduce((s, r) => s + r.days, 0);
      return acc;
    },
    {} as Record<string, { name: string; requests: number; days: number }>,
  );

  const departmentChartData = Object.values(departmentData).filter(
    (entry) => entry.requests > 0 || entry.days > 0,
  );

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(yearRequests, year),
    [yearRequests, year],
  );
  const hasMonthlyActivity = monthlyTrend.some((entry) => entry.requests > 0);

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
      <div className="page-toolbar flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapports et analyses</h1>
          <p className="text-muted-foreground mt-1">
            Statistiques basées sur les congés de {year}
          </p>
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
          <Button variant="outline" onClick={handleExport} disabled={exporting || isLoading}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Export...' : 'Exporter le planning'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des demandes</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '…' : totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Congés couvrant {year}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jours totaux</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '…' : totalDays}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? '…' : `${approvedDays} jours approuvés`}
            </p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne par demande</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '…' : avgDaysPerRequest}</div>
            <p className="text-xs text-muted-foreground mt-1">Jours en moyenne</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'approbation</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '…' : `${approvalRate}%`}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {decidedRequests > 0
                ? `${approvedRequests}/${decidedRequests} décisions`
                : 'Aucune décision'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader>
            <CardTitle>Demandes par type</CardTitle>
            <CardDescription>Répartition des demandes selon le type de congé</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartPanel
              isLoading={isLoading}
              isEmpty={totalRequests === 0}
              emptyMessage={`Aucune demande pour ${year}`}
            >
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
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartPanel>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader>
            <CardTitle>Statut des demandes</CardTitle>
            <CardDescription>Répartition par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartPanel
              isLoading={isLoading}
              isEmpty={statusChartData.length === 0}
              emptyMessage={`Aucune demande pour ${year}`}
            >
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
                    dataKey="value"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </ChartPanel>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '700ms' }}>
          <CardHeader>
            <CardTitle>Par département</CardTitle>
            <CardDescription>Demandes et jours par département</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartPanel
              isLoading={isLoading}
              isEmpty={departmentChartData.length === 0}
              emptyMessage={`Aucune demande pour ${year}`}
            >
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
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="requests" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="right" dataKey="days" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartPanel>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '800ms' }}>
          <CardHeader>
            <CardTitle>Tendance mensuelle</CardTitle>
            <CardDescription>Évolution des congés démarrant en {year}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartPanel
              isLoading={isLoading}
              isEmpty={!hasMonthlyActivity}
              emptyMessage={`Aucune demande pour ${year}`}
            >
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
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="approved" stroke="hsl(var(--success))" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </ChartPanel>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
