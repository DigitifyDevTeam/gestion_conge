import { useMemo, useState } from 'react';
import { format, getYear, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, CheckCircle2, Clock3, History, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HolidayRequest, HolidayType, HalfDayPeriod, RequestStatus } from '@/types/holiday';
import { cn } from '@/lib/utils';
import { formatLeaveDuration } from '@/lib/leave';

interface HistoryDayEntry {
  id: string;
  date: Date;
  halfDayPeriod?: HalfDayPeriod | null;
  request: HolidayRequest;
}

function typeLabel(type: HolidayType): string {
  switch (type) {
    case 'annual':
      return 'Annuels';
    case 'sick':
      return 'Maladie';
    case 'personal':
      return 'Personnel';
    case 'unpaid':
      return 'Sans solde';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'approved':
      return 'Approuvé';
    case 'rejected':
      return 'Rejeté';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function statusIcon(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return Clock3;
    case 'approved':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function expandRequestDays(request: HolidayRequest): HistoryDayEntry[] {
  return request.dates.map((entry) => {
    const date = startOfDay(new Date(entry.date));
    return {
      id: `${request.id}-${format(date, 'yyyy-MM-dd')}`,
      date,
      halfDayPeriod: entry.halfDayPeriod || null,
      request,
    };
  });
}

function sumDays(requests: HolidayRequest[], status?: RequestStatus): number {
  return requests
    .filter((request) => (status ? request.status === status : true))
    .reduce((total, request) => total + Number(request.days), 0);
}

function collectYears(requests: HolidayRequest[]): number[] {
  const years = new Set<number>();
  const current = new Date().getFullYear();
  years.add(current);
  for (const request of requests) {
    for (const entry of request.dates) {
      years.add(getYear(new Date(entry.date)));
    }
    years.add(getYear(request.createdAt));
  }
  return [...years].sort((a, b) => b - a);
}

export interface LeaveHistoryArchiveProps {
  mode: 'employee' | 'admin';
  requests: HolidayRequest[];
  isLoading?: boolean;
  employees?: Array<{ id: string; name: string }>;
}

export function LeaveHistoryArchive({
  mode,
  requests,
  isLoading = false,
  employees = [],
}: LeaveHistoryArchiveProps) {
  const isAdminArchive = mode === 'admin';
  const yearOptions = useMemo(() => collectYears(requests), [requests]);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  const employeeOptions = useMemo(() => {
    if (employees.length > 0) {
      return [...employees].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
    }
    const byId = new Map<string, { id: string; name: string }>();
    for (const request of requests) {
      if (!request.employeeId) continue;
      if (!byId.has(request.employeeId)) {
        byId.set(request.employeeId, {
          id: request.employeeId,
          name: request.employeeName || 'Employé',
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
  }, [employees, requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (isAdminArchive && employeeFilter !== 'all' && request.employeeId !== employeeFilter) {
        return false;
      }
      if (yearFilter === 'all') return true;
      const year = Number(yearFilter);
      return (
        request.dates.some((entry) => getYear(new Date(entry.date)) === year)
        || getYear(request.createdAt) === year
      );
    });
  }, [requests, isAdminArchive, employeeFilter, yearFilter]);

  /** Days belonging to the selected year only (when a year is picked). */
  const historyDays = useMemo(() => {
    const year = yearFilter === 'all' ? null : Number(yearFilter);
    return filteredRequests
      .flatMap(expandRequestDays)
      .filter((entry) => (year == null ? true : getYear(entry.date) === year))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredRequests, yearFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; entries: HistoryDayEntry[] }>();
    for (const entry of historyDays) {
      const key = format(entry.date, 'yyyy-MM');
      const existing = map.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(key, {
          label: format(entry.date, 'MMMM yyyy', { locale: fr }),
          entries: [entry],
        });
      }
    }
    return [...map.values()];
  }, [historyDays]);

  const title = isAdminArchive ? 'Archives des congés' : 'Historique';
  const subtitle = isAdminArchive
    ? 'Historique complet des congés de tous les employés — conservé d’une année sur l’autre.'
    : 'Consultez tous vos jours de congés — l’historique reste disponible chaque année.';

  const EmptyIcon = isAdminArchive ? Archive : History;
  const selectedEmployeeName =
    employeeFilter === 'all'
      ? null
      : employeeOptions.find((user) => user.id === employeeFilter)?.name || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isAdminArchive && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Employé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {employeeOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in"
        style={{ animationDelay: '100ms' }}
      >
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">
            {yearFilter === 'all' ? 'Total des jours' : `Jours ${yearFilter}`}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {sumDays(filteredRequests)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Jours approuvés</p>
          <p className="text-2xl font-bold text-success mt-1">
            {sumDays(filteredRequests, 'approved')}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Jours en attente</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {sumDays(filteredRequests, 'pending')}
          </p>
        </div>
      </div>

      {(yearFilter !== 'all' || selectedEmployeeName) && (
        <p className="text-sm text-muted-foreground animate-fade-in">
          Affichage
          {selectedEmployeeName ? ` · ${selectedEmployeeName}` : ''}
          {yearFilter !== 'all' ? ` · année ${yearFilter}` : ''}
        </p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          {isAdminArchive ? 'Chargement des archives…' : 'Chargement de l’historique…'}
        </p>
      )}

      {!isLoading && grouped.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-border shadow-card">
          <EmptyIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {isAdminArchive
              ? 'Aucun congé dans les archives pour ces filtres'
              : 'Aucun jour de congé dans l’historique pour cette période'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.label} className="space-y-3 animate-fade-in">
            <h2 className="text-lg font-semibold text-foreground capitalize">{group.label}</h2>
            <div className="space-y-3">
              {group.entries.map((entry) => {
                const StatusIcon = statusIcon(entry.request.status);
                const isHalfDay = Boolean(entry.halfDayPeriod);
                return (
                  <div
                    key={entry.id}
                    className="bg-card rounded-xl border border-border p-5 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          entry.request.status === 'approved' && 'bg-success/10',
                          entry.request.status === 'pending' && 'bg-warning/10',
                          entry.request.status === 'rejected' && 'bg-destructive/10',
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            'w-4 h-4',
                            entry.request.status === 'approved' && 'text-success',
                            entry.request.status === 'pending' && 'text-warning',
                            entry.request.status === 'rejected' && 'text-destructive',
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {isAdminArchive && (
                            <p className="font-semibold text-foreground">
                              {entry.request.employeeName}
                            </p>
                          )}
                          <p className="font-medium text-foreground">
                            {format(entry.date, 'EEEE d MMMM yyyy', { locale: fr })}
                          </p>
                          <Badge variant={entry.request.status} className="text-xs">
                            {statusLabel(entry.request.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {typeLabel(entry.request.type)}
                          {isHalfDay
                            ? ` · ${formatLeaveDuration(0.5, entry.halfDayPeriod)}`
                            : ''}
                        </p>
                        {isHalfDay && (
                          <p className="text-xs text-muted-foreground mt-1">Demi-journée</p>
                        )}
                        {entry.request.reason && (
                          <p className="text-sm text-foreground mt-2">{entry.request.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
