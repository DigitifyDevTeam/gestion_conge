import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Download, Eye, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { listLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '@/api/leaveRequests';
import { listUsers } from '@/api/users';
import { listPublicHolidays } from '@/api/publicHolidays';
import { HolidayRequest, RequestStatus, HolidayType } from '@/types/holiday';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';
import {
  formatLeaveDates,
  formatLeaveDuration,
  formatLeaveDurationCompact,
  halfDayPeriodLabel,
} from '@/lib/leave';
import { downloadLeavePlanningExcel } from '@/lib/exportLeavePlanning';

const typeLabels: Record<HolidayType, string> = {
  annual: 'Congés annuels',
  sick: 'Congés maladie',
  personal: 'Jour personnel',
  unpaid: 'Congés sans solde',
};

const statusLabels: Record<RequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

export default function AllRequestsPage() {
  const queryClient = useQueryClient();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | null>(null);
  const [comment, setComment] = useState('');

  const filteredRequests = allRequests.filter(request => {
    if (searchQuery && !request.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    if (typeFilter !== 'all' && request.type !== typeFilter) return false;
    return true;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      approveLeaveRequest(id, comment),
    onSuccess: (_data, vars) => {
      invalidate();
      const req = allRequests.find((request) => request.id === vars.id);
      toast({
        title: 'Demande approuvée',
        description: req
          ? `La demande de ${typeLabels[req.type].toLowerCase()} de ${req.employeeName} a été approuvée.`
          : 'Demande approuvée.',
      });
      setSelectedRequest(null);
      setComment('');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : "Échec de l'approbation.",
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      rejectLeaveRequest(id, comment),
    onSuccess: (_data, vars) => {
      invalidate();
      const req = allRequests.find((request) => request.id === vars.id);
      toast({
        title: 'Demande refusée',
        description: req
          ? `La demande de ${typeLabels[req.type].toLowerCase()} de ${req.employeeName} a été refusée.`
          : 'Demande refusée.',
      });
      setSelectedRequest(null);
      setComment('');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Échec du refus.',
        variant: 'destructive',
      });
    },
  });

  const isReviewPending = approveMutation.isPending || rejectMutation.isPending;

  const handleExport = async () => {
    const year = new Date().getFullYear();
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
          <h1 className="text-2xl font-bold text-foreground">Toutes les demandes</h1>
          <p className="text-muted-foreground mt-1">Gérez toutes les demandes de congés</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Export...' : 'Exporter le planning'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom d'employé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvé</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="annual">Congés annuels</SelectItem>
              <SelectItem value="unpaid">Congés sans solde</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground mt-1">{allRequests.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">En attente</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {allRequests.filter(r => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Approuvées</p>
          <p className="text-2xl font-bold text-success mt-1">
            {allRequests.filter(r => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Rejetées</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {allRequests.filter(r => r.status === 'rejected').length}
          </p>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-card rounded-xl border border-border shadow-card animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Jours</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de soumission</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={request.employeeAvatar} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {getInitials(request.employeeName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{request.employeeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">{typeLabels[request.type]}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatLeaveDates(request.dates, true)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">{formatLeaveDurationCompact(request.days, request.halfDayPeriod)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={request.status}>
                          {statusLabels[request.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(request.createdAt), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Voir"
                            aria-label="Voir"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {request.status === 'pending' && (
                            <>
                              <Button
                                variant="success"
                                size="icon"
                                className="h-8 w-8"
                                title="Approuver"
                                aria-label="Approuver"
                                disabled={isReviewPending}
                                onClick={() =>
                                  approveMutation.mutate({ id: request.id, comment: '' })
                                }
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                title="Refuser"
                                aria-label="Refuser"
                                disabled={isReviewPending}
                                onClick={() =>
                                  rejectMutation.mutate({ id: request.id, comment: '' })
                                }
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune demande trouvée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Request Details Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={() => {
          setSelectedRequest(null);
          setComment('');
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la demande</DialogTitle>
            <DialogDescription>
              Informations complètes sur la demande de congé
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={selectedRequest.employeeAvatar} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {getInitials(selectedRequest.employeeName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{selectedRequest.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[selectedRequest.type]}</p>
                </div>
                <Badge variant={selectedRequest.status} className="ml-auto">
                  {statusLabels[selectedRequest.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">Jours demandés</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRequest.dates.map((entry) => (
                      <span
                        key={entry.date.toISOString()}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {format(new Date(entry.date), 'EEE d MMM yyyy', { locale: fr })}
                        {entry.halfDayPeriod
                          ? ` · ${halfDayPeriodLabel(entry.halfDayPeriod)}`
                          : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Nombre de jours</p>
                  <p className="font-medium text-foreground">{formatLeaveDuration(selectedRequest.days, selectedRequest.halfDayPeriod)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date de soumission</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(selectedRequest.createdAt), 'd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Raison</p>
                  <p className="text-foreground bg-secondary/50 p-3 rounded-lg">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}

              {selectedRequest.reviewedBy && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Examen</p>
                  <div className="flex items-center gap-2">
                    {selectedRequest.status === 'approved' ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <X className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-sm text-foreground">
                      {selectedRequest.status === 'approved' ? 'Approuvé' : 'Refusé'} par{' '}
                      <strong>{selectedRequest.reviewedBy}</strong>
                      {selectedRequest.reviewedAt && (
                        <> le {format(new Date(selectedRequest.reviewedAt), 'd MMMM yyyy', { locale: fr })}</>
                      )}
                    </span>
                  </div>
                  {selectedRequest.reviewComment && (
                    <p className="text-sm text-muted-foreground mt-2 bg-secondary/50 p-3 rounded-lg">
                      {selectedRequest.reviewComment}
                    </p>
                  )}
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <Textarea
                    placeholder="Ajouter un commentaire (optionnel)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="destructive"
                      disabled={isReviewPending}
                      onClick={() =>
                        rejectMutation.mutate({ id: selectedRequest.id, comment })
                      }
                    >
                      <X className="w-4 h-4 mr-2" />
                      Refuser
                    </Button>
                    <Button
                      variant="success"
                      disabled={isReviewPending}
                      onClick={() =>
                        approveMutation.mutate({ id: selectedRequest.id, comment })
                      }
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approuver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

