import { formatLeaveDateRange } from '@/lib/leave';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { listTeam } from '@/api/team';

export default function TeamPage() {
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: listTeam,
  });

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Équipe</h1>
        <p className="text-muted-foreground mt-1">Consultez les membres de votre équipe et leur disponibilité</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md animate-fade-in" style={{ animationDelay: '100ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher des membres de l'équipe..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total des membres</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teamMembers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Disponibles aujourd'hui</p>
          <p className="text-2xl font-bold text-success mt-1">
            {teamMembers.filter(m => !m.isOnHoliday).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">En congé</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {teamMembers.filter(m => m.isOnHoliday).length}
          </p>
        </div>
      </div>

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member, index) => (
          <div 
            key={member.id}
            className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${(index + 3) * 100}ms` }}
          >
            <div className="flex items-start gap-4">
              <Avatar className="w-12 h-12">
                <AvatarImage src={member.avatar} />
                <AvatarFallback className={avatarColors[index % avatarColors.length]}>
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{member.name}</h3>
                  {member.isOnHoliday ? (
                    <Badge variant="pending">En congé</Badge>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{member.role}</p>
                <p className="text-xs text-muted-foreground mt-1">{member.department}</p>
              </div>
            </div>
            {member.leaveStart && member.leaveEnd && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {member.isOnHoliday ? 'Congé : ' : 'Prochain congé : '}
                  <span className="font-medium text-foreground">
                    {formatLeaveDateRange(member.leaveStart, member.leaveEnd)}
                  </span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
