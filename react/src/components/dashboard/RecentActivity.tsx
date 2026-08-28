import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { HolidayRequest } from '@/types/holiday';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLeaveDates, formatLeaveDuration } from '@/lib/leave';

interface RecentActivityProps {
  requests: HolidayRequest[];
}

const statusConfig = {
  pending: { icon: Clock3, color: 'text-warning' },
  approved: { icon: CheckCircle2, color: 'text-success' },
  rejected: { icon: XCircle, color: 'text-destructive' },
};

export function RecentActivity({ requests }: RecentActivityProps) {
  const navigate = useNavigate();
  const sortedRequests = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card animate-fade-in" style={{ animationDelay: '600ms' }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Activité récente</h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
          Voir historique
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="space-y-4">
        {sortedRequests.map((request) => {
          const StatusIcon = statusConfig[request.status].icon;
          return (
            <div key={request.id} className="flex items-start gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                request.status === 'approved' ? 'bg-success/10' : 
                request.status === 'pending' ? 'bg-warning/10' : 'bg-destructive/10'
              )}>
                <StatusIcon className={cn("w-4 h-4", statusConfig[request.status].color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground capitalize">
                    {request.type === 'annual' ? 'Congés annuels' : 
                     request.type === 'sick' ? 'Congés maladie' : 
                     request.type === 'personal' ? 'Jours personnels' : 
                     'Congés sans solde'}
                  </span>
                  <Badge variant={request.status} className="text-xs">
                    {request.status === 'pending' ? 'En attente' : 
                     request.status === 'approved' ? 'Approuvé' : 
                     'Rejeté'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatLeaveDates(request.dates, true)} · {formatLeaveDuration(request.days, request.halfDayPeriod)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Soumis le {format(new Date(request.createdAt), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
