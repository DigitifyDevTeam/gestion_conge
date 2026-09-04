import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Palmtree, Clock, Siren, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  composeLeaveReason,
  earliestLeaveDate,
  formatLeaveDates,
  formatLeaveDuration,
  holidayDateKeys,
  isLeaveReasonChoice,
  isWorkingDay,
  LEAVE_REASON_OPTIONS,
  MIN_LEAVE_NOTICE_DAYS,
  parseLeaveReason,
  sortLeaveDays,
  sumLeaveDayValues,
  toDateKey,
} from '@/lib/leave';
import {
  HalfDayPeriod,
  HolidayRequest,
  HolidayType,
  LeaveDay,
  LeaveReasonChoice,
} from '@/types/holiday';
import { toast } from '@/hooks/use-toast';
import {
  createLeaveRequest,
  LeaveRequestPayload,
  listLeaveRequests,
  updateLeaveRequest,
} from '@/api/leaveRequests';
import { ApiError } from '@/api/client';
import { listMyBalances } from '@/api/leaveBalances';
import { listPublicHolidays } from '@/api/publicHolidays';
import { User } from '@/types/auth';

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestToEdit?: HolidayRequest | null;
  /** Admin: pick an employee and allow past days (retroactive / urgent leave). */
  adminMode?: boolean;
  employees?: User[];
}

type DayDuration = 'full' | 'half';

const holidayTypes: { type: HolidayType; label: string; icon: typeof Palmtree; description: string }[] = [
  { type: 'annual', label: 'Congés annuels', icon: Palmtree, description: 'Vacances ou congés planifiés' },
  { type: 'unpaid', label: 'Congés sans solde', icon: Clock, description: 'Congés prolongés sans rémunération' },
];

const durationOptions: { value: DayDuration; label: string }[] = [
  { value: 'full', label: 'Journée' },
  { value: 'half', label: 'Demi-journée' },
];

function durationOf(day: LeaveDay): DayDuration {
  return day.halfDayPeriod ? 'half' : 'full';
}

