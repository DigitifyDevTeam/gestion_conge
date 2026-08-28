import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Edit, Save, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { formatLeaveDaysNumber } from '@/lib/leave';
import { listAllBalances, updateBalance, setAnnualAllocationForAll, BalanceWithId } from '@/api/leaveBalances';
import { ApiError } from '@/api/client';

type ManagedLeaveType = 'annual' | 'unpaid';

const typeLabels: Record<ManagedLeaveType, string> = {
  annual: 'Congés annuels',
  unpaid: 'Congés sans solde',
};

function formatUsedDays(value: number): string {
  const n = Number(value);
  if (Number.isInteger(n)) {
    return String(n).padStart(2, '0');
  }
  return formatLeaveDaysNumber(n);
}

function BalanceTypeCell({
  remaining,
  total,
  used,
  pending,
  onEdit,
}: Readonly<{
  remaining: number;
  total: number;
  used: number;
  pending: number;
  onEdit: () => void;
}>) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {formatUsedDays(used)}/{formatLeaveDaysNumber(total)}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
          <Edit className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex gap-1 text-xs text-muted-foreground">
        <span>Restant: {formatLeaveDaysNumber(remaining)}</span>
        <span>•</span>
        <span>En attente: {formatLeaveDaysNumber(pending)}</span>
      </div>
    </div>
  );
}

export default function BalanceManagementPage() {
  const queryClient = useQueryClient();
  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances', 'all'],
    queryFn: listAllBalances,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    userId: string;
    type: ManagedLeaveType;
    balanceId: number;
    currentTotal: number;
  } | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState<string>('');
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationValue, setAllocationValue] = useState('18');

  const filteredBalances = balances.filter(emp =>
    emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const patchMutation = useMutation({
    mutationFn: ({ id, total }: { id: number; total: number }) => updateBalance(id, { total }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({ title: 'Solde mis à jour', description: 'Le solde a été enregistré.' });
      setAdjustmentDialog(null);
      setAdjustmentValue('');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Mise à jour impossible.',
        variant: 'destructive',
      });
    },
  });

  const findBalance = (userId: string, type: ManagedLeaveType): BalanceWithId | undefined => {
    return balances.find(e => e.userId === userId)?.balances.find(b => b.type === type);
  };

  const handleAdjustBalance = () => {
    if (!adjustmentDialog || !adjustmentValue) return;
    const value = parseInt(adjustmentValue);
    if (isNaN(value)) {
      toast({ title: 'Erreur', description: 'Veuillez entrer un nombre valide.', variant: 'destructive' });
      return;
    }
    const newTotal = Math.max(0, adjustmentDialog.currentTotal + value);
    patchMutation.mutate({ id: adjustmentDialog.balanceId, total: newTotal });
  };

  const allocationMutation = useMutation({
    mutationFn: (total: number) => setAnnualAllocationForAll(total),
    onSuccess: (_, total) => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({
        title: 'Allocation définie',
        description: `L'allocation annuelle de ${total} jour${total === 1 ? '' : 's'} a été appliquée à tous les employés.`,
      });
      setAllocationDialogOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Mise à jour impossible.',
        variant: 'destructive',
      });
    },
  });

  const openAllocationDialog = () => {
    const sample = balances.find((emp) => emp.balances.some((b) => b.type === 'annual'));
    const current = sample?.balances.find((b) => b.type === 'annual')?.total;
    setAllocationValue(current != null ? String(current) : '18');
    setAllocationDialogOpen(true);
  };

  const handleSetAnnualAllocation = () => {
    const value = Number(allocationValue);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: 'Erreur', description: 'Veuillez entrer un nombre valide.', variant: 'destructive' });
      return;
    }
    allocationMutation.mutate(value);
  };

  const openAdjust = (userId: string, type: ManagedLeaveType) => {
    const bal = findBalance(userId, type);
    if (!bal) return;
    setAdjustmentDialog({
      userId,
      type,
      balanceId: bal.id,
      currentTotal: bal.total,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des soldes</h1>
          <p className="text-muted-foreground mt-1">Ajustez les soldes de congés des employés</p>
        </div>
        <Button variant="outline" onClick={openAllocationDialog}>
          Définir allocation
        </Button>
      </div>

      <div className="relative max-w-md animate-fade-in" style={{ animationDelay: '100ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un employé..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Congés annuels</TableHead>
                  <TableHead>Congés sans solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalances.length > 0 ? (
                  filteredBalances.map((emp) => {
                    const annualBalance = emp.balances.find(b => b.type === 'annual');
                    const unpaidBalance = emp.balances.find(b => b.type === 'unpaid');

                    return (
                      <TableRow key={emp.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={emp.avatar} />
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {getInitials(emp.employeeName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{emp.employeeName}</p>
                              <p className="text-xs text-muted-foreground">{emp.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BalanceTypeCell
                            remaining={annualBalance?.remaining || 0}
                            total={annualBalance?.total || 0}
                            used={annualBalance?.used || 0}
                            pending={annualBalance?.pending || 0}
                            onEdit={() => openAdjust(emp.userId, 'annual')}
                          />
                        </TableCell>
                        <TableCell>
                          <BalanceTypeCell
                            remaining={unpaidBalance?.remaining || 0}
                            total={unpaidBalance?.total || 0}
                            used={unpaidBalance?.used || 0}
                            pending={unpaidBalance?.pending || 0}
                            onEdit={() => openAdjust(emp.userId, 'unpaid')}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Aucun employé trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Définir l'allocation annuelle</DialogTitle>
            <DialogDescription>
              Cette valeur sera appliquée à l'allocation annuelle de tous les employés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allocation">Allocation annuelle (jours)</Label>
              <Input
                id="allocation"
                type="number"
                min={0}
                step={0.5}
                value={allocationValue}
                onChange={(e) => setAllocationValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setAllocationDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSetAnnualAllocation} disabled={allocationMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Appliquer à tous
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustmentDialog} onOpenChange={() => setAdjustmentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le solde</DialogTitle>
            <DialogDescription>
              Ajustez le solde de {adjustmentDialog && typeLabels[adjustmentDialog.type]} pour cet employé
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjustment">Ajustement (jours)</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = parseInt(adjustmentValue) || 0;
                    setAdjustmentValue((current - 1).toString());
                  }}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  id="adjustment"
                  type="number"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  placeholder="0"
                  className="text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = parseInt(adjustmentValue) || 0;
                    setAdjustmentValue((current + 1).toString());
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Entrez un nombre positif pour ajouter, négatif pour soustraire
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAdjustmentDialog(null);
                  setAdjustmentValue('');
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleAdjustBalance} disabled={patchMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
