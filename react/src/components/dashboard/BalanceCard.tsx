import { HolidayBalance } from '@/types/holiday';
import { Palmtree, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLeaveDaysNumber } from '@/lib/leave';

const typeConfig: Record<'annual' | 'unpaid', { 
  icon: typeof Palmtree; 
  label: string; 
  gradient: string;
  bgColor: string;
  iconColor: string;
}> = {
  annual: { 
    icon: Palmtree, 
    label: 'Congés annuels',
    gradient: 'from-primary to-primary/70',
    bgColor: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  unpaid: { 
    icon: Clock, 
    label: 'Congés sans solde',
    gradient: 'from-muted-foreground to-muted-foreground/70',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
};

interface BalanceCardProps {
  balance: HolidayBalance;
  index: number;
}

export function BalanceCard({ balance, index }: BalanceCardProps) {
  if (balance.type !== 'annual' && balance.type !== 'unpaid') {
    return null;
  }

  const config = typeConfig[balance.type];
  const Icon = config.icon;
  const percentage = balance.total > 0 ? (balance.used / balance.total) * 100 : 0;

  return (
    <div 
      className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.bgColor)}>
          <Icon className={cn("w-5 h-5", config.iconColor)} />
        </div>
        {balance.pending > 0 && (
          <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
            {formatLeaveDaysNumber(balance.pending)} en attente
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-muted-foreground mb-1">{config.label}</h3>
      
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-foreground">{formatLeaveDaysNumber(balance.used)}</span>
        <span className="text-sm text-muted-foreground">/ {formatLeaveDaysNumber(balance.total)} jours</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", config.gradient)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{formatLeaveDaysNumber(balance.used)} utilisés</span>
        <span>{formatLeaveDaysNumber(balance.remaining)} restants</span>
      </div>
    </div>
  );
}
