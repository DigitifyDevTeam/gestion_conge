import { TeamMember } from '@/types/holiday';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Palmtree } from 'lucide-react';
import { formatLeaveDateRange } from '@/lib/leave';

interface TeamAvailabilityProps {
  members: TeamMember[];
}

function leaveLabel(member: TeamMember): string | null {
  if (!member.leaveStart || !member.leaveEnd) {
    return null;
  }
  return `Congé : ${formatLeaveDateRange(member.leaveStart, member.leaveEnd)}`;
}

function MemberLeaveStatus({ member }: { member: TeamMember }) {
  const rangeLabel = leaveLabel(member);
  if (member.isOnHoliday) {
    return (
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant="pending" className="gap-1">
          <Palmtree className="w-3 h-3" />
          En congé
        </Badge>
        {rangeLabel && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {rangeLabel}
          </span>
        )}
      </div>
    );
  }
  if (rangeLabel) {
    return (
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {rangeLabel}
      </span>
    );
  }
  return <span className="w-2 h-2 rounded-full bg-success shrink-0" />;
}

export function TeamAvailability({ members }: TeamAvailabilityProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const avatarColors = [
    'bg-primary/20 text-primary',
    'bg-success/20 text-success',
    'bg-warning/20 text-warning',
    'bg-chart-4/20 text-chart-4',
    'bg-chart-5/20 text-chart-5',
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card animate-fade-in" style={{ animationDelay: '500ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Disponibilité de l'équipe</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {members.filter(m => !m.isOnHoliday).length}/{members.length} disponible{members.filter(m => !m.isOnHoliday).length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => (
            <div 
              key={member.id} 
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
            >
              <Avatar className="w-9 h-9">
                <AvatarImage src={member.avatar} />
                <AvatarFallback className={avatarColors[index % avatarColors.length]}>
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.role}</p>
              </div>
              <MemberLeaveStatus member={member} />
            </div>
        ))}
      </div>
    </div>
  );
}