function durationLabel(value: DayDuration): string {
  switch (value) {
    case 'full':
      return 'Journée';
    case 'half':
      return 'Demi-journée';
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

function withDuration(day: LeaveDay, duration: DayDuration): LeaveDay {
  switch (duration) {
    case 'full':
      return { date: day.date, halfDayPeriod: null };
    case 'half':
      return { date: day.date, halfDayPeriod: 'half' };
    default: {
      const exhaustive: never = duration;
      return exhaustive;
    }
  }
}

function submitButtonLabel(
  isEditing: boolean,
  isPending: boolean,
  adminMode: boolean,
): string {
  if (isPending) {
    if (isEditing) return 'Enregistrement...';
    return adminMode ? 'Enregistrement...' : 'Envoi...';
  }
  if (isEditing) return 'Enregistrer les modifications';
  return adminMode ? 'Enregistrer et approuver' : 'Soumettre la demande';
}

function extractIsoDates(message: string): string[] {
  return [...message.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((match) => match[0]);
}

function humanizeApiMessage(message: string): string {
  return message.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => {
    const parsed = parseISO(iso);
    if (Number.isNaN(parsed.getTime())) {
      return iso;
    }
    return format(parsed, 'EEEE d MMMM yyyy', { locale: fr });
  });
}

function overlapExplanation(date: Date): string {
  return `Le ${format(date, 'EEEE d MMMM yyyy', { locale: fr })} est déjà couvert par une autre demande (en attente ou approuvée). Retirez-le pour continuer.`;
}

const HolidayNameByKeyContext = createContext<Map<string, string>>(new Map());

function RequestCalendarDayContent({ date }: { date: Date }) {
  const names = useContext(HolidayNameByKeyContext);
  const holidayName = names.get(toDateKey(date));
  return (
    <span
      className="relative flex h-full w-full items-center justify-center"
      title={holidayName ? `Jour férié — ${holidayName}` : undefined}
    >
      {format(date, 'd')}
      {holidayName ? (
        <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-500" />
      ) : null}
    </span>
  );
}

export function NewRequestDialog({
  open,
  onOpenChange,
  requestToEdit,
  adminMode = false,
  employees = [],
}: NewRequestDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(requestToEdit);
  const [selectedType, setSelectedType] = useState<HolidayType>('annual');
  const [selectedDays, setSelectedDays] = useState<LeaveDay[]>([]);
  const [reasonChoice, setReasonChoice] = useState<LeaveReasonChoice | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [apiConflictKeys, setApiConflictKeys] = useState<string[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((user) => user.role === 'employee')
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [employees],
  );

  useQuery({
    queryKey: ['leave-balances', 'me'],
    queryFn: listMyBalances,
    enabled: open && !adminMode,
  });
  const { data: existingRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
    enabled: open,
  });
  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
    enabled: open,
  });
  const holidayKeys = useMemo(() => holidayDateKeys(publicHolidays), [publicHolidays]);
  const holidayDates = useMemo(
    () => publicHolidays.map((holiday) => startOfDay(holiday.date)),
    [publicHolidays],
  );
  const holidayNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const holiday of publicHolidays) {
      map.set(toDateKey(holiday.date), holiday.name);
    }
    return map;
  }, [publicHolidays]);
  const resetForm = () => {
    setSelectedType('annual');
    setSelectedDays([]);
    setReasonChoice('');
    setOtherReason('');
    setApiConflictKeys([]);
    setEmergencyMode(false);
    setSelectedEmployeeId('');
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!requestToEdit) {
      resetForm();
      setVisibleMonth(startOfDay(new Date()));
      return;
    }
    const parsed = parseLeaveReason(requestToEdit.reason || '');
    const editDays = requestToEdit.dates.map((day) => ({
      date: startOfDay(new Date(day.date)),
      halfDayPeriod: day.halfDayPeriod || null,
    }));
    setSelectedType(requestToEdit.type);
    setSelectedDays(editDays);
    setReasonChoice(parsed.choice);
    setOtherReason(parsed.otherDetail);
    setApiConflictKeys([]);
    setSelectedEmployeeId(requestToEdit.employeeId || '');
    const noticeDate = earliestLeaveDate(new Date(), false);
    setEmergencyMode(
      Boolean(requestToEdit.emergency) ||
        editDays.some((day) => startOfDay(day.date) < noticeDate),
    );
    setVisibleMonth(editDays[0]?.date ?? startOfDay(new Date()));
  }, [open, requestToEdit]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const occupiedDates = useMemo(() => {
    const dates: Date[] = [];
    for (const request of existingRequests) {
      if (request.status === 'rejected') {
        continue;
      }
      if (requestToEdit && request.id === requestToEdit.id) {
        continue;
      }
      if (adminMode) {
        if (!selectedEmployeeId || request.employeeId !== selectedEmployeeId) {
          continue;
        }
      }
      for (const day of request.dates) {
        dates.push(startOfDay(new Date(day.date)));
      }
    }
    return dates;
  }, [existingRequests, requestToEdit, adminMode, selectedEmployeeId]);

  const occupiedKeys = useMemo(
    () => new Set(occupiedDates.map(toDateKey)),
    [occupiedDates],
  );

  const handleMutationError = (err: unknown, fallback: string) => {
    const raw = err instanceof ApiError ? err.message : fallback;
    const isoDates = extractIsoDates(raw);
    if (isoDates.length > 0) {
      setApiConflictKeys(isoDates);
    }
    toast({
      title: isoDates.length > 0 ? 'Jour déjà demandé' : 'Erreur',
      description: humanizeApiMessage(raw),
      variant: 'destructive',
    });
  };

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      invalidate();
      toast({
        title: adminMode ? 'Congé enregistré' : 'Demande soumise',
        description: adminMode
          ? 'La demande a été saisie et approuvée pour l’employé.'
          : 'Votre demande a été soumise pour approbation.',
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Impossible de soumettre la demande.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: LeaveRequestPayload) =>
      updateLeaveRequest(requestToEdit!.id, payload),
    onSuccess: () => {
      invalidate();
      toast({
        title: 'Demande mise à jour',
        description: 'Votre demande en attente a été modifiée.',
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      handleMutationError(err, 'Impossible de modifier la demande.');
    },
  });

  const today = startOfDay(new Date());
  const allowPastDays = adminMode && !isEditing;
  const minSelectableDate = allowPastDays
    ? undefined
    : earliestLeaveDate(today, emergencyMode);
  const sortedDays = useMemo(() => sortLeaveDays(selectedDays), [selectedDays]);
  const resolvedDays = sumLeaveDayValues(sortedDays);
  const selectedDates = sortedDays.map((day) => day.date);
  const halfDates = sortedDays
    .filter((day) => Boolean(day.halfDayPeriod))
    .map((day) => day.date);
  const selectedKeySet = useMemo(
    () => new Set(sortedDays.map((day) => toDateKey(day.date))),
    [sortedDays],
  );
  const conflictKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const day of sortedDays) {
      const key = toDateKey(day.date);
      if (occupiedKeys.has(key) || apiConflictKeys.includes(key)) {
        keys.add(key);
      }
    }
    return keys;
  }, [sortedDays, occupiedKeys, apiConflictKeys]);
  const conflictDates = sortedDays
    .filter((day) => conflictKeys.has(toDateKey(day.date)))
    .map((day) => day.date);
  const busyDates = occupiedDates.filter((date) => !selectedKeySet.has(toDateKey(date)));
  const hasConflicts = conflictKeys.size > 0;

  const isDaySelectable = (day: Date) => {
    const normalized = startOfDay(day);
    if (minSelectableDate && normalized < minSelectableDate) {
      return false;
    }
    return isWorkingDay(day, holidayKeys);
  };

  const handleEmergencyToggle = () => {
    if (allowPastDays) {
      return;
    }
    setEmergencyMode((current) => {
      const next = !current;
      if (!next) {
        const noticeDate = earliestLeaveDate(today, false);
        setSelectedDays((days) =>
          days.filter((day) => startOfDay(day.date) >= noticeDate),
        );
      }
      return next;
    });
  };

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setSelectedDays([]);
    setApiConflictKeys([]);
  };

  const handleCalendarSelect = (dates: Date[] | undefined) => {
    const next = (dates ?? []).map(startOfDay).filter(isDaySelectable);
    const nextKeys = new Set(next.map(toDateKey));
    setApiConflictKeys((current) => current.filter((key) => nextKeys.has(key)));
    setSelectedDays((current) => {
      const kept = current.filter((day) => nextKeys.has(toDateKey(day.date)));
      const keptKeys = new Set(kept.map((day) => toDateKey(day.date)));
      const added = next
        .filter((date) => !keptKeys.has(toDateKey(date)))
        .map((date) => ({ date, halfDayPeriod: null as HalfDayPeriod | null }));
      return [...kept, ...added];
    });
  };

  const setDayDuration = (date: Date, duration: DayDuration) => {
    const key = toDateKey(date);
    setSelectedDays((current) =>
      current.map((day) =>
        toDateKey(day.date) === key ? withDuration(day, duration) : day,
      ),
    );
  };

  const removeDay = (date: Date) => {
    const key = toDateKey(date);
    setApiConflictKeys((current) => current.filter((item) => item !== key));
    setSelectedDays((current) => current.filter((day) => toDateKey(day.date) !== key));
  };

  const handleSubmit = () => {
    if (adminMode && !isEditing && !selectedEmployeeId) {
      toast({
        title: 'Employé requis',
        description: 'Sélectionnez l’employé concerné par cette demande.',
        variant: 'destructive',
      });
      return;
    }

    if (sortedDays.length === 0) {
      toast({
        title: 'Veuillez sélectionner les jours',
        description: 'Cliquez sur le calendrier pour ajouter au moins un jour.',
        variant: 'destructive',
      });
      return;
    }

    const invalidDay = sortedDays.find((day) => !isDaySelectable(day.date));
    if (invalidDay) {
      const tooSoon =
        Boolean(minSelectableDate) && startOfDay(invalidDay.date) < minSelectableDate!;
      toast({
        title: tooSoon ? `Préavis de ${MIN_LEAVE_NOTICE_DAYS} jours` : 'Jour invalide',
        description: tooSoon
          ? `Les congés doivent commencer au plus tôt le ${format(minSelectableDate!, 'd MMMM yyyy', { locale: fr })}. Activez le mode urgence pour aujourd’hui ou demain.`
          : `Le ${format(invalidDay.date, 'd MMM yyyy', { locale: fr })} est un week-end ou un jour férié.`,
        variant: 'destructive',
      });
      return;
    }

    const firstConflict = sortedDays.find((day) => conflictKeys.has(toDateKey(day.date)));
    if (firstConflict) {
      toast({
        title: 'Jour déjà demandé',
        description: overlapExplanation(firstConflict.date),
        variant: 'destructive',
      });
      return;
    }

    if (!reasonChoice) {
      toast({
        title: 'Raison requise',
        description: 'Veuillez sélectionner la raison de votre demande de congé.',
        variant: 'destructive',
      });
      return;
    }

    if (reasonChoice === 'other' && !otherReason.trim()) {
      toast({
        title: 'Raison requise',
        description: 'Veuillez préciser la raison pour « Autre ».',
        variant: 'destructive',
      });
      return;
    }

    const payload: LeaveRequestPayload = {
      type: selectedType,
      dates: sortedDays,
      reason: composeLeaveReason(reasonChoice, otherReason),
      emergency: allowPastDays || emergencyMode,
      ...(adminMode && selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}),
    };
    if (isEditing) {
      updateMutation.mutate(payload);
      return;
    }
    createMutation.mutate(payload);
  };

  const dialogTitle = isEditing
    ? 'Modifier la demande'
    : adminMode
      ? 'Demande de congé (admin)'
      : 'Demander un congé';

  let dialogDescription: string;
  if (adminMode && !isEditing) {
    dialogDescription =
      'Saisissez un congé pour un employé, y compris des jours passés (congé urgent non déclaré). La demande sera approuvée immédiatement.';
  } else if (emergencyMode) {
    dialogDescription =
      'Mode urgence activé : vous pouvez sélectionner aujourd’hui, demain et les jours suivants.';
  } else if (minSelectableDate) {
    dialogDescription = `Préavis de ${MIN_LEAVE_NOTICE_DAYS} jours : première date le ${format(minSelectableDate, 'EEEE d MMMM yyyy', { locale: fr })}.`;
  } else {
    dialogDescription = 'Sélectionnez les jours de congé.';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="leave-request-dialog flex max-h-[min(90vh,48rem)] w-[min(96vw,68rem)] max-w-5xl flex-col gap-4 overflow-hidden p-6"
      >
        <div className="leave-request-header flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0 space-y-1">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </div>
          {!allowPastDays && (
            <Button
              type="button"
              size="sm"
              variant={emergencyMode ? 'destructive' : 'outline'}
              aria-pressed={emergencyMode}
              onClick={handleEmergencyToggle}
              className="shrink-0"
            >
              <Siren className="h-4 w-4" />
              Mode urgence
            </Button>
          )}
        </div>

        <div className="leave-request-grid grid min-h-0 grid-cols-1 gap-x-4 gap-y-2 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] sm:grid-rows-[auto_auto_auto_auto] sm:overflow-hidden">
          {adminMode && !isEditing && (
            <div className="space-y-1.5 sm:col-start-2 sm:row-start-1">
              <Label className="text-sm font-medium">
                Employé <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedEmployeeId || undefined}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger className="h-9" aria-required="true">
                  <SelectValue placeholder="Choisir un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className={cn(
              'space-y-1.5 sm:col-start-2',
              adminMode && !isEditing ? 'sm:row-start-2' : 'sm:row-start-1',
            )}
          >
            <Label className="text-sm font-medium">Type de congé</Label>
            <div className="grid grid-cols-2 gap-2">
              {holidayTypes.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  type="button"
                  title={description}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                    selectedType === type
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selectedType === type ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      selectedType === type ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="leave-request-calendar flex min-h-0 flex-col overflow-hidden rounded-lg border border-border sm:col-start-1 sm:row-span-2 sm:row-start-1">
            <HolidayNameByKeyContext.Provider value={holidayNameByKey}>
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={handleCalendarSelect}
                onDayClick={(day, modifiers) => {
                  if (modifiers.outside && !modifiers.disabled) {
                    setVisibleMonth(startOfDay(day));
                  }
                }}
                disabled={(day) =>
                  (adminMode && !isEditing && !selectedEmployeeId) || !isDaySelectable(day)
                }
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                {...(allowPastDays ? {} : { fromDate: today })}
                fixedWeeks
                modifiers={{
                  half: halfDates,
                  busy: busyDates,
                  conflict: conflictDates,
                  holiday: holidayDates,
                }}
                modifiersClassNames={{
                  half: 'ring-2 ring-inset ring-primary/40',
                  busy: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
                  conflict:
                    '!bg-destructive !text-destructive-foreground hover:!bg-destructive hover:!text-destructive-foreground',
                  holiday:
                    '!bg-amber-500/20 !text-amber-900 hover:!bg-amber-500/20 dark:!text-amber-200 !opacity-100 cursor-not-allowed',
                }}
                classNames={{
                  months: 'flex w-full flex-col',
                  month: 'w-full space-y-2',
                  caption: 'flex justify-center pt-1 relative items-center',
                  caption_label: 'text-base font-semibold capitalize',
                  nav_button: cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100',
                  ),
                  table: 'w-full border-collapse',
                  head_row: 'flex w-full',
                  head_cell:
                    'text-muted-foreground rounded-md flex-1 font-medium text-xs',
                  row: 'flex w-full mt-1',
                  cell: 'relative flex-1 h-9 max-h-9 p-0.5 text-center text-sm focus-within:relative focus-within:z-20',
                  day: cn(
                    buttonVariants({ variant: 'ghost' }),
                    'h-full w-full p-0 text-sm font-normal aria-selected:opacity-100',
                  ),
                  day_outside:
                    'day-outside enabled:text-foreground enabled:opacity-100 aria-selected:opacity-100',
                  day_disabled: 'text-muted-foreground opacity-50',
                }}
                components={{
                  DayContent: RequestCalendarDayContent,
                }}
                className="pointer-events-auto w-full shrink-0 p-3"
              />
            </HolidayNameByKeyContext.Provider>
            <div className="leave-request-legend relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Sélectionné</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span>Déjà demandé</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Jour férié</span>
              </span>
            </div>
          </div>

          <div
            className={cn(
              'shrink-0 space-y-1.5 sm:col-start-1',
              adminMode && !isEditing ? 'sm:row-start-4' : 'sm:row-start-3',
            )}
          >
            <Label className="text-sm font-medium">
              Raison <span className="text-destructive">*</span>
            </Label>
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  value={reasonChoice || undefined}
                  onValueChange={(value) => {
                    if (!isLeaveReasonChoice(value)) {
                      return;
                    }
                    setReasonChoice(value);
                    if (value !== 'other') {
                      setOtherReason('');
                    }
                  }}
                >
                  <SelectTrigger className="h-9" aria-required="true">
                    <SelectValue placeholder="Choisir une raison" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_REASON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reasonChoice === 'other' && (
                <Input
                  id="leave-reason-other"
                  placeholder="Précisez la raison..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  className="h-9 min-w-0 flex-1"
                  required
                  aria-required="true"
                  aria-label="Précisez la raison"
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              'leave-request-days flex min-h-0 flex-col overflow-hidden rounded-lg border border-border sm:col-start-2 sm:row-span-2',
              adminMode && !isEditing ? 'sm:row-start-3' : 'sm:row-start-2',
            )}
          >
            {hasConflicts && (
              <div
                role="alert"
                className="flex shrink-0 items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Retirez les jours déjà demandés (en rouge) pour pouvoir soumettre.</p>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sortedDays.length > 0 ? (
                <ul className="space-y-1.5 p-2">
                  {sortedDays.map((day) => {
                    const current = durationOf(day);
                    const key = toDateKey(day.date);
                    const isConflict = conflictKeys.has(key);
                    return (
                      <li
                        key={key}
                        className={cn(
                          'flex items-center gap-2 rounded-md border bg-card px-2 py-1.5',
                          isConflict
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-border',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium capitalize text-foreground">
                            {format(day.date, 'EEE d MMM', { locale: fr })}
                          </p>
                          {isConflict ? (
                            <p className="text-[11px] text-destructive">Déjà demandé</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              {current === 'full' ? '1 j' : '0,5 j'} · {durationLabel(current)}
                            </p>
                          )}
                        </div>
                        <div className="inline-flex shrink-0 rounded-md bg-secondary p-0.5">
                          {durationOptions.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setDayDuration(day.date, value)}
                              className={cn(
                                'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                                current === value
                                  ? 'bg-background text-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                              aria-pressed={current === value}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDay(day.date)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={`Retirer le ${format(day.date, 'd MMMM yyyy', { locale: fr })}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="leave-request-days-empty flex h-full min-h-[8rem] items-center justify-center px-3 text-center text-sm text-muted-foreground">
                  {adminMode && !selectedEmployeeId
                    ? 'Choisissez d’abord un employé'
                    : 'Aucun jour sélectionné'}
                </div>
              )}
            </div>
            {sortedDays.length > 0 && (
              <div className="shrink-0 border-t border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-primary">
                    {formatLeaveDuration(resolvedDays)}
                  </span>
                  {` · ${formatLeaveDates(sortedDays)}`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="leave-request-footer flex shrink-0 justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleSubmit}
            disabled={
              createMutation.isPending ||
              updateMutation.isPending ||
              hasConflicts ||
              (adminMode && !isEditing && !selectedEmployeeId)
            }
          >
            {submitButtonLabel(
              isEditing,
              createMutation.isPending || updateMutation.isPending,
              adminMode,
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
