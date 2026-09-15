import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Edit,
  Eye,
  FilePlus2,
  FolderOpen,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/api/client';
import { listUsers } from '@/api/users';
import {
  createEmployeeDocument,
  deleteEmployeeDocument,
  downloadEmployeeDocument,
  listEmployeeDocuments,
  updateEmployeeDocument,
} from '@/api/employeeDocuments';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DocumentCategory,
  EmployeeDocument,
} from '@/types/document';
import { cn } from '@/lib/utils';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.doc',
  '.docx',
]);
const MAX_BYTES = 10 * 1024 * 1024;

const documentSchema = z.object({
  employeeId: z.string().min(1, 'Sélectionnez un employé'),
  title: z.string().min(1, 'Le titre est requis'),
  category: z.enum(['payslip', 'contract', 'certificate', 'other']),
  description: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function validateFile(file: File | null, required: boolean): string | null {
  if (!file) {
    return required ? 'Un fichier est obligatoire.' : null;
  }
  const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return 'Format non autorisé. Formats acceptés : PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX.';
  }
  if (file.size > MAX_BYTES) {
    return 'Le fichier ne doit pas dépasser 10 Mo.';
  }
  return null;
}

export default function DocumentManagementPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDocument | null>(null);
  const [deleting, setDeleting] = useState<EmployeeDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ['users', 'employee'],
    queryFn: () => listUsers('employee'),
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['employee-documents', 'admin', employeeFilter, categoryFilter],
    queryFn: () =>
      listEmployeeDocuments({
        employeeId: employeeFilter === 'all' ? undefined : employeeFilter,
        category: categoryFilter,
      }),
  });

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(needle)
      || doc.description.toLowerCase().includes(needle)
      || doc.fileName.toLowerCase().includes(needle)
      || doc.employeeName.toLowerCase().includes(needle)
      || doc.employeeEmail.toLowerCase().includes(needle)
      || doc.categoryLabel.toLowerCase().includes(needle)
    );
  }, [documents, search]);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      employeeId: '',
      title: '',
      category: 'payslip',
      description: '',
    },
  });

  const employeeMap = useMemo(
    () => new Map(employees.map((user) => [user.id, user])),
    [employees],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: DocumentFormData) => {
      if (editing) {
        return updateEmployeeDocument(editing.id, {
          employeeId: values.employeeId,
          title: values.title,
          category: values.category,
          description: values.description,
          file,
        });
      }
      if (!file) {
        throw new Error('Un fichier est obligatoire.');
      }
      return createEmployeeDocument({
        employeeId: values.employeeId,
        title: values.title,
        category: values.category,
        description: values.description,
        file,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents'] });
      toast({
        title: editing ? 'Document mis à jour' : 'Document ajouté',
        description: editing
          ? 'Les modifications ont été enregistrées.'
          : 'L’employé pourra consulter ce fichier dans Mes documents.',
      });
      closeDialog();
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Une erreur est survenue.';
      toast({
        title: 'Enregistrement impossible',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployeeDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents'] });
      toast({ title: 'Document supprimé' });
      setDeleting(null);
    },
    onError: (err) => {
      toast({
        title: 'Suppression impossible',
        description: err instanceof Error ? err.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    },
  });

  function openCreate() {
    setEditing(null);
    setFile(null);
    setFileError(null);
    form.reset({
      employeeId: employeeFilter !== 'all' ? employeeFilter : '',
      title: '',
      category: 'payslip',
      description: '',
    });
    setDialogOpen(true);
  }

  function openEdit(doc: EmployeeDocument) {
    setEditing(doc);
    setFile(null);
    setFileError(null);
    form.reset({
      employeeId: doc.employeeId,
      title: doc.title,
      category: doc.category,
      description: doc.description,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setFile(null);
    setFileError(null);
    form.reset();
  }

  function onFileChange(next: File | null) {
    setFile(next);
    setFileError(validateFile(next, !editing));
  }

  function onSubmit(values: DocumentFormData) {
    const error = validateFile(file, !editing);
    setFileError(error);
    if (error) return;
    saveMutation.mutate(values);
  }

  async function handleDownload(doc: EmployeeDocument, inline: boolean) {
    setBusyId(doc.id);
    try {
      await downloadEmployeeDocument(doc, { inline });
    } catch (err) {
      toast({
        title: inline ? 'Ouverture impossible' : 'Téléchargement impossible',
        description: err instanceof Error ? err.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Documents employés
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Déposez, modifiez ou retirez les fichiers RH d’un employé. Chaque employé
            ne voit que ses propres documents.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <FilePlus2 className="w-4 h-4 mr-2" />
          Ajouter un document
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (titre, employé, fichier…)"
            className="pl-9"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Employé" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {employees.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value as DocumentCategory | 'all')}
        >
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {DOCUMENT_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Catégorie</TableHead>
              <TableHead className="hidden lg:table-cell">Ajouté le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12">
                  <div className="text-center">
                    <FolderOpen className="w-9 h-9 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium">Aucun document</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ajoutez une fiche de paie ou un autre fichier pour un employé.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => {
                const user = employeeMap.get(doc.employeeId);
                const busy = busyId === doc.id;
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user?.avatar} />
                          <AvatarFallback>{initials(doc.employeeName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.employeeName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.employeeEmail || user?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                        {doc.fileName}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-normal">
                        {doc.categoryLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(doc.createdAt, 'd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          title="Voir"
                          onClick={() => handleDownload(doc, true)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          title="Télécharger"
                          onClick={() => handleDownload(doc, false)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Modifier"
                          onClick={() => openEdit(doc)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="Supprimer"
                          onClick={() => setDeleting(doc)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifier le document' : 'Ajouter un document'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Mettez à jour les informations ou remplacez le fichier.'
                : 'Le fichier sera visible uniquement par l’employé sélectionné.'}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label>Employé</Label>
              <Select
                value={form.watch('employeeId')}
                onValueChange={(value) => form.setValue('employeeId', value, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.employeeId ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.employeeId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-title">Titre</Label>
              <Input
                id="doc-title"
                placeholder="Ex. Fiche de paie — Août 2026"
                {...form.register('title')}
              />
              {form.formState.errors.title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(value) =>
                  form.setValue('category', value as DocumentCategory, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {DOCUMENT_CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-description">Description (optionnel)</Label>
              <Textarea
                id="doc-description"
                rows={3}
                placeholder="Précision visible par l’employé…"
                {...form.register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label>Fichier {editing ? '(remplacer)' : ''}</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-full rounded-lg border border-dashed px-4 py-6 text-left transition-colors',
                  'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  fileError ? 'border-destructive/60' : 'border-border',
                )}
              >
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {file
                        ? file.name
                        : editing
                          ? `Fichier actuel : ${editing.fileName}`
                          : 'Choisir un fichier'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, images ou Word — 10 Mo max
                      {editing && !file ? ' · laissez vide pour conserver le fichier' : ''}
                    </p>
                  </div>
                </div>
              </button>
              {fileError ? (
                <p className="text-sm text-destructive">{fileError}</p>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? 'Enregistrement…'
                  : editing
                    ? 'Enregistrer'
                    : 'Déposer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.title} » sera retiré définitivement de l’espace de{' '}
              {deleting?.employeeName}. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
