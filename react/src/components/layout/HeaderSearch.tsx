import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, Search, Users } from 'lucide-react';
import { listLeaveRequests } from '@/api/leaveRequests';
import { listTeam } from '@/api/team';
import { useAuth } from '@/contexts/AuthContext';
import { HolidayRequest, HolidayType, TeamMember } from '@/types/holiday';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<HolidayType, string> = {
  annual: 'Annuels',
  sick: 'Maladie',
  personal: 'Personnel',
  unpaid: 'Sans solde',
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
} as const;

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function matchesQuery(haystack: string, query: string): boolean {
  return normalize(haystack).includes(query);
}

function memberMatches(member: TeamMember, query: string): boolean {
  return (
    matchesQuery(member.name, query) ||
    matchesQuery(member.role || '', query) ||
    matchesQuery(member.department || '', query)
  );
}

function requestMatches(request: HolidayRequest, query: string): boolean {
  return (
    matchesQuery(request.employeeName, query) ||
    matchesQuery(TYPE_LABELS[request.type], query) ||
    matchesQuery(STATUS_LABELS[request.status], query) ||
    matchesQuery(request.reason || '', query)
  );
}

export function HeaderSearch() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const queriesEnabled = isAuthenticated && !authLoading;

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: listTeam,
    enabled: queriesEnabled,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: queriesEnabled,
  });

  const normalizedQuery = normalize(query);

  const memberResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }
    return teamMembers.filter((member) => memberMatches(member, normalizedQuery)).slice(0, 5);
  }, [teamMembers, normalizedQuery]);

  const requestResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }
    return requests.filter((request) => requestMatches(request, normalizedQuery)).slice(0, 5);
  }, [requests, normalizedQuery]);

  const flatResults = useMemo(
    () => [
      ...memberResults.map((member) => ({ kind: 'member' as const, id: `member-${member.id}`, member })),
      ...requestResults.map((request) => ({ kind: 'request' as const, id: `request-${request.id}`, request })),
    ],
    [memberResults, requestResults],
  );

  const showPanel = open && normalizedQuery.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const goToMember = (member: TeamMember) => {
    setOpen(false);
    setQuery('');
    navigate(`/team?q=${encodeURIComponent(member.name)}`);
  };

  const goToRequest = (request: HolidayRequest) => {
    setOpen(false);
    setQuery('');
    navigate(`/requests?q=${encodeURIComponent(request.employeeName)}`);
  };

  const goToFullSearch = () => {
    if (!normalizedQuery) {
      return;
    }
    setOpen(false);
    const target = memberResults.length && !requestResults.length ? '/team' : '/requests';
    navigate(`${target}?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  const selectActive = () => {
    const active = flatResults[activeIndex];
    if (!active) {
      goToFullSearch();
      return;
    }
    if (active.kind === 'member') {
      goToMember(active.member);
      return;
    }
    goToRequest(active.request);
  };

  return (
    <div ref={containerRef} className="app-header-search relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(flatResults.length - 1, 0)));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              selectActive();
            }
          }}
          placeholder="Rechercher des demandes, membres de l'équipe..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          aria-label="Recherche globale"
          aria-controls="header-search-results"
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {showPanel && (
        <div
          id="header-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          role="listbox"
        >
          {flatResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-muted-foreground">
              Aucun résultat pour « {query.trim()} »
            </p>
          ) : (
            <div className="max-h-[22rem] overflow-y-auto py-2">
              {memberResults.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Membres
                  </p>
                  {memberResults.map((member, index) => {
                    const itemIndex = index;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === itemIndex}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                          activeIndex === itemIndex ? 'bg-accent' : 'hover:bg-accent/60',
                        )}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => goToMember(member)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[member.role, member.department].filter(Boolean).join(' · ') || 'Équipe'}
                            {member.isOnHoliday ? ' · En congé' : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {requestResults.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Demandes
                  </p>
                  {requestResults.map((request, index) => {
                    const itemIndex = memberResults.length + index;
                    return (
                      <button
                        key={request.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === itemIndex}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                          activeIndex === itemIndex ? 'bg-accent' : 'hover:bg-accent/60',
                        )}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => goToRequest(request)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {request.employeeName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {TYPE_LABELS[request.type]} · {STATUS_LABELS[request.status]} ·{' '}
                            {format(request.startDate, 'd MMM', { locale: fr })} –{' '}
                            {format(request.endDate, 'd MMM yyyy', { locale: fr })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {normalizedQuery && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/60"
              onClick={goToFullSearch}
            >
              <Search className="w-4 h-4" />
              Voir tous les résultats pour « {query.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}
