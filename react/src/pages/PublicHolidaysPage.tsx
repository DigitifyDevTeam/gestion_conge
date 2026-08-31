import { useState } from 'react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Flag, Sparkles, Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  createPublicHoliday,
  deletePublicHoliday,
  listPublicHolidays,
  PublicHolidayWithId,
  updatePublicHoliday,
} from '@/api/publicHolidays';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';
import { cn } from '@/lib/utils';

export default function PublicHolidaysPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: holidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: listPublicHolidays,
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHolidayWithId | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<PublicHolidayWithId | null>(null);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', isReligious: false });

  const currentYear = new Date().getFullYear();

  const sortByDate = (a: PublicHolidayWithId, b: PublicHolidayWithId) =>
    new Date(a.date).getTime() - new Date(b.date).getTime();

  const upcomingHolidays = holidays
    .filter(h => isFuture(new Date(h.date)) || isToday(new Date(h.date)))
    .sort(sortByDate);

  const pastHolidays = holidays
    .filter(h => isPast(new Date(h.date)) && !isToday(new Date(h.date)))
    .sort(sortByDate);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['public-holidays'] });

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs.', variant: 'destructive' });
      return;
    }
    try {
      await createPublicHoliday({
        name: newHoliday.name,
        date: new Date(newHoliday.date),
        isReligious: newHoliday.isReligious,
      });
      invalidate();
      setNewHoliday({ name: '', date: '', isReligious: false });
      setIsAddDialogOpen(false);
      toast({ title: 'Jour férié ajouté', description: `${newHoliday.name} a été ajouté avec succès.` });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Ajout impossible.',
        variant: 'destructive',
      });
    }
  };

  const handleEditHoliday = (holiday: PublicHolidayWithId) => {
    setEditingHoliday(holiday);
  };

  const handleSaveEdit = async () => {
    if (!editingHoliday) return;
    try {
      await updatePublicHoliday(editingHoliday.id, {
        name: editingHoliday.name,
        date: new Date(editingHoliday.date),
        isReligious: !!editingHoliday.isReligious,
      });
      invalidate();
      setEditingHoliday(null);
      toast({ title: 'Jour férié modifié', description: 'Les modifications ont été enregistrées.' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Modification impossible.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deletingHoliday) return;
    try {
      await deletePublicHoliday(deletingHoliday.id);
      invalidate();
      toast({
        title: 'Jour férié supprimé',
        description: `${deletingHoliday.name} a été supprimé.`,
        variant: 'destructive',
      });
      setDeletingHoliday(null);
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Suppression impossible.',
        variant: 'destructive',
      });
    }
  };

  const getHolidayStatus = (holiday: PublicHolidayWithId) => {
    const holidayDate = new Date(holiday.date);
    if (isToday(holidayDate)) return 'today';
    if (isFuture(holidayDate)) return 'upcoming';
    return 'past';
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-toolbar flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jours fériés</h1>
          <p className="text-muted-foreground mt-1">Liste des jours fériés officiels tunisiens pour {currentYear}</p>
        </div>
        {isAdmin() && (
          <Button variant="gradient" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un jour férié
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Total des jours fériés</p>
          <p className="text-2xl font-bold text-foreground mt-1">{holidays.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">À venir</p>
          <p className="text-2xl font-bold text-primary mt-1">{upcomingHolidays.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Passés</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{pastHolidays.length}</p>
        </div>
      </div>

      {/* Upcoming Holidays */}
      {upcomingHolidays.length > 0 && (
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Jours fériés à venir</h2>
          </div>
          
          <div className="space-y-3">
            {upcomingHolidays.map((holiday, index) => {
              const status = getHolidayStatus(holiday);
              const daysUntil = getDaysUntil(new Date(holiday.date));
              const isTodayHoliday = isToday(new Date(holiday.date));
              
              return (
                <div
                  key={holiday.id}
                  className={cn(
                    "bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in",
                    isTodayHoliday && "border-primary border-2 bg-primary/5"
                  )}
                  style={{ animationDelay: `${(index + 3) * 100}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0",
                        isTodayHoliday ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      )}>
                        <span className="text-xs font-medium">
                          {format(new Date(holiday.date), 'MMM', { locale: fr })}
                        </span>
                        <span className="text-lg font-bold">
                          {format(new Date(holiday.date), 'd', { locale: fr })}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground text-lg">{holiday.name}</h3>
                          {isTodayHoliday && (
                            <Badge variant="default" className="bg-primary">
                              Aujourd'hui
                            </Badge>
                          )}
                          {status === 'upcoming' && !isTodayHoliday && (
                            <Badge variant="outline" className="text-primary border-primary">
                              Dans {daysUntil} jour{daysUntil > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(holiday.date), 'EEEE d MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {holiday.isReligious ? (
                        <Sparkles className="w-5 h-5 text-warning" />
                      ) : (
                        <Flag className="w-5 h-5 text-primary" />
                      )}
                      {isAdmin() && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditHoliday(holiday)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeletingHoliday(holiday)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Holidays */}
      {pastHolidays.length > 0 && (
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Jours fériés passés</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastHolidays.map((holiday, index) => (
              <div
                key={holiday.id}
                className="bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in opacity-60"
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {format(new Date(holiday.date), 'MMM', { locale: fr })}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground">
                      {format(new Date(holiday.date), 'd', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm truncate">{holiday.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(holiday.date), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un jour férié</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau jour férié au calendrier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Nom</Label>
              <Input
                id="holiday-name"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="Nom du jour férié"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-religious"
                checked={newHoliday.isReligious}
                onCheckedChange={(checked) =>
                  setNewHoliday({ ...newHoliday, isReligious: checked as boolean })
                }
              />
              <Label htmlFor="is-religious" className="cursor-pointer">
                Fête religieuse
              </Label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddHoliday}>
                <Save className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Dialog */}
      <Dialog open={!!editingHoliday} onOpenChange={() => setEditingHoliday(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le jour férié</DialogTitle>
            <DialogDescription>
              Modifiez les informations du jour férié
            </DialogDescription>
          </DialogHeader>
          {editingHoliday && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={editingHoliday.name}
                  onChange={(e) =>
                    setEditingHoliday({ ...editingHoliday, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={format(new Date(editingHoliday.date), 'yyyy-MM-dd')}
                  onChange={(e) =>
                    setEditingHoliday({
                      ...editingHoliday,
                      date: new Date(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is-religious"
                  checked={editingHoliday.isReligious}
                  onCheckedChange={(checked) =>
                    setEditingHoliday({
                      ...editingHoliday,
                      isReligious: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="edit-is-religious" className="cursor-pointer">
                  Fête religieuse
                </Label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingHoliday(null)}>
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingHoliday} onOpenChange={(open) => !open && setDeletingHoliday(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement le jour férié{' '}
              <strong>{deletingHoliday?.name}</strong> du calendrier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHoliday}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

