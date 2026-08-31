import { useState } from 'react';
import { useForm, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Edit, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { User, UserRole } from '@/types/auth';
import { createUser, deleteUser, listUsers, updateUser } from '@/api/users';
import { ApiError } from '@/api/client';

const userSchema = z
  .object({
    name: z.string().min(1, 'Le nom est requis'),
    email: z.string().email('Email invalide'),
    role: z.enum(['employee', 'admin', 'comptable']),
    department: z.string(),
    position: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'comptable') {
      return;
    }
    if (!data.department.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le département est requis',
        path: ['department'],
      });
    }
    if (!data.position.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le poste est requis',
        path: ['position'],
      });
    }
  });

type UserFormData = z.infer<typeof userSchema>;

const USER_FORM_FIELDS = ['name', 'email', 'role', 'department', 'position'] as const;

function applyApiFieldErrors(err: unknown, setError: UseFormSetError<UserFormData>): boolean {
  if (!(err instanceof ApiError) || !err.data || typeof err.data !== 'object') {
    return false;
  }

  const data = err.data as Record<string, unknown>;
  let applied = false;

  for (const key of USER_FORM_FIELDS) {
    const value = data[key];
    if (value === undefined) continue;

    const message = Array.isArray(value) ? String(value[0]) : String(value);
    setError(key, { message });
    applied = true;
  }

  return applied;
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'comptable':
      return 'Comptable';
    case 'employee':
      return 'Employé';
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

function roleBadgeVariant(role: UserRole): 'default' | 'outline' | 'secondary' {
  switch (role) {
    case 'admin':
      return 'default';
    case 'comptable':
      return 'secondary';
    case 'employee':
      return 'outline';
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'employee',
    },
  });

  const role = watch('role');

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast({
        title: user.role === 'comptable' ? 'Comptable ajouté' : 'Utilisateur autorisé',
        description:
          user.role === 'comptable'
            ? `${user.email} recevra le rapport mensuel des congés par e-mail.`
            : `Une invitation avec lien d'activation a été envoyée à ${user.email}.`,
      });
      setIsCreateDialogOpen(false);
      reset();
    },
    onError: (err: unknown) => {
      if (applyApiFieldErrors(err, setError)) return;
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Création impossible.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserFormData }) => updateUser(id, data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Utilisateur mis à jour', description: `${user.name} a été mis à jour avec succès.` });
      setEditingUser(null);
      reset();
    },
    onError: (err: unknown) => {
      if (applyApiFieldErrors(err, setError)) return;
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Mise à jour impossible.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Utilisateur supprimé',
        description: `${deletingUser?.name} a été supprimé.`,
        variant: 'destructive',
      });
      setDeletingUser(null);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Suppression impossible.',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = (data: UserFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setValue('name', user.name);
    setValue('email', user.email);
    setValue('role', user.role);
    setValue('department', user.department || '');
    setValue('position', user.position || '');
  };

  const handleUpdate = (data: UserFormData) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    }
  };

  const handleDelete = () => {
    if (deletingUser) {
      deleteMutation.mutate(deletingUser.id);
    }
  };

  const openCreateDialog = () => {
    reset();
    setIsCreateDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingUser(null);
    reset();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-toolbar flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            Autorisez des e-mails : l&apos;utilisateur reçoit une invitation et se connecte avec son mot de passe
          </p>
        </div>
        <Button variant="gradient" onClick={openCreateDialog}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md animate-fade-in" style={{ animationDelay: '100ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou département..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-xl border border-border shadow-card animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>{user.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(user.role)}>
                          {roleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
            <DialogDescription>
              {role === 'comptable'
                ? 'Le comptable recevra un rapport mensuel par e-mail. Il ne se connecte pas à l\'application.'
                : 'La personne recevra un e-mail avec un lien d\'activation pour choisir son mot de passe.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={role} onValueChange={(value) => setValue('role', value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="comptable">Comptable</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>
            {role !== 'comptable' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="department">Département</Label>
                  <Input id="department" {...register('department')} />
                  {errors.department && (
                    <p className="text-sm text-destructive">{errors.department.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Poste</Label>
                  <Input id="position" {...register('position')} />
                  {errors.position && (
                    <p className="text-sm text-destructive">{errors.position.message}</p>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={closeEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet</Label>
              <Input id="edit-name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rôle</Label>
              <Select value={role} onValueChange={(value) => setValue('role', value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="comptable">Comptable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== 'comptable' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Département</Label>
                  <Input id="edit-department" {...register('department')} />
                  {errors.department && (
                    <p className="text-sm text-destructive">{errors.department.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Poste</Label>
                  <Input id="edit-position" {...register('position')} />
                  {errors.position && (
                    <p className="text-sm text-destructive">{errors.position.message}</p>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
              >
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée. Cela supprimera définitivement l'utilisateur{' '}
              <strong>{deletingUser?.name}</strong> du système.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

