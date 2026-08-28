import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Filter, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NewRequestDialog } from '@/components/requests/NewRequestDialog';
import {
  approveLeaveRequest,
  deleteLeaveRequest,
  listLeaveRequests,
  rejectLeaveRequest,
} from '@/api/leaveRequests';
import { HolidayRequest, HolidayType } from '@/types/holiday';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatLeaveDates, formatLeaveDuration } from '@/lib/leave';

const typeLabels: Record<HolidayType, string> = {
  annual: 'Congés annuels',
  sick: 'Congés maladie',
  personal: 'Jour personnel',
  unpaid: 'Congés sans solde',
};

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [editingRequest, setEditingRequest] = useState<HolidayRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<HolidayRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | null>(null);
  const [comment, setComment] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => listLeaveRequests(),
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ['leave-requests', 'pending'],
    queryFn: () => listLeaveRequests('pending'),
    enabled: isAdmin(),
  });

  const pendingToReview = isAdmin()
    ? approvals.filter((request) => request.employeeId !== user?.id)
    : [];
  const pendingToReviewIds = new Set(pendingToReview.map((request) => request.id));

  const filteredRequests = requests.filter((request) => {
    if (pendingToReviewIds.has(request.id)) return false;
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    if (typeFilter !== 'all' && request.type !== typeFilter) return false;
    return true;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['team'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLeaveRequest(id),
    onSuccess: (_data, id) => {
      invalidate();
      const req = requests.find((request) => request.id === id);
      toast({
        title: 'Demande supprimée',
        description: req
          ? `Votre demande de ${typeLabels[req.type].toLowerCase()} a été annulée.`
          : 'La demande en attente a été supprimée.',
      });
      setDeletingRequest(null);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible de supprimer la demande.',
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      approveLeaveRequest(id, comment),
    onSuccess: (_data, vars) => {
      invalidate();
      const req = approvals.find((a) => a.id === vars.id);
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
      const req = approvals.find((a) => a.id === vars.id);
      toast({
        title: 'Demande rejetée',
        description: req
          ? `La demande de ${typeLabels[req.type].toLowerCase()} de ${req.employeeName} a été rejetée.`
          : 'Demande rejetée.',
        variant: 'destructive',
      });
      setSelectedRequest(null);
      setComment('');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Échec du rejet.',
        variant: 'destructive',
      });
    },
  });

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes demandes</h1>
          <p className="text-muted-foreground mt-1">
            Consultez vos demandes de congés et examinez celles en attente d'approbation
          </p>
        </div>
        {!isAdmin() && (
          <Button variant="gradient" onClick={() => setShowNewRequest(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle demande
          </Button>
        )}
      </div>

      {pendingToReview.length > 0 && (
        <section className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Demandes à approuver</h2>
            <div className="bg-warning/10 text-warning px-4 py-2 rounded-lg">
              <span className="font-semibold">{pendingToReview.length}</span> demande
              {pendingToReview.length > 1 ? 's' : ''} en attente
            </div>
          </div>

          <div className="space-y-4">
            {pendingToReview.map((request, index) => (
              <div
                key={request.id}
                className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${(index + 2) * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.employeeAvatar} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(request.employeeName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-foreground">{request.employeeName}</h3>
                      <Badge variant="pending">En attente</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-2">
                      {typeLabels[request.type]}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatLeaveDates(request.dates, true)}</span>
                      <span>•</span>
                      <span>
                        {formatLeaveDuration(request.days, request.halfDayPeriod)}
                      </span>
                    </div>
                    {request.reason && (
                      <p className="mt-2 text-sm text-foreground bg-secondary/50 px-3 py-2 rounded-lg">
                        "{request.reason}"
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Soumis le{' '}
                      {format(new Date(request.createdAt), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="success"
                      size="icon"
                      onClick={() => approveMutation.mutate({ id: request.id, comment })}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => rejectMutation.mutate({ id: request.id, comment })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
        {pendingToReview.length > 0 && (
          <h2 className="text-lg font-semibold text-foreground">
            {isAdmin() ? 'Toutes les demandes' : 'Mes demandes'}
          </h2>
        )}

        <div className="flex items-center gap-3">
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

        <div className="space-y-3">
          {isLoading && (
            <p className="text-muted-foreground text-sm">Chargement des demandes...</p>
          )}
          {filteredRequests.map((request, index) => (
            <div
              key={request.id}
              className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${(index + 2) * 100}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {isAdmin() && (
                      <span className="text-sm text-muted-foreground">{request.employeeName}</span>
                    )}
                    <h3 className="font-semibold text-foreground">
                      {typeLabels[request.type]}
                    </h3>
                    <Badge variant={request.status}>
                      {request.status === 'pending'
                        ? 'En attente'
                        : request.status === 'approved'
                          ? 'Approuvé'
                          : 'Rejeté'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatLeaveDates(request.dates, true)}</span>
                    <span>•</span>
                    <span>
                      {formatLeaveDuration(request.days, request.halfDayPeriod)}
                    </span>
                  </div>
                  {request.reason && (
                    <p className="mt-2 text-sm text-foreground">{request.reason}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Soumis le</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(request.createdAt), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  {request.status === 'pending' && request.employeeId === user?.id && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRequest(request)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingRequest(request)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {request.reviewedBy && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {request.status === 'approved' ? 'Approuvé' : 'Examiné'} par{' '}
                    <span className="font-medium text-foreground">{request.reviewedBy}</span>{' '}
                    le{' '}
                    {format(new Date(request.reviewedAt!), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}
            </div>
          ))}

          {!isLoading && filteredRequests.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <p className="text-muted-foreground">
                Aucune demande trouvée correspondant à vos filtres
              </p>
            </div>
          )}
        </div>
      </section>

      <NewRequestDialog
        open={showNewRequest || !!editingRequest}
        requestToEdit={editingRequest}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewRequest(false);
            setEditingRequest(null);
          }
        }}
      />

      <Dialog
        open={!!selectedRequest}
        onOpenChange={() => {
          setSelectedRequest(null);
          setComment('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Examiner la demande</DialogTitle>
            <DialogDescription>
              Ajoutez un commentaire avant d'approuver ou de rejeter cette demande
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="font-medium text-foreground">{selectedRequest.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabels[selectedRequest.type]} • {formatLeaveDuration(selectedRequest.days, selectedRequest.halfDayPeriod)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatLeaveDates(selectedRequest.dates, true)}
                </p>
              </div>

              <Textarea
                placeholder="Ajouter un commentaire (optionnel)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />

              <div className="flex justify-end gap-3">
                <Button
                  variant="destructive"
                  onClick={() =>
                    rejectMutation.mutate({ id: selectedRequest.id, comment })
                  }
                >
                  <X className="w-4 h-4 mr-2" />
                  Rejeter
                </Button>
                <Button
                  variant="success"
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
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deletingRequest}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setDeletingRequest(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRequest
                ? `Votre demande de ${typeLabels[deletingRequest.type].toLowerCase()} (${formatLeaveDates(deletingRequest.dates, true)}) sera annulée. Les jours reviendront dans votre solde.`
                : 'Cette demande en attente sera annulée.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deletingRequest) {
                  return;
                }
                deleteMutation.mutate(deletingRequest.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
